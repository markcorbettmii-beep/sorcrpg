import { Hono } from 'hono';
import { cors } from 'hono/cors';
import * as bcrypt from 'bcryptjs';

// ─── CONTENT FILTER ─────────────────────────────────────────────────────────
// Ported from sorc-app (2026-08-24) — needed by the lobby/room chat routes below.
const SLUR_LIST = [
  'nigger','nigga','faggot','fag','kike','spic','chink','gook','wetback',
  'tranny','shemale','cunt','dyke','cracker','redskin','raghead','towelhead',
  'beaner','zipperhead','jigaboo','porch monkey','coon','jungle bunny',
  'sandnigger','camel jockey'
];

const PROFANITY_LIST = [
  'fuck','shit','ass','bitch','bastard','damn','crap','piss','dick','cock',
  'pussy','whore','slut','jackass','asshole','bullshit','motherfucker',
  'motherfucking','fucker','fucking','shitty','dipshit','dumbass','dumbfuck',
  'horseshit','clusterfuck','shithead','fuckhead','butthead','twat',
  'wanker','tosser','bollocks','bloody hell','arse','arsehole','prick',
  'tit','tits','boob','boobs','boner','dildo','jizz','cum','cumshot',
  'blowjob','handjob','rimjob','buttfuck','butt fuck','titty','titties'
];

function filterContent(text: string): { blocked: boolean; filtered: string; reason: string } {
  if (!text) return { blocked: false, filtered: text, reason: '' };
  const lower = text.toLowerCase();
  for (const slur of SLUR_LIST) {
    const re = new RegExp('\\b' + slur.replace(/\s+/g, '\\s+') + '\\b', 'i');
    if (re.test(lower)) return { blocked: true, filtered: text, reason: 'Your message contains a slur and cannot be sent.' };
  }
  let filtered = text;
  for (const word of PROFANITY_LIST) {
    const re = new RegExp('\\b' + word + '\\b', 'gi');
    filtered = filtered.replace(re, (m: string) => '*'.repeat(m.length));
  }
  return { blocked: false, filtered, reason: '' };
}

interface Env {
  sorc_db: D1Database;
  RESEND_API_KEY: string;
  GOOGLE_CLIENT_SECRET: string;
}

const app = new Hono<{ Bindings: Env }>();

const ALLOWED_ORIGINS = new Set(['http://localhost:3000', 'https://sorcrpg.com', 'https://www.sorcrpg.com']);

// Security headers on every response
app.use('*', async (c, next) => {
  await next();
  c.header('X-Frame-Options', 'DENY');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
});

app.use('*', cors({
  origin: ['http://localhost:3000', 'https://sorcrpg.com', 'https://www.sorcrpg.com'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
}));

// Every API response must be JSON. Without this an uncaught error returns
// Hono's plain-text 500, the browser's res.json() throws, and the UI reports
// it as a connection failure - hiding the real cause.
app.onError((err: any, c: any) => {
  console.error('Unhandled error:', c.req.method, c.req.path, err?.stack || err);
  return c.json({ error: 'Server error.', details: err?.message || String(err) }, 500);
});

app.notFound((c: any) => c.json({ error: 'Not found.', path: c.req.path }, 404));

// In-memory rate limiter for auth endpoints (resets per Worker instance; good-enough for basic abuse prevention)
const authRateLimit = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string, max = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = authRateLimit.get(ip);
  if (!entry || entry.resetAt < now) {
    authRateLimit.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }
  if (entry.count >= max) return true;
  entry.count++;
  return false;
}

// CSRF: reject POST requests to auth endpoints from disallowed origins
app.use('/api/auth/*', async (c, next) => {
  if (c.req.method === 'POST') {
    const origin = c.req.header('Origin');
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    if (isRateLimited(ip)) {
      return c.json({ error: 'Too many requests. Please try again later.' }, 429);
    }
  }
  await next();
});

const authMiddleware = async (c: any, next: any) => {
  const authKey = c.req.header('X-Auth-Key');
  if (!authKey) return c.json({ error: 'Missing auth key' }, 401);
  const user = await c.env.sorc_db.prepare('SELECT * FROM users WHERE auth_key = ?').bind(authKey).first() as any;
  if (!user) return c.json({ error: 'Invalid auth key' }, 401);
  // Sessions are stamped with a 30-day expiry at signin/registration (see below).
  // Rows written before this fix have no stamp yet (auth_key_expires_at is NULL)
  // and are treated as not-yet-expired until their next fresh login re-stamps them.
  if (user.auth_key_expires_at && new Date(user.auth_key_expires_at) < new Date()) {
    return c.json({ error: 'Session expired', expired: true }, 401);
  }
  c.set('user', user);
  await next();
};

const AUTH_KEY_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, matches sorc-app's existing session length
const FELLOWSHIP_CAP = 25; // Basic members; Pro Membership is unlimited (see sorc-beyond.html's table)
const TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours, matches the verification/reset emails' own "expires in 24 hours" text

async function ensureAuthColumns(db: D1Database) {
  await db.prepare(`ALTER TABLE users ADD COLUMN auth_key_expires_at TEXT`).run().catch(() => {});
  await db.prepare(`ALTER TABLE users ADD COLUMN verification_token_created_at TEXT`).run().catch(() => {});
}

// Custom profile banner (see sorc-beyond.html's Basic vs. Pro table: "Custom
// profile banner" is Pro-exclusive, same tier as signature/website/socials).
async function ensureProfileColumns(db: D1Database) {
  await db.prepare(`ALTER TABLE users ADD COLUMN banner TEXT`).run().catch(() => {});
}

// Trigger deployment with fixed wrangler secret put syntax
app.post('/api/auth/register', async (c) => {
  const { email, username, firstName, password, confirmPassword, kidVerified } = await c.req.json();
  if (!kidVerified) return c.json({ error: 'K-ID age verification is required to create an account' }, 400);
  if (!email || !username) return c.json({ error: 'Email and username required' }, 400);
  if (email.length > 254) return c.json({ error: 'Email address too long (max 254 characters)' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'Invalid email address' }, 400);
  if (!password || !confirmPassword) return c.json({ error: 'Password required' }, 400);
  if (password !== confirmPassword) return c.json({ error: 'Passwords do not match' }, 400);
  if (password.length < 8 || password.length > 64) return c.json({ error: 'Password must be 8-64 characters' }, 400);
  if (!/[A-Z]/.test(password)) return c.json({ error: 'Password must contain at least one uppercase letter' }, 400);
  if (!/[a-z]/.test(password)) return c.json({ error: 'Password must contain at least one lowercase letter' }, 400);
  if (!/[0-9]/.test(password)) return c.json({ error: 'Password must contain at least one number' }, 400);
  if (username.length < 3 || username.length > 30) return c.json({ error: 'Username must be 3-30 characters' }, 400);
  if (!/^[a-zA-Z0-9-]+$/.test(username)) return c.json({ error: 'Username can only contain letters, numbers, and hyphens' }, 400);

  const existingUser = await c.env.sorc_db.prepare('SELECT id, verification_token, email_verified, username FROM users WHERE email = ?').bind(email).first() as any;

  // If user exists and is verified, they can't register again
  if (existingUser && existingUser.email_verified) {
    return c.json({ error: 'Email already registered' }, 400);
  }

  // If user exists and is unverified, we'll resend the email below with existing token

  // Check username uniqueness
  const usernameExists = await c.env.sorc_db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (usernameExists) return c.json({ error: 'Username already taken' }, 400);

  const authKey = crypto.randomUUID();
  const verificationToken = 'verify_' + crypto.randomUUID();
  const userId = Math.floor(Math.random() * 90000) + 10000;
  const now = new Date().toISOString();
  const uuid = crypto.randomUUID();
  const authKeyExpiresAt = new Date(Date.now() + AUTH_KEY_LIFETIME_MS).toISOString();

  try {
    await ensureAuthColumns(c.env.sorc_db);
    // Hash password using bcrypt (12 rounds = ~250ms per hash, resistant to brute force)
    const passwordHash = await bcrypt.hash(password, 12);

    let userToUse = existingUser;
    let tokenToUse = existingUser?.verification_token || verificationToken;

    // If user doesn't exist, create them
    if (!existingUser) {
      await c.env.sorc_db.prepare(`INSERT INTO users (id, email, auth_key, auth_key_expires_at, username, display_name, first_name, role, join_date, created_at, updated_at, user_id, verification_token, verification_token_created_at, email_verified, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(uuid, email, authKey, authKeyExpiresAt, username, firstName || username, firstName || '', 'CIVILIAN', now, now, now, userId, verificationToken, now, false, passwordHash).run();
      userToUse = { id: uuid, username, email };
    } else {
      // Update existing unverified user's password
      await c.env.sorc_db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(passwordHash, existingUser.id).run();
    }

    // ALWAYS send verification email
    const verificationLink = `https://sorcrpg.com/verify-email.html?token=${tokenToUse}`;
    console.log('RESEND_API_KEY exists:', !!c.env.RESEND_API_KEY);
    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${c.env.RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from: 'noreply@sorcrpg.com',
          to: email,
          subject: 'Verify Your SORC Account',
          html: `<p>Welcome to Essentia, ${userToUse.username}!</p>
<p>Please verify your email to complete account creation:</p>
<p><a href="${verificationLink}">Verify Email</a></p>
<p>Or paste this link: ${verificationLink}</p>
<p>This link expires in 24 hours.</p>`
        })
      });
      const emailData = await emailRes.json();
      if (!emailRes.ok) {
        console.error('Resend API error:', emailRes.status, JSON.stringify(emailData));
        return c.json({ error: 'Failed to send verification email', details: emailData }, 500);
      } else {
        console.log('Email sent successfully:', emailData);
      }
    } catch (emailError: any) {
      console.error('Email send failed:', emailError.message);
      return c.json({ error: 'Failed to send verification email', details: emailError.message }, 500);
    }

    const newUser = await c.env.sorc_db.prepare('SELECT id, email, username, display_name, role, community_points, created_at FROM users WHERE email = ?').bind(email).first();
    return c.json({ success: true, user: newUser, authKey, verificationToken: tokenToUse, message: 'Account created. Check your email to verify.' });
  } catch (error: any) {
    return c.json({ error: 'Registration failed', details: error.message }, 500);
  }
});

app.post('/api/auth/verify-email', async (c) => {
  const { token } = await c.req.json();
  if (!token) return c.json({ error: 'Verification token required' }, 400);
  // Reject reset tokens (which start with "reset_")
  if (token.startsWith('reset_')) return c.json({ error: 'Invalid verification token - this is a password reset link, not a verification link' }, 400);
  await ensureAuthColumns(c.env.sorc_db);
  const user = await c.env.sorc_db.prepare('SELECT id, email, verification_token_created_at FROM users WHERE verification_token = ?').bind(token).first() as any;
  if (!user) return c.json({ error: 'Invalid or expired verification token' }, 400);
  if (user.verification_token_created_at && Date.now() - new Date(user.verification_token_created_at).getTime() > TOKEN_LIFETIME_MS) {
    return c.json({ error: 'This verification link has expired. Please request a new one.' }, 400);
  }
  await c.env.sorc_db.prepare('UPDATE users SET email_verified = ?, verification_token = NULL, verification_token_created_at = NULL WHERE id = ?').bind(true, user.id).run();
  return c.json({ success: true, message: 'Email verified' });
});

app.post('/api/auth/resend-verification', async (c) => {
  const { email } = await c.req.json();
  if (!email) return c.json({ error: 'Email required' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'Invalid email address' }, 400);

  await ensureAuthColumns(c.env.sorc_db);
  const user = await c.env.sorc_db.prepare('SELECT id, email, username, verification_token, verification_token_created_at, email_verified FROM users WHERE email = ?').bind(email).first() as any;
  if (!user) return c.json({ error: 'Email not found', details: 'No account with this email' }, 404);
  if (user.email_verified) return c.json({ error: 'Account already verified', details: 'You can now sign in' }, 400);

  // Generate a fresh verification token whenever there's none, it's a reset
  // token, or the existing one has already expired - always re-stamps the
  // 24-hour clock so a resend always gives a genuinely fresh window.
  const tokenExpired = !user.verification_token_created_at
    || (Date.now() - new Date(user.verification_token_created_at).getTime() > TOKEN_LIFETIME_MS);
  if (!user.verification_token || user.verification_token.startsWith('reset_') || tokenExpired) {
    const newToken = 'verify_' + crypto.randomUUID();
    const now = new Date().toISOString();
    await c.env.sorc_db.prepare('UPDATE users SET verification_token = ?, verification_token_created_at = ? WHERE id = ?').bind(newToken, now, user.id).run();
    user.verification_token = newToken;
  }

  // Resend verification email
  const verificationLink = `https://sorcrpg.com/verify-email.html?token=${user.verification_token}`;
  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${c.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'noreply@sorcrpg.com',
        to: email,
        subject: 'Verify Your SORC Account',
        html: `<p>Welcome to Essentia, ${user.username}!</p>
<p>Please verify your email to complete account creation:</p>
<p><a href="${verificationLink}">Verify Email</a></p>
<p>Or paste this link: ${verificationLink}</p>
<p>This link expires in 24 hours.</p>`
      })
    });
    const emailData = await emailRes.json();
    if (!emailRes.ok) {
      console.error('Resend API error:', emailRes.status, JSON.stringify(emailData));
      return c.json({ error: 'Failed to send verification email', details: emailData }, 500);
    }
    console.log('Resend verification email sent:', emailData);
  } catch (emailError: any) {
    console.error('Email send failed:', emailError.message);
    return c.json({ error: 'Failed to send email', details: emailError.message }, 500);
  }

  return c.json({ success: true, message: 'Verification email sent. Check your inbox.' });
});

app.post('/api/auth/signin', async (c) => {
  const { email, username, password } = await c.req.json();
  if (!email && !username) return c.json({ error: 'Email or username required' }, 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'Invalid email address' }, 400);
  if (!password) return c.json({ error: 'Password required' }, 400);

  const user = await c.env.sorc_db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').bind(email || '', username || '').first() as any;
  if (!user) return c.json({ error: 'Invalid credentials' }, 401);
  if (!user.email_verified) return c.json({ success: false, unverified: true, error: 'Please verify your email before signing in' }, 401);

  // Check if account uses OAuth provider sign-in only (no password set)
  if (!user.password_hash) {
    return c.json({ error: 'This account does not support email/password sign-in. Please use Sign in with Google, Amazon, or Apple.' }, 401);
  }

  // Check if password reset is required (security migration from SHA-256 to bcrypt)
  if (user.password_reset_required) {
    return c.json({ success: false, passwordResetRequired: true, error: 'Password reset required. Please use the password reset link to create a new password.' }, 401);
  }

  // Verify password using bcrypt
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  await ensureAuthColumns(c.env.sorc_db);
  const authKey = crypto.randomUUID();
  const authKeyExpiresAt = new Date(Date.now() + AUTH_KEY_LIFETIME_MS).toISOString();
  await c.env.sorc_db.prepare('UPDATE users SET auth_key = ?, auth_key_expires_at = ? WHERE id = ?').bind(authKey, authKeyExpiresAt, user.id).run();
  return c.json({ success: true, user: { id: user.id, email: user.email, username: user.username, display_name: user.display_name, role: user.role, community_points: user.community_points, created_at: user.created_at }, authKey });
});

app.post('/api/auth/forgot-password', async (c) => {
  const { email } = await c.req.json();
  if (!email) return c.json({ error: 'Email required' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'Invalid email address' }, 400);

  const user = await c.env.sorc_db.prepare('SELECT id, email, username FROM users WHERE email = ?').bind(email).first() as any;
  if (!user) {
    // For security, don't reveal if email exists - just return success
    return c.json({ success: true, message: 'If that email is registered, a password reset link has been sent' });
  }

  await ensureAuthColumns(c.env.sorc_db);
  // Generate password reset token (prefixed with "reset_" to distinguish from verification_token)
  const resetToken = 'reset_' + crypto.randomUUID();
  const tokenNow = new Date().toISOString();
  await c.env.sorc_db.prepare('UPDATE users SET verification_token = ?, verification_token_created_at = ? WHERE id = ?').bind(resetToken, tokenNow, user.id).run();

  // Send password reset email
  const resetLink = `https://sorcrpg.com/reset-password.html?token=${resetToken}`;
  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${c.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'noreply@sorcrpg.com',
        to: email,
        subject: 'Reset Your SORC Account Password',
        html: `<p>Hi ${user.username},</p>
<p>We received a request to reset your password. Click the link below to set a new password:</p>
<p><a href="${resetLink}">Reset Password</a></p>
<p>Or paste this link: ${resetLink}</p>
<p>This link expires in 24 hours.</p>
<p>If you didn't request this, you can ignore this email.</p>`
      })
    });
    const emailData = await emailRes.json();
    if (!emailRes.ok) {
      console.error('Resend API error:', emailRes.status, JSON.stringify(emailData));
    }
  } catch (emailError: any) {
    console.error('Email send failed:', emailError.message);
  }

  return c.json({ success: true, message: 'If that email is registered, a password reset link has been sent' });
});

app.post('/api/auth/reset-password', async (c) => {
  const { token, password, confirmPassword } = await c.req.json();
  if (!token || !password || !confirmPassword) return c.json({ error: 'Token and new password required' }, 400);
  if (password !== confirmPassword) return c.json({ error: 'Passwords do not match' }, 400);
  if (password.length < 8 || password.length > 64) return c.json({ error: 'Password must be 8-64 characters' }, 400);
  if (!/[A-Z]/.test(password)) return c.json({ error: 'Password must contain at least one uppercase letter' }, 400);
  if (!/[a-z]/.test(password)) return c.json({ error: 'Password must contain at least one lowercase letter' }, 400);
  if (!/[0-9]/.test(password)) return c.json({ error: 'Password must contain at least one number' }, 400);

  // Check for reset token (prefixed with "reset_")
  if (!token.startsWith('reset_')) {
    return c.json({ error: 'Invalid reset link' }, 400);
  }

  await ensureAuthColumns(c.env.sorc_db);
  const user = await c.env.sorc_db.prepare('SELECT id, email, verification_token_created_at FROM users WHERE verification_token = ?').bind(token).first() as any;
  if (!user) return c.json({ error: 'Invalid or expired reset link' }, 400);
  if (user.verification_token_created_at && Date.now() - new Date(user.verification_token_created_at).getTime() > TOKEN_LIFETIME_MS) {
    return c.json({ error: 'This reset link has expired. Please request a new one.' }, 400);
  }

  // Hash new password using bcrypt
  const passwordHash = await bcrypt.hash(password, 12);

  // Rotate auth_key too: anyone who already had a copy of this account's old
  // session token (the exact scenario a reset is meant to lock out) loses it
  // the moment the password changes, not just the token that got them here.
  const newAuthKey = crypto.randomUUID();
  const newAuthKeyExpiresAt = new Date(Date.now() + AUTH_KEY_LIFETIME_MS).toISOString();

  // Update password, clear reset token, clear password_reset_required flag, rotate session
  await c.env.sorc_db.prepare('UPDATE users SET password_hash = ?, verification_token = NULL, verification_token_created_at = NULL, password_reset_required = 0, auth_key = ?, auth_key_expires_at = ? WHERE id = ?').bind(passwordHash, newAuthKey, newAuthKeyExpiresAt, user.id).run();

  return c.json({ success: true, message: 'Password reset successful. You can now sign in with your new password.' });
});

app.get('/auth/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    const errorDescription = c.req.query('error_description') || 'No description provided';
    const errorUri = c.req.query('error_uri') || 'No URI provided';
    return c.html(`
      <html>
      <head><title>Google OAuth Error</title>
      <script>
        alert('❌ SIGN-IN FAILED\\n\\nError: ${error}\\n\\nDescription: ${errorDescription}\\n\\nTap OK to return to Sign In');
      </script>
      <style>
        body { font-family: Arial, sans-serif; background: #fff; padding: 20px; }
        .error-box { background: #f8f8f8; border: 2px solid #d0d0d0; border-radius: 8px; padding: 20px; max-width: 600px; color: #333333; }
        h1 { color: #333333; margin-top: 0; }
        code { background: #f5f5f5; padding: 15px; display: block; border-left: 3px solid #d0d0d0; border-radius: 4px; overflow-x: auto; margin: 15px 0; font-family: monospace; }
        p { line-height: 1.6; }
      </style>
      </head>
      <body onload="window.location.href = '/signin.html';">
        <div class="error-box">
          <h1>⚠️ Google Sign-In Error</h1>
          <p><strong>Error Code:</strong> ${error}</p>
          <p><strong>Description:</strong> ${errorDescription}</p>
          <code>GOOGLE_OAUTH_ERROR
Error: ${error}
Description: ${errorDescription}
URI: ${errorUri}</code>
          <p><a href="/signin.html">← Back to Sign In</a></p>
        </div>
      </body>
      </html>
    `, 400);
  }

  if (!code) {
    return c.html(`
      <html>
      <head><title>Google OAuth Error</title>
      <script>
        alert('❌ SIGN-IN FAILED\\n\\nMissing authorization code from Google\\n\\nPossible causes:\\n- Redirect URI mismatch\\n- User denied permissions\\n\\nTap OK to return to Sign In');
      </script>
      <style>
        body { font-family: Arial, sans-serif; background: #fff; padding: 20px; }
        .error-box { background: #f8f8f8; border: 2px solid #d0d0d0; border-radius: 8px; padding: 20px; max-width: 600px; color: #333333; }
        h1 { color: #333333; margin-top: 0; }
        code { background: #f5f5f5; padding: 15px; display: block; border-left: 3px solid #d0d0d0; border-radius: 4px; overflow-x: auto; margin: 15px 0; font-family: monospace; }
        p { line-height: 1.6; }
      </style>
      </head>
      <body onload="window.location.href = '/signin.html';">
        <div class="error-box">
          <h1>⚠️ Google Sign-In Error</h1>
          <p><strong>Issue:</strong> Authorization code missing from Google</p>
          <code>GOOGLE_OAUTH_ERROR
Code: Missing authorization code
Status: The redirect from Google did not include an authorization code

Possible causes:
- Google OAuth configuration is incorrect
- Redirect URI mismatch
- User denied permissions</code>
          <p><a href="/signin.html">← Back to Sign In</a></p>
        </div>
      </body>
      </html>
    `, 400);
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        client_id: '303646936307-no909pqm07k8im730pirgjlo06mgp1tb.apps.googleusercontent.com',
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: 'https://api.sorcrpg.com/auth/google/callback',
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange failed - Error response:', error);
      return c.html(`
        <html>
        <head><title>Google OAuth Error</title>
        <script>
          alert('❌ SIGN-IN FAILED\\n\\nToken Exchange Error\\n\\nStatus: ${tokenResponse.status}\\n\\nTap OK to return to Sign In');
        </script>
        <style>
          body { font-family: Arial, sans-serif; background: #fff; padding: 20px; }
          .error-box { background: #f8f8f8; border: 2px solid #d0d0d0; border-radius: 8px; padding: 20px; max-width: 600px; color: #333333; }
          h1 { color: #333333; margin-top: 0; }
          code { background: #f5f5f5; padding: 15px; display: block; border-left: 3px solid #d0d0d0; border-radius: 4px; overflow-x: auto; margin: 15px 0; font-family: monospace; font-size: 0.9rem; }
          p { line-height: 1.6; }
        </style>
        </head>
        <body onload="window.location.href = '/signin.html';">
          <div class="error-box">
            <h1>⚠️ Token Exchange Failed</h1>
            <p><strong>Status:</strong> ${tokenResponse.status}</p>
            <code>GOOGLE_TOKEN_EXCHANGE_ERROR
Status: ${tokenResponse.status}
Response: ${error.substring(0, 500)}</code>
            <p><a href="/signin.html">← Back to Sign In</a></p>
          </div>
        </body>
        </html>
      `, 400);
    }

    const tokenData = await tokenResponse.json() as any;
    if (!tokenData.access_token) {
      return c.html(`
        <html>
        <head><title>Google OAuth Error</title>
        <script>
          alert('❌ SIGN-IN FAILED\\n\\nNo Access Token from Google\\n\\nTap OK to return to Sign In');
        </script>
        <style>
          body { font-family: Arial, sans-serif; background: #fff; padding: 20px; }
          .error-box { background: #f8f8f8; border: 2px solid #d0d0d0; border-radius: 8px; padding: 20px; max-width: 600px; color: #333333; }
          h1 { color: #333333; margin-top: 0; }
          code { background: #f5f5f5; padding: 15px; display: block; border-left: 3px solid #d0d0d0; border-radius: 4px; overflow-x: auto; margin: 15px 0; font-family: monospace; }
          p { line-height: 1.6; }
        </style>
        </head>
        <body onload="window.location.href = '/signin.html';">
          <div class="error-box">
            <h1>⚠️ No Access Token Received</h1>
            <p><strong>Issue:</strong> Google did not provide an access token</p>
            <code>GOOGLE_NO_ACCESS_TOKEN
Google OAuth returned: ${JSON.stringify(tokenData).substring(0, 500)}</code>
            <p><a href="/signin.html">← Back to Sign In</a></p>
          </div>
        </body>
        </html>
      `, 400);
    }

    // Get user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      return c.html(`
        <html>
        <head><title>Google OAuth Error</title>
        <style>
          body { font-family: Arial, sans-serif; background: #fff; padding: 20px; }
          .error-box { background: #f8f8f8; border: 2px solid #d0d0d0; border-radius: 8px; padding: 20px; max-width: 600px; color: #333333; }
          h1 { color: #333333; margin-top: 0; }
          code { background: #f5f5f5; padding: 15px; display: block; border-left: 3px solid #d0d0d0; border-radius: 4px; overflow-x: auto; margin: 15px 0; font-family: monospace; }
          p { line-height: 1.6; }
        </style>
        </head>
        <body>
          <div class="error-box">
            <h1>⚠️ Failed to Get User Info</h1>
            <p><strong>Status:</strong> ${userResponse.status}</p>
            <code>GOOGLE_USERINFO_ERROR
Status: ${userResponse.status}
Endpoint: https://www.googleapis.com/oauth2/v2/userinfo
Access Token Present: ${!!tokenData.access_token}</code>
            <p><a href="/signin.html">← Back to Sign In</a></p>
          </div>
          <script>
            alert('❌ SIGN-IN FAILED\\n\\nFailed to Get User Info from Google\\n\\nStatus: ${userResponse.status}\\n\\nTap OK to return to Sign In');
            window.location.href = '/signin.html';
          </script>
        </body>
        </html>
      `, 400);
    }

    const googleUser = await userResponse.json() as any;
    if (!googleUser.email) {
      return c.html(`
        <html>
        <head><title>Google OAuth Error</title>
        <style>
          body { font-family: Arial, sans-serif; background: #fff; padding: 20px; }
          .error-box { background: #f8f8f8; border: 2px solid #d0d0d0; border-radius: 8px; padding: 20px; max-width: 600px; color: #333333; }
          h1 { color: #333333; margin-top: 0; }
          code { background: #f5f5f5; padding: 15px; display: block; border-left: 3px solid #d0d0d0; border-radius: 4px; overflow-x: auto; margin: 15px 0; font-family: monospace; }
          p { line-height: 1.6; }
        </style>
        </head>
        <body>
          <div class="error-box">
            <h1>⚠️ No Email in Google Profile</h1>
            <p><strong>Issue:</strong> Your Google account does not have a public email</p>
            <code>GOOGLE_NO_EMAIL
Google User Info: ${JSON.stringify(googleUser).substring(0, 500)}

Solution: Make sure your Google account has a public email address.</code>
            <p><a href="/signin.html">← Back to Sign In</a></p>
          </div>
          <script>
            alert('❌ SIGN-IN FAILED\\n\\nNo Email in Google Profile\\n\\nMake sure your Google account has a public email address.\\n\\nTap OK to return to Sign In');
            window.location.href = '/signin.html';
          </script>
        </body>
        </html>
      `, 400);
    }

    // Check if user exists
    let user = await c.env.sorc_db.prepare('SELECT * FROM users WHERE email = ?').bind(googleUser.email).first() as any;
    let authKey: string;
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      // Create new user from Google OAuth
      authKey = crypto.randomUUID();
      const userId = Math.floor(Math.random() * 90000) + 10000;
      const now = new Date().toISOString();
      const uuid = crypto.randomUUID();
      const username = googleUser.email.split('@')[0] + '_' + Math.floor(Math.random() * 10000);
      const authKeyExpiresAt = new Date(Date.now() + AUTH_KEY_LIFETIME_MS).toISOString();

      try {
        await ensureAuthColumns(c.env.sorc_db);
        await c.env.sorc_db.prepare(`
          INSERT INTO users (id, email, auth_key, auth_key_expires_at, username, display_name, first_name, role, join_date, created_at, updated_at, user_id, email_verified, password_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(uuid, googleUser.email, authKey, authKeyExpiresAt, username, googleUser.name || googleUser.email, googleUser.given_name || '', 'CIVILIAN', now, now, now, userId, true, '').run();
        user = { id: uuid, email: googleUser.email, username, display_name: googleUser.name || googleUser.email, role: 'CIVILIAN', community_points: 0, created_at: now };
      } catch (error: any) {
        return c.html(`
          <html>
          <head><title>Database Error</title>
          <style>
            body { font-family: Arial, sans-serif; background: #fff; padding: 20px; }
            .error-box { background: #f8f8f8; border: 2px solid #d0d0d0; border-radius: 8px; padding: 20px; max-width: 600px; color: #333333; }
            h1 { color: #333333; margin-top: 0; }
            code { background: #f5f5f5; padding: 15px; display: block; border-left: 3px solid #d0d0d0; border-radius: 4px; overflow-x: auto; margin: 15px 0; font-family: monospace; font-size: 0.85rem; }
            p { line-height: 1.6; }
          </style>
          </head>
          <body>
            <div class="error-box">
              <h1>⚠️ Failed to Create Account</h1>
              <p><strong>Email:</strong> ${googleUser.email}</p>
              <code>DATABASE_INSERT_ERROR
Error: ${error.message}
Email: ${googleUser.email}
Username: ${username}

This usually means:
- Email already exists
- Database connection issue
- Server misconfiguration</code>
              <p><a href="/signin.html">← Back to Sign In</a></p>
            </div>
            <script>
              alert('❌ SIGN-IN FAILED\\n\\nFailed to Create Account\\n\\nError: ${error.message}\\n\\nTap OK to return to Sign In');
              window.location.href = '/signin.html';
            </script>
          </body>
          </html>
        `, 500);
      }
    } else {
      // User exists, generate new auth key
      authKey = crypto.randomUUID();
      const authKeyExpiresAt = new Date(Date.now() + AUTH_KEY_LIFETIME_MS).toISOString();
      try {
        await ensureAuthColumns(c.env.sorc_db);
        await c.env.sorc_db.prepare('UPDATE users SET auth_key = ?, auth_key_expires_at = ? WHERE id = ?').bind(authKey, authKeyExpiresAt, user.id).run();
      } catch (error: any) {
        return c.html(`
          <html>
          <head><title>Database Error</title>
          <style>
            body { font-family: Arial, sans-serif; background: #fff; padding: 20px; }
            .error-box { background: #f8f8f8; border: 2px solid #d0d0d0; border-radius: 8px; padding: 20px; max-width: 600px; color: #333333; }
            h1 { color: #333333; margin-top: 0; }
            code { background: #f5f5f5; padding: 15px; display: block; border-left: 3px solid #d0d0d0; border-radius: 4px; overflow-x: auto; margin: 15px 0; font-family: monospace; }
            p { line-height: 1.6; }
          </style>
          </head>
          <body>
            <div class="error-box">
              <h1>⚠️ Failed to Authenticate</h1>
              <p><strong>Error:</strong> Could not update authentication token</p>
              <code>DATABASE_UPDATE_ERROR
Error: ${error.message}

This usually means:
- Database connection issue
- User record was deleted
- Server misconfiguration</code>
              <p><a href="/signin.html">← Back to Sign In</a></p>
            </div>
            <script>
              alert('❌ SIGN-IN FAILED\\n\\nFailed to Authenticate\\n\\nError: ${error.message}\\n\\nTap OK to return to Sign In');
              window.location.href = '/signin.html';
            </script>
          </body>
          </html>
        `, 500);
      }
    }

    // Build return URL with user data and auth key
    const userData = JSON.stringify({
      id: user.id,
      email: user.email,
      username: user.username,
      display_name: user.display_name,
      first_name: user.first_name || null,
      surname: user.surname || null,
      prefix: user.prefix || null,
      suffix: user.suffix || null,
      avatar: user.avatar || null,
      bio: user.bio || null,
      role: user.role,
      community_points: user.community_points || 0,
      post_count: user.post_count || 0,
      titles: user.titles || null,
      join_date: user.join_date,
      created_at: user.created_at,
      authKey: authKey,
      // New Google sign-ups get an auto-generated username (email prefix +
      // random digits, see above) with no chance to pick their own. This
      // flag routes the post-K-ID redirect through choose-username.html
      // once, right after verification, before the account is otherwise
      // considered fully set up - see choose-username.html and
      // POST /api/auth/set-username. Existing users logging back in never
      // carry this flag.
      needs_username: isNewUser
    });
    const returnUrl = `https://sorcrpg.com/signin.html?user=${encodeURIComponent(userData)}`;
    const kidUrl = `https://sorcrpg.com/k-id-status.html?return=${encodeURIComponent(returnUrl)}`;

    console.log('OAuth success - redirecting to K-ID verification');
    console.log('User email:', user.email);
    console.log('Auth key generated:', !!authKey);
    console.log('K-ID URL length:', kidUrl.length);

    return c.redirect(kidUrl);
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return c.html(`
      <html>
      <head><title>OAuth Error</title>
      <style>
        body { font-family: Arial, sans-serif; background: #fff; padding: 20px; }
        .error-box { background: #f8f8f8; border: 2px solid #d0d0d0; border-radius: 8px; padding: 20px; max-width: 600px; color: #333333; }
        h1 { color: #333333; margin-top: 0; }
        code { background: #f5f5f5; padding: 15px; display: block; border-left: 3px solid #d0d0d0; border-radius: 4px; overflow-x: auto; margin: 15px 0; font-family: monospace; font-size: 0.85rem; word-break: break-all; }
        p { line-height: 1.6; }
      </style>
      </head>
      <body>
        <div class="error-box">
          <h1>⚠️ Unexpected Error</h1>
          <p><strong>Details:</strong> An unexpected error occurred during authentication</p>
          <code>UNEXPECTED_OAUTH_ERROR
Error: ${error.message}
Stack: ${error.stack ? error.stack.substring(0, 300) : 'N/A'}</code>
          <p><a href="/signin.html">← Back to Sign In</a></p>
        </div>
        <script>
          alert('❌ SIGN-IN FAILED\\n\\nUnexpected Error During Authentication\\n\\nError: ${error.message}\\n\\nTap OK to return to Sign In');
          window.location.href = '/signin.html';
        </script>
      </body>
      </html>
    `, 500);
  }
});

// Handle post-K-ID verification redirect from Google OAuth
// This endpoint receives user data after K-ID age verification is complete
app.post('/auth/google/login-after-kid', async (c) => {
  try {
    const body = await c.req.json();
    const { user, authKey } = body;

    if (!user || !authKey) {
      return c.json({ error: 'Missing user data or auth key' }, 400);
    }

    return c.json({
      success: true,
      user,
      authKey
    });
  } catch (error: any) {
    console.error('POST /auth/google/login-after-kid error:', error);
    return c.json({ error: 'Invalid request' }, 400);
  }
});

// Lets a brand-new Google (or future OAuth) signup replace the auto-generated
// email-prefix username with one they actually chose - see needs_username in
// /auth/google/callback and choose-username.html. Same validation as
// /api/auth/register's username field, plus the profanity filter signin.html
// already runs client-side for the email/password signup form, repeated here
// server-side so it can't be skipped.
const USERNAME_BAD_WORDS = ['fuck','shit','ass','bitch','cunt','dick','cock','pussy','nigger','nigga','faggot','retard','whore','slut','bastard','crap','piss','prick','twat','wanker','bollocks'];
function containsBadWord(str: string): boolean {
  const lower = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  return USERNAME_BAD_WORDS.some(w => lower.includes(w));
}

app.post('/api/auth/set-username', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const { username } = await c.req.json() as any;
  if (!username || typeof username !== 'string') return c.json({ error: 'Username required' }, 400);
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 30) return c.json({ error: 'Username must be 3-30 characters' }, 400);
  if (!/^[a-zA-Z0-9-]+$/.test(trimmed)) return c.json({ error: 'Username can only contain letters, numbers, and hyphens' }, 400);
  if (containsBadWord(trimmed)) return c.json({ error: 'Username contains inappropriate language' }, 400);

  const existing = await c.env.sorc_db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').bind(trimmed, user.id).first();
  if (existing) return c.json({ error: 'Username already taken' }, 400);

  const now = new Date().toISOString();
  await c.env.sorc_db.prepare('UPDATE users SET username = ?, updated_at = ? WHERE id = ?').bind(trimmed, now, user.id).run();
  return c.json({ success: true, username: trimmed });
});

app.get('/api/forum/categories', async (c) => {
  try {
    const categories: any[] = [
      { id: 'announcements', name: 'News & Announcements', icon: '📣', desc: null, color: '#d0021b', readOnly: true, adminOnly: true },
      { id: 'conduct', name: 'Conduct & Rules', icon: '⚖️', desc: 'The laws of Essentia and the SORC community. Read before you post.', color: '#8B0000', readOnly: true, adminOnly: true },
      { id: 'general', name: 'General Discussion', icon: '💬', desc: 'The heart of the SORC community.', color: '#333' },
      { id: 'sorc-beyond', name: 'SORC Beyond', icon: '⚡', desc: 'Discuss digital features, online lobbies, and the SORC Beyond platform.', color: '#1a3a6b' },
      { id: 'x-roads', name: 'The X Roads', icon: '🗺', desc: "Where lore, legend, and mystery converge.", color: '#4a1a6b' },
      { id: 'rules', name: 'Rules & Gameplay Advice', icon: '📖', desc: 'Questions and discussions about SORC mechanics.', color: '#1a4a1a' },
      { id: 'majestic-worlds', name: 'The Majestic Worlds of Essentia', icon: '🌍', desc: 'The thirteen worlds of Essentia.', color: '#1a3a1a' },
      { id: 'tawdry-dwarf', name: 'Tawdry Dwarf & Beyond', icon: '🔭', desc: "Far from Adoria's reach.", color: '#1a1a3a' },
      { id: 'lfg', name: 'Looking for Group', icon: '⚔️', desc: 'Find players and Game Masters.', color: '#3a1a00' }
    ];
    for (const cat of categories) {
      const threadCount = await c.env.sorc_db.prepare('SELECT COUNT(*) as count FROM threads WHERE category_id = ?').bind(cat.id).first() as any;
      cat.threadCount = threadCount?.count || 0;
    }
    return c.json({ categories });
  } catch (error: any) {
    return c.json({ error: 'Failed to load categories', details: error.message }, 500);
  }
});

app.get('/api/forum/category/:categoryId', authMiddleware, async (c) => {
  const categoryId = c.req.param('categoryId');
  const page = parseInt(c.req.query('page') || '1');
  const limit = 20;
  const offset = (page - 1) * limit;
  try {
    const threads = await c.env.sorc_db.prepare(`SELECT t.*, u.username as author_name, u.display_name, u.role as author_role FROM threads t JOIN users u ON t.author_uid = u.id WHERE t.category_id = ? ORDER BY t.pinned DESC, t.last_reply_at DESC LIMIT ? OFFSET ?`).bind(categoryId, limit, offset).all();
    const totalThreads = await c.env.sorc_db.prepare('SELECT COUNT(*) as count FROM threads WHERE category_id = ?').bind(categoryId).first() as any;
    return c.json({ threads: threads.results, total: totalThreads.count, page, totalPages: Math.ceil(totalThreads.count / limit) });
  } catch (error: any) {
    return c.json({ error: 'Failed to load threads', details: error.message }, 500);
  }
});

app.get('/api/forum/thread/:threadId', authMiddleware, async (c) => {
  const threadId = c.req.param('threadId');
  try {
    const thread = await c.env.sorc_db.prepare(`SELECT t.*, u.username as author_name, u.display_name, u.role as author_role FROM threads t JOIN users u ON t.author_uid = u.id WHERE t.id = ?`).bind(threadId).first();
    if (!thread) return c.json({ error: 'Thread not found' }, 404);
    const posts = await c.env.sorc_db.prepare(`SELECT p.*, u.username as author_name, u.display_name, u.role as author_role FROM posts p JOIN users u ON p.author_uid = u.id WHERE p.thread_id = ? ORDER BY p.created_at ASC`).bind(threadId).all();
    await c.env.sorc_db.prepare('UPDATE threads SET views = views + 1 WHERE id = ?').bind(threadId).run();
    return c.json({ thread, posts: posts.results });
  } catch (error: any) {
    return c.json({ error: 'Failed to load thread', details: error.message }, 500);
  }
});

app.post('/api/forum/thread', authMiddleware, async (c) => {
  const { categoryId, title, body } = await c.req.json();
  const user = c.get('user') as any;
  if (!title || !body) return c.json({ error: 'Title and body required' }, 400);
  try {
    const threadId = crypto.randomUUID();
    const now = new Date().toISOString();
    await c.env.sorc_db.prepare(`INSERT INTO threads (id, category_id, title, body, author_uid, author_name, author_role, created_at, last_reply_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(threadId, categoryId, title, body, user.id, user.display_name || user.username, user.role, now, now).run();
    const postId = crypto.randomUUID();
    await c.env.sorc_db.prepare(`INSERT INTO posts (id, thread_id, body, author_uid, author_name, author_role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(postId, threadId, body, user.id, user.display_name || user.username, user.role, now).run();
    await c.env.sorc_db.prepare('UPDATE users SET post_count = post_count + 1 WHERE id = ?').bind(user.id).run();
    return c.json({ success: true, threadId });
  } catch (error: any) {
    return c.json({ error: 'Failed to create thread', details: error.message }, 500);
  }
});

app.post('/api/forum/post', authMiddleware, async (c) => {
  const { threadId, body } = await c.req.json();
  const user = c.get('user') as any;
  if (!body) return c.json({ error: 'Body required' }, 400);
  try {
    const postId = crypto.randomUUID();
    const now = new Date().toISOString();
    await c.env.sorc_db.prepare(`INSERT INTO posts (id, thread_id, body, author_uid, author_name, author_role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(postId, threadId, body, user.id, user.display_name || user.username, user.role, now).run();
    await c.env.sorc_db.prepare(`UPDATE threads SET reply_count = reply_count + 1, last_reply_at = ?, last_reply_by = ? WHERE id = ?`).bind(now, user.display_name || user.username, threadId).run();
    await c.env.sorc_db.prepare('UPDATE users SET post_count = post_count + 1 WHERE id = ?').bind(user.id).run();
    return c.json({ success: true, postId });
  } catch (error: any) {
    return c.json({ error: 'Failed to create post', details: error.message }, 500);
  }
});

// ===== FELLOWSHIPS =====

app.get('/api/fellowships', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    const rows = await c.env.sorc_db.prepare(
      `SELECT f.*, u.avatar, u.role
       FROM fellowships f
       JOIN users u ON u.id = CASE WHEN f.sender_uid = ? THEN f.receiver_uid ELSE f.sender_uid END
       WHERE (f.sender_uid = ? OR f.receiver_uid = ?) AND f.status = 'accepted'
       ORDER BY f.accepted_at DESC`
    ).bind(user.id, user.id, user.id).all();
    return c.json({ fellows: rows.results });
  } catch (error: any) {
    return c.json({ error: 'Failed to load fellows', details: error.message }, 500);
  }
});

app.get('/api/fellowships/requests/incoming', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    const rows = await c.env.sorc_db.prepare(
      `SELECT f.*, u.avatar FROM fellowships f
       JOIN users u ON u.id = f.sender_uid
       WHERE f.receiver_uid = ? AND f.status = 'pending'
       ORDER BY f.created_at DESC`
    ).bind(user.id).all();
    return c.json({ requests: rows.results });
  } catch (error: any) {
    return c.json({ error: 'Failed to load requests', details: error.message }, 500);
  }
});

app.get('/api/fellowships/requests/outgoing', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    const rows = await c.env.sorc_db.prepare(
      `SELECT f.*, u.avatar FROM fellowships f
       JOIN users u ON u.id = f.receiver_uid
       WHERE f.sender_uid = ? AND f.status = 'pending'
       ORDER BY f.created_at DESC`
    ).bind(user.id).all();
    return c.json({ requests: rows.results });
  } catch (error: any) {
    return c.json({ error: 'Failed to load requests', details: error.message }, 500);
  }
});

app.post('/api/fellowships/request', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const { receiverUid } = await c.req.json();
  if (!receiverUid) return c.json({ error: 'receiverUid required' }, 400);
  if (receiverUid === user.id) return c.json({ error: 'Cannot send request to yourself' }, 400);
  try {
    const receiver = await c.env.sorc_db.prepare('SELECT id, display_name, username FROM users WHERE id = ?').bind(receiverUid).first() as any;
    if (!receiver) return c.json({ error: 'User not found' }, 404);
    const existing = await c.env.sorc_db.prepare(
      `SELECT id FROM fellowships WHERE (sender_uid = ? AND receiver_uid = ?) OR (sender_uid = ? AND receiver_uid = ?)`
    ).bind(user.id, receiverUid, receiverUid, user.id).first();
    if (existing) return c.json({ error: 'Fellowship request already exists' }, 409);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await c.env.sorc_db.prepare(
      `INSERT INTO fellowships (id, sender_uid, sender_name, receiver_uid, receiver_name, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)`
    ).bind(id, user.id, user.display_name || user.username, receiverUid, receiver.display_name || receiver.username, now).run();
    return c.json({ success: true, id });
  } catch (error: any) {
    return c.json({ error: 'Failed to send request', details: error.message }, 500);
  }
});

app.post('/api/fellowships/:id/accept', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const fellowshipId = c.req.param('id');
  try {
    const fellowship = await c.env.sorc_db.prepare('SELECT * FROM fellowships WHERE id = ?').bind(fellowshipId).first() as any;
    if (!fellowship) return c.json({ error: 'Not found' }, 404);
    if (fellowship.receiver_uid !== user.id) return c.json({ error: 'Forbidden' }, 403);
    if (fellowship.status !== 'pending') return c.json({ error: 'Request is not pending' }, 400);

    // Fellowship cap: Basic members top out at 25 accepted fellowships
    // (remove one to add another); Pro Membership is unlimited, per
    // sorc-beyond.html's Basic vs. Pro table.
    if (!(await isProMember(c.env.sorc_db, user))) {
      const count = await c.env.sorc_db.prepare(
        `SELECT COUNT(*) as cnt FROM fellowships WHERE status = 'accepted' AND (sender_uid = ? OR receiver_uid = ?)`
      ).bind(user.id, user.id).first() as any;
      if ((count?.cnt || 0) >= FELLOWSHIP_CAP) {
        return c.json({ error: `You've reached the Basic Fellowship cap (${FELLOWSHIP_CAP}). Remove one to add another, or upgrade to Pro for unlimited fellows.` }, 403);
      }
    }
    const sender = await c.env.sorc_db.prepare('SELECT * FROM users WHERE id = ?').bind(fellowship.sender_uid).first() as any;
    if (sender && !(await isProMember(c.env.sorc_db, sender))) {
      const senderCount = await c.env.sorc_db.prepare(
        `SELECT COUNT(*) as cnt FROM fellowships WHERE status = 'accepted' AND (sender_uid = ? OR receiver_uid = ?)`
      ).bind(sender.id, sender.id).first() as any;
      if ((senderCount?.cnt || 0) >= FELLOWSHIP_CAP) {
        return c.json({ error: (sender.display_name || sender.username) + " has reached their Basic Fellowship cap. They'll need to remove one, or upgrade to Pro." }, 403);
      }
    }

    await c.env.sorc_db.prepare(`UPDATE fellowships SET status = 'accepted', accepted_at = ? WHERE id = ?`).bind(new Date().toISOString(), fellowshipId).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to accept', details: error.message }, 500);
  }
});

app.post('/api/fellowships/:id/decline', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const fellowshipId = c.req.param('id');
  try {
    const fellowship = await c.env.sorc_db.prepare('SELECT * FROM fellowships WHERE id = ?').bind(fellowshipId).first() as any;
    if (!fellowship) return c.json({ error: 'Not found' }, 404);
    if (fellowship.receiver_uid !== user.id) return c.json({ error: 'Forbidden' }, 403);
    await c.env.sorc_db.prepare('DELETE FROM fellowships WHERE id = ?').bind(fellowshipId).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to decline', details: error.message }, 500);
  }
});

app.delete('/api/fellowships/:id', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const fellowshipId = c.req.param('id');
  try {
    const fellowship = await c.env.sorc_db.prepare('SELECT * FROM fellowships WHERE id = ?').bind(fellowshipId).first() as any;
    if (!fellowship) return c.json({ error: 'Not found' }, 404);
    if (fellowship.sender_uid !== user.id && fellowship.receiver_uid !== user.id) return c.json({ error: 'Forbidden' }, 403);
    await c.env.sorc_db.prepare('DELETE FROM fellowships WHERE id = ?').bind(fellowshipId).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to remove', details: error.message }, 500);
  }
});

// ===== INBOX / MESSAGES =====

app.get('/api/conversations', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    const rows = await c.env.sorc_db.prepare(
      `SELECT * FROM conversations
       WHERE user1_uid = ? OR user2_uid = ?
       ORDER BY last_message_at DESC`
    ).bind(user.id, user.id).all();
    return c.json({ conversations: rows.results });
  } catch (error: any) {
    return c.json({ error: 'Failed to load conversations', details: error.message }, 500);
  }
});

app.get('/api/conversations/:id', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const convId = c.req.param('id');
  try {
    const conv = await c.env.sorc_db.prepare('SELECT * FROM conversations WHERE id = ?').bind(convId).first() as any;
    if (!conv) return c.json({ error: 'Not found' }, 404);
    if (conv.user1_uid !== user.id && conv.user2_uid !== user.id) return c.json({ error: 'Forbidden' }, 403);
    const messages = await c.env.sorc_db.prepare(
      `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`
    ).bind(convId).all();
    return c.json({ conversation: conv, messages: messages.results });
  } catch (error: any) {
    return c.json({ error: 'Failed to load conversation', details: error.message }, 500);
  }
});

app.post('/api/conversations', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const { receiverUid, body } = await c.req.json();
  if (!receiverUid || !body) return c.json({ error: 'receiverUid and body required' }, 400);
  if (receiverUid === user.id) return c.json({ error: 'Cannot message yourself' }, 400);
  try {
    const receiver = await c.env.sorc_db.prepare('SELECT id, display_name, username FROM users WHERE id = ?').bind(receiverUid).first() as any;
    if (!receiver) return c.json({ error: 'User not found' }, 404);
    const [u1, u2] = [user.id, receiverUid].sort();
    let conv = await c.env.sorc_db.prepare(
      `SELECT * FROM conversations WHERE (user1_uid = ? AND user2_uid = ?) OR (user1_uid = ? AND user2_uid = ?)`
    ).bind(u1, u2, u2, u1).first() as any;
    const now = new Date().toISOString();
    if (!conv) {
      const convId = crypto.randomUUID();
      await c.env.sorc_db.prepare(
        `INSERT INTO conversations (id, user1_uid, user2_uid, user1_name, user2_name, last_message_text, last_message_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(convId, user.id, receiverUid, user.display_name || user.username, receiver.display_name || receiver.username, body.slice(0, 80), now, now).run();
      conv = { id: convId };
    } else {
      await c.env.sorc_db.prepare('UPDATE conversations SET last_message_text = ?, last_message_at = ? WHERE id = ?').bind(body.slice(0, 80), now, conv.id).run();
    }
    const msgId = crypto.randomUUID();
    await c.env.sorc_db.prepare(
      `INSERT INTO messages (id, conversation_id, sender_uid, sender_name, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(msgId, conv.id, user.id, user.display_name || user.username, body, now).run();
    return c.json({ success: true, conversationId: conv.id, messageId: msgId });
  } catch (error: any) {
    return c.json({ error: 'Failed to send message', details: error.message }, 500);
  }
});

app.post('/api/conversations/:id/messages', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const convId = c.req.param('id');
  const { body } = await c.req.json();
  if (!body) return c.json({ error: 'body required' }, 400);
  try {
    const conv = await c.env.sorc_db.prepare('SELECT * FROM conversations WHERE id = ?').bind(convId).first() as any;
    if (!conv) return c.json({ error: 'Not found' }, 404);
    if (conv.user1_uid !== user.id && conv.user2_uid !== user.id) return c.json({ error: 'Forbidden' }, 403);
    const msgId = crypto.randomUUID();
    const now = new Date().toISOString();
    await c.env.sorc_db.prepare(
      `INSERT INTO messages (id, conversation_id, sender_uid, sender_name, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(msgId, convId, user.id, user.display_name || user.username, body, now).run();
    await c.env.sorc_db.prepare('UPDATE conversations SET last_message_text = ?, last_message_at = ? WHERE id = ?').bind(body.slice(0, 80), now, convId).run();
    return c.json({ success: true, messageId: msgId });
  } catch (error: any) {
    return c.json({ error: 'Failed to send message', details: error.message }, 500);
  }
});

app.get('/api/profile/:userId', async (c) => {
  const userId = c.req.param('userId');
  try {
    await ensureProfileColumns(c.env.sorc_db);
    const user = await c.env.sorc_db.prepare(`SELECT id, username, display_name, first_name, surname, prefix, suffix, avatar, bio, role, community_points, post_count, titles, join_date, last_seen, created_at, signature, website, social_twitter, social_twitch, banner FROM users WHERE id = ? OR username = ?`).bind(userId, userId).first() as any;
    if (!user) return c.json({ error: 'User not found' }, 404);
    // Signature/website/socials/banner are Pro-exclusive - don't show them on
    // a public profile for a member who no longer has (or never had) Pro.
    if (!(await isProMember(c.env.sorc_db, user))) {
      user.signature = null; user.website = null; user.social_twitter = null; user.social_twitch = null; user.banner = null;
    }
    return c.json({ user });
  } catch (error: any) {
    return c.json({ error: 'Failed to load profile', details: error.message }, 500);
  }
});

app.get('/api/me', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    await ensureProfileColumns(c.env.sorc_db);
    const fullUser = await c.env.sorc_db.prepare('SELECT id, username, display_name, first_name, surname, prefix, suffix, avatar, bio, role, community_points, post_count, titles, join_date, last_seen, created_at, signature, website, social_twitter, social_twitch, banner FROM users WHERE id = ?').bind(user.id).first() as any;
    if (!fullUser) return c.json({ error: 'User not found' }, 404);
    // Privileged accounts (ADMIN/OWNER, verified server-side, never client-claimed)
    // are auto-topped-up to a 10,000 community_points floor.
    if (isPrivileged(fullUser) && (fullUser.community_points || 0) < 10000) {
      await c.env.sorc_db.prepare('UPDATE users SET community_points = 10000 WHERE id = ?').bind(fullUser.id).run();
      fullUser.community_points = 10000;
    }
    // Client pages (Trading Post, Character's Home, etc.) need to know Basic
    // vs. Pro to show the right locked/unlocked state without a second call.
    // The real gate is always server-side on each endpoint - this is display only.
    fullUser.is_pro = await isProMember(c.env.sorc_db, fullUser);
    return c.json({ user: fullUser });
  } catch (error: any) {
    return c.json({ error: 'Failed to load profile', details: error.message }, 500);
  }
});

app.put('/api/profile', authMiddleware, async (c) => {
  const updates = await c.req.json();
  const user = c.get('user') as any;
  await ensureProfileColumns(c.env.sorc_db);
  const allowedFields = ['display_name', 'first_name', 'surname', 'prefix', 'suffix', 'bio', 'avatar', 'privacy_email'];
  // Pro Membership perks (see sorc-beyond.html's comparison table): a signature,
  // personal website link, social links, and a custom banner are Pro-only. Not
  // purchasable with Community Points, and not settable at all without a
  // claimed box set code.
  const proOnlyFields = ['signature', 'website', 'social_twitter', 'social_twitch', 'banner'];
  const isPro = await isProMember(c.env.sorc_db, user);
  const setParts: string[] = [];
  const values: any[] = [];
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      setParts.push(`${field} = ?`);
      values.push(updates[field]);
    }
  }
  const blockedProFields: string[] = [];
  for (const field of proOnlyFields) {
    if (updates[field] === undefined) continue;
    if (!isPro) { blockedProFields.push(field); continue; }
    setParts.push(`${field} = ?`);
    values.push(updates[field]);
  }
  if (blockedProFields.length > 0 && setParts.length === 0) {
    return c.json({ error: 'Pro Membership required to set: ' + blockedProFields.join(', ') }, 403);
  }
  if (setParts.length === 0) return c.json({ error: 'No valid fields to update' }, 400);
  try {
    await c.env.sorc_db.prepare(`UPDATE users SET ${setParts.join(', ')}, updated_at = ? WHERE id = ?`).bind(...values, new Date().toISOString(), user.id).run();
    const updatedUser = await c.env.sorc_db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
    return c.json({ success: true, user: updatedUser, blocked_pro_fields: blockedProFields.length ? blockedProFields : undefined });
  } catch (error: any) {
    return c.json({ error: 'Failed to update profile', details: error.message }, 500);
  }
});

// ===== MIGRATIONS =====

// Migration endpoint to add password_reset_required column and force password reset
app.post('/api/admin/migrate-bcrypt', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  if (!isPrivileged(user)) return c.json({ error: 'Forbidden.' }, 403);
  try {
    // Add password_reset_required column if it doesn't exist
    await c.env.sorc_db.prepare(`
      ALTER TABLE users ADD COLUMN password_reset_required BOOLEAN DEFAULT FALSE
    `).run().catch(() => {
      // Column might already exist, that's okay
    });

    // Set password_reset_required = 1 for users with password_hash (existing email/password users)
    // Keep auth_key intact so users can still use the app - they just can't sign in again until they reset password
    await c.env.sorc_db.prepare(`
      UPDATE users SET password_reset_required = 1 WHERE password_hash IS NOT NULL
    `).run();

    return c.json({
      success: true,
      message: 'Migration complete. All email/password users have been logged out and must reset their password on next login. OAuth users (Google, Amazon, Apple) are unaffected.'
    });
  } catch (error: any) {
    return c.json({ error: 'Migration failed', details: error.message }, 500);
  }
});

// ===== ASSESSMENTS =====

async function checkRateLimit(db: D1Database, key: string, maxAttempts: number, windowSeconds: number): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowSeconds;
  try {
    await db.prepare('DELETE FROM rate_limits WHERE key = ? AND created_at < ?').bind(key, windowStart).run();
    const row = await db.prepare('SELECT COUNT(*) as count FROM rate_limits WHERE key = ?').bind(key).first() as any;
    if ((row?.count || 0) >= maxAttempts) return false;
    await db.prepare('INSERT INTO rate_limits (key, created_at) VALUES (?, ?)').bind(key, now).run();
    return true;
  } catch {
    return false; // deny on DB error — don't fail open
  }
}

function genLobbyCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const arr = crypto.getRandomValues(new Uint8Array(6));
  for (let i = 0; i < 6; i++) code += chars[arr[i] % chars.length];
  return code;
}

function isPrivileged(user: any): boolean {
  const OWNER_EMAILS = ['corbett@sorcrpg.com'];
  const ADMIN_EMAILS = ['markcorbett.mii@gmail.com'];
  return user.role === 'ADMIN' || user.role === 'OWNER'
    || OWNER_EMAILS.includes(user.email)
    || ADMIN_EMAILS.includes(user.email);
}

const ASSESSMENT_QUESTIONS = [
  // PAGE 1 - Dice, D100 System, Action Resolution
  { q: "When rolling d100, your tens die shows 7 and your ones die shows 3. What is your result?", options: ["37", "73", "3", "7"], answer: 1, page: 1 },
  { q: "What does rolling two 0s on the d100 equal?", options: ["0", "10", "50", "100"], answer: 3, page: 1 },
  { q: "When using the D100+D100 system, what is the minimum possible total result?", options: ["1", "2", "10", "0"], answer: 1, page: 1 },
  { q: "What is the maximum possible result when using the D100+D100 system?", options: ["100", "150", "200", "198"], answer: 2, page: 1 },
  { q: "Which two dice combine to form a d100 roll in SORC?", options: ["Two D6s", "Two D10s (tens and ones)", "D20 and D6", "D12 and D8"], answer: 1, page: 1 },
  { q: "When rolling d100, your tens die shows 4 and your ones die shows 0. What is your result?", options: ["4", "400", "40", "100"], answer: 2, page: 1 },
  { q: "When rolling d100, the tens die shows 1 and the ones die shows 0. What is your result?", options: ["1", "100", "10", "01"], answer: 2, page: 1 },
  { q: "When rolling d100, the tens die shows 0 and the ones die shows 5. What is your result?", options: ["50", "0", "15", "5"], answer: 3, page: 1 },
  { q: "What is the maximum possible result on a single d100 roll?", options: ["99", "10", "50", "100"], answer: 3, page: 1 },
  { q: "What is the minimum possible result on a single d100 roll?", options: ["0", "1", "10", "5"], answer: 1, page: 1 },
  { q: "Which dice roll is used for very rare items such as Divine and Legendary drops?", options: ["1D6", "1D4", "D100 + D100", "2D6"], answer: 2, page: 1 },
  { q: "What does DIFS stand for in SORC?", options: ["Defense Index Factor Score", "Difficulty Score", "Damage Infliction Scale", "Dice Influence Factor"], answer: 1, page: 1 },
  { q: "In SORC, a D100 action roll must do what to the DIFS to succeed?", options: ["Fall below it", "Equal it exactly", "Meet or exceed it", "Exceed it by at least 5"], answer: 2, page: 1 },
  { q: "Items obtained through loot, discovery, and crafting are determined by which die?", options: ["D20", "D12", "D100", "D6"], answer: 2, page: 1 },
  { q: "In the d100 pair, what does each die represent?", options: ["Both are added together", "One is the tens place, the other the ones place", "One is damage, one is accuracy", "The higher die is used"], answer: 1, page: 1 },

  // PAGE 2 - Races, Attributes, Traits, Professions, Hobbies, Ranks
  { q: "Which color chips represent Life in SORC?", options: ["Red", "Blue", "Yellow", "Green"], answer: 0, page: 2 },
  { q: "What color chips represent Mana in SORC?", options: ["Red", "Blue", "Yellow", "Green"], answer: 1, page: 2 },
  { q: "What color chips represent Stamina in SORC?", options: ["Red", "Blue", "Yellow", "Green"], answer: 2, page: 2 },
  { q: "How many playable races and subraces are available in SORC?", options: ["20", "30", "40", "50"], answer: 2, page: 2 },
  { q: "How many size categories do SORC races fall into?", options: ["2", "3", "4", "5"], answer: 1, page: 2 },
  { q: "What are the three size categories for SORC races?", options: ["Large, Medium, Small", "Goliath, Standard, Small", "Titan, Normal, Tiny", "Heavy, Average, Light"], answer: 1, page: 2 },
  { q: "What is the height range for Goliath size races?", options: ["5-7 ft", "7-9 ft", "9-11 ft", "3-5 ft"], answer: 1, page: 2 },
  { q: "What is the height range for Small size races?", options: ["1-3 ft", "2-4 ft", "3-5 ft", "4-6 ft"], answer: 2, page: 2 },
  { q: "In SORC, does a Human's culture (Omne, Nordkin, etc.) affect their base Traits and Stats?", options: ["Yes, significantly", "Yes, slightly", "No, every human begins with the same Traits and Stats", "Only in combat"], answer: 2, page: 2 },
  { q: "How many Attributes exist in SORC?", options: ["5", "6", "7", "8"], answer: 1, page: 2 },
  { q: "What is the theoretical maximum any single Attribute can reach?", options: ["20", "25", "45", "50"], answer: 3, page: 2 },
  { q: "What is the maximum score a Skill can reach?", options: ["30", "45", "50", "59"], answer: 1, page: 2 },
  { q: "How many REM Points must be invested to unlock a Profession?", options: ["1", "2", "5", "10"], answer: 1, page: 2 },
  { q: "Skill and talent scores are multiplied by what number to determine their bonus on each use?", options: ["2", "3", "5", "10"], answer: 2, page: 2 },
  { q: "Which Trait sets the maximum cap (Extent) for each Vitality resource?", options: ["Spirit", "Apex", "Capacity", "Knowledge"], answer: 1, page: 2 },
  { q: "Which Trait governs how fast Vitality resources recover?", options: ["Apex", "Spirit", "Willpower", "Focus"], answer: 1, page: 2 },
  { q: "Which Expertise tier does every character have access to for free?", options: ["Novice", "Apprentice", "Journeyman", "Grandmaster"], answer: 0, page: 2 },
  { q: "What is the correct Character Rank order from lowest to highest for the first three ranks?", options: ["Adventurer, Peasant, Pauper", "Pauper, Peasant, Commoner", "Legend, Elite, Pauper", "Commoner, Peasant, Pauper"], answer: 1, page: 2 },
  { q: "What Character Rank comes directly after Commoner?", options: ["Hero", "Peasant", "Adventurer", "Elite"], answer: 2, page: 2 },
  { q: "What is the highest Character Rank in SORC?", options: ["Elite", "Hero", "Uber", "Legend"], answer: 3, page: 2 },
  { q: "How many total Character Ranks exist in SORC?", options: ["6", "7", "8", "9"], answer: 2, page: 2 },
  { q: "What Character Rank comes directly after Hero?", options: ["Uber", "Adventurer", "Legend", "Elite"], answer: 0, page: 2 },
  { q: "Can characters equip items of a Rank above their own?", options: ["Yes, with a penalty", "Yes, if given by the GM", "No, never", "Only in emergencies"], answer: 2, page: 2 },
  { q: "Can Hobbies or Professions be used during combat?", options: ["Only Professions can", "Only Hobbies can", "Both can be used freely", "Neither can ever be used in combat"], answer: 3, page: 2 },
  { q: "How does Hobby action time compare to the equivalent Profession work?", options: ["Half the action time", "The same action time", "Double the action time", "Hobbies require no actions"], answer: 2, page: 2 },
  { q: "Can Hobby action time be decreased with Expertise?", options: ["Yes, at the same rate as a Profession", "Yes, but only at Master tier", "No, only Profession action time can be decreased", "Only during downtime"], answer: 2, page: 2 },
  { q: "What happens to the value of an item crafted as a Hobby?", options: ["It gains double value", "It loses half of the product's default value", "Its value is unchanged", "It cannot be valued at all"], answer: 1, page: 2 },
  { q: "What bonus do characters who work at their craft as a Hobby receive?", options: ["Combat bonuses", "Discovery bonuses", "Crafting speed bonuses", "Wage bonuses"], answer: 1, page: 2 },
  { q: "Which system do Hobbies improve through?", options: ["Expertise", "Growth", "Remnants", "Reputation"], answer: 1, page: 2 },
  { q: "What is the Crafting Check formula in SORC?", options: ["d100 + Skill Score vs DIFS", "d100 + (Skill Score x 5) + Aligned Attribute Modifier vs DIFS", "d20 + Skill Score vs DIFS", "Skill Score x 5 vs DIFS"], answer: 1, page: 2 },

  // PAGE 3 - Classes, Paths, Branches, Abilities
  { q: "What is the maximum number of Abilities a character can learn?", options: ["40", "50", "59", "75"], answer: 2, page: 3 },
  { q: "How many main Classes exist in SORC?", options: ["8", "12", "16", "20"], answer: 2, page: 3 },
  { q: "How many Paths does each Class Tree have?", options: ["2", "3", "4", "5"], answer: 1, page: 3 },
  { q: "How many Branches does each Main Class have to choose from?", options: ["2", "3", "4", "5"], answer: 1, page: 3 },
  { q: "At what Character LVL do Path Abilities become available?", options: ["LVL 1", "LVL 4", "LVL 10", "LVL 21"], answer: 1, page: 3 },
  { q: "At what Character LVL do Branch Abilities unlock?", options: ["LVL 10", "LVL 15", "LVL 21", "LVL 30"], answer: 2, page: 3 },
  { q: "How many Abilities does a single Class Tree contain in total?", options: ["20", "30", "45", "59"], answer: 1, page: 3 },
  { q: "Which LVL range covers a Class Tree's Tier Abilities?", options: ["LVLs 1-3", "LVLs 1-5", "LVLs 4-20", "LVLs 21-30"], answer: 0, page: 3 },
  { q: "Which LVL range covers a Class Tree's Path Abilities?", options: ["LVLs 1-3", "LVLs 4-20", "LVLs 10-25", "LVLs 21-30"], answer: 1, page: 3 },
  { q: "Which class is restricted from using edged weapons?", options: ["Cleric", "Warlock", "Bard", "Ranger"], answer: 0, page: 3 },
  { q: "Which class cannot use holy weapons?", options: ["Paladin", "Cleric", "Warlock", "Monk"], answer: 2, page: 3 },

  // PAGE 4 - Cards, Currency, Modules
  { q: "How many Silver coins equal one Gold coin in SORC?", options: ["5", "10", "25", "100"], answer: 1, page: 4 },
  { q: "How many Copper coins equal one Silver coin in SORC?", options: ["5", "10", "25", "100"], answer: 1, page: 4 },
  { q: "What are the three standard currency denominations in Essentia?", options: ["Platinum, Gold, Silver", "Gold, Silver, Copper", "Gold, Silver, Bronze", "Credits, Gold, Silver"], answer: 1, page: 4 },
  { q: "Which world serves as the universe's primary reserve currency issuer?", options: ["Omne", "Ignis", "Zailister", "Tredici"], answer: 2, page: 4 },
  { q: "Which worlds refuse coins and trade only in Credits?", options: ["Ignis and Zailister", "Futurem, Omne, and Tredici", "Zailister and Tredici", "Only Omne"], answer: 1, page: 4 },
  { q: "What Card rank is included in a module of LVLs 1-5?", options: ["Rare", "Uncommon", "Common", "Heroic"], answer: 2, page: 4 },
  { q: "What Card rank is included in a module of LVLs 5-8?", options: ["Common", "Uncommon", "Rare", "Unique"], answer: 1, page: 4 },
  { q: "What is the highest item Rank in SORC?", options: ["Legendary", "Elite", "Divine", "Unique"], answer: 2, page: 4 },
  { q: "Which item Rank sits directly above Rare?", options: ["Uncommon", "Unique", "Heroic", "Elite"], answer: 1, page: 4 },

  // PAGE 5 - Combat, Movement, Armor, Encumbrance
  { q: "What does PROTS stand for in SORC?", options: ["Power Rating Over Target Score", "Protection Score", "Primary Roll Threshold", "Passive Resistance Stat"], answer: 1, page: 5 },
  { q: "What roll result counts as a Critical Hit in SORC?", options: ["Natural 1", "Natural 99 only", "96-100", "Any roll of 85+"], answer: 2, page: 5 },
  { q: "How much damage does a Critical Hit deal?", options: ["1.5x damage", "2x damage dice plus the source bonus", "3x damage dice", "Instant incapacitation"], answer: 1, page: 5 },
  { q: "What is the Initiative formula in SORC?", options: ["Base Speed + Agility Trait + Intuition Trait", "Agility + Vigilance + Luck", "Dexterity + Wit + Spirit", "Base Speed + Strength + Luck"], answer: 0, page: 5 },
  { q: "Which Trait breaks a tie on Initiative?", options: ["Agility", "Intuition", "Luck", "Spirit"], answer: 2, page: 5 },
  { q: "How many real-time seconds does each combat turn represent in SORC?", options: ["3", "6", "10", "12"], answer: 1, page: 5 },
  { q: "How much time does each Player have to complete their turn?", options: ["30 seconds", "1 minute", "2 minutes", "5 minutes"], answer: 2, page: 5 },
  { q: "What is the base movement speed for Standard size races?", options: ["25 ft", "30 ft", "35 ft", "40 ft"], answer: 1, page: 5 },
  { q: "What is the base movement speed for Goliath size races?", options: ["30 ft", "35 ft", "40 ft", "50 ft"], answer: 2, page: 5 },
  { q: "What is the base movement speed for Small size races?", options: ["20 ft", "25 ft", "30 ft", "35 ft"], answer: 1, page: 5 },
  { q: "In SORC's armor system, when does an attack successfully hit?", options: ["When the roll is lower than PROTS", "When the roll equals zero", "When the roll equals or exceeds PROTS", "When the roll is a natural 1"], answer: 2, page: 5 },
  { q: "What does the abbreviation 'AS' stand for in SORC?", options: ["Attack Speed", "Armor Set", "Action Score", "Armor Score"], answer: 3, page: 5 },
  { q: "What is the base Armor Score (AS) of Heavy (Plate) armor?", options: ["25", "35", "45", "60"], answer: 2, page: 5 },
  { q: "What does LST stand for in SORC combat?", options: ["Long-range Stealth Training", "Limb-Specific Targeting", "Light Strike Technique", "Luck Saving Throw"], answer: 1, page: 5 },
  { q: "How much carry capacity does each positive point of Strength add on top of the racial base?", options: ["10 lbs", "15 lbs", "20 lbs", "25 lbs"], answer: 1, page: 5 },
  { q: "At what load threshold does a character become Encumbered and unable to move or act?", options: ["0-94%", "95-99%", "100%+", "110%+"], answer: 2, page: 5 },
  { q: "What load percentage range still allows a character to move at full speed?", options: ["0-94%", "0-80%", "95-99%", "100%+"], answer: 0, page: 5 },
  { q: "What happens to a character at the Burdened load threshold (95-99%)?", options: ["They cannot act", "They move at half speed", "They move at full speed", "They drop all items"], answer: 1, page: 5 },
];

// GM Codex: the GM-only counterpart to the Basic Rules pool above, drawn from
// content/gm_essentials/gm_ref_001.html and gm_ref_002.html. IDs are offset by
// 1000 so they never collide with ASSESSMENT_QUESTIONS' 0-based indices when
// both pools are combined into one 20-question GM submission.
const GM_CODEX_QUESTIONS = [
  { q: "Per the GM Codex introduction, what actually gates a GM's access to Lobbies?", options: ["Reading the GM Codex itself", "Passing the SORC Assessment", "Owning a physical box set", "An admin invitation"], answer: 1, page: 1 },
  { q: "Can a GM ever simulate a character's Rank?", options: ["Yes, freely", "Yes, but only up to Uncommon", "No — Rank is only ever earned, no exceptions", "Only for NPCs"], answer: 2, page: 1 },
  { q: "What happens to a Common or Uncommon rank Companion that dies?", options: ["It enters the boneyard for repair", "It can be resurrected once per campaign", "It is permanently lost and never enters the boneyard", "The GM automatically replaces it"], answer: 2, page: 1 },
  { q: "At what item Rank does Attunement become required before an armament can be enhanced or Bound?", options: ["Rare and above", "Unique and above", "Heroic and above", "Legendary and above"], answer: 2, page: 1 },
  { q: "Per the GM Codex Quick Reference table, what Card Rank is included in a module of Level 18-23?", options: ["Unique", "Heroic", "Elite", "Legendary"], answer: 1, page: 1 },
  { q: "How many Drawn Ability picks does a character earn per year of age lived?", options: ["One every 2 years", "Exactly one, every year, flat", "One per Growth", "Two per year"], answer: 1, page: 2 },
  { q: "A character who commits to a 20-ability capstone Drawn Ability tree and a 19-ability runner-up tree has spent how many of their 40 lifetime picks?", options: ["20", "30", "39", "40"], answer: 2, page: 2 },
  { q: "How many total Class Ability picks does a character have across their entire career (Ch. Lvl 1 through 30)?", options: ["40", "50", "59", "60"], answer: 2, page: 2 },
  { q: "Roughly how much cumulative XP does Ch. Lvl 30 require?", options: ["Roughly 1 million", "Roughly 1.5 million", "Roughly 2.58 million", "Roughly 3 million"], answer: 2, page: 2 },
  { q: "In Attribute Development, how many d6 are rolled and how many of the lowest results are discarded?", options: ["Roll 1d6 six times, discard 1 lowest", "Roll 1d6 nine times, discard the two lowest", "Roll 1d6 seven times, discard none", "Roll 1d6 ten times, discard the three lowest"], answer: 1, page: 2 },
];

const ASSESSMENT_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// PC-track scoring, also used as the fallback grade for a GM-track attempt
// that doesn't clear the perfect-score GM bar (see calcSorcRole below) — an
// imperfect GM attempt still gets fair credit for their Basic Rules score.
function calcPcRole(basicRulesScore: number): string {
  if (basicRulesScore < 6) return 'FAIL';
  if (basicRulesScore >= 9) return 'PC-ADV';
  if (basicRulesScore === 8) return 'PC-INT';
  return 'PC-BEG';
}

// GM track requires a perfect score across BOTH sections (10 Basic Rules +
// 10 GM Codex, 20 total) to be granted GM-ADV. Anything less than a perfect
// 20/20 falls back to grading just the Basic Rules portion as a normal PC
// attempt, rather than a blanket fail.
function calcSorcRole(basicRulesScore: number, gmTrack: boolean, gmCodexScore?: number): string {
  if (gmTrack) {
    if (basicRulesScore === 10 && gmCodexScore === 10) return 'GM-ADV';
    return calcPcRole(basicRulesScore);
  }
  return calcPcRole(basicRulesScore);
}

app.get('/api/assess', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const result = await c.env.sorc_db.prepare(
    `SELECT * FROM assessments WHERE user_id = ?`
  ).bind(user.id).first() as any;
  let expired = false;
  let expires_at: string | null = null;
  if (result) {
    const takenMs = new Date(result.taken_at).getTime();
    expires_at = new Date(takenMs + ASSESSMENT_EXPIRY_MS).toISOString();
    expired = Date.now() > takenMs + ASSESSMENT_EXPIRY_MS;
  }
  return c.json({ assessment: result || null, expired, expires_at, needs_reassess: !!(user.needs_reassess) });
});

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

app.get('/api/assess/questions', authMiddleware, async (c) => {
  const gmTrack = c.req.query('gm_track') === '1';
  const basicPool = shuffle(ASSESSMENT_QUESTIONS.map((q, i) => ({ ...q, id: i, section: 'basic' })));
  const basicQuestions = basicPool.slice(0, 10);

  let questions = basicQuestions;
  if (gmTrack) {
    // GM Codex ids are offset by 1000 so they never collide with the Basic
    // Rules 0-based indices once both sections are combined for grading.
    const codexPool = shuffle(GM_CODEX_QUESTIONS.map((q, i) => ({ ...q, id: 1000 + i, section: 'gm_codex' })));
    questions = basicQuestions.concat(codexPool.slice(0, 10));
  }

  const out = questions.map(q => ({
    id: q.id,
    q: q.q,
    options: q.options,
    page: q.page,
    section: q.section
  }));
  /* Never cache: every request must return a freshly shuffled set of questions */
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  c.header('Pragma', 'no-cache');
  return c.json({ questions: out });
});

// Beta: the Player (PC) Assessment is open to anonymous visitors, no account
// required — a genuine try-before-you-join preview. GM stays account-only
// (it grants real lobby-creation power tied to a box code, this doesn't).
// No DB writes here at all: there's no user to attach a role to, so this
// never touches the users or assessments tables — just grades and returns
// the result. Rate-limited by IP since there's no user id to key on.
app.get('/api/assess/beta-questions', async (c) => {
  const pool = shuffle(ASSESSMENT_QUESTIONS.map((q, i) => ({ ...q, id: i, section: 'basic' })));
  const out = pool.slice(0, 10).map(q => ({ id: q.id, q: q.q, options: q.options, page: q.page, section: q.section }));
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  c.header('Pragma', 'no-cache');
  return c.json({ questions: out });
});

app.post('/api/assess/beta-submit', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const allowed = await checkRateLimit(c.env.sorc_db, `assess-beta:${ip}`, 10, 3600);
  if (!allowed) return c.json({ error: 'Too many assessment attempts. Please try again later.' }, 429);

  const { answers } = await c.req.json() as any;
  if (!Array.isArray(answers) || answers.length !== 10) {
    return c.json({ error: 'Must answer all 10 questions.' }, 400);
  }

  let score = 0;
  // Basic Rules pool is 83 questions deep and only 10 are ever shown per
  // attempt, so revealing the correct answer for a missed question here
  // only leaks one of 83 facts, not the whole quiz - safe to hand back for
  // the review screen (see showBetaResult/renderWrongReview in assess.html).
  const wrong: Array<{ id: number; answer: number }> = [];
  for (const entry of answers) {
    const qId = typeof entry === 'object' ? entry.id : null;
    const chosen = typeof entry === 'object' ? entry.answer : entry;
    if (qId !== null && qId >= 0 && qId < ASSESSMENT_QUESTIONS.length) {
      const correct = ASSESSMENT_QUESTIONS[qId].answer;
      if (chosen === correct) score++;
      else wrong.push({ id: qId, answer: correct });
    }
  }

  const role = calcPcRole(score);
  // Beta preview pass bar is 75% (8/10), stricter than the normal PC-BEG floor
  // (6/10) used for the real, logged-in assessment - the preview only shows a
  // pass message on a genuinely strong score.
  const passed = score >= 8;
  return c.json({ score, role, passed, beta: true, wrong });
});

app.post('/api/assess/submit', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const allowed = await checkRateLimit(c.env.sorc_db, `assess:${user.id}:${ip}`, 5, 3600);
  if (!allowed) return c.json({ error: 'Too many assessment attempts. Please try again later.' }, 429);

  const existing = await c.env.sorc_db.prepare(
    `SELECT id FROM assessments WHERE user_id = ?`
  ).bind(user.id).first();
  /* Allow overwrite when flagged for reassessment (expiry or incompetence) */
  if (existing && !user.needs_reassess) return c.json({ error: 'Already assessed. Use reassess to retake.' }, 400);
  if (existing && user.needs_reassess) {
    await c.env.sorc_db.prepare(`DELETE FROM assessments WHERE user_id = ?`).bind(user.id).run();
  }

  const { answers, gm_track } = await c.req.json() as any;
  const expectedCount = gm_track ? 20 : 10;
  if (!Array.isArray(answers) || answers.length !== expectedCount) {
    return c.json({ error: `Must answer all ${expectedCount} questions.` }, 400);
  }

  // GM track answers span both pools: Basic Rules ids are 0-based (< 1000),
  // GM Codex ids are offset by 1000 (see /api/assess/questions). Scored
  // separately so a GM attempt is graded per-section, not just combined.
  let basicScore = 0;
  let codexScore = 0;
  // Review data for the result screen's wrong-answer breakdown (see
  // renderWrongReview in assess.html). Basic Rules is an 83-question pool
  // with only 10 drawn per attempt, so handing back the correct answer for
  // a miss only leaks one of 83 facts - fine. GM Codex is the opposite: its
  // pool IS the 10 questions shown, every attempt, so revealing an answer
  // there would permanently burn that question for every future GM
  // attempt. Codex misses are flagged (id only, no answer) so the chosen
  // option still highlights red without exposing the fixed answer key.
  const wrong: Array<{ id: number; answer?: number }> = [];
  for (const entry of answers) {
    const qId = typeof entry === 'object' ? entry.id : null;
    const chosen = typeof entry === 'object' ? entry.answer : entry;
    if (qId === null) continue;
    if (qId >= 1000) {
      const codexId = qId - 1000;
      if (codexId >= 0 && codexId < GM_CODEX_QUESTIONS.length) {
        if (chosen === GM_CODEX_QUESTIONS[codexId].answer) codexScore++;
        else wrong.push({ id: qId });
      }
    } else if (qId >= 0 && qId < ASSESSMENT_QUESTIONS.length) {
      const correct = ASSESSMENT_QUESTIONS[qId].answer;
      if (chosen === correct) basicScore++;
      else wrong.push({ id: qId, answer: correct });
    }
  }

  const role = calcSorcRole(basicScore, !!gm_track, gm_track ? codexScore : undefined);
  const score = gm_track ? basicScore + codexScore : basicScore;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const siteRole = (role && role.startsWith('GM')) ? 'MASTER' : 'PLAYER';

  if (role === 'FAIL') {
    /* FAIL downgrades to Civilian everywhere — record it and update user */
    try {
      await c.env.sorc_db.prepare(
        `INSERT INTO assessments (id, user_id, score, role_granted, gm_track, taken_at) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(id, user.id, score, 'FAIL', gm_track ? 1 : 0, now).run();
      if (!isPrivileged(user)) {
        await c.env.sorc_db.prepare(
          `UPDATE users SET role = 'CIVILIAN', sorc_role = NULL, needs_reassess = 0, updated_at = ? WHERE id = ?`
        ).bind(now, user.id).run();
      }
    } catch(_) {}
    return c.json({ score, basic_score: basicScore, codex_score: gm_track ? codexScore : undefined, role: 'FAIL', passed: false, message: 'Score too low — you have been downgraded to Civilian. Study the Basic Rules and reassess to regain lobby access.', wrong });
  }

  try {
    await c.env.sorc_db.prepare(
      `INSERT INTO assessments (id, user_id, score, role_granted, gm_track, taken_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(id, user.id, score, role, gm_track ? 1 : 0, now).run();

    // Update both the site role (PLAYER/MASTER) and the sorc_role (PC-BEG/INT/ADV/GM-ADV)
    // Award community points only on first-ever assessment (assessment_rewarded = 0)
    const fullUser = await c.env.sorc_db.prepare(`SELECT assessment_rewarded, needs_reassess FROM users WHERE id = ?`).bind(user.id).first() as any;
    const firstTime = !fullUser?.assessment_rewarded;
    const pointsAwarded = firstTime ? (siteRole === 'MASTER' ? 200 : 100) : 0;

    const preserveRole = isPrivileged(user);
    if (preserveRole) {
      await c.env.sorc_db.prepare(
        `UPDATE users SET sorc_role = ?, needs_reassess = 0, assessment_rewarded = 1,
         community_points = community_points + ?, updated_at = ? WHERE id = ?`
      ).bind(role, pointsAwarded, now, user.id).run();
    } else {
      await c.env.sorc_db.prepare(
        `UPDATE users SET role = ?, sorc_role = ?, needs_reassess = 0, assessment_rewarded = 1,
         community_points = community_points + ?, updated_at = ? WHERE id = ?`
      ).bind(siteRole, role, pointsAwarded, now, user.id).run();
    }

    return c.json({ score, basic_score: basicScore, codex_score: gm_track ? codexScore : undefined, role, site_role: preserveRole ? user.role : siteRole, passed: true, points_awarded: pointsAwarded, wrong });
  } catch (error: any) {
    return c.json({ error: 'Failed to save assessment.', details: error.message }, 500);
  }
});

app.delete('/api/assess', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const now = new Date().toISOString();
  await c.env.sorc_db.prepare(`DELETE FROM assessments WHERE user_id = ?`).bind(user.id).run();
  if (isPrivileged(user)) {
    await c.env.sorc_db.prepare(
      `UPDATE users SET sorc_role = NULL, needs_reassess = 0, updated_at = ? WHERE id = ?`
    ).bind(now, user.id).run();
  } else {
    await c.env.sorc_db.prepare(
      `UPDATE users SET sorc_role = NULL, role = 'CIVILIAN', needs_reassess = 0, updated_at = ? WHERE id = ?`
    ).bind(now, user.id).run();
  }
  return c.json({ success: true });
});

// ─── BOX SET CODE VALIDATION ───────────────────────────────────────────────────
// Ported from sorc-app (2026-08-24): sorc-api is the Worker actually bound to
// api.sorcrpg.com, but never had this system - box_set_codes was created and
// used by sorc-app alone. Same shared D1 database, so the table already
// exists live; this just gives the live API routes to reach it.

// ---------------------------------------------------------------------------
// Chat roll codes. A message containing e.g. "3ROLLD100:" is rolled here, on
// the server - a client-supplied result could be forged. "GM" in front hides
// the outcome from everyone but the GM, while still recording it.
//   xROLLD4:  xROLLD6:  xROLLD10:  xROLLD100:  xROLLD100+100:
// x is optional and defaults to 1.
// ---------------------------------------------------------------------------
const ROLL_CODE_RE = /\b(GM)?(\d{0,2})ROLLD(100\+100|100|10|6|4):/gi;
const MAX_DICE_PER_CODE = 20;

// Unbiased 1..sides using rejection sampling; a plain modulo skews low faces.
function rollDie(sides: number): number {
  const limit = Math.floor(256 / sides) * sides;
  const buf = new Uint8Array(1);
  let v: number;
  do { crypto.getRandomValues(buf); v = buf[0]; } while (v >= limit);
  return (v % sides) + 1;
}

interface RollResult {
  code: string; gm: boolean; count: number; die: string;
  rolls: number[]; total: number;
}

function resolveRollCodes(body: string): RollResult[] {
  const out: RollResult[] = [];
  ROLL_CODE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ROLL_CODE_RE.exec(body)) !== null) {
    const gm = !!m[1];
    const count = Math.min(Math.max(parseInt(m[2] || '1', 10) || 1, 1), MAX_DICE_PER_CODE);
    const dieRaw = m[3].toLowerCase();
    // D100 + D100 is two percentile rolls added together, 2 to 200, used for
    // Rare and Divine items (see Basic Rules pg. 1). It is not a flat +100.
    const pair = dieRaw === '100+100';
    const sides = pair ? 100 : parseInt(dieRaw, 10);
    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(pair ? rollDie(100) + rollDie(100) : rollDie(sides));
    }
    out.push({
      code: m[0], gm, count, die: 'd' + dieRaw,
      rolls, total: rolls.reduce((a, b) => a + b, 0),
    });
    if (out.length >= 10) break; // one message can't spam unlimited codes
  }
  return out;
}

function formatRolls(r: RollResult): string {
  const detail = r.count > 1 ? ` [${r.rolls.join(', ')}]` : '';
  return `${r.count}${r.die} = ${r.total}${detail}`;
}

async function validateBoxSetCode(db: D1Database, code: string, userId: string): Promise<{ valid: boolean; error?: string }> {
  const row = await db.prepare(`SELECT * FROM box_set_codes WHERE code = ?`).bind(code.toUpperCase().trim()).first() as any;
  if (!row) return { valid: false, error: 'Invalid box set code.' };
  if (row.owner_uid && row.owner_uid !== userId) return { valid: false, error: 'This box set code is already registered to another account.' };
  if (row.expires_at && new Date(row.expires_at) < new Date()) return { valid: false, error: 'This code has expired.' };
  return { valid: true };
}

async function claimBoxSetCode(db: D1Database, code: string, userId: string) {
  const now = new Date().toISOString();
  await db.prepare(`UPDATE box_set_codes SET owner_uid = ?, claimed_at = ? WHERE code = ? AND (owner_uid IS NULL OR owner_uid = ?)`)
    .bind(userId, now, code.toUpperCase().trim(), userId).run();
}

// Pro Membership = owning a claimed box set code. There is no separate
// purchase/subscription flow - claiming a code (admin-generated,
// server-validated) is the only way to become Pro. No client-writable field
// exists for this, on purpose - do not add one without a real redemption or
// payment flow behind it.
async function isProMember(db: D1Database, user: any): Promise<boolean> {
  if (isPrivileged(user)) return true;
  const owned = await db.prepare(`SELECT id FROM box_set_codes WHERE owner_uid = ? LIMIT 1`).bind(user.id).first();
  return !!owned;
}

app.post('/api/box-codes/generate', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  if (!isPrivileged(user)) return c.json({ error: 'Forbidden.' }, 403);
  try {
    const now = new Date().toISOString();
    // Format: GEN + 6 random digits + BSC
    const rng = crypto.getRandomValues(new Uint8Array(6));
    let code = 'GEN';
    for (let i = 0; i < 6; i++) code += rng[i] % 10;
    code += 'BSC';
    const expiresAt = new Date(Date.now() + 2 * 86400000).toISOString();
    // Ensure optional columns exist (ignore if already present)
    await c.env.sorc_db.prepare(`ALTER TABLE box_set_codes ADD COLUMN created_by TEXT`).run().catch(() => {});
    await c.env.sorc_db.prepare(`ALTER TABLE box_set_codes ADD COLUMN note TEXT`).run().catch(() => {});
    await c.env.sorc_db.prepare(`ALTER TABLE box_set_codes ADD COLUMN created_at TEXT`).run().catch(() => {});
    await c.env.sorc_db.prepare(`ALTER TABLE box_set_codes ADD COLUMN expires_at TEXT`).run().catch(() => {});
    await c.env.sorc_db.prepare(
      `INSERT INTO box_set_codes (id, code, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), code, user.id, now, expiresAt).run();
    return c.json({ success: true, code, expires_at: expiresAt });
  } catch (error: any) {
    return c.json({ error: 'Failed to generate code.', details: error.message }, 500);
  }
});

// ─── GM CODES (role upgrade: PLAYER → MASTER) ─────────────────────────────────

async function ensureGmCodesTable(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS gm_codes (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    created_by TEXT NOT NULL,
    note TEXT,
    used_by TEXT,
    used_at TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT
  )`).run();
}

app.post('/api/gm-codes/generate', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  if (!isPrivileged(user)) return c.json({ error: 'Forbidden.' }, 403);
  await ensureGmCodesTable(c.env.sorc_db);
  const { note, days } = await c.req.json().catch(() => ({} as any)) as any;
  const now = new Date().toISOString();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rng = crypto.getRandomValues(new Uint8Array(8));
  let suffix = '';
  for (let i = 0; i < 8; i++) suffix += chars[rng[i] % chars.length];
  const code = 'GM-' + suffix;
  const expireDays = (typeof days === 'number' && days > 0) ? days : 7;
  const expiresAt = new Date(Date.now() + expireDays * 86400000).toISOString();
  await c.env.sorc_db.prepare(
    `INSERT INTO gm_codes (id, code, created_by, note, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), code, user.id, note ? note.substring(0, 100) : null, now, expiresAt).run();
  return c.json({ success: true, code, expires_at: expiresAt });
});

app.post('/api/gm-codes/redeem', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  if (user.role === 'MASTER') return c.json({ error: 'Already a GM.' }, 400);
  if (user.role !== 'PLAYER') return c.json({ error: 'Complete the Player Assessment before redeeming a GM code.' }, 400);
  await ensureGmCodesTable(c.env.sorc_db);
  const { code } = await c.req.json().catch(() => ({} as any)) as any;
  if (!code) return c.json({ error: 'GM code required.' }, 400);
  const row = await c.env.sorc_db.prepare(`SELECT * FROM gm_codes WHERE code = ?`).bind(code.toUpperCase().trim()).first() as any;
  if (!row) return c.json({ error: 'Invalid GM code.' }, 400);
  if (row.used_by) return c.json({ error: 'This GM code has already been used.' }, 400);
  if (row.expires_at && new Date(row.expires_at) < new Date()) return c.json({ error: 'This GM code has expired.' }, 400);
  const now = new Date().toISOString();
  await c.env.sorc_db.prepare(`UPDATE gm_codes SET used_by = ?, used_at = ? WHERE code = ?`).bind(user.id, now, code.toUpperCase().trim()).run();
  await c.env.sorc_db.prepare(
    `UPDATE users SET role = 'MASTER', sorc_role = 'GM-ADV', community_points = community_points + 500, updated_at = ? WHERE id = ?`
  ).bind(now, user.id).run();
  return c.json({ success: true, role: 'MASTER', sorc_role: 'GM-ADV', points_awarded: 500 });
});

app.get('/api/gm-codes/generated', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  if (!isPrivileged(user)) return c.json({ error: 'Forbidden.' }, 403);
  await ensureGmCodesTable(c.env.sorc_db);
  const rows = await c.env.sorc_db.prepare(
    `SELECT code, note, used_by, used_at, created_at, expires_at FROM gm_codes WHERE created_by = ? ORDER BY created_at DESC LIMIT 50`
  ).bind(user.id).all();
  return c.json({ codes: rows.results || [] });
});

// ─── LOBBIES ───────────────────────────────────────────────────────────────────
// Ported from sorc-app (2026-08-24): "Browse & join Tavern Lobbies" is
// advertised to every member (Basic and Pro alike) but had zero backing
// routes on sorc-api, the Worker actually live at api.sorcrpg.com.

app.get('/api/lobbies', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const assessment = await c.env.sorc_db.prepare(
    `SELECT * FROM assessments WHERE user_id = ?`
  ).bind(user.id).first() as any;

  const lobbies = await c.env.sorc_db.prepare(
    `SELECT l.*, u.username as creator_name, u.display_name as creator_display
     FROM lobbies l JOIN users u ON l.creator_uid = u.id
     WHERE l.is_private = 0 AND l.status != 'closed'
     ORDER BY l.created_at DESC LIMIT 50`
  ).all();

  return c.json({
    lobbies: lobbies.results || [],
    assessed: !!assessment || isPrivileged(user),
    sorc_role: user.sorc_role || assessment?.role_granted || null,
    is_privileged: isPrivileged(user),
    needs_reassess: !!(user.needs_reassess)
  });
});

app.post('/api/lobbies', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const assessment = await c.env.sorc_db.prepare(
    `SELECT * FROM assessments WHERE user_id = ?`
  ).bind(user.id).first() as any;
  if (!assessment && !isPrivileged(user)) return c.json({ error: 'You must complete the assessment before creating a lobby.', needs_reassess: true }, 403);

  if (!isPrivileged(user) && assessment) {
    const age = Date.now() - new Date(assessment.taken_at).getTime();
    if (age > ASSESSMENT_EXPIRY_MS) {
      await c.env.sorc_db.prepare(`UPDATE users SET needs_reassess = 1, updated_at = ? WHERE id = ?`).bind(new Date().toISOString(), user.id).run();
      return c.json({ error: 'Your assessment has expired (30 days). Please reassess to create lobbies.', needs_reassess: true }, 403);
    }
  }

  if (user.needs_reassess && !isPrivileged(user)) {
    return c.json({ error: 'You are flagged for reassessment. Please reassess before creating lobbies.', needs_reassess: true }, 403);
  }

  const { name, box_set_code, is_private } = await c.req.json() as any;
  if (!name || !name.trim()) return c.json({ error: 'Lobby name required.' }, 400);

  const existingLobby = await c.env.sorc_db.prepare(
    `SELECT id FROM lobbies WHERE creator_uid = ? AND status != 'closed'`
  ).bind(user.id).first();
  if (existingLobby) return c.json({ error: 'You already have an active lobby. Close it before creating a new one.' }, 400);

  if (!isPrivileged(user)) {
    if (!box_set_code) return c.json({ error: 'A box set code is required to create a lobby.' }, 400);
    const codeCheck = await validateBoxSetCode(c.env.sorc_db, box_set_code, user.id);
    if (!codeCheck.valid) return c.json({ error: codeCheck.error || 'Invalid box set code.' }, 400);
  }

  const lobbyId = crypto.randomUUID();
  const lobbyCode = genLobbyCode();
  const now = new Date().toISOString();
  const memberId = crypto.randomUUID();

  try {
    if (!isPrivileged(user) && box_set_code) {
      await claimBoxSetCode(c.env.sorc_db, box_set_code, user.id);
    }

    await c.env.sorc_db.prepare(
      `INSERT INTO lobbies (id, name, creator_uid, is_private, status, max_members, member_count, lobby_code, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'open', 20, 1, ?, ?, ?)`
    ).bind(lobbyId, name.trim().substring(0, 60), user.id, is_private ? 1 : 0, lobbyCode, now, now).run();

    const creatorRole = assessment?.role_granted || user.sorc_role || user.role;
    await c.env.sorc_db.prepare(
      `INSERT INTO lobby_members (id, lobby_id, user_id, sorc_role, username, display_name, joined_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(memberId, lobbyId, user.id, creatorRole, user.username, user.display_name || user.username, now).run();

    return c.json({ success: true, lobby_id: lobbyId, lobby_code: lobbyCode });
  } catch (error: any) {
    return c.json({ error: 'Failed to create lobby.', details: error.message }, 500);
  }
});

app.get('/api/lobbies/:id', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const lobbyId = c.req.param('id');

  const lobby = await c.env.sorc_db.prepare(
    `SELECT l.*, u.username as creator_name, u.display_name as creator_display
     FROM lobbies l JOIN users u ON l.creator_uid = u.id WHERE l.id = ?`
  ).bind(lobbyId).first() as any;
  if (!lobby) return c.json({ error: 'Lobby not found' }, 404);

  const privileged = isPrivileged(user);

  if (lobby.is_private && lobby.creator_uid !== user.id && !privileged) {
    const isMember = await c.env.sorc_db.prepare(
      `SELECT id FROM lobby_members WHERE lobby_id = ? AND user_id = ?`
    ).bind(lobbyId, user.id).first();
    if (!isMember) return c.json({ error: 'This lobby is private.' }, 403);
  }

  // Include username for profile links; privileged users also see user_id for admin tools
  const members = await c.env.sorc_db.prepare(
    `SELECT lm.*, u.avatar, u.user_id as public_uid, u.role as live_role, u.sorc_role as live_sorc_role, u.email as member_email FROM lobby_members lm
     LEFT JOIN users u ON lm.user_id = u.id WHERE lm.lobby_id = ? ORDER BY lm.joined_at ASC`
  ).bind(lobbyId).all();

  const OWNER_EMAILS_LIST = ['corbett@sorcrpg.com'];
  const ADMIN_EMAILS_LIST = ['markcorbett.mii@gmail.com'];

  const memberList = (members.results || []).map((m: any) => {
    let displayRole = m.live_role;
    if (OWNER_EMAILS_LIST.includes(m.member_email)) displayRole = 'OWNER';
    else if (ADMIN_EMAILS_LIST.includes(m.member_email)) displayRole = 'ADMIN';
    const out: any = {
      id: m.id, lobby_id: m.lobby_id, user_id: m.user_id,
      role: displayRole, sorc_role: m.live_sorc_role || m.sorc_role, username: m.username, display_name: m.display_name,
      joined_at: m.joined_at, is_muted: m.is_muted, avatar: m.avatar,
      profile_url: 'public-profile.html?u=' + encodeURIComponent(m.username)
    };
    if (privileged) out.public_uid = m.public_uid;
    return out;
  });

  const isMember = memberList.some((m: any) => m.user_id === user.id);
  const isCreator = lobby.creator_uid === user.id;

  return c.json({
    lobby, members: memberList, is_member: isMember || privileged,
    is_creator: isCreator, is_privileged: privileged
  });
});

app.post('/api/lobbies/join', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const privileged = isPrivileged(user);

  const assessment = await c.env.sorc_db.prepare(`SELECT * FROM assessments WHERE user_id = ?`).bind(user.id).first() as any;
  if (!assessment && !privileged) return c.json({ error: 'You must complete the assessment before joining a lobby.', needs_reassess: true }, 403);

  if (!privileged && assessment) {
    const age = Date.now() - new Date(assessment.taken_at).getTime();
    if (age > ASSESSMENT_EXPIRY_MS) {
      await c.env.sorc_db.prepare(`UPDATE users SET needs_reassess = 1, updated_at = ? WHERE id = ?`).bind(new Date().toISOString(), user.id).run();
      return c.json({ error: 'Your assessment has expired (30 days). Please reassess to rejoin lobbies.', needs_reassess: true }, 403);
    }
  }

  if (user.needs_reassess && !privileged) {
    return c.json({
      error: 'You are flagged for reassessment. Please reassess before joining lobbies.',
      needs_reassess: true
    }, 403);
  }

  const { lobby_id, lobby_code } = await c.req.json() as any;

  let lobby: any;
  if (lobby_code) {
    lobby = await c.env.sorc_db.prepare(`SELECT * FROM lobbies WHERE lobby_code = ?`).bind(lobby_code.toUpperCase().trim()).first();
  } else if (lobby_id) {
    lobby = await c.env.sorc_db.prepare(`SELECT * FROM lobbies WHERE id = ?`).bind(lobby_id).first();
  }
  if (!lobby) return c.json({ error: 'Lobby not found.' }, 404);
  if (lobby.status === 'closed') return c.json({ error: 'This lobby is closed.' }, 400);
  if (!privileged && lobby.member_count >= lobby.max_members) return c.json({ error: 'This lobby is full.' }, 400);

  const existing = await c.env.sorc_db.prepare(`SELECT id FROM lobby_members WHERE lobby_id = ? AND user_id = ?`).bind(lobby.id, user.id).first();
  if (existing) return c.json({ error: 'You are already in this lobby.' }, 400);

  const memberId = crypto.randomUUID();
  const now = new Date().toISOString();
  const memberRole = privileged ? user.role : (assessment?.role_granted || user.sorc_role);

  try {
    await c.env.sorc_db.prepare(
      `INSERT INTO lobby_members (id, lobby_id, user_id, sorc_role, username, display_name, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(memberId, lobby.id, user.id, memberRole, user.username, user.display_name || user.username, now).run();

    if (!privileged) {
      const newCount = (lobby.member_count || 1) + 1;
      const newStatus = newCount >= lobby.max_members ? 'full' : 'open';
      await c.env.sorc_db.prepare(`UPDATE lobbies SET member_count = ?, status = ?, updated_at = ? WHERE id = ?`).bind(newCount, newStatus, now, lobby.id).run();
    }

    return c.json({ success: true, lobby_name: lobby.name, lobby_id: lobby.id });
  } catch (error: any) {
    return c.json({ error: 'Failed to join lobby.', details: error.message }, 500);
  }
});

app.post('/api/lobbies/:id/leave', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const lobbyId = c.req.param('id');
  try {
    const lobby = await c.env.sorc_db.prepare(`SELECT * FROM lobbies WHERE id = ?`).bind(lobbyId).first() as any;
    if (!lobby) return c.json({ error: 'Lobby not found' }, 404);

    // One-time migration: add commandeered_from column if not yet present
    try {
      await c.env.sorc_db.prepare('ALTER TABLE lobbies ADD COLUMN commandeered_from TEXT').run();
    } catch (_) {}

    const now = new Date().toISOString();
    await c.env.sorc_db.prepare(`DELETE FROM lobby_members WHERE lobby_id = ? AND user_id = ?`).bind(lobbyId, user.id).run();

    if (lobby.creator_uid === user.id) {
      const next = await c.env.sorc_db.prepare(
        `SELECT lm.user_id FROM lobby_members lm
         LEFT JOIN box_set_codes bsc ON bsc.owner_uid = lm.user_id
         WHERE lm.lobby_id = ?
         ORDER BY CASE WHEN bsc.owner_uid IS NOT NULL THEN 0 ELSE 1 END ASC, lm.joined_at ASC
         LIMIT 1`
      ).bind(lobbyId).first() as any;
      if (next) {
        await c.env.sorc_db.prepare(
          `UPDATE lobbies SET creator_uid = ?, commandeered_from = ?, updated_at = ? WHERE id = ?`
        ).bind(next.user_id, user.username, now, lobbyId).run();
      } else {
        await c.env.sorc_db.prepare(`UPDATE lobbies SET status = 'closed', updated_at = ? WHERE id = ?`)
          .bind(now, lobbyId).run();
      }
    }

    const newCount = Math.max(0, (lobby.member_count || 1) - 1);
    await c.env.sorc_db.prepare(`UPDATE lobbies SET member_count = ?, updated_at = ? WHERE id = ?`).bind(newCount, now, lobbyId).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to leave lobby.', details: error.message }, 500);
  }
});

app.delete('/api/lobbies/:id', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const lobbyId = c.req.param('id');
  const lobby = await c.env.sorc_db.prepare(`SELECT * FROM lobbies WHERE id = ?`).bind(lobbyId).first() as any;
  if (!lobby) return c.json({ error: 'Lobby not found' }, 404);
  if (lobby.creator_uid !== user.id && !isPrivileged(user)) return c.json({ error: 'Only the creator can close this lobby.' }, 403);
  await c.env.sorc_db.prepare(`UPDATE lobbies SET status = 'closed', updated_at = ? WHERE id = ?`).bind(new Date().toISOString(), lobbyId).run();
  return c.json({ success: true });
});

app.post('/api/lobbies/:id/invite', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const lobbyId = c.req.param('id');
  try {
    const { username } = await c.req.json() as any;
    if (!username) return c.json({ error: 'Username required.' }, 400);
    const lobby = await c.env.sorc_db.prepare(`SELECT * FROM lobbies WHERE id = ?`).bind(lobbyId).first() as any;
    if (!lobby) return c.json({ error: 'Lobby not found.' }, 404);
    if (lobby.creator_uid !== user.id && !isPrivileged(user)) return c.json({ error: 'Only the host can send invites.' }, 403);
    const target = await c.env.sorc_db.prepare(`SELECT id, username, display_name FROM users WHERE username = ?`).bind(username.trim()).first() as any;
    if (!target) return c.json({ error: 'Player not found.' }, 404);
    if (target.id === user.id) return c.json({ error: 'Cannot invite yourself.' }, 400);
    const now = new Date().toISOString();
    const myName = user.display_name || user.username;
    const targetName = target.display_name || target.username;
    const msgBody = `You've been invited to join "${lobby.name}"! Use code ${lobby.lobby_code} on the Lobbies page.`;
    const existing = await c.env.sorc_db.prepare(
      `SELECT id FROM conversations WHERE (user1_uid = ? AND user2_uid = ?) OR (user1_uid = ? AND user2_uid = ?)`
    ).bind(user.id, target.id, target.id, user.id).first() as any;
    if (existing) {
      await c.env.sorc_db.prepare(
        `INSERT INTO messages (id, conversation_id, sender_uid, sender_name, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), existing.id, user.id, myName, msgBody, now).run();
      await c.env.sorc_db.prepare(
        `UPDATE conversations SET last_message_text = ?, last_message_at = ? WHERE id = ?`
      ).bind(msgBody.substring(0, 100), now, existing.id).run();
    } else {
      const convId = crypto.randomUUID();
      await c.env.sorc_db.prepare(
        `INSERT INTO conversations (id, user1_uid, user2_uid, user1_name, user2_name, status, last_message_text, created_at, last_message_at) VALUES (?, ?, ?, ?, ?, 'accepted', ?, ?, ?)`
      ).bind(convId, user.id, target.id, myName, targetName, msgBody.substring(0, 100), now, now).run();
      await c.env.sorc_db.prepare(
        `INSERT INTO messages (id, conversation_id, sender_uid, sender_name, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), convId, user.id, myName, msgBody, now).run();
    }
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to send invite.', details: error.message }, 500);
  }
});

app.get('/api/lobbies/:id/invite-pool', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const lobbyId = c.req.param('id');
  const lobby = await c.env.sorc_db.prepare(`SELECT * FROM lobbies WHERE id = ?`).bind(lobbyId).first() as any;
  if (!lobby) return c.json({ error: 'Lobby not found.' }, 404);
  if (lobby.creator_uid !== user.id && !isPrivileged(user)) return c.json({ error: 'Not authorized.' }, 403);

  // Fellowships: accepted fellows not already in this lobby
  const fellowsRaw = await c.env.sorc_db.prepare(
    `SELECT u.id, u.username, u.display_name, u.sorc_role
     FROM fellowships f
     JOIN users u ON u.id = CASE WHEN f.sender_uid = ? THEN f.receiver_uid ELSE f.sender_uid END
     WHERE (f.sender_uid = ? OR f.receiver_uid = ?) AND f.status = 'accepted'
       AND u.id NOT IN (SELECT user_id FROM lobby_members WHERE lobby_id = ?)
     ORDER BY u.display_name ASC LIMIT 50`
  ).bind(user.id, user.id, user.id, lobbyId).all();

  // Players currently in other open lobbies not already in this one
  const othersRaw = await c.env.sorc_db.prepare(
    `SELECT u.id, u.username, u.display_name, u.sorc_role, l.name as lobby_name
     FROM lobby_members lm
     JOIN users u ON u.id = lm.user_id
     JOIN lobbies l ON l.id = lm.lobby_id
     WHERE l.id != ? AND l.status != 'closed' AND l.is_private = 0
       AND lm.user_id NOT IN (SELECT user_id FROM lobby_members WHERE lobby_id = ?)
     ORDER BY lm.joined_at DESC LIMIT 50`
  ).bind(lobbyId, lobbyId).all();

  return c.json({ fellowships: fellowsRaw.results || [], others: othersRaw.results || [] });
});

const SUMMON_DDL = `CREATE TABLE IF NOT EXISTS lobby_summons (
  id TEXT PRIMARY KEY,
  lobby_id TEXT NOT NULL,
  lobby_name TEXT NOT NULL,
  from_uid TEXT NOT NULL,
  from_name TEXT NOT NULL,
  to_uid TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
)`;

app.post('/api/lobbies/:id/summon', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const lobbyId = c.req.param('id');
  try {
    await c.env.sorc_db.prepare(SUMMON_DDL).run();
    const lobby = await c.env.sorc_db.prepare(`SELECT * FROM lobbies WHERE id = ?`).bind(lobbyId).first() as any;
    if (!lobby) return c.json({ error: 'Lobby not found.' }, 404);
    if (lobby.creator_uid !== user.id && !isPrivileged(user)) return c.json({ error: 'Only the host can send summons.' }, 403);
    if (lobby.status === 'closed') return c.json({ error: 'Lobby is closed.' }, 400);

    const { to_uid, note } = await c.req.json() as any;
    if (!to_uid) return c.json({ error: 'Target player required.' }, 400);
    if (to_uid === user.id) return c.json({ error: 'Cannot summon yourself.' }, 400);

    const target = await c.env.sorc_db.prepare(
      `SELECT id FROM users WHERE id = ? AND (banned IS NULL OR banned = 0)`
    ).bind(to_uid).first() as any;
    if (!target) return c.json({ error: 'Player not found.' }, 404);

    const isMember = await c.env.sorc_db.prepare(
      `SELECT id FROM lobby_members WHERE lobby_id = ? AND user_id = ?`
    ).bind(lobbyId, to_uid).first() as any;
    if (isMember) return c.json({ error: 'Player is already in this lobby.' }, 400);

    await c.env.sorc_db.prepare(
      `UPDATE lobby_summons SET status = 'superseded' WHERE lobby_id = ? AND from_uid = ? AND to_uid = ? AND status = 'pending'`
    ).bind(lobbyId, user.id, to_uid).run();

    const summonId = crypto.randomUUID();
    const fromName = user.display_name || user.username;
    const now = new Date().toISOString();
    await c.env.sorc_db.prepare(
      `INSERT INTO lobby_summons (id, lobby_id, lobby_name, from_uid, from_name, to_uid, note, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
    ).bind(summonId, lobbyId, lobby.name, user.id, fromName, to_uid, note || null, now).run();

    return c.json({ success: true, summon_id: summonId });
  } catch (error: any) {
    return c.json({ error: 'Failed to send summon.', details: error.message }, 500);
  }
});

app.get('/api/summons/pending', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    await c.env.sorc_db.prepare(SUMMON_DDL).run();
    const summons = await c.env.sorc_db.prepare(
      `SELECT * FROM lobby_summons WHERE to_uid = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 5`
    ).bind(user.id).all();
    return c.json({ summons: summons.results || [] });
  } catch (e: any) {
    return c.json({ summons: [] });
  }
});

app.post('/api/summons/:id/respond', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const summonId = c.req.param('id');
  try {
    await c.env.sorc_db.prepare(SUMMON_DDL).run();
    const summon = await c.env.sorc_db.prepare(
      `SELECT * FROM lobby_summons WHERE id = ? AND to_uid = ? AND status = 'pending'`
    ).bind(summonId, user.id).first() as any;
    if (!summon) return c.json({ error: 'Summon not found or already handled.' }, 404);

    const { accept } = await c.req.json() as any;
    const newStatus = accept ? 'accepted' : 'denied';
    await c.env.sorc_db.prepare(`UPDATE lobby_summons SET status = ? WHERE id = ?`).bind(newStatus, summonId).run();

    if (accept) {
      const playerName = user.display_name || user.username;
      const activityBody = `⬡ ${playerName} joined ${summon.lobby_name}`;
      const now = new Date().toISOString();
      await c.env.sorc_db.prepare(
        `INSERT INTO world_messages (id, sender_uid, sender_name, sender_lobby_id, sender_lobby_name, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), user.id, playerName, summon.lobby_id, summon.lobby_name, activityBody, now).run().catch(() => {});
    }

    return c.json({ success: true, status: newStatus, lobby_id: accept ? summon.lobby_id : null });
  } catch (error: any) {
    return c.json({ error: 'Failed to respond to summon.', details: error.message }, 500);
  }
});

// ─── LOBBY OPERATIONS (chat, ready-check, DMs, mute/kick, transfer-host) ────
// Ported from sorc-app (2026-08-24).

app.get('/api/lobbies/:id/messages', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const lobbyId = c.req.param('id');
  const isMember = await c.env.sorc_db.prepare(`SELECT id FROM lobby_members WHERE lobby_id = ? AND user_id = ?`).bind(lobbyId, user.id).first();
  if (!isMember) return c.json({ error: 'Not a member of this lobby.' }, 403);
  const since = c.req.query('since');
  let msgs: any;
  if (since) {
    msgs = await c.env.sorc_db.prepare(`SELECT * FROM lobby_messages WHERE lobby_id = ? AND created_at > ? ORDER BY created_at ASC LIMIT 100`).bind(lobbyId, since).all();
  } else {
    msgs = await c.env.sorc_db.prepare(`SELECT * FROM lobby_messages WHERE lobby_id = ? ORDER BY created_at DESC LIMIT 80`).bind(lobbyId).all();
    msgs.results = (msgs.results || []).reverse();
  }
  const lobbyStatus = await c.env.sorc_db.prepare(`SELECT status FROM lobbies WHERE id = ?`).bind(lobbyId).first() as any;
  let lobbyTheme = 'default';
  try {
    await c.env.sorc_db.prepare(`CREATE TABLE IF NOT EXISTS lobby_themes (lobby_id TEXT PRIMARY KEY, theme TEXT NOT NULL)`).run();
    const themeRow = await c.env.sorc_db.prepare(`SELECT theme FROM lobby_themes WHERE lobby_id = ?`).bind(lobbyId).first() as any;
    if (themeRow?.theme) lobbyTheme = themeRow.theme;
  } catch {}
  let readyCheck: any = null;
  try {
    await c.env.sorc_db.prepare(`CREATE TABLE IF NOT EXISTS ready_checks (lobby_id TEXT PRIMARY KEY, check_id TEXT NOT NULL, initiated_at TEXT NOT NULL, initiated_by TEXT NOT NULL, initiated_name TEXT NOT NULL)`).run();
    await c.env.sorc_db.prepare(`CREATE TABLE IF NOT EXISTS ready_check_responses (lobby_id TEXT NOT NULL, check_id TEXT NOT NULL, user_id TEXT NOT NULL, username TEXT NOT NULL, status TEXT NOT NULL, responded_at TEXT NOT NULL, PRIMARY KEY (lobby_id, user_id))`).run();
    const rc = await c.env.sorc_db.prepare(`SELECT * FROM ready_checks WHERE lobby_id = ?`).bind(lobbyId).first() as any;
    if (rc) {
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      if (rc.initiated_at > fiveMinsAgo) {
        const resp = await c.env.sorc_db.prepare(`SELECT user_id, username, status FROM ready_check_responses WHERE lobby_id = ? AND check_id = ?`).bind(lobbyId, rc.check_id).all();
        readyCheck = { check_id: rc.check_id, initiated_at: rc.initiated_at, initiated_name: rc.initiated_name, responses: resp.results || [] };
      }
    }
  } catch {}
  return c.json({ messages: msgs.results || [], lobby_status: lobbyStatus?.status || 'open', lobby_theme: lobbyTheme, ready_check: readyCheck });
});

app.patch('/api/lobbies/:id/theme', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const lobbyId = c.req.param('id');
  const lobby = await c.env.sorc_db.prepare(`SELECT * FROM lobbies WHERE id = ?`).bind(lobbyId).first() as any;
  if (!lobby || (lobby.creator_uid !== user.id && !isPrivileged(user))) return c.json({ error: 'Not authorized.' }, 403);
  const { theme } = await c.req.json() as any;
  const VALID_THEMES = ['default', 'terminal', 'veilwood', 'ember', 'arcane', 'lawful'];
  if (!theme || !VALID_THEMES.includes(theme)) return c.json({ error: 'Invalid theme.' }, 400);
  await c.env.sorc_db.prepare(`CREATE TABLE IF NOT EXISTS lobby_themes (lobby_id TEXT PRIMARY KEY, theme TEXT NOT NULL)`).run();
  await c.env.sorc_db.prepare(`INSERT OR REPLACE INTO lobby_themes (lobby_id, theme) VALUES (?, ?)`).bind(lobbyId, theme).run();
  return c.json({ success: true });
});

app.post('/api/lobbies/:id/messages', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const lobbyId = c.req.param('id');
  const member = await c.env.sorc_db.prepare(`SELECT * FROM lobby_members WHERE lobby_id = ? AND user_id = ?`).bind(lobbyId, user.id).first() as any;
  if (!member) return c.json({ error: 'Not a member of this lobby.' }, 403);
  if (member.is_muted) return c.json({ error: 'You are muted in this lobby.' }, 403);
  const chatAllowed = await checkRateLimit(c.env.sorc_db, `lobbychat:${user.id}`, 20, 60);
  if (!chatAllowed) return c.json({ error: 'Slow down — too many messages.' }, 429);
  const { body } = await c.req.json() as any;
  if (!body || !body.trim()) return c.json({ error: 'Message cannot be empty.' }, 400);
  if (body.length > 500) return c.json({ error: 'Message too long (max 500 chars).' }, 400);
  const lobbyMsgCheck = filterContent(body.trim());
  if (lobbyMsgCheck.blocked) return c.json({ error: lobbyMsgCheck.reason }, 400);
  const msgId = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.sorc_db.prepare(
    `INSERT INTO lobby_messages (id, lobby_id, user_id, username, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(msgId, lobbyId, user.id, user.display_name || user.username, lobbyMsgCheck.filtered, now).run();
  return c.json({ success: true, message_id: msgId });
});

app.delete('/api/lobbies/:id/messages', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const lobbyId = c.req.param('id');
  const lobby = await c.env.sorc_db.prepare(`SELECT creator_uid FROM lobbies WHERE id = ?`).bind(lobbyId).first() as any;
  if (!lobby) return c.json({ error: 'Lobby not found.' }, 404);
  if (lobby.creator_uid !== user.id && !isPrivileged(user)) return c.json({ error: 'GM only.' }, 403);
  await c.env.sorc_db.prepare(`DELETE FROM lobby_messages WHERE lobby_id = ?`).bind(lobbyId).run();
  return c.json({ success: true });
});

app.delete('/api/lobbies/:id/messages/:msgId', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const lobbyId = c.req.param('id');
  const msgId = c.req.param('msgId');
  const lobby = await c.env.sorc_db.prepare(`SELECT creator_uid FROM lobbies WHERE id = ?`).bind(lobbyId).first() as any;
  if (!lobby) return c.json({ error: 'Lobby not found.' }, 404);
  if (lobby.creator_uid !== user.id && !isPrivileged(user)) return c.json({ error: 'GM only.' }, 403);
  await c.env.sorc_db.prepare(`DELETE FROM lobby_messages WHERE id = ? AND lobby_id = ?`).bind(msgId, lobbyId).run();
  return c.json({ success: true });
});

app.post('/api/lobbies/:id/ready-check', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const lobbyId = c.req.param('id');
  const lobby = await c.env.sorc_db.prepare(`SELECT creator_uid FROM lobbies WHERE id = ?`).bind(lobbyId).first() as any;
  if (!lobby) return c.json({ error: 'Lobby not found.' }, 404);
  if (lobby.creator_uid !== user.id && !isPrivileged(user)) return c.json({ error: 'Host only.' }, 403);
  const checkId = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.sorc_db.prepare(`CREATE TABLE IF NOT EXISTS ready_checks (lobby_id TEXT PRIMARY KEY, check_id TEXT NOT NULL, initiated_at TEXT NOT NULL, initiated_by TEXT NOT NULL, initiated_name TEXT NOT NULL)`).run();
  await c.env.sorc_db.prepare(`INSERT OR REPLACE INTO ready_checks (lobby_id, check_id, initiated_at, initiated_by, initiated_name) VALUES (?, ?, ?, ?, ?)`).bind(lobbyId, checkId, now, user.id, user.display_name || user.username).run();
  await c.env.sorc_db.prepare(`CREATE TABLE IF NOT EXISTS ready_check_responses (lobby_id TEXT NOT NULL, check_id TEXT NOT NULL, user_id TEXT NOT NULL, username TEXT NOT NULL, status TEXT NOT NULL, responded_at TEXT NOT NULL, PRIMARY KEY (lobby_id, user_id))`).run();
  await c.env.sorc_db.prepare(`DELETE FROM ready_check_responses WHERE lobby_id = ?`).bind(lobbyId).run();
  return c.json({ success: true, check_id: checkId });
});

app.post('/api/lobbies/:id/ready-check/respond', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const lobbyId = c.req.param('id');
  const body = await c.req.json() as any;
  const status = body.status === 'ready' ? 'ready' : 'not_ready';
  const checkId = body.check_id;
  if (!checkId) return c.json({ error: 'Missing check_id.' }, 400);
  const isMember = await c.env.sorc_db.prepare(`SELECT id FROM lobby_members WHERE lobby_id = ? AND user_id = ?`).bind(lobbyId, user.id).first();
  if (!isMember) return c.json({ error: 'Not a member.' }, 403);
  await c.env.sorc_db.prepare(`CREATE TABLE IF NOT EXISTS ready_check_responses (lobby_id TEXT NOT NULL, check_id TEXT NOT NULL, user_id TEXT NOT NULL, username TEXT NOT NULL, status TEXT NOT NULL, responded_at TEXT NOT NULL, PRIMARY KEY (lobby_id, user_id))`).run();
  await c.env.sorc_db.prepare(`INSERT OR REPLACE INTO ready_check_responses (lobby_id, check_id, user_id, username, status, responded_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(lobbyId, checkId, user.id, user.display_name || user.username, status, new Date().toISOString()).run();
  return c.json({ success: true });
});

app.get('/api/lobbies/:id/direct-messages', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const lobbyId = c.req.param('id');
  const isMember = await c.env.sorc_db.prepare(
    `SELECT id FROM lobby_members WHERE lobby_id = ? AND user_id = ?`
  ).bind(lobbyId, user.id).first();
  if (!isMember) return c.json({ error: 'Not a member.' }, 403);
  try {
    const result = await c.env.sorc_db.prepare(
      `SELECT * FROM lobby_dms WHERE lobby_id = ? AND (sender_uid = ? OR recipient_uid = ?) ORDER BY created_at DESC LIMIT 80`
    ).bind(lobbyId, user.id, user.id).all();
    return c.json({ messages: (result.results || []).reverse() });
  } catch {
    return c.json({ messages: [] });
  }
});

app.post('/api/lobbies/:id/direct-messages', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const lobbyId = c.req.param('id');
  const allowed = await checkRateLimit(c.env.sorc_db, `lobby_dm:${user.id}`, 20, 60);
  if (!allowed) return c.json({ error: 'Too many messages. Slow down.' }, 429);
  const isMember = await c.env.sorc_db.prepare(
    `SELECT id FROM lobby_members WHERE lobby_id = ? AND user_id = ?`
  ).bind(lobbyId, user.id).first();
  if (!isMember) return c.json({ error: 'Not a member.' }, 403);
  const { to_uid, body } = await c.req.json();
  if (!to_uid || !body || typeof body !== 'string') return c.json({ error: 'to_uid and body required.' }, 400);
  const trimmed = body.trim().slice(0, 400);
  if (!trimmed) return c.json({ error: 'Message cannot be empty.' }, 400);
  if (to_uid === user.id) return c.json({ error: 'Cannot message yourself.' }, 400);
  const recipient = await c.env.sorc_db.prepare(
    `SELECT id FROM lobby_members WHERE lobby_id = ? AND user_id = ?`
  ).bind(lobbyId, to_uid).first();
  if (!recipient) return c.json({ error: 'Recipient is not in this lobby.' }, 404);
  const senderName = user.display_name || user.username;
  const check = filterContent(trimmed);
  if (check.blocked) return c.json({ error: 'Message blocked: ' + check.reason }, 400);
  try {
    await c.env.sorc_db.prepare(
      `INSERT INTO lobby_dms (id, lobby_id, sender_uid, sender_name, recipient_uid, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), lobbyId, user.id, senderName, to_uid, check.filtered, new Date().toISOString()).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: 'Could not send message.' }, 500);
  }
});

app.patch('/api/lobbies/:id/members/:uid/mute', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const lobbyId = c.req.param('id');
  const targetUid = c.req.param('uid');
  const lobby = await c.env.sorc_db.prepare(`SELECT * FROM lobbies WHERE id = ?`).bind(lobbyId).first() as any;
  if (!lobby || lobby.creator_uid !== user.id) return c.json({ error: 'Not authorized.' }, 403);
  const member = await c.env.sorc_db.prepare(`SELECT * FROM lobby_members WHERE lobby_id = ? AND user_id = ?`).bind(lobbyId, targetUid).first() as any;
  if (!member) return c.json({ error: 'Member not found.' }, 404);
  const newMuted = member.is_muted ? 0 : 1;
  await c.env.sorc_db.prepare(`UPDATE lobby_members SET is_muted = ? WHERE lobby_id = ? AND user_id = ?`).bind(newMuted, lobbyId, targetUid).run();
  return c.json({ success: true, muted: !!newMuted });
});

app.delete('/api/lobbies/:id/members/:uid', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const lobbyId = c.req.param('id');
  const targetUid = c.req.param('uid');
  const lobby = await c.env.sorc_db.prepare(`SELECT * FROM lobbies WHERE id = ?`).bind(lobbyId).first() as any;
  if (!lobby || (lobby.creator_uid !== user.id && !isPrivileged(user))) return c.json({ error: 'Not authorized.' }, 403);
  if (targetUid === user.id) return c.json({ error: 'Cannot kick yourself.' }, 400);
  await c.env.sorc_db.prepare(`DELETE FROM lobby_members WHERE lobby_id = ? AND user_id = ?`).bind(lobbyId, targetUid).run();
  const newCount = Math.max(1, (lobby.member_count || 1) - 1);
  await c.env.sorc_db.prepare(`UPDATE lobbies SET member_count = ?, updated_at = ? WHERE id = ?`).bind(newCount, new Date().toISOString(), lobbyId).run();
  return c.json({ success: true });
});

app.post('/api/lobbies/:id/transfer-host', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const lobbyId = c.req.param('id');
  const lobby = await c.env.sorc_db.prepare(`SELECT * FROM lobbies WHERE id = ?`).bind(lobbyId).first() as any;
  if (!lobby) return c.json({ error: 'Lobby not found.' }, 404);
  const isHost = lobby.creator_uid === user.id;
  const isOwner = user.role === 'OWNER' || isPrivileged(user);
  const isAdmin = user.role === 'ADMIN';
  if (!isHost && !isOwner && !isAdmin) return c.json({ error: 'Only the host, an Admin, or an Owner can promote.' }, 403);
  const { new_host_uid } = await c.req.json();
  if (!new_host_uid) return c.json({ error: 'new_host_uid required.' }, 400);
  if (new_host_uid === user.id) return c.json({ error: 'Already the host.' }, 400);
  const member = await c.env.sorc_db.prepare(
    `SELECT lm.*, u.role as live_role FROM lobby_members lm LEFT JOIN users u ON lm.user_id = u.id WHERE lm.lobby_id = ? AND lm.user_id = ?`
  ).bind(lobbyId, new_host_uid).first() as any;
  if (!member) return c.json({ error: 'That player is not in this lobby.' }, 404);
  if (isAdmin && !isOwner && member.live_role === 'OWNER') return c.json({ error: 'Admins cannot promote over an Owner.' }, 403);
  const now = new Date().toISOString();
  await c.env.sorc_db.prepare(`UPDATE lobbies SET creator_uid = ?, updated_at = ? WHERE id = ?`)
    .bind(new_host_uid, now, lobbyId).run();
  return c.json({ success: true });
});

// ─── LOBBY REPORTS ───────────────────────────────────────────────────────────
// Ported from sorc-app (2026-08-24).

const VALID_LOBBY_REPORT_REASONS = ['Incompetence', 'Language', 'Threats', 'Harassment', 'Spam', 'Other'];

app.post('/api/lobbies/:id/report/:uid', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const lobbyId = c.req.param('id');
  const targetUid = c.req.param('uid');

  if (targetUid === user.id) return c.json({ error: 'Cannot report yourself.' }, 400);

  const isMember = await c.env.sorc_db.prepare(
    `SELECT id FROM lobby_members WHERE lobby_id = ? AND user_id = ?`
  ).bind(lobbyId, user.id).first();
  if (!isMember) return c.json({ error: 'You must be in the lobby to file a report.' }, 403);

  const target = await c.env.sorc_db.prepare(
    `SELECT id, username FROM users WHERE id = ?`
  ).bind(targetUid).first() as any;
  if (!target) return c.json({ error: 'User not found.' }, 404);

  const { reason, details } = await c.req.json() as any;
  if (!reason || !VALID_LOBBY_REPORT_REASONS.includes(reason)) {
    return c.json({ error: 'Invalid report reason.' }, 400);
  }

  const now = new Date().toISOString();
  const reportId = crypto.randomUUID();

  await c.env.sorc_db.prepare(
    `INSERT INTO lobby_reports (id, lobby_id, reporter_uid, reported_uid, reason, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(reportId, lobbyId, user.id, targetUid, reason, details ? details.substring(0, 500) : null, now).run();

  // Reporter blocks the reported user (one-way, reporter → reported)
  await c.env.sorc_db.prepare(
    `INSERT OR IGNORE INTO blocks (id, blocker_uid, blocked_uid, created_at) VALUES (?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), user.id, targetUid, now).run();

  // If incompetence, flag the reported user for reassessment
  if (reason === 'Incompetence') {
    await c.env.sorc_db.prepare(
      `UPDATE users SET needs_reassess = 1, updated_at = ? WHERE id = ?`
    ).bind(now, targetUid).run();
  }

  return c.json({ success: true, blocked: true, needs_reassess_flagged: reason === 'Incompetence' });
});

// ─── PRIVATE ROOMS (launched from a Lobby by its GM) ────────────────────────
// Ported from sorc-app (2026-08-24). This is the actual "Launch Room" backing
// endpoint lobbies.html calls — it validates that whoever is designated GM
// (gm_uid) genuinely holds a GM role, requires the caller to be the lobby
// creator, the designated GM, or privileged, enforces a minimum party size
// (GM + 2 players) and a fresh all-ready ready-check before letting play begin.

app.post('/api/lobbies/:id/launch', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const lobbyId = c.req.param('id');

  const lobby = await c.env.sorc_db.prepare(`SELECT * FROM lobbies WHERE id = ?`).bind(lobbyId).first() as any;
  if (!lobby) return c.json({ error: 'Lobby not found.' }, 404);

  const members = await c.env.sorc_db.prepare(
    `SELECT lm.*, u.role, u.email FROM lobby_members lm LEFT JOIN users u ON lm.user_id = u.id WHERE lm.lobby_id = ?`
  ).bind(lobbyId).all();
  const memberList = members.results as any[] || [];

  const body = await c.req.json() as any;
  // Default gm_uid to the caller; default selected_members to everyone in the lobby
  const gm_uid: string = body.gm_uid || user.id;
  const selected_members: string[] = body.selected_members || memberList.map((m: any) => m.user_id);

  const gmMember = memberList.find((m: any) => m.user_id === gm_uid);
  if (!gmMember) return c.json({ error: 'GM must be a lobby member.' }, 400);
  const gmIsPrivileged = isPrivileged({ id: gm_uid, role: gmMember.role, email: gmMember.email || '' });
  const gmRoleOk = (gmMember.sorc_role && gmMember.sorc_role.startsWith('GM'))
    || gmMember.role === 'MASTER' || gmIsPrivileged;
  if (!gmRoleOk) return c.json({ error: 'Selected GM must hold a GM role.' }, 400);

  const isCreatorOrGM = lobby.creator_uid === user.id || user.id === gm_uid || isPrivileged(user);
  if (!isCreatorOrGM) return c.json({ error: 'Only the lobby creator or GM can launch a room.' }, 403);

  /* ── Private Campaign Rooms are Pro-exclusive (see sorc-beyond.html's
     Basic vs. Pro table). Lobby *creation* already requires a box code for
     non-privileged creators, but that doesn't cover a non-Pro member who
     was recruited in and is now the designated GM launching the room
     themselves — gate the launch itself too. ── */
  if (!(await isProMember(c.env.sorc_db, user))) {
    return c.json({ error: 'Launching a Private Campaign Room requires Pro Membership (a registered box set).' }, 403);
  }

  /* ── Minimum party size: GM + at least 2 players ── */
  if (memberList.length < 3) {
    return c.json({ error: 'At least 2 players and a GM are required to launch a room.' }, 400);
  }

  /* ── Ready check: all members must have confirmed ready ── */
  try {
    await c.env.sorc_db.prepare(`CREATE TABLE IF NOT EXISTS ready_checks (lobby_id TEXT PRIMARY KEY, check_id TEXT NOT NULL, initiated_at TEXT NOT NULL, initiated_by TEXT NOT NULL, initiated_name TEXT NOT NULL)`).run();
    await c.env.sorc_db.prepare(`CREATE TABLE IF NOT EXISTS ready_check_responses (lobby_id TEXT NOT NULL, check_id TEXT NOT NULL, user_id TEXT NOT NULL, username TEXT NOT NULL, status TEXT NOT NULL, responded_at TEXT NOT NULL, PRIMARY KEY (lobby_id, user_id))`).run();
    const rc = await c.env.sorc_db.prepare(`SELECT * FROM ready_checks WHERE lobby_id = ?`).bind(lobbyId).first() as any;
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    if (!rc || rc.initiated_at < fiveMinsAgo) {
      return c.json({ error: 'Run a ready check first — all players must confirm ready before launching.' }, 400);
    }
    const responses = await c.env.sorc_db.prepare(
      `SELECT user_id FROM ready_check_responses WHERE lobby_id = ? AND check_id = ? AND status = 'ready'`
    ).bind(lobbyId, rc.check_id).all();
    const readyUids = new Set((responses.results as any[]).map((r: any) => r.user_id));
    const notReady = memberList.filter((m: any) => !readyUids.has(m.user_id));
    if (notReady.length > 0) {
      const names = notReady.map((m: any) => m.display_name || m.username).join(', ');
      return c.json({ error: 'Not everyone is ready: ' + names }, 400);
    }
  } catch (e: any) {
    return c.json({ error: 'Could not verify ready check status.' }, 500);
  }

  const roomId = crypto.randomUUID();
  const jitsiRoom = 'sorc-' + roomId.replace(/-/g, '').substring(0, 12);
  const now = new Date().toISOString();

  try {
    await c.env.sorc_db.prepare(
      `INSERT INTO private_rooms (id, lobby_id, room_name, gm_uid, status, jitsi_room, created_at) VALUES (?, ?, ?, ?, 'active', ?, ?)`
    ).bind(roomId, lobbyId, lobby.name, gm_uid, jitsiRoom, now).run();

    const allParticipants = [gm_uid, ...selected_members.filter((id: string) => id !== gm_uid)];
    for (const uid of allParticipants) {
      const m = memberList.find((x: any) => x.user_id === uid);
      if (!m) continue;
      const roomRole = uid === gm_uid ? 'gm' : 'pc';
      await c.env.sorc_db.prepare(
        `INSERT INTO room_members (id, room_id, user_id, room_role, username, joined_at) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), roomId, uid, roomRole, m.username, now).run();
    }

    await c.env.sorc_db.prepare(`UPDATE lobbies SET status = 'in_progress', updated_at = ? WHERE id = ?`).bind(now, lobbyId).run();

    return c.json({ success: true, room_id: roomId, jitsi_room: jitsiRoom });
  } catch (error: any) {
    return c.json({ error: 'Failed to launch room.', details: error.message }, 500);
  }
});

// ─── USER LOOKUP (safe - no sensitive fields) ───────────────────────────────
// Ported from sorc-app (2026-08-24).

app.get('/api/users/lookup', authMiddleware, async (c) => {
  const requester = c.get('user') as any;
  const username = c.req.query('username');
  if (!username || username.trim().length < 1) return c.json({ error: 'Username required.' }, 400);
  if (username.length > 40) return c.json({ error: 'Invalid username.' }, 400);

  const allowed = await checkRateLimit(c.env.sorc_db, `lookup:${requester.id}`, 20, 60);
  if (!allowed) return c.json({ error: 'Too many lookups. Please wait.' }, 429);

  const found = await c.env.sorc_db.prepare(
    `SELECT id, username, display_name, sorc_role, avatar
     FROM users
     WHERE username = ? AND (banned IS NULL OR banned = 0) AND (suspended_until IS NULL OR suspended_until < datetime('now'))`
  ).bind(username.trim()).first() as any;

  if (!found) return c.json({ error: 'User not found.' }, 404);
  if (found.id === requester.id) return c.json({ error: 'Cannot invite yourself.' }, 400);

  return c.json({ user: { id: found.id, username: found.username, display_name: found.display_name, sorc_role: found.sorc_role, avatar: found.avatar } });
});

// ─── ROOMS (dice, roll log) ──────────────────────────────────────────────────
// Ported from sorc-app (2026-08-24). Room creation itself happens through
// POST /api/lobbies/:id/launch above — these are the in-room routes.

app.get('/api/rooms/:id', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const roomId = c.req.param('id');

  const room = await c.env.sorc_db.prepare(`SELECT * FROM private_rooms WHERE id = ?`).bind(roomId).first() as any;
  if (!room) return c.json({ error: 'Room not found.' }, 404);

  const membership = await c.env.sorc_db.prepare(`SELECT * FROM room_members WHERE room_id = ? AND user_id = ?`).bind(roomId, user.id).first() as any;
  if (!membership) return c.json({ error: 'You are not a member of this room.' }, 403);

  const members = await c.env.sorc_db.prepare(`SELECT * FROM room_members WHERE room_id = ? ORDER BY joined_at ASC`).bind(roomId).all();
  const rolls = await c.env.sorc_db.prepare(`SELECT * FROM roll_log WHERE room_id = ? ORDER BY rolled_at DESC LIMIT 50`).bind(roomId).all();

  return c.json({
    room,
    members: members.results || [],
    rolls: rolls.results || [],
    my_role: membership.room_role,
    is_gm: membership.room_role === 'gm'
  });
});

app.post('/api/rooms/:id/roll', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const roomId = c.req.param('id');

  const room = await c.env.sorc_db.prepare(`SELECT * FROM private_rooms WHERE id = ?`).bind(roomId).first() as any;
  if (!room) return c.json({ error: 'Room not found.' }, 404);

  const { roll_purpose, die_type, result1, result2, total, locked_by_gm } = await c.req.json() as any;
  if (!roll_purpose || !die_type || result1 === undefined || total === undefined || !locked_by_gm) {
    return c.json({ error: 'Missing roll data.' }, 400);
  }

  const validDice = ['d4', 'd6', 'd100', 'd100+d100'];
  if (!validDice.includes(die_type)) return c.json({ error: 'Invalid die type.' }, 400);

  const gmMembership = await c.env.sorc_db.prepare(
    `SELECT * FROM room_members WHERE room_id = ? AND user_id = ? AND room_role = 'gm'`
  ).bind(roomId, locked_by_gm).first();
  if (!gmMembership) return c.json({ error: 'Roll purpose must be locked by the GM.' }, 403);

  const playerMembership = await c.env.sorc_db.prepare(
    `SELECT * FROM room_members WHERE room_id = ? AND user_id = ?`
  ).bind(roomId, user.id).first();
  if (!playerMembership) return c.json({ error: 'Not a room member.' }, 403);

  const rollId = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.sorc_db.prepare(
    `INSERT INTO roll_log (id, room_id, player_uid, roll_purpose, die_type, result1, result2, total, locked_by_gm, rolled_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(rollId, roomId, user.id, roll_purpose, die_type, result1, result2 || null, total, locked_by_gm, now).run();

  return c.json({ success: true, roll_id: rollId, total });
});

app.get('/api/rooms/:id/rolls', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const roomId = c.req.param('id');
  const isMember = await c.env.sorc_db.prepare(`SELECT id FROM room_members WHERE room_id = ? AND user_id = ?`).bind(roomId, user.id).first();
  if (!isMember) return c.json({ error: 'Not a room member.' }, 403);
  const since = c.req.query('since');
  let rolls: any;
  if (since) {
    rolls = await c.env.sorc_db.prepare(`SELECT * FROM roll_log WHERE room_id = ? AND rolled_at > ? ORDER BY rolled_at ASC LIMIT 50`).bind(roomId, since).all();
  } else {
    rolls = await c.env.sorc_db.prepare(`SELECT * FROM roll_log WHERE room_id = ? ORDER BY rolled_at DESC LIMIT 50`).bind(roomId).all();
  }
  return c.json({ rolls: rolls.results || [] });
});

// ─── ROOM CHAT ────────────────────────────────────────────────────────────────
// Ported from sorc-app (2026-08-24).

app.get('/api/rooms/:id/messages', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const roomId = c.req.param('id');
  const isMember = await c.env.sorc_db.prepare(`SELECT id FROM room_members WHERE room_id = ? AND user_id = ?`).bind(roomId, user.id).first();
  if (!isMember) return c.json({ error: 'Not a room member.' }, 403);
  const messages = await c.env.sorc_db.prepare(
    `SELECT rm.*, u.sorc_role FROM room_messages rm JOIN users u ON rm.user_id = u.id WHERE rm.room_id = ? ORDER BY rm.created_at ASC LIMIT 100`
  ).bind(roomId).all();

  // A GM roll is visible to the GM who owns the room and to the roller; every
  // other member sees nothing of it. It stays recorded either way.
  const roomRow = await c.env.sorc_db.prepare(`SELECT gm_uid FROM private_rooms WHERE id = ?`).bind(roomId).first() as any;
  const canSeeGmRolls = !!roomRow && (roomRow.gm_uid === user.id || isPrivileged(user));
  const visible = (messages.results || []).filter((m: any) =>
    !m.gm_only || canSeeGmRolls || m.user_id === user.id);
  return c.json({ messages: visible });
});

app.post('/api/rooms/:id/messages', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const roomId = c.req.param('id');
  const isMember = await c.env.sorc_db.prepare(`SELECT id FROM room_members WHERE room_id = ? AND user_id = ?`).bind(roomId, user.id).first();
  if (!isMember) return c.json({ error: 'Not a room member.' }, 403);
  const { body } = await c.req.json() as any;
  if (!body || !body.trim()) return c.json({ error: 'Message cannot be empty.' }, 400);
  if (body.length > 500) return c.json({ error: 'Message too long.' }, 400);
  const roomMsgCheck = filterContent(body.trim());
  if (roomMsgCheck.blocked) return c.json({ error: roomMsgCheck.reason }, 400);
  const now = new Date().toISOString();

  // Resolve any roll codes before the message is stored, so the recorded
  // outcome is the server's and cannot be edited after the fact.
  const rolls = resolveRollCodes(roomMsgCheck.filtered);
  const gmOnly = rolls.some((r) => r.gm) ? 1 : 0;
  let finalBody = roomMsgCheck.filtered;
  if (rolls.length) {
    finalBody += '\n' + rolls.map((r) =>
      `${r.gm ? '[GM] ' : ''}${r.code} ${formatRolls(r)}`).join('\n');
  }

  await c.env.sorc_db.prepare(`ALTER TABLE room_messages ADD COLUMN gm_only INTEGER DEFAULT 0`).run().catch(() => {});
  await c.env.sorc_db.prepare(`ALTER TABLE room_messages ADD COLUMN roll_data TEXT`).run().catch(() => {});

  await c.env.sorc_db.prepare(
    `INSERT INTO room_messages (id, room_id, user_id, username, body, created_at, gm_only, roll_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), roomId, user.id, user.username, finalBody, now, gmOnly,
         rolls.length ? JSON.stringify(rolls) : null).run();
  return c.json({ success: true, rolls });
});

app.delete('/api/rooms/:id/messages', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const roomId = c.req.param('id');
  const room = await c.env.sorc_db.prepare(`SELECT gm_uid FROM private_rooms WHERE id = ?`).bind(roomId).first() as any;
  if (!room) return c.json({ error: 'Room not found.' }, 404);
  if (room.gm_uid !== user.id && !isPrivileged(user)) return c.json({ error: 'GM only.' }, 403);
  await c.env.sorc_db.prepare(`DELETE FROM room_messages WHERE room_id = ?`).bind(roomId).run();
  return c.json({ success: true });
});

app.delete('/api/rooms/:id/messages/:msgId', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const roomId = c.req.param('id');
  const msgId = c.req.param('msgId');
  const room = await c.env.sorc_db.prepare(`SELECT gm_uid FROM private_rooms WHERE id = ?`).bind(roomId).first() as any;
  if (!room) return c.json({ error: 'Room not found.' }, 404);
  if (room.gm_uid !== user.id && !isPrivileged(user)) return c.json({ error: 'GM only.' }, 403);
  await c.env.sorc_db.prepare(`DELETE FROM room_messages WHERE id = ? AND room_id = ?`).bind(msgId, roomId).run();
  return c.json({ success: true });
});

// ─── ROOM VISIBILITY & SPECTATE ──────────────────────────────────────────────
// Ported from sorc-app (2026-08-24).

app.get('/api/rooms', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const privileged = isPrivileged(user);
  let rooms: any;
  if (privileged) {
    rooms = await c.env.sorc_db.prepare(
      `SELECT r.*, u.username as gm_name, u.display_name as gm_display,
       (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id) as member_count
       FROM private_rooms r LEFT JOIN users u ON r.gm_uid = u.id
       WHERE r.status = 'active' ORDER BY r.created_at DESC LIMIT 50`
    ).all();
  } else {
    rooms = await c.env.sorc_db.prepare(
      `SELECT r.*, u.username as gm_name, u.display_name as gm_display,
       (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id) as member_count
       FROM private_rooms r LEFT JOIN users u ON r.gm_uid = u.id
       WHERE r.status = 'active' AND r.is_hidden = 0 ORDER BY r.created_at DESC LIMIT 50`
    ).all();
  }
  return c.json({ rooms: rooms.results || [] });
});

app.patch('/api/rooms/:id/spectate', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const roomId = c.req.param('id');
  const room = await c.env.sorc_db.prepare(`SELECT * FROM private_rooms WHERE id = ?`).bind(roomId).first() as any;
  if (!room) return c.json({ error: 'Room not found.' }, 404);
  if (room.gm_uid !== user.id && !isPrivileged(user)) return c.json({ error: 'Only the GM can toggle spectate mode.' }, 403);
  const newVal = room.spectate_enabled ? 0 : 1;
  await c.env.sorc_db.prepare(`UPDATE private_rooms SET spectate_enabled = ? WHERE id = ?`).bind(newVal, roomId).run();
  return c.json({ success: true, spectate_enabled: !!newVal });
});

app.patch('/api/rooms/:id/visibility', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const roomId = c.req.param('id');
  const room = await c.env.sorc_db.prepare(`SELECT * FROM private_rooms WHERE id = ?`).bind(roomId).first() as any;
  if (!room) return c.json({ error: 'Room not found.' }, 404);
  if (room.gm_uid !== user.id && !isPrivileged(user)) return c.json({ error: 'Only the GM can toggle room visibility.' }, 403);
  const newHidden = room.is_hidden ? 0 : 1;
  await c.env.sorc_db.prepare(`UPDATE private_rooms SET is_hidden = ? WHERE id = ?`).bind(newHidden, roomId).run();
  return c.json({ success: true, is_hidden: !!newHidden });
});

// ─── ROOM INVITES (GM invites fellows) ───────────────────────────────────────
// Ported from sorc-app (2026-08-24).

app.post('/api/rooms/:id/invite/:uid', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const roomId = c.req.param('id');
  const invitedUid = c.req.param('uid');

  const room = await c.env.sorc_db.prepare(`SELECT * FROM private_rooms WHERE id = ?`).bind(roomId).first() as any;
  if (!room) return c.json({ error: 'Room not found.' }, 404);
  if (room.gm_uid !== user.id) return c.json({ error: 'Only the GM can send invites.' }, 403);
  if (room.status !== 'active') return c.json({ error: 'Room is not active.' }, 400);

  const fellowship = await c.env.sorc_db.prepare(
    `SELECT id FROM fellowship_requests WHERE status = 'accepted'
     AND ((sender_uid = ? AND receiver_uid = ?) OR (sender_uid = ? AND receiver_uid = ?))`
  ).bind(user.id, invitedUid, invitedUid, user.id).first();
  if (!fellowship) return c.json({ error: 'You can only invite fellows.' }, 403);

  const already = await c.env.sorc_db.prepare(`SELECT id FROM room_members WHERE room_id = ? AND user_id = ?`).bind(roomId, invitedUid).first();
  if (already) return c.json({ error: 'User is already in the room.' }, 400);

  const memberCount = await c.env.sorc_db.prepare(
    `SELECT COUNT(*) as cnt FROM room_members WHERE room_id = ? AND room_role = 'pc'`
  ).bind(roomId).first() as any;
  if ((memberCount?.cnt || 0) >= 5) return c.json({ error: 'Room is full (max 5 PCs).' }, 400);

  const now = new Date().toISOString();
  try {
    await c.env.sorc_db.prepare(
      `INSERT OR IGNORE INTO room_invites (id, room_id, invited_by, invited_uid, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)`
    ).bind(crypto.randomUUID(), roomId, user.id, invitedUid, now).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to send invite.', details: error.message }, 500);
  }
});

app.get('/api/rooms/invites/mine', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const invites = await c.env.sorc_db.prepare(
    `SELECT ri.*, r.room_name, u.username as inviter_name, r.spectate_enabled
     FROM room_invites ri
     JOIN private_rooms r ON ri.room_id = r.id
     JOIN users u ON ri.invited_by = u.id
     WHERE ri.invited_uid = ? AND ri.status = 'pending' AND r.status = 'active'
     ORDER BY ri.created_at DESC`
  ).bind(user.id).all();
  return c.json({ invites: invites.results || [] });
});

app.post('/api/rooms/invites/:inviteId/accept', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const inviteId = c.req.param('inviteId');
  const invite = await c.env.sorc_db.prepare(`SELECT * FROM room_invites WHERE id = ?`).bind(inviteId).first() as any;
  if (!invite || invite.invited_uid !== user.id) return c.json({ error: 'Invite not found.' }, 404);
  if (invite.status !== 'pending') return c.json({ error: 'Invite already responded to.' }, 400);

  const room = await c.env.sorc_db.prepare(`SELECT * FROM private_rooms WHERE id = ? AND status = 'active'`).bind(invite.room_id).first() as any;
  if (!room) return c.json({ error: 'Room is no longer active.' }, 400);

  const now = new Date().toISOString();

  await c.env.sorc_db.prepare(`UPDATE room_invites SET status = 'accepted' WHERE id = ?`).bind(inviteId).run();
  await c.env.sorc_db.prepare(
    `INSERT OR IGNORE INTO room_members (id, room_id, user_id, room_role, username, joined_at) VALUES (?, ?, ?, 'pc', ?, ?)`
  ).bind(crypto.randomUUID(), invite.room_id, user.id, user.username, now).run();

  return c.json({ success: true, room_id: invite.room_id });
});

app.post('/api/rooms/invites/:inviteId/decline', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const inviteId = c.req.param('inviteId');
  const invite = await c.env.sorc_db.prepare(`SELECT * FROM room_invites WHERE id = ? AND invited_uid = ?`).bind(inviteId, user.id).first();
  if (!invite) return c.json({ error: 'Invite not found.' }, 404);
  await c.env.sorc_db.prepare(`UPDATE room_invites SET status = 'declined' WHERE id = ?`).bind(inviteId).run();
  return c.json({ success: true });
});

// ─── ROOM JOIN REQUESTS (lobby members request to join visible rooms) ───────
// Ported from sorc-app (2026-08-24).

app.post('/api/rooms/:id/request', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const roomId = c.req.param('id');
  const { request_type } = await c.req.json() as any;
  const reqType = request_type === 'spectate' ? 'spectate' : 'join';

  const room = await c.env.sorc_db.prepare(`SELECT * FROM private_rooms WHERE id = ?`).bind(roomId).first() as any;
  if (!room) return c.json({ error: 'Room not found.' }, 404);
  if (room.is_hidden) return c.json({ error: 'This room is not accepting requests.' }, 403);
  if (room.status !== 'active') return c.json({ error: 'Room is not active.' }, 400);
  if (reqType === 'spectate' && !room.spectate_enabled) return c.json({ error: 'Spectate mode is off for this room.' }, 403);

  const assessment = await c.env.sorc_db.prepare(`SELECT * FROM assessments WHERE user_id = ?`).bind(user.id).first();
  if (!assessment && !isPrivileged(user)) return c.json({ error: 'You must be assessed to request entry.' }, 403);

  const already = await c.env.sorc_db.prepare(`SELECT id FROM room_members WHERE room_id = ? AND user_id = ?`).bind(roomId, user.id).first();
  if (already) return c.json({ error: 'You are already in this room.' }, 400);

  const now = new Date().toISOString();
  try {
    await c.env.sorc_db.prepare(
      `INSERT OR IGNORE INTO room_requests (id, room_id, requester_uid, request_type, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)`
    ).bind(crypto.randomUUID(), roomId, user.id, reqType, now).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to send request.', details: error.message }, 500);
  }
});

app.get('/api/rooms/:id/requests', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const roomId = c.req.param('id');
  const room = await c.env.sorc_db.prepare(`SELECT * FROM private_rooms WHERE id = ?`).bind(roomId).first() as any;
  if (!room) return c.json({ error: 'Room not found.' }, 404);
  if (room.gm_uid !== user.id && !isPrivileged(user)) return c.json({ error: 'Not authorized.' }, 403);

  const requests = await c.env.sorc_db.prepare(
    `SELECT rr.*, u.username, u.display_name, u.sorc_role, u.avatar
     FROM room_requests rr JOIN users u ON rr.requester_uid = u.id
     WHERE rr.room_id = ? AND rr.status = 'pending' ORDER BY rr.created_at ASC`
  ).bind(roomId).all();
  return c.json({ requests: requests.results || [] });
});

app.post('/api/rooms/:id/requests/:reqId/accept', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const roomId = c.req.param('id');
  const reqId = c.req.param('reqId');

  const room = await c.env.sorc_db.prepare(`SELECT * FROM private_rooms WHERE id = ?`).bind(roomId).first() as any;
  if (!room) return c.json({ error: 'Room not found.' }, 404);
  if (room.gm_uid !== user.id && !isPrivileged(user)) return c.json({ error: 'Not authorized.' }, 403);

  const req = await c.env.sorc_db.prepare(`SELECT * FROM room_requests WHERE id = ? AND room_id = ?`).bind(reqId, roomId).first() as any;
  if (!req || req.status !== 'pending') return c.json({ error: 'Request not found.' }, 404);

  if (req.request_type === 'join') {
    const pcCount = await c.env.sorc_db.prepare(
      `SELECT COUNT(*) as cnt FROM room_members WHERE room_id = ? AND room_role = 'pc'`
    ).bind(roomId).first() as any;
    if ((pcCount?.cnt || 0) >= 5) return c.json({ error: 'Room is full (max 5 PCs).' }, 400);
  }

  const requester = await c.env.sorc_db.prepare(`SELECT username FROM users WHERE id = ?`).bind(req.requester_uid).first() as any;
  const roomRole = req.request_type === 'spectate' ? 'spectator' : 'pc';
  const now = new Date().toISOString();

  await c.env.sorc_db.prepare(`UPDATE room_requests SET status = 'accepted' WHERE id = ?`).bind(reqId).run();
  await c.env.sorc_db.prepare(
    `INSERT OR IGNORE INTO room_members (id, room_id, user_id, room_role, username, joined_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), roomId, req.requester_uid, roomRole, requester?.username || 'Unknown', now).run();

  return c.json({ success: true });
});

app.post('/api/rooms/:id/requests/:reqId/decline', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const roomId = c.req.param('id');
  const reqId = c.req.param('reqId');
  const room = await c.env.sorc_db.prepare(`SELECT * FROM private_rooms WHERE id = ?`).bind(roomId).first() as any;
  if (!room || (room.gm_uid !== user.id && !isPrivileged(user))) return c.json({ error: 'Not authorized.' }, 403);
  await c.env.sorc_db.prepare(`UPDATE room_requests SET status = 'declined' WHERE id = ?`).bind(reqId).run();
  return c.json({ success: true });
});

// ─── ADMIN: MEMBER MANAGEMENT & REPORTS ─────────────────────────────────────
// Ported from sorc-app (2026-08-24). admin.html has had no working backend
// on the live Worker at all until now — only migrate-bcrypt existed here.

const requireAdmin = async (c: any, next: any) => {
  const user = c.get('user') as any;
  if (!isPrivileged(user)) return c.json({ error: 'Not authorized' }, 403);
  await next();
};

app.post('/api/forum/posts/:id/report', authMiddleware, async (c) => {
  const postId = c.req.param('id');
  const user = c.get('user') as any;
  const { reason } = await c.req.json();
  if (!reason) return c.json({ error: 'Reason required' }, 400);
  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const existing = await c.env.sorc_db.prepare('SELECT id, report_count FROM reports WHERE type = ? AND target_id = ?').bind('post', postId).first() as any;
    if (existing) {
      await c.env.sorc_db.prepare('UPDATE reports SET report_count = report_count + 1, reason = ?, updated_at = ? WHERE id = ?').bind(reason, now, existing.id).run();
    } else {
      const preview = await c.env.sorc_db.prepare('SELECT body FROM posts WHERE id = ?').bind(postId).first() as any;
      await c.env.sorc_db.prepare('INSERT INTO reports (id, type, target_id, target_preview, reason, reporter_uid, reporter_name, report_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)').bind(id, 'post', postId, (preview?.body || '').substring(0, 120), reason, user.id, user.display_name || user.username, now, now).run();
    }
    const reportCount = existing ? existing.report_count + 1 : 1;
    if (reportCount >= 3) {
      await c.env.sorc_db.prepare('UPDATE posts SET hidden = 1 WHERE id = ?').bind(postId).run();
    }
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to submit report', details: error.message }, 500);
  }
});

app.post('/api/users/:uid/report', authMiddleware, async (c) => {
  const uid = c.req.param('uid');
  const user = c.get('user') as any;
  const { reason } = await c.req.json();
  if (!reason) return c.json({ error: 'Reason required' }, 400);
  try {
    const target = await c.env.sorc_db.prepare('SELECT id, display_name, username FROM users WHERE id = ? OR username = ?').bind(uid, uid).first() as any;
    if (!target) return c.json({ error: 'User not found' }, 404);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const existing = await c.env.sorc_db.prepare('SELECT id, report_count FROM reports WHERE type = ? AND target_id = ?').bind('user', target.id).first() as any;
    if (existing) {
      await c.env.sorc_db.prepare('UPDATE reports SET report_count = report_count + 1, reason = ?, updated_at = ? WHERE id = ?').bind(reason, now, existing.id).run();
    } else {
      await c.env.sorc_db.prepare('INSERT INTO reports (id, type, target_id, target_preview, reason, reporter_uid, reporter_name, report_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)').bind(id, 'user', target.id, target.display_name || target.username, reason, user.id, user.display_name || user.username, now, now).run();
    }
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to submit report', details: error.message }, 500);
  }
});

app.get('/api/admin/reports', authMiddleware, requireAdmin, async (c) => {
  try {
    const result = await c.env.sorc_db.prepare('SELECT * FROM reports WHERE dismissed = 0 ORDER BY report_count DESC, created_at DESC').all();
    return c.json({ reports: result.results || [] });
  } catch (error: any) {
    return c.json({ error: 'Failed to load reports', details: error.message }, 500);
  }
});

app.post('/api/admin/reports/:id/dismiss', authMiddleware, requireAdmin, async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.sorc_db.prepare('UPDATE reports SET dismissed = 1 WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to dismiss report', details: error.message }, 500);
  }
});

app.get('/api/admin/members', authMiddleware, requireAdmin, async (c) => {
  const search = c.req.query('search') || '';
  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 200);
  try {
    let result;
    if (search) {
      result = await c.env.sorc_db.prepare('SELECT id, user_id, username, display_name, email, role, community_points, post_count, created_at, last_seen FROM users WHERE username LIKE ? OR display_name LIKE ? OR email LIKE ? OR CAST(user_id AS TEXT) = ? LIMIT ?').bind(`%${search}%`, `%${search}%`, `%${search}%`, search, limit).all();
    } else {
      result = await c.env.sorc_db.prepare('SELECT id, user_id, username, display_name, email, role, community_points, post_count, created_at, last_seen FROM users ORDER BY created_at DESC LIMIT ?').bind(limit).all();
    }
    return c.json({ members: result.results || [] });
  } catch (error: any) {
    return c.json({ error: 'Failed to load members', details: error.message }, 500);
  }
});

app.put('/api/admin/members/:uid/role', authMiddleware, requireAdmin, async (c) => {
  const uid = c.req.param('uid');
  const admin = c.get('user') as any;
  const OWNER_EMAILS = ['corbett@sorcrpg.com'];
  if (!OWNER_EMAILS.includes(admin.email)) return c.json({ error: 'Owner only' }, 403);
  const { role } = await c.req.json();
  const validRoles = ['CIVILIAN', 'PLAYER', 'MASTER', 'ADMIN', 'OWNER'];
  if (!validRoles.includes(role)) return c.json({ error: 'Invalid role' }, 400);
  try {
    await c.env.sorc_db.prepare('UPDATE users SET role = ? WHERE id = ? OR username = ?').bind(role, uid, uid).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to update role', details: error.message }, 500);
  }
});

app.post('/api/admin/members/:uid/warn', authMiddleware, requireAdmin, async (c) => {
  const uid = c.req.param('uid');
  const { reason } = await c.req.json();
  if (!reason) return c.json({ error: 'Reason required' }, 400);
  try {
    await c.env.sorc_db.prepare('UPDATE users SET warnings = COALESCE(warnings, 0) + 1, last_warning = ? WHERE id = ? OR username = ?').bind(reason, uid, uid).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to warn member', details: error.message }, 500);
  }
});

app.post('/api/admin/members/:uid/suspend', authMiddleware, requireAdmin, async (c) => {
  const uid = c.req.param('uid');
  const { days } = await c.req.json();
  const safeDays = Math.min(Math.max(parseInt(days) || 1, 1), 365);
  const until = new Date(Date.now() + safeDays * 86400000).toISOString();
  try {
    await c.env.sorc_db.prepare('UPDATE users SET suspended_until = ? WHERE id = ? OR username = ?').bind(until, uid, uid).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to suspend member', details: error.message }, 500);
  }
});

app.post('/api/admin/members/:uid/ban', authMiddleware, requireAdmin, async (c) => {
  const uid = c.req.param('uid');
  const admin = c.get('user') as any;
  const OWNER_EMAILS = ['corbett@sorcrpg.com'];
  if (!OWNER_EMAILS.includes(admin.email)) return c.json({ error: 'Owner only' }, 403);
  const { reason } = await c.req.json();
  try {
    await c.env.sorc_db.prepare('UPDATE users SET banned = 1, ban_reason = ? WHERE id = ? OR username = ?').bind(reason || '', uid, uid).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to ban member', details: error.message }, 500);
  }
});

app.post('/api/admin/invitations', authMiddleware, requireAdmin, async (c) => {
  const { uid } = await c.req.json();
  const admin = c.get('user') as any;
  const OWNER_EMAILS = ['corbett@sorcrpg.com'];
  if (!OWNER_EMAILS.includes(admin.email)) return c.json({ error: 'Owner only' }, 403);
  try {
    await c.env.sorc_db.prepare('UPDATE users SET admin_invited = 1 WHERE id = ? OR username = ?').bind(uid, uid).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to send invitation', details: error.message }, 500);
  }
});

app.get('/api/admin/invitations/pending', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  return c.json({ invitation: user.admin_invited === 1 || user.admin_invited === true });
});

app.post('/api/admin/invitations/respond', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const { accept } = await c.req.json();
  try {
    const fresh = await c.env.sorc_db.prepare('SELECT admin_invited, community_points FROM users WHERE id = ?').bind(user.id).first() as any;
    if (!fresh || !(fresh.admin_invited === 1 || fresh.admin_invited === true)) {
      return c.json({ error: 'No pending admin invitation.' }, 403);
    }
    if (accept) {
      const newCp = Math.min((fresh.community_points || 0) + 10000, 999999);
      await c.env.sorc_db.prepare(
        `UPDATE users SET role = 'ADMIN', community_points = ?, admin_invited = 0, updated_at = ? WHERE id = ?`
      ).bind(newCp, new Date().toISOString(), user.id).run();
      return c.json({ success: true, role: 'ADMIN', community_points: newCp });
    } else {
      await c.env.sorc_db.prepare(
        `UPDATE users SET admin_invited = 0, updated_at = ? WHERE id = ?`
      ).bind(new Date().toISOString(), user.id).run();
      return c.json({ success: true });
    }
  } catch (error: any) {
    return c.json({ error: 'Failed to respond', details: error.message }, 500);
  }
});

// ─── TRIALS LEADERBOARD (stub) ──────────────────────────────────────────────
// Ported from sorc-app (2026-08-24). Basic members see the top 100, Pro
// Members (a registered box set) see the top 200 - per sorc-beyond.html's
// own Basic vs. Pro comparison table. Ranking metric/computation TBD; this
// wires up the depth gate ahead of the actual feature.
// Ranked by community_points (the only real, comparable metric that exists
// today - Trials of Combat win/loss ranking is a separate, not-yet-built
// feature; once it ships this can add a `metric=trials` mode alongside).
// Depth (top 100 Basic / top 200 Pro) matches sorc-beyond.html's table.
app.get('/api/leaderboard', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const isPro = await isProMember(c.env.sorc_db, user);
  const depth = isPro ? 200 : 100;
  try {
    const rows = await c.env.sorc_db.prepare(
      `SELECT id, username, display_name, avatar, role, community_points
       FROM users
       WHERE (banned IS NULL OR banned = 0)
       ORDER BY community_points DESC, created_at ASC
       LIMIT ?`
    ).bind(depth).all();
    const ranked = ((rows.results || []) as any[]).map((r, i) => ({
      rank: i + 1,
      id: r.id,
      username: r.username,
      display_name: r.display_name,
      avatar: r.avatar,
      role: r.role,
      community_points: r.community_points
    }));

    const myPoints = user.community_points || 0;
    const aheadRow = await c.env.sorc_db.prepare(
      `SELECT COUNT(*) as cnt FROM users
       WHERE (banned IS NULL OR banned = 0)
       AND (community_points > ? OR (community_points = ? AND created_at < ?))`
    ).bind(myPoints, myPoints, user.created_at).first() as any;

    return c.json({
      leaderboard: ranked,
      depth,
      is_pro: isPro,
      my_rank: (aheadRow?.cnt || 0) + 1,
      my_points: myPoints
    });
  } catch (error: any) {
    return c.json({ error: 'Failed to load leaderboard', details: error.message }, 500);
  }
});

// ─── PRO MEMBERSHIP FEATURE STUBS ───────────────────────────────────────────
// Per sorc-beyond.html's Basic vs. Pro comparison table. None of these have
// a real implementation yet - each wires up the correct access gate ahead
// of the actual feature, same pattern as the leaderboard stub above.

app.get('/api/trading-post', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  if (!(await isProMember(c.env.sorc_db, user))) {
    return c.json({ error: 'The Trading Post requires Pro Membership (a registered box set).' }, 403);
  }
  return c.json({ error: 'The Trading Post is not yet implemented.' }, 501);
});

app.get('/api/characters-home', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  if (!(await isProMember(c.env.sorc_db, user))) {
    return c.json({ error: "Character's Home requires Pro Membership (a registered box set)." }, 403);
  }
  return c.json({ error: "Character's Home is not yet implemented." }, 501);
});

app.get('/api/sorc-ambiance', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  if (!(await isProMember(c.env.sorc_db, user))) {
    return c.json({ error: 'The SORC Ambiance App requires Pro Membership (a registered box set).' }, 403);
  }
  return c.json({ error: 'The SORC Ambiance App is not yet implemented.' }, 501);
});

app.post('/api/call-to-arms', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  if (!(await isProMember(c.env.sorc_db, user))) {
    return c.json({ error: 'Call to Arms requires Pro Membership (a registered box set).' }, 403);
  }
  return c.json({ error: 'Call to Arms is not yet implemented.' }, 501);
});

// Trials of Combat is free to all members (Basic and Pro) - Pro members get
// exclusive cosmetic skins, a fuller achievements/trophies list, and Practice
// Mode. No access gate on the base feature itself, only on those perks.
app.get('/api/trials-of-combat', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const isPro = await isProMember(c.env.sorc_db, user);
  return c.json({
    error: 'Trials of Combat is not yet implemented.',
    perks: { exclusive_skins: isPro, practice_mode: isPro, leaderboard_depth: isPro ? 200 : 100 }
  }, 501);
});

// Basic achievements are free to all; the full achievements/trophies system
// is Pro-exclusive per the comparison table. Catalog is grounded in data
// that already exists (posts, points, fellowships, lobbies, rooms, role) -
// nothing here depends on the not-yet-built Trading Post/Trials/Home.
async function ensureAchievementsTable(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS user_achievements (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    achievement_id TEXT NOT NULL,
    earned_at TEXT NOT NULL,
    UNIQUE(user_id, achievement_id)
  )`).run().catch(() => {});
}

const ACHIEVEMENT_CATALOG: { id: string; tier: 'basic' | 'pro'; name: string; description: string }[] = [
  { id: 'first_post', tier: 'basic', name: 'First Words', description: 'Made your first forum post.' },
  { id: 'century_points', tier: 'basic', name: 'Century Club', description: 'Earned 100 Community Points.' },
  { id: 'assessed', tier: 'basic', name: 'Essentia Discovered', description: 'Passed a Role Assessment.' },
  { id: 'first_fellow', tier: 'basic', name: 'Fellowship Forged', description: 'Made your first Fellowship connection.' },
  { id: 'lobby_goer', tier: 'basic', name: 'Tavern Regular', description: 'Joined your first Lobby.' },
  { id: 'game_master', tier: 'basic', name: 'Behind the Screen', description: 'Passed the GM Assessment.' },
  { id: 'into_the_fray', tier: 'basic', name: 'Into the Fray', description: 'Joined your first private Room session.' },
  // Pro-exclusive: not shown or earnable at all for Basic members, per the
  // 'Full achievements system' row on sorc-beyond.html's table.
  { id: 'pro_initiate', tier: 'pro', name: 'Pro Initiate', description: 'Registered a SORC box set.' },
  { id: 'community_pillar', tier: 'pro', name: 'Community Pillar', description: 'Pro Membership with 500+ Community Points.' },
];

async function checkAchievement(db: D1Database, user: any, id: string): Promise<boolean> {
  switch (id) {
    case 'first_post': return (user.post_count || 0) >= 1;
    case 'century_points': return (user.community_points || 0) >= 100;
    case 'assessed': return !!user.role && user.role !== 'CIVILIAN';
    case 'first_fellow': {
      const row = await db.prepare(`SELECT id FROM fellowships WHERE status = 'accepted' AND (sender_uid = ? OR receiver_uid = ?) LIMIT 1`).bind(user.id, user.id).first();
      return !!row;
    }
    case 'lobby_goer': {
      const row = await db.prepare(`SELECT id FROM lobby_members WHERE user_id = ? LIMIT 1`).bind(user.id).first();
      return !!row;
    }
    case 'game_master': return !!(user.sorc_role && String(user.sorc_role).indexOf('GM') === 0);
    case 'into_the_fray': {
      const row = await db.prepare(`SELECT id FROM room_members WHERE user_id = ? LIMIT 1`).bind(user.id).first();
      return !!row;
    }
    case 'pro_initiate': return await isProMember(db, user);
    case 'community_pillar': return (await isProMember(db, user)) && (user.community_points || 0) >= 500;
    default: return false;
  }
}

app.get('/api/achievements', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    await ensureAchievementsTable(c.env.sorc_db);
    const isPro = await isProMember(c.env.sorc_db, user);
    const visibleCatalog = ACHIEVEMENT_CATALOG.filter(a => a.tier === 'basic' || isPro);

    const existing = await c.env.sorc_db.prepare(`SELECT achievement_id, earned_at FROM user_achievements WHERE user_id = ?`).bind(user.id).all();
    const earnedMap = new Map<string, string>(((existing.results || []) as any[]).map((r: any) => [r.achievement_id, r.earned_at]));

    // Awarding a new achievement grants +25 Community Points, matching the
    // 'Earning an in-game achievement: +25 pts, awarded automatically upon
    // achievement unlock' rule already documented on sorc-beyond.html.
    let pointsAwarded = 0;
    for (const ach of visibleCatalog) {
      if (earnedMap.has(ach.id)) continue;
      if (await checkAchievement(c.env.sorc_db, user, ach.id)) {
        const now = new Date().toISOString();
        await c.env.sorc_db.prepare(
          `INSERT OR IGNORE INTO user_achievements (id, user_id, achievement_id, earned_at) VALUES (?, ?, ?, ?)`
        ).bind(crypto.randomUUID(), user.id, ach.id, now).run();
        earnedMap.set(ach.id, now);
        pointsAwarded += 25;
      }
    }
    if (pointsAwarded > 0) {
      await c.env.sorc_db.prepare(`UPDATE users SET community_points = COALESCE(community_points, 0) + ? WHERE id = ?`).bind(pointsAwarded, user.id).run();
    }

    const achievements = visibleCatalog.map(a => ({
      id: a.id,
      name: a.name,
      description: a.description,
      tier: a.tier,
      earned: earnedMap.has(a.id),
      earned_at: earnedMap.get(a.id) || null
    }));

    return c.json({ achievements, full_system: isPro, points_awarded: pointsAwarded });
  } catch (error: any) {
    return c.json({ error: 'Failed to load achievements', details: error.message }, 500);
  }
});

// SORC Store access via Community Points is Pro-exclusive per the table;
// Lottery raffle tickets remain a separate, open-to-all purchase (see
// sorc-beyond.html: 'The SORC Lottery is open to all members, Basic and Pro').
app.get('/api/sorc-store', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  if (!(await isProMember(c.env.sorc_db, user))) {
    return c.json({ error: 'SORC Store access via Community Points requires Pro Membership (a registered box set).' }, 403);
  }
  return c.json({ error: 'The SORC Store is not yet implemented.' }, 501);
});

// ─── GROUP FELLOWSHIP CHAT (Pro) ────────────────────────────────────────────
// Per sorc-beyond.html's table: 1:1 fellowship messaging is free for everyone
// (see /api/conversations above), but a multi-fellow group thread is a Pro
// perk. Hosting (creating a group, adding members) requires the OWNER to be
// Pro - same pattern as Lobbies (creator needs a box code, joiners don't).
// Reading/posting in a group you already belong to needs no extra Pro check,
// same as joining someone else's Lobby for free.

async function ensureFellowshipGroupTables(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS fellowship_groups (
    id TEXT PRIMARY KEY,
    owner_uid TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`).run().catch(() => {});
  await db.prepare(`CREATE TABLE IF NOT EXISTS fellowship_group_members (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    added_at TEXT NOT NULL,
    UNIQUE(group_id, user_id)
  )`).run().catch(() => {});
  await db.prepare(`CREATE TABLE IF NOT EXISTS fellowship_group_messages (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`).run().catch(() => {});
}

async function isAcceptedFellow(db: D1Database, uidA: string, uidB: string): Promise<boolean> {
  const row = await db.prepare(
    `SELECT id FROM fellowships WHERE status = 'accepted' AND ((sender_uid = ? AND receiver_uid = ?) OR (sender_uid = ? AND receiver_uid = ?))`
  ).bind(uidA, uidB, uidB, uidA).first();
  return !!row;
}

app.post('/api/fellowships/groups', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  if (!(await isProMember(c.env.sorc_db, user))) {
    return c.json({ error: 'Group Fellowship chat requires Pro Membership (a registered box set).' }, 403);
  }
  await ensureFellowshipGroupTables(c.env.sorc_db);
  const { name, member_uids } = await c.req.json() as any;
  const groupName = (name || '').trim().slice(0, 60) || 'Fellowship Group';
  const uids: string[] = Array.isArray(member_uids) ? member_uids.filter((u: any) => typeof u === 'string') : [];
  try {
    for (const uid of uids) {
      if (uid === user.id) continue;
      if (!(await isAcceptedFellow(c.env.sorc_db, user.id, uid))) {
        return c.json({ error: 'Every member must be an accepted Fellowship of yours.' }, 400);
      }
    }
    const groupId = crypto.randomUUID();
    const now = new Date().toISOString();
    await c.env.sorc_db.prepare(`INSERT INTO fellowship_groups (id, owner_uid, name, created_at) VALUES (?, ?, ?, ?)`).bind(groupId, user.id, groupName, now).run();
    await c.env.sorc_db.prepare(`INSERT INTO fellowship_group_members (id, group_id, user_id, added_at) VALUES (?, ?, ?, ?)`).bind(crypto.randomUUID(), groupId, user.id, now).run();
    for (const uid of uids) {
      if (uid === user.id) continue;
      await c.env.sorc_db.prepare(`INSERT OR IGNORE INTO fellowship_group_members (id, group_id, user_id, added_at) VALUES (?, ?, ?, ?)`).bind(crypto.randomUUID(), groupId, uid, now).run();
    }
    return c.json({ success: true, group_id: groupId });
  } catch (error: any) {
    return c.json({ error: 'Failed to create group.', details: error.message }, 500);
  }
});

app.get('/api/fellowships/groups', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  await ensureFellowshipGroupTables(c.env.sorc_db);
  try {
    const rows = await c.env.sorc_db.prepare(
      `SELECT g.id, g.name, g.owner_uid, g.created_at,
       (SELECT COUNT(*) FROM fellowship_group_members m2 WHERE m2.group_id = g.id) as member_count
       FROM fellowship_groups g
       JOIN fellowship_group_members m ON m.group_id = g.id
       WHERE m.user_id = ?
       ORDER BY g.created_at DESC`
    ).bind(user.id).all();
    return c.json({ groups: rows.results || [] });
  } catch (error: any) {
    return c.json({ error: 'Failed to load groups.', details: error.message }, 500);
  }
});

app.post('/api/fellowships/groups/:id/members', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const groupId = c.req.param('id');
  await ensureFellowshipGroupTables(c.env.sorc_db);
  const group = await c.env.sorc_db.prepare(`SELECT * FROM fellowship_groups WHERE id = ?`).bind(groupId).first() as any;
  if (!group) return c.json({ error: 'Group not found.' }, 404);
  if (group.owner_uid !== user.id) return c.json({ error: 'Only the group owner can add members.' }, 403);
  if (!(await isProMember(c.env.sorc_db, user))) {
    return c.json({ error: 'Group Fellowship chat requires Pro Membership (a registered box set).' }, 403);
  }
  const { uid } = await c.req.json() as any;
  if (!uid) return c.json({ error: 'uid required.' }, 400);
  if (!(await isAcceptedFellow(c.env.sorc_db, user.id, uid))) {
    return c.json({ error: 'That member must be an accepted Fellowship of yours.' }, 400);
  }
  await c.env.sorc_db.prepare(`INSERT OR IGNORE INTO fellowship_group_members (id, group_id, user_id, added_at) VALUES (?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), groupId, uid, new Date().toISOString()).run();
  return c.json({ success: true });
});

app.delete('/api/fellowships/groups/:id/members/:uid', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const groupId = c.req.param('id');
  const targetUid = c.req.param('uid');
  const group = await c.env.sorc_db.prepare(`SELECT * FROM fellowship_groups WHERE id = ?`).bind(groupId).first() as any;
  if (!group) return c.json({ error: 'Group not found.' }, 404);
  // The owner can remove anyone; anyone else can only remove themselves (leave).
  if (group.owner_uid !== user.id && targetUid !== user.id) {
    return c.json({ error: 'Not authorized.' }, 403);
  }
  if (targetUid === group.owner_uid) return c.json({ error: 'The owner cannot be removed - delete the group instead.' }, 400);
  await c.env.sorc_db.prepare(`DELETE FROM fellowship_group_members WHERE group_id = ? AND user_id = ?`).bind(groupId, targetUid).run();
  return c.json({ success: true });
});

app.delete('/api/fellowships/groups/:id', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const groupId = c.req.param('id');
  const group = await c.env.sorc_db.prepare(`SELECT * FROM fellowship_groups WHERE id = ?`).bind(groupId).first() as any;
  if (!group) return c.json({ error: 'Group not found.' }, 404);
  if (group.owner_uid !== user.id && !isPrivileged(user)) return c.json({ error: 'Only the group owner can delete it.' }, 403);
  await c.env.sorc_db.prepare(`DELETE FROM fellowship_groups WHERE id = ?`).bind(groupId).run();
  await c.env.sorc_db.prepare(`DELETE FROM fellowship_group_members WHERE group_id = ?`).bind(groupId).run();
  await c.env.sorc_db.prepare(`DELETE FROM fellowship_group_messages WHERE group_id = ?`).bind(groupId).run();
  return c.json({ success: true });
});

app.get('/api/fellowships/groups/:id/messages', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const groupId = c.req.param('id');
  const isMember = await c.env.sorc_db.prepare(`SELECT id FROM fellowship_group_members WHERE group_id = ? AND user_id = ?`).bind(groupId, user.id).first();
  if (!isMember) return c.json({ error: 'Not a member of this group.' }, 403);
  const since = c.req.query('since');
  let msgs: any;
  if (since) {
    msgs = await c.env.sorc_db.prepare(`SELECT * FROM fellowship_group_messages WHERE group_id = ? AND created_at > ? ORDER BY created_at ASC LIMIT 100`).bind(groupId, since).all();
  } else {
    msgs = await c.env.sorc_db.prepare(`SELECT * FROM fellowship_group_messages WHERE group_id = ? ORDER BY created_at DESC LIMIT 80`).bind(groupId).all();
    msgs.results = (msgs.results || []).reverse();
  }
  return c.json({ messages: msgs.results || [] });
});

app.post('/api/fellowships/groups/:id/messages', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const groupId = c.req.param('id');
  const isMember = await c.env.sorc_db.prepare(`SELECT id FROM fellowship_group_members WHERE group_id = ? AND user_id = ?`).bind(groupId, user.id).first();
  if (!isMember) return c.json({ error: 'Not a member of this group.' }, 403);
  const allowed = await checkRateLimit(c.env.sorc_db, `groupchat:${user.id}`, 20, 60);
  if (!allowed) return c.json({ error: 'Slow down — too many messages.' }, 429);
  const { body } = await c.req.json() as any;
  if (!body || !body.trim()) return c.json({ error: 'Message cannot be empty.' }, 400);
  if (body.length > 500) return c.json({ error: 'Message too long (max 500 chars).' }, 400);
  const check = filterContent(body.trim());
  if (check.blocked) return c.json({ error: check.reason }, 400);
  const msgId = crypto.randomUUID();
  await c.env.sorc_db.prepare(
    `INSERT INTO fellowship_group_messages (id, group_id, user_id, username, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(msgId, groupId, user.id, user.display_name || user.username, check.filtered, new Date().toISOString()).run();
  return c.json({ success: true, message_id: msgId });
});

// ─── WORLD CHAT (LFG/LFM/WTB/WTS) ───────────────────────────────────────────
// Ported from sorc-app (2026-08-24). lobbies.html's World Chat tab has been
// dead on the live Worker - it calls these routes and none existed here.
// LFG:/WTB:/WTS: are all the same shape: a short, non-host-postable
// advertising tag (looking for a group, want to buy, want to sell).

app.get('/api/world-chat', authMiddleware, async (c) => {
  try {
    await c.env.sorc_db.prepare(
      `CREATE TABLE IF NOT EXISTS world_messages (
         id TEXT PRIMARY KEY,
         sender_uid TEXT NOT NULL,
         sender_name TEXT NOT NULL,
         sender_lobby_id TEXT,
         sender_lobby_name TEXT,
         body TEXT NOT NULL,
         created_at TEXT NOT NULL
       )`
    ).run();
    const msgs = await c.env.sorc_db.prepare(
      `SELECT * FROM world_messages ORDER BY created_at DESC LIMIT 60`
    ).all();
    return c.json({ messages: (msgs.results || []).reverse() });
  } catch (error: any) {
    return c.json({ messages: [] });
  }
});

app.post('/api/world-chat', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const allowed = await checkRateLimit(c.env.sorc_db, `worldchat:${user.id}`, 8, 60);
  if (!allowed) return c.json({ error: 'Slow down — too many messages.' }, 429);
  try {
    const { body } = await c.req.json() as any;
    if (!body || !body.trim()) return c.json({ error: 'Message cannot be empty.' }, 400);
    if (body.length > 400) return c.json({ error: 'Message too long (max 400 chars).' }, 400);
    const worldMsgCheck = filterContent(body.trim());
    if (worldMsgCheck.blocked) return c.json({ error: worldMsgCheck.reason }, 400);

    // Must be the active creator of an open lobby, or posting a short
    // LFG:/WTB:/WTS: tag. WTB:/WTS: (want to buy/sell) advertise Essentia
    // Exchange trades the same way LFG: advertises looking for a group.
    const lobby = await c.env.sorc_db.prepare(
      `SELECT id, name FROM lobbies WHERE creator_uid = ? AND status != 'closed' ORDER BY created_at DESC LIMIT 1`
    ).bind(user.id).first() as any;
    const isHost = !!(lobby || isPrivileged(user));
    if (!isHost) {
      if (!/^(LFG|WTB|WTS):/i.test(body.trim())) return c.json({ error: 'Only active lobby hosts can post freely. Use LFG:, WTB:, or WTS: to advertise yourself.' }, 403);
      if (body.trim().length > 40) return c.json({ error: 'LFG:/WTB:/WTS: tags are limited to 40 characters.' }, 400);
    }

    await c.env.sorc_db.prepare(
      `CREATE TABLE IF NOT EXISTS world_messages (
         id TEXT PRIMARY KEY,
         sender_uid TEXT NOT NULL,
         sender_name TEXT NOT NULL,
         sender_lobby_id TEXT,
         sender_lobby_name TEXT,
         body TEXT NOT NULL,
         created_at TEXT NOT NULL
       )`
    ).run();

    const now = new Date().toISOString();
    await c.env.sorc_db.prepare(
      `INSERT INTO world_messages (id, sender_uid, sender_name, sender_lobby_id, sender_lobby_name, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      user.id,
      user.display_name || user.username,
      lobby?.id || null,
      lobby?.name || null,
      worldMsgCheck.filtered,
      now
    ).run();

    // Prune old messages (keep last 200)
    await c.env.sorc_db.prepare(
      `DELETE FROM world_messages WHERE id NOT IN (SELECT id FROM world_messages ORDER BY created_at DESC LIMIT 200)`
    ).run();

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to post.', details: error.message }, 500);
  }
});

app.post('/api/world-chat/:msgId/respond', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const respondAllowed = await checkRateLimit(c.env.sorc_db, `wcrespond:${user.id}`, 5, 60);
  if (!respondAllowed) return c.json({ error: 'Slow down — too many responses.' }, 429);
  const msgId = c.req.param('msgId');
  try {
    const original = await c.env.sorc_db.prepare(
      `SELECT * FROM world_messages WHERE id = ?`
    ).bind(msgId).first() as any;
    if (!original) return c.json({ error: 'Message not found.' }, 404);

    const myName = user.display_name || user.username;
    const profileUrl = `https://sorcrpg.com/public-profile.html?username=${encodeURIComponent(user.username)}`;
    const { type } = await c.req.json().catch(() => ({ type: 'LFM' })) as any;
    const responseBody = type === 'SUM'
      ? `SUM: ${myName} confirmed — ${profileUrl}`
      : `📋 ${myName} responds to ${original.sender_name}'s request — ${profileUrl}`;
    const now = new Date().toISOString();

    await c.env.sorc_db.prepare(
      `INSERT INTO world_messages (id, sender_uid, sender_name, sender_lobby_id, sender_lobby_name, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), user.id, myName, null, null, responseBody, now).run();

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed.', details: error.message }, 500);
  }
});

// ─── PRO MEMBERSHIP FEATURE STUBS ───────────────────────────────────────────
// Per sorc-beyond.html's Basic vs. Pro comparison table. None of these have
// a real implementation yet - each wires up the correct access gate ahead
// of the actual feature, same pattern as the leaderboard stub above.

app.get('/api/trading-post', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  if (!(await isProMember(c.env.sorc_db, user))) {
    return c.json({ error: 'The Trading Post requires Pro Membership (a registered box set).' }, 403);
  }
  return c.json({ error: 'The Trading Post is not yet implemented.' }, 501);
});

app.get('/api/characters-home', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  if (!(await isProMember(c.env.sorc_db, user))) {
    return c.json({ error: "Character's Home requires Pro Membership (a registered box set)." }, 403);
  }
  return c.json({ error: "Character's Home is not yet implemented." }, 501);
});

app.get('/api/sorc-ambiance', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  if (!(await isProMember(c.env.sorc_db, user))) {
    return c.json({ error: 'The SORC Ambiance App requires Pro Membership (a registered box set).' }, 403);
  }
  return c.json({ error: 'The SORC Ambiance App is not yet implemented.' }, 501);
});

app.post('/api/call-to-arms', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  if (!(await isProMember(c.env.sorc_db, user))) {
    return c.json({ error: 'Call to Arms requires Pro Membership (a registered box set).' }, 403);
  }
  return c.json({ error: 'Call to Arms is not yet implemented.' }, 501);
});

// Trials of Combat is free to all members (Basic and Pro) - Pro members get
// exclusive cosmetic skins, a fuller achievements/trophies list, and Practice
// Mode. No access gate on the base feature itself, only on those perks.
app.get('/api/trials-of-combat', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const isPro = await isProMember(c.env.sorc_db, user);
  return c.json({
    error: 'Trials of Combat is not yet implemented.',
    perks: { exclusive_skins: isPro, practice_mode: isPro, leaderboard_depth: isPro ? 200 : 100 }
  }, 501);
});

// Basic achievements are free to all; the full achievements/trophies system
// is Pro-exclusive per the comparison table.
app.get('/api/achievements', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const isPro = await isProMember(c.env.sorc_db, user);
  return c.json({ error: 'Achievements are not yet implemented.', full_system: isPro }, 501);
});

// SORC Store access via Community Points is Pro-exclusive per the table;
// Lottery raffle tickets remain a separate, open-to-all purchase (see
// sorc-beyond.html: 'The SORC Lottery is open to all members, Basic and Pro').
app.get('/api/sorc-store', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  if (!(await isProMember(c.env.sorc_db, user))) {
    return c.json({ error: 'SORC Store access via Community Points requires Pro Membership (a registered box set).' }, 403);
  }
  return c.json({ error: 'The SORC Store is not yet implemented.' }, 501);
});

export default app;
