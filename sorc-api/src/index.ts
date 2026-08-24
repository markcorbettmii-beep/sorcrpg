import { Hono } from 'hono';
import { cors } from 'hono/cors';
import * as bcrypt from 'bcryptjs';

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
const TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours, matches the verification/reset emails' own "expires in 24 hours" text

async function ensureAuthColumns(db: D1Database) {
  await db.prepare(`ALTER TABLE users ADD COLUMN auth_key_expires_at TEXT`).run().catch(() => {});
  await db.prepare(`ALTER TABLE users ADD COLUMN verification_token_created_at TEXT`).run().catch(() => {});
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

    if (!user) {
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
      authKey: authKey
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
    const user = await c.env.sorc_db.prepare(`SELECT id, username, display_name, first_name, surname, prefix, suffix, avatar, bio, role, community_points, post_count, titles, join_date, last_seen, created_at FROM users WHERE id = ? OR username = ?`).bind(userId, userId).first();
    if (!user) return c.json({ error: 'User not found' }, 404);
    return c.json({ user });
  } catch (error: any) {
    return c.json({ error: 'Failed to load profile', details: error.message }, 500);
  }
});

app.get('/api/me', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    const fullUser = await c.env.sorc_db.prepare('SELECT id, username, display_name, first_name, surname, prefix, suffix, avatar, bio, role, community_points, post_count, titles, join_date, last_seen, created_at FROM users WHERE id = ?').bind(user.id).first() as any;
    if (!fullUser) return c.json({ error: 'User not found' }, 404);
    // Privileged accounts (ADMIN/OWNER, verified server-side, never client-claimed)
    // are auto-topped-up to a 10,000 community_points floor.
    if (isPrivileged(fullUser) && (fullUser.community_points || 0) < 10000) {
      await c.env.sorc_db.prepare('UPDATE users SET community_points = 10000 WHERE id = ?').bind(fullUser.id).run();
      fullUser.community_points = 10000;
    }
    return c.json({ user: fullUser });
  } catch (error: any) {
    return c.json({ error: 'Failed to load profile', details: error.message }, 500);
  }
});

app.put('/api/profile', authMiddleware, async (c) => {
  const updates = await c.req.json();
  const user = c.get('user') as any;
  const allowedFields = ['display_name', 'first_name', 'surname', 'prefix', 'suffix', 'bio', 'avatar', 'signature', 'website', 'social_twitter', 'social_twitch', 'privacy_email'];
  const setParts: string[] = [];
  const values: any[] = [];
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      setParts.push(`${field} = ?`);
      values.push(updates[field]);
    }
  }
  if (setParts.length === 0) return c.json({ error: 'No valid fields to update' }, 400);
  try {
    await c.env.sorc_db.prepare(`UPDATE users SET ${setParts.join(', ')}, updated_at = ? WHERE id = ?`).bind(...values, new Date().toISOString(), user.id).run();
    const updatedUser = await c.env.sorc_db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
    return c.json({ success: true, user: updatedUser });
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
  for (const entry of answers) {
    const qId = typeof entry === 'object' ? entry.id : null;
    const chosen = typeof entry === 'object' ? entry.answer : entry;
    if (qId !== null && qId >= 0 && qId < ASSESSMENT_QUESTIONS.length) {
      if (chosen === ASSESSMENT_QUESTIONS[qId].answer) score++;
    }
  }

  const role = calcPcRole(score);
  // Beta preview pass bar is 75% (8/10), stricter than the normal PC-BEG floor
  // (6/10) used for the real, logged-in assessment - the preview only shows a
  // pass message on a genuinely strong score.
  const passed = score >= 8;
  return c.json({ score, role, passed, beta: true });
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
  for (const entry of answers) {
    const qId = typeof entry === 'object' ? entry.id : null;
    const chosen = typeof entry === 'object' ? entry.answer : entry;
    if (qId === null) continue;
    if (qId >= 1000) {
      const codexId = qId - 1000;
      if (codexId >= 0 && codexId < GM_CODEX_QUESTIONS.length && chosen === GM_CODEX_QUESTIONS[codexId].answer) codexScore++;
    } else if (qId >= 0 && qId < ASSESSMENT_QUESTIONS.length) {
      if (chosen === ASSESSMENT_QUESTIONS[qId].answer) basicScore++;
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
    return c.json({ score, basic_score: basicScore, codex_score: gm_track ? codexScore : undefined, role: 'FAIL', passed: false, message: 'Score too low — you have been downgraded to Civilian. Study the Basic Rules and reassess to regain lobby access.' });
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

    return c.json({ score, basic_score: basicScore, codex_score: gm_track ? codexScore : undefined, role, site_role: preserveRole ? user.role : siteRole, passed: true, points_awarded: pointsAwarded });
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

export default app;
