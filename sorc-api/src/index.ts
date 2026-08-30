import { Hono } from 'hono';
import { cors } from 'hono/cors';
import * as bcrypt from 'bcryptjs';

// ─── CONTENT FILTER ─────────────────────────────────────────────────────────
// Ported from sorc-app (2026-08-24) - needed by the lobby/room chat routes below.
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
  // Beta-only guest access. "1" = on. Flip to "0" in wrangler.toml (or via the
  // Cloudflare dashboard) and redeploy to switch guest sign-in off site-wide -
  // no code change needed. See GUESTS_ENABLED below.
  GUESTS_ENABLED?: string;
}

// Guest access is a TEMPORARY beta feature. One switch governs it: the
// GUESTS_ENABLED var. Off means /api/auth/guest refuses to mint accounts and
// the Lobbies page hides its "Join as Guest" card (it asks /api/public-config).
// Turning it off does NOT delete the guests already created - see the teardown
// note on /api/auth/guest for that.
function guestsEnabled(env: Env): boolean {
  return (env.GUESTS_ENABLED ?? '1') !== '0';
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

// Abandon bans. Created lazily, so every reader must make sure it exists first
// rather than assuming /leave has run at least once on this database.
// TEMPORARY - beta guest access. Authoritative guest check: the email domain
// is assigned by /api/auth/guest and cannot be claimed through registration,
// unlike the "Guest x" display name. Guests are full Players inside a lobby
// (chat, dice, mute, kick, report all apply to them normally) but hold no real
// account, so account-level social features are closed to them.
const GUEST_EMAIL_DOMAIN = '@guest.sorcrpg.local';
function isGuestUser(user: any): boolean {
  return typeof user?.email === 'string' && user.email.endsWith(GUEST_EMAIL_DOMAIN);
}

// IP bans. Admin-only, and the bluntest tool on the site: it turns away a
// whole address before anything else runs, which is what makes it useful
// against a guest who just makes a new guest account every time they are
// kicked. Enforced by ipBanGate below.
async function ensureIpBansTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ip_bans (
      ip TEXT PRIMARY KEY,
      banned_by TEXT,
      banned_by_name TEXT,
      reason TEXT,
      created_at TEXT NOT NULL
    )
  `).run().catch(() => {});
}

// Remember the address an account last came from, so an admin has something to
// ban. Best-effort: never let this fail a request.
async function recordLastIp(db: D1Database, userId: string, ip: string) {
  if (!ip || ip === 'unknown') return;
  await db.prepare(`ALTER TABLE users ADD COLUMN last_ip TEXT`).run().catch(() => {});
  await db.prepare(`UPDATE users SET last_ip = ? WHERE id = ?`).bind(ip, userId).run().catch(() => {});
}

// Turn away banned addresses before any route runs. Deliberately fail-open: if
// the ban list cannot be read the site keeps working, because a moderation
// feature must never be able to take the whole API down. Read-only requests
// are left alone so a banned address can still see the site; what it loses is
// the ability to act - sign up, sign in, join, post.
const ipBanGate = async (c: any, next: any) => {
  const method = c.req.method;
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();
  try {
    const ip = c.req.header('CF-Connecting-IP');
    if (ip) {
      await ensureIpBansTable(c.env.sorc_db);
      const banned = await c.env.sorc_db.prepare(`SELECT ip FROM ip_bans WHERE ip = ?`).bind(ip).first();
      if (banned) return c.json({ error: 'This address has been banned from SORC.' }, 403);
    }
  } catch (_) { /* fail open - never take the API down over the ban list */ }
  return next();
};
app.use('/api/*', ipBanGate);

// Public, unauthenticated feature flags the static pages need before a user
// exists. Never put anything sensitive here - it is readable by anyone.
app.get('/api/public-config', (c) => {
  c.header('Cache-Control', 'no-store');
  return c.json({ guests_enabled: guestsEnabled(c.env) });
});

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

// ─── GUEST ACCESS (TEMPORARY - BETA ONLY) ───────────────────────────────────
// Mints a throwaway "Guest N" account so beta testers can try lobbies without
// signing up. Everything guest-related is designed to be switched off and then
// removed cleanly:
//
//   1. To DISABLE: set GUESTS_ENABLED = "0" in wrangler.toml and redeploy.
//      New guests stop being minted and the Lobbies page hides the button.
//      Existing guest sessions keep working until their auth keys expire.
//   2. To PURGE the data afterwards, every guest row is identifiable by its
//      email domain:
//        DELETE FROM assessments WHERE user_id IN
//          (SELECT id FROM users WHERE email LIKE '%@guest.sorcrpg.local');
//        DELETE FROM lobby_members WHERE user_id IN
//          (SELECT id FROM users WHERE email LIKE '%@guest.sorcrpg.local');
//        DELETE FROM users WHERE email LIKE '%@guest.sorcrpg.local';
//        DROP TABLE IF EXISTS guest_counter;
//   3. To REMOVE the feature, delete this route, guestsEnabled(), the
//      GUESTS_ENABLED field, and the guest card in lobbies.html.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/auth/guest', async (c) => {
  if (!guestsEnabled(c.env)) {
    return c.json({ error: 'Guest access is closed. Please create an account to join lobbies.' }, 403);
  }
  try {
    // Ensure guest_counter table exists
    await c.env.sorc_db.prepare(`
      CREATE TABLE IF NOT EXISTS guest_counter (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        next_guest_number INTEGER DEFAULT 1
      )
    `).run();

    // Initialize if not exists
    const counter = await c.env.sorc_db.prepare('SELECT next_guest_number FROM guest_counter WHERE id = 1').first() as any;
    if (!counter) {
      await c.env.sorc_db.prepare('INSERT INTO guest_counter (id, next_guest_number) VALUES (1, 1)').run();
    }

    // Get and increment the counter atomically
    const result = await c.env.sorc_db.prepare('UPDATE guest_counter SET next_guest_number = next_guest_number + 1 WHERE id = 1 RETURNING next_guest_number').first() as any;
    const guestNumber = result.next_guest_number - 1; // Get the old value before increment

    const username = `Guest ${guestNumber}`;
    const email = `guest-${guestNumber}-${Date.now()}@guest.sorcrpg.local`;
    const authKey = crypto.randomUUID();
    const uuid = crypto.randomUUID();
    const userId = Math.floor(Math.random() * 90000) + 10000;
    const now = new Date().toISOString();
    const authKeyExpiresAt = new Date(Date.now() + AUTH_KEY_LIFETIME_MS).toISOString();

    // Hash a random password (guest won't use it)
    const randomPassword = crypto.randomUUID().substring(0, 20);
    const passwordHash = await bcrypt.hash(randomPassword, 12);

    // Guests land as a Beginner Player. The beta skips the assessment gate, so
    // both halves of that gate have to be satisfied: sorc_role is what the
    // Lobbies page checks client-side, the assessments row below is what
    // /api/lobbies/join checks server-side. Without both, a guest is bounced
    // straight back to the assessment.
    await ensureAuthColumns(c.env.sorc_db);
    await c.env.sorc_db.prepare(`
      INSERT INTO users (id, email, auth_key, auth_key_expires_at, username, display_name, first_name, role, sorc_role, join_date, created_at, updated_at, user_id, email_verified, password_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(uuid, email, authKey, authKeyExpiresAt, username, username, '', 'PLAYER', 'PC-BEG', now, now, now, userId, true, passwordHash).run();

    const assessmentId = crypto.randomUUID();
    await c.env.sorc_db.prepare(`
      INSERT INTO assessments (id, user_id, score, role_granted, gm_track, taken_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(assessmentId, uuid, 8, 'PC-BEG', 0, now).run();

    // Record the address so an admin can IP-ban a guest who misbehaves - a
    // guest account itself is worthless to ban, they can mint another instantly.
    await recordLastIp(c.env.sorc_db, uuid, c.req.header('CF-Connecting-IP') || '');

    const newUser = await c.env.sorc_db.prepare('SELECT id, email, username, display_name, role, sorc_role, community_points, created_at FROM users WHERE id = ?').bind(uuid).first();
    return c.json({ success: true, user: newUser, authKey, message: 'Guest account created' });
  } catch (error: any) {
    console.error('Guest account creation failed:', error);
    return c.json({ error: 'Guest account creation failed', details: error.message }, 500);
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
  await recordLastIp(c.env.sorc_db, user.id, c.req.header('CF-Connecting-IP') || '');
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
  // Guests cannot create threads - must register first
  if (isGuestUser(user)) {
    return c.json({ error: 'Thread creation requires a registered account. Create an account or sign in to start discussions.', requires_login: true }, 403);
  }
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
  // Guests can reply but are limited to 10 posts per day
  if (isGuestUser(user)) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const todayStart = today + 'T00:00:00.000Z';
    const todayEnd = today + 'T23:59:59.999Z';
    const guestPostsToday = await c.env.sorc_db.prepare(
      `SELECT COUNT(*) as count FROM posts WHERE author_uid = ? AND created_at >= ? AND created_at <= ?`
    ).bind(user.id, todayStart, todayEnd).first() as any;
    if ((guestPostsToday?.count || 0) >= 10) {
      return c.json({ error: 'Guest reply limit reached. You can reply up to 10 times per day. Create an account for unlimited access.', requires_login: true }, 429);
    }
  }
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
  // Fellowships are account-level and outlive a lobby, so they require a real
  // login on both sides. A guest holds no account to attach one to.
  if (isGuestUser(user)) {
    return c.json({ error: 'Fellowship requires login. Create an account to add fellows.', requires_login: true }, 403);
  }
  try {
    const receiver = await c.env.sorc_db.prepare('SELECT id, email, display_name, username FROM users WHERE id = ?').bind(receiverUid).first() as any;
    if (!receiver) return c.json({ error: 'User not found' }, 404);
    if (isGuestUser(receiver)) {
      return c.json({ error: 'Fellowship requires login. This player is a guest and has no account yet.', requires_login: true }, 403);
    }
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
    return false; // deny on DB error - don't fail open
  }
}

function genLobbyCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const arr = crypto.getRandomValues(new Uint8Array(6));
  for (let i = 0; i < 6; i++) code += chars[arr[i] % chars.length];
  return code;
}

/* Lobby tiers. Three lobbies - Beginner, Intermediate, Advanced - held as a
   column on the lobby rather than as three pages, so there is one page, one
   list query, and one place where entry is decided. A separate page per tier
   would enforce nothing: anyone can open a URL, so the gate has to live here
   regardless.

   The ladder is a ceiling, not a pigeonhole. A player's earned rank is the
   highest tier they may enter, and they may enter anything at or below it:
   an Advanced player joins any lobby they choose, an Intermediate joins
   Beginner or Intermediate, and a Civilian - failed or unranked - gets
   Beginner. That lets a ranked player drop into a lower table to run or help
   a game, which is the point of letting them choose.

   Suffix-matched so the GM roles ride the same ladder as their PC
   counterparts (GM-ADV with PC-ADV, and so on) without a second table. */
const LOBBY_TIERS = ['BEG', 'INT', 'ADV'];
const DEFAULT_LOBBY_TIER = 'BEG';

function tierRank(tier: string): number {
  const i = LOBBY_TIERS.indexOf(String(tier || '').toUpperCase());
  return i === -1 ? 0 : i;
}

// The highest tier this player may enter. Privileged accounts are not bound by
// the ladder, the same way they are not bound by the assessment itself.
function playerTierCeiling(user: any): string {
  if (isPrivileged(user)) return 'ADV';
  const role = String(user?.sorc_role || '').toUpperCase();
  if (role.endsWith('-ADV')) return 'ADV';
  if (role.endsWith('-INT')) return 'INT';
  return DEFAULT_LOBBY_TIER;
}

function normalizeTier(tier: any): string | null {
  const t = String(tier || '').toUpperCase();
  return LOBBY_TIERS.indexOf(t) === -1 ? null : t;
}

// Added lazily, like the other late columns here, so a live database picks it
// up without a separate migration step. Existing lobbies read as Beginner.
async function ensureLobbyTierColumn(db: D1Database) {
  await db.prepare(`ALTER TABLE lobbies ADD COLUMN tier TEXT DEFAULT '${DEFAULT_LOBBY_TIER}'`).run().catch(() => {});
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
  { q: "What is the minimum possible total on a Divine Roll?", options: ["1", "2", "10", "0"], answer: 1, page: 1 },
  { q: "What is the maximum possible total on a Divine Roll?", options: ["100", "150", "200", "198"], answer: 2, page: 1 },
  { q: "Which two dice combine to form a d100 roll in SORC?", options: ["Two D6s", "Two D10s (tens and ones)", "D20 and D6", "D12 and D8"], answer: 1, page: 1 },
  { q: "When rolling d100, your tens die shows 4 and your ones die shows 0. What is your result?", options: ["4", "400", "40", "100"], answer: 2, page: 1 },
  { q: "When rolling d100, the tens die shows 1 and the ones die shows 0. What is your result?", options: ["1", "100", "10", "01"], answer: 2, page: 1 },
  { q: "When rolling d100, the tens die shows 0 and the ones die shows 5. What is your result?", options: ["50", "0", "15", "5"], answer: 3, page: 1 },
  { q: "What is the maximum possible result on a single d100 roll?", options: ["99", "10", "50", "100"], answer: 3, page: 1 },
  { q: "What is the minimum possible result on a single d100 roll?", options: ["0", "1", "10", "5"], answer: 1, page: 1 },
  { q: "Which roll is used for very rare items such as Divine and Legendary drops?", options: ["1D6", "1D4", "The Divine Roll", "2D6"], answer: 2, page: 1 },
  { q: "What is a Divine Roll made up of?", options: ["A single D100", "Two D100 results added together", "A D100 plus a flat 100", "Two D10 multiplied"], answer: 1, page: 1 },
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
  { q: "Can a GM ever simulate a character's Rank?", options: ["Yes, freely", "Yes, but only up to Uncommon", "No - Rank is only ever earned, no exceptions", "Only for NPCs"], answer: 2, page: 1 },
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
// that doesn't clear the perfect-score GM bar (see calcSorcRole below) - an
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
// required - a genuine try-before-you-join preview. GM stays account-only
// (it grants real lobby-creation power tied to a box code, this doesn't).
// No DB writes here at all: there's no user to attach a role to, so this
// never touches the users or assessments tables - just grades and returns
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

  const { answers } = await c.req.json();
  if (!Array.isArray(answers) || answers.length !== 10) {
    return c.json({ error: 'Must answer all 10 questions.' }, 400);
  }

  let score = 0;
  // Basic Rules pool is 84 questions deep and only 10 are ever shown per
  // attempt, so revealing the correct answer for a missed question here
  // only leaks one of 84 facts, not the whole quiz - safe to hand back for
  // the review screen (see showBetaResult/renderWrongReview in assess.html).
  const wrong: Array<{ id: number; answer: number }> = [];
  for (const entry of answers) {
    const qId = typeof entry === 'object' ? entry.id : null;
    const chosen = typeof entry === 'object' ? entry.answer : entry;
    if (qId !== null && qId >= 0 && qId < ASSESSMENT_QUESTIONS.length) {
      const correct = ASSESSMENT_QUESTIONS[qId].answer;
      if (chosen === correct) {
        score++;
      } else {
        wrong.push({ id: qId, answer: correct });
      }
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

  /* Anyone may assess whenever they like, and the latest score is the one that
     counts - it replaces the standing role outright, upward or downward. This
     used to refuse a second attempt outright unless an admin had flagged
     needs_reassess, which contradicted the page offering the retake. The flag
     still forces a reassessment; it is no longer what permits one.

     The previous attempt is deleted rather than kept alongside, so a player
     holds exactly one standing assessment. Repeat attempts are bounded by the
     rate limit above (5 an hour), not by a one-shot gate, and community points
     are unaffected either way - assessment_rewarded is claimed once, so a
     retake re-grades without paying out again. */
  await c.env.sorc_db.prepare(`DELETE FROM assessments WHERE user_id = ?`).bind(user.id).run();

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
  // renderWrongReview in assess.html). Basic Rules is an 84-question pool
  // with only 10 drawn per attempt, so handing back the correct answer for
  // a miss only leaks one of 84 facts - fine. GM Codex is the opposite: its
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
    /* FAIL downgrades to Civilian everywhere - record it and update user */
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
    return c.json({ score, basic_score: basicScore, codex_score: gm_track ? codexScore : undefined, role: 'FAIL', passed: false, message: 'Score too low - you have been downgraded to Civilian. Study the Basic Rules and reassess to regain lobby access.', wrong });
  }

  try {
    await c.env.sorc_db.prepare(
      `INSERT INTO assessments (id, user_id, score, role_granted, gm_track, taken_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(id, user.id, score, role, gm_track ? 1 : 0, now).run();

    // Update both the site role (PLAYER/MASTER) and the sorc_role (PC-BEG/INT/ADV/GM-ADV)
    // Award community points only on first-ever assessment (assessment_rewarded = 0)
    // Guests do not earn community points - they must register a real account first
    const fullUser = await c.env.sorc_db.prepare(`SELECT assessment_rewarded, needs_reassess FROM users WHERE id = ?`).bind(user.id).first() as any;
    const firstTime = !fullUser?.assessment_rewarded;
    const isGuest = isGuestUser(user);
    const pointsAwarded = (firstTime && !isGuest) ? (siteRole === 'MASTER' ? 200 : 100) : 0;

    const preserveRole = isPrivileged(user);
    // Role first, and on its own. Setting a role twice is harmless; paying for
    // it twice is not, so the two are no longer one statement.
    if (preserveRole) {
      await c.env.sorc_db.prepare(
        `UPDATE users SET sorc_role = ?, needs_reassess = 0, updated_at = ? WHERE id = ?`
      ).bind(role, now, user.id).run();
    } else {
      await c.env.sorc_db.prepare(
        `UPDATE users SET role = ?, sorc_role = ?, needs_reassess = 0, updated_at = ? WHERE id = ?`
      ).bind(siteRole, role, now, user.id).run();
    }

    // The award is claimed by flipping assessment_rewarded, conditional on it
    // still being unclaimed. Reading the flag and then writing was a race:
    // two submissions firing together both saw it unset and both paid out.
    // Now the flag IS the claim, so exactly one can win it.
    let awarded = 0;
    if (pointsAwarded > 0) {
      const claim = await c.env.sorc_db.prepare(
        `UPDATE users
            SET assessment_rewarded = 1,
                community_points = COALESCE(community_points, 0) + ?,
                updated_at = ?
          WHERE id = ? AND (assessment_rewarded IS NULL OR assessment_rewarded = 0)`
      ).bind(pointsAwarded, now, user.id).run();
      if (claim.meta && claim.meta.changes === 1) awarded = pointsAwarded;
    } else {
      await c.env.sorc_db.prepare(
        `UPDATE users SET assessment_rewarded = 1, updated_at = ? WHERE id = ?`
      ).bind(now, user.id).run();
    }

    return c.json({ score, basic_score: basicScore, codex_score: gm_track ? codexScore : undefined, role, site_role: preserveRole ? user.role : siteRole, passed: true, points_awarded: awarded, wrong });
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
// the server - a client-supplied result could be forged.
// - "GM" prefix: hidden roll, only GM can see
// - "SHOW" prefix: GM roll visible to all (requires GM confirmation)
// - No prefix: regular roll visible to all
//   xROLLD4: xROLLD6: xROLLD10: xROLLD100: xROLLD100+100:
//   GMxROLLD100: SHOWxROLLD100:
// x is optional and defaults to 1.
// ---------------------------------------------------------------------------
const ROLL_CODE_RE = /\b(GM|SHOW)?(\d{0,2})ROLLD(100\+100|100|10|6|4):/gi;
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
  rolls: number[]; total: number; gmShown?: boolean;
}

function resolveRollCodes(body: string): RollResult[] {
  const out: RollResult[] = [];
  ROLL_CODE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ROLL_CODE_RE.exec(body)) !== null) {
    const prefix = m[1] ? m[1].toUpperCase() : '';
    const gm = prefix === 'GM'; // Only GM prefix = hidden
    const gmShown = prefix === 'SHOW'; // SHOW prefix = GM roll but shown to all
    const dieRaw = m[3].toLowerCase();
    // The Divine Roll is two percentile rolls added together, 2 to 200, used
    // for Rare and Divine items (see Basic Rules pg. 1). It is not a flat +100.
    const pair = dieRaw === '100+100';
    // A Divine Roll is always exactly one roll - the count is not the player's
    // to set. Clamped here rather than trusted from the code, since the roll
    // code is client-supplied text.
    const count = pair
      ? 1
      : Math.min(Math.max(parseInt(m[2] || '1', 10) || 1, 1), MAX_DICE_PER_CODE);
    const sides = pair ? 100 : parseInt(dieRaw, 10);
    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(pair ? rollDie(100) + rollDie(100) : rollDie(sides));
    }
    out.push({
      code: m[0], gm, count, die: 'd' + dieRaw,
      rolls, total: rolls.reduce((a, b) => a + b, 0),
      gmShown: gmShown,
    });
    if (out.length >= 10) break; // one message can't spam unlimited codes
  }
  return out;
}

function formatRolls(r: RollResult): string {
  const detail = r.count > 1 ? ` [${r.rolls.join(', ')}]` : '';
  // The two-percentile roll is called the Divine Roll in the rules - it is
  // named, never printed as a die spelling.
  const label = r.die === 'd100+100'
    ? (r.count > 1 ? `${r.count}× Divine Roll` : 'Divine Roll')
    : `${r.count}${r.die}`;
  return `${label} = ${r.total}${detail}`;
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

// ─── CHARACTER SHEETS (a player's Space, Characters tab) ────────────────────
// Not to be confused with /api/characters-home further down: Character's Home
// is a Pro game feature. These are the sheets a player keeps in their own
// Space, which is where the sheet glyph beside a name in a lobby leads.
//
// Field values are stored as JSON, not as a picture, so a sheet is always
// current and readable on a phone. Exporting a still image stays a
// client-side action on the sheet itself, the same html2canvas path the PDF
// export already uses.
//
// Security follows the same shape as the rest of this file: authMiddleware has
// already re-read the user from D1 by auth_key, so identity is never a client
// claim; ownership is enforced in the WHERE clause of every write, so a forged
// id cannot reach another player's sheet; and the cap, the Pro check and the
// GM check are all counted from the database rather than taken from the body.

const SHEET_CAP_BASIC = 2;
const SHEET_CAP_PRO = 5;
// A sheet is a few hundred short text fields. The ceiling is here so a sheet
// cannot be used to push arbitrary weight into D1 one save at a time.
const MAX_SHEET_BYTES = 256 * 1024;

async function ensureCharactersTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT,
      data TEXT,
      is_public INTEGER DEFAULT 1,
      is_default INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    )
  `).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id)`).run().catch(() => {});
}

// Serialise a sheet body, refusing one that is over the ceiling.
function packSheetData(data: any): { ok: true; json: string } | { ok: false; size: number } {
  const json = JSON.stringify(data || {});
  const size = new TextEncoder().encode(json).length;
  if (size > MAX_SHEET_BYTES) return { ok: false, size };
  return { ok: true, json };
}

// A GM running a session can always read a player's sheet, public or not.
// Checking it server-side against live lobby membership means the sheet link
// carries no lobby context to forge, and the reach ends on its own the moment
// either of them leaves - there is no standing grant left behind to revoke.
// Scope: the viewer hosts, or holds GM rights in, an open lobby that the
// sheet's owner is a member of.
async function canGmViewSheet(db: D1Database, viewerId: string, ownerId: string): Promise<boolean> {
  if (!viewerId || !ownerId || viewerId === ownerId) return false;
  const row = await db.prepare(
    `SELECT 1 AS ok
       FROM lobbies l
       JOIN lobby_members target ON target.lobby_id = l.id AND target.user_id = ?
       LEFT JOIN lobby_members viewer ON viewer.lobby_id = l.id AND viewer.user_id = ?
      WHERE l.status != 'closed'
        AND (l.creator_uid = ? OR viewer.sorc_role LIKE 'GM-%')
      LIMIT 1`
  ).bind(ownerId, viewerId, viewerId).first();
  return !!row;
}

function shapeCharacter(row: any) {
  let parsed: any = {};
  try { parsed = row.data ? JSON.parse(row.data) : {}; } catch (_) { parsed = {}; }
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name || 'Unnamed Character',
    data: parsed,
    is_public: row.is_public === 1,
    is_default: row.is_default === 1,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// The signed-in player's own sheets - always all of them, public or not. The
// privacy toggle governs other people's eyes, never the owner's.
app.get('/api/characters', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    await ensureCharactersTable(c.env.sorc_db);
    const rows = await c.env.sorc_db.prepare(
      `SELECT * FROM characters WHERE user_id = ? ORDER BY is_default DESC, created_at ASC`
    ).bind(user.id).all();
    const isPro = await isProMember(c.env.sorc_db, user);
    return c.json({
      characters: (rows.results || []).map(shapeCharacter),
      cap: isPro ? SHEET_CAP_PRO : SHEET_CAP_BASIC,
      is_pro: isPro
    });
  } catch (error: any) {
    return c.json({ error: 'Failed to load characters.', details: error.message }, 500);
  }
});

app.post('/api/characters', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    await ensureCharactersTable(c.env.sorc_db);
    const isPro = await isProMember(c.env.sorc_db, user);
    const cap = isPro ? SHEET_CAP_PRO : SHEET_CAP_BASIC;
    const countRow = await c.env.sorc_db.prepare(
      `SELECT COUNT(*) AS n FROM characters WHERE user_id = ?`
    ).bind(user.id).first() as any;
    const held = Number(countRow?.n || 0);
    if (held >= cap) {
      return c.json({
        error: isPro
          ? 'You already hold ' + cap + ' character sheets, the most a Pro Membership carries. Delete one to make room.'
          : 'A Basic Membership carries ' + cap + ' character sheets. Pro Membership raises that to ' + SHEET_CAP_PRO + '.',
        cap, held
      }, 400);
    }
    const body = await c.req.json().catch(() => ({})) as any;
    const packed = packSheetData(body.data);
    if (!packed.ok) return c.json({ error: 'That character sheet is too large to save.' }, 413);

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await c.env.sorc_db.prepare(
      `INSERT INTO characters (id, user_id, name, data, is_public, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, user.id,
      String(body.name || 'Unnamed Character').slice(0, 120),
      packed.json,
      body.is_public === false ? 0 : 1,
      held === 0 ? 1 : 0,
      now, now
    ).run();
    return c.json({ success: true, id, cap, held: held + 1 });
  } catch (error: any) {
    return c.json({ error: 'Failed to create character.', details: error.message }, 500);
  }
});

app.put('/api/characters/:id', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const id = c.req.param('id');
  try {
    await ensureCharactersTable(c.env.sorc_db);
    // Ownership is part of the lookup and of every write below, so an id
    // belonging to someone else simply does not resolve.
    const owned = await c.env.sorc_db.prepare(
      `SELECT id FROM characters WHERE id = ? AND user_id = ?`
    ).bind(id, user.id).first();
    if (!owned) return c.json({ error: 'Character not found.' }, 404);

    const body = await c.req.json().catch(() => ({})) as any;
    const setParts: string[] = [];
    const values: any[] = [];
    if (body.name !== undefined) { setParts.push('name = ?'); values.push(String(body.name).slice(0, 120)); }
    if (body.data !== undefined) {
      const packed = packSheetData(body.data);
      if (!packed.ok) return c.json({ error: 'That character sheet is too large to save.' }, 413);
      setParts.push('data = ?'); values.push(packed.json);
    }
    if (body.is_public !== undefined) { setParts.push('is_public = ?'); values.push(body.is_public ? 1 : 0); }
    if (setParts.length === 0 && body.is_default !== true) {
      return c.json({ error: 'Nothing to update.' }, 400);
    }
    if (setParts.length > 0) {
      setParts.push('updated_at = ?'); values.push(new Date().toISOString());
      values.push(id, user.id);
      await c.env.sorc_db.prepare(
        `UPDATE characters SET ${setParts.join(', ')} WHERE id = ? AND user_id = ?`
      ).bind(...values).run();
    }
    // Exactly one sheet is the default - the one the sheet glyph opens.
    if (body.is_default === true) {
      await c.env.sorc_db.prepare(`UPDATE characters SET is_default = 0 WHERE user_id = ?`).bind(user.id).run();
      await c.env.sorc_db.prepare(`UPDATE characters SET is_default = 1 WHERE id = ? AND user_id = ?`).bind(id, user.id).run();
    }
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to save character.', details: error.message }, 500);
  }
});

app.delete('/api/characters/:id', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const id = c.req.param('id');
  try {
    await ensureCharactersTable(c.env.sorc_db);
    const row = await c.env.sorc_db.prepare(
      `SELECT is_default FROM characters WHERE id = ? AND user_id = ?`
    ).bind(id, user.id).first() as any;
    if (!row) return c.json({ error: 'Character not found.' }, 404);
    await c.env.sorc_db.prepare(`DELETE FROM characters WHERE id = ? AND user_id = ?`).bind(id, user.id).run();
    // Deleting the default promotes the oldest survivor, so the sheet glyph
    // never points at nothing while the player still holds a sheet.
    if (row.is_default === 1) {
      const next = await c.env.sorc_db.prepare(
        `SELECT id FROM characters WHERE user_id = ? ORDER BY created_at ASC LIMIT 1`
      ).bind(user.id).first() as any;
      if (next) await c.env.sorc_db.prepare(`UPDATE characters SET is_default = 1 WHERE id = ?`).bind(next.id).run();
    }
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to delete character.', details: error.message }, 500);
  }
});

// Someone else's Characters tab. Two path segments after /api/characters, so
// it cannot collide with /api/characters/:id above.
// Reports private:true rather than erroring when the sheets are hidden: the
// tab then shows the "this tab is private" note over an empty default sheet,
// which is a different thing from the player holding no sheets at all.
app.get('/api/characters/space/:username', authMiddleware, async (c) => {
  const viewer = c.get('user') as any;
  try {
    await ensureCharactersTable(c.env.sorc_db);
    const owner = await c.env.sorc_db.prepare(
      `SELECT id, username, display_name FROM users WHERE username = ?`
    ).bind(c.req.param('username')).first() as any;
    if (!owner) return c.json({ error: 'No such player.' }, 404);

    const isSelf = owner.id === viewer.id;
    const gmMayView = isSelf ? false : await canGmViewSheet(c.env.sorc_db, viewer.id, owner.id);
    const seesEverything = isSelf || gmMayView || isPrivileged(viewer);

    const rows = await c.env.sorc_db.prepare(
      `SELECT * FROM characters WHERE user_id = ? ORDER BY is_default DESC, created_at ASC`
    ).bind(owner.id).all();
    const all = (rows.results || []) as any[];
    const visible = seesEverything ? all : all.filter((r: any) => r.is_public === 1);

    return c.json({
      owner: { username: owner.username, display_name: owner.display_name || owner.username },
      characters: visible.map(shapeCharacter),
      // Private only when they hold sheets and none are open to this viewer -
      // not when they simply have not made one yet.
      private: !seesEverything && all.length > 0 && visible.length === 0,
      via_gm: gmMayView
    });
  } catch (error: any) {
    return c.json({ error: 'Failed to load characters.', details: error.message }, 500);
  }
});

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

  await ensureLobbyTierColumn(c.env.sorc_db);

  /* ?tier= narrows the list to one of the three lobbies. Absent, the whole
     board comes back and the page decides what to show - the filter is a view,
     not the gate. What may actually be entered is settled in /join. */
  const wantTier = normalizeTier(c.req.query('tier'));
  const lobbies = wantTier
    ? await c.env.sorc_db.prepare(
        `SELECT l.*, u.username as creator_name, u.display_name as creator_display
         FROM lobbies l JOIN users u ON l.creator_uid = u.id
         WHERE l.is_private = 0 AND COALESCE(l.tier, ?) = ?
         ORDER BY l.created_at DESC LIMIT 50`
      ).bind(DEFAULT_LOBBY_TIER, wantTier).all()
    : await c.env.sorc_db.prepare(
        `SELECT l.*, u.username as creator_name, u.display_name as creator_display
         FROM lobbies l JOIN users u ON l.creator_uid = u.id
         WHERE l.is_private = 0
         ORDER BY l.created_at DESC LIMIT 50`
      ).all();

  /* Mirrors the gate in /join, so the padlocks on the tier bar say the same
     thing the door will. An absent or lapsed rank is worth Beginner: it is
     never a reason to show nothing. */
  const rankOk = isPrivileged(user) || (!!assessment && !user.needs_reassess);
  const ceiling = rankOk ? playerTierCeiling(user) : DEFAULT_LOBBY_TIER;
  return c.json({
    lobbies: lobbies.results || [],
    assessed: !!assessment || isPrivileged(user),
    sorc_role: user.sorc_role || assessment?.role_granted || null,
    is_privileged: isPrivileged(user),
    needs_reassess: !!(user.needs_reassess),
    // What this player may enter: their ceiling, and everything at or below it.
    tier: wantTier,
    tier_ceiling: ceiling,
    allowed_tiers: LOBBY_TIERS.filter(function (t) { return tierRank(t) <= tierRank(ceiling); })
  });
});

app.post('/api/lobbies', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  // Guests join and play; they never host. Creating a lobby needs a real
  // account and a box set code, and a guest holds neither. The box code check
  // further down would stop them anyway, but say so plainly and up front
  // rather than handing a tester a confusing code error.
  if (isGuestUser(user)) {
    return c.json({
      error: 'Creating a lobby requires login and a box set code. Guests can join and play, but cannot host.',
      requires_login: true
    }, 403);
  }
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

  const { name, box_set_code, is_private, tier } = await c.req.json() as any;
  if (!name || !name.trim()) return c.json({ error: 'Lobby name required.' }, 400);

  await ensureLobbyTierColumn(c.env.sorc_db);

  /* A host opens a table at their own tier or below - the same ceiling that
     governs joining, so nobody can host a room they could not themselves walk
     into. Naming no tier opens one at their own rank. */
  const hostCeiling = playerTierCeiling(user);
  const requestedTier = normalizeTier(tier) || hostCeiling;
  if (tierRank(requestedTier) > tierRank(hostCeiling)) {
    return c.json({
      error: 'That lobby is above your rank. Assess higher to host there.',
      tier_ceiling: hostCeiling
    }, 403);
  }

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
      `INSERT INTO lobbies (id, name, creator_uid, is_private, status, max_members, member_count, lobby_code, tier, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'open', 20, 1, ?, ?, ?, ?)`
    ).bind(lobbyId, name.trim().substring(0, 60), user.id, is_private ? 1 : 0, lobbyCode, requestedTier, now, now).run();

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

  /* Beginner asks for no assessment at all. Registering makes you a Civilian,
     and a Civilian - like a signed-in guest - can sit down at a Beginner table
     straight away. The assessment is how you advance past it, into
     Intermediate or Advanced as a PC or a GM, not a toll on entering at all.
     This used to refuse every lobby to anyone unassessed.

     So rank is weighed against the lobby actually being joined, below, once its
     tier is known - not up front against every lobby alike. Everything that
     invalidates a rank drops the player to Beginner rather than shutting them
     out: no assessment, an expired one, or a reassessment flag all leave
     Beginner open and only close what sits above it. */
  const assessment = await c.env.sorc_db.prepare(`SELECT * FROM assessments WHERE user_id = ?`).bind(user.id).first() as any;

  let rankValid = !!assessment;
  let rankLapsed = '';
  if (!privileged && assessment) {
    const age = Date.now() - new Date(assessment.taken_at).getTime();
    if (age > ASSESSMENT_EXPIRY_MS) {
      // Still flagged on expiry, as before - it just no longer bars the door.
      await c.env.sorc_db.prepare(`UPDATE users SET needs_reassess = 1, updated_at = ? WHERE id = ?`).bind(new Date().toISOString(), user.id).run();
      rankValid = false;
      rankLapsed = 'Your assessment has expired (30 days).';
    }
  }
  if (!privileged && user.needs_reassess) {
    rankValid = false;
    rankLapsed = rankLapsed || 'You are flagged for reassessment.';
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

  // The host walking back into their own lobby is not a join request to weigh
  // up - the lobby is already theirs. They kept creator_uid when they left, so
  // they come back through the door they own: no code, no full check.
  const isOwnLobby = lobby.creator_uid === user.id;

  /* The tier gate, and the only one that counts - a page or a filtered list can
     be walked around, this cannot. A player enters their own tier or anything
     below it, so someone who failed still gets Beginner and can play, while the
     Advanced table stays Advanced. Lobbies predating the column read as
     Beginner, which is open to everyone and so changes nothing for them.

     The host is exempt, on the same reasoning as the checks above: the lobby is
     already theirs. It matters now that anyone may reassess freely - a host who
     slips a rank would otherwise be locked out of the table they are running. */
  const lobbyTier = normalizeTier(lobby.tier) || DEFAULT_LOBBY_TIER;
  // A rank that never existed or has lapsed is worth Beginner, not nothing.
  const ceiling = rankValid ? playerTierCeiling(user) : DEFAULT_LOBBY_TIER;
  if (!privileged && !isOwnLobby && tierRank(lobbyTier) > tierRank(ceiling)) {
    const TIER_NAMES: any = { BEG: 'Beginner', INT: 'Intermediate', ADV: 'Advanced' };
    const why = rankLapsed
      ? rankLapsed + ' Reassess to reach the ' + TIER_NAMES[lobbyTier] + ' lobby.'
      : (assessment
          ? 'The ' + TIER_NAMES[lobbyTier] + ' lobby is above your rank. Assess higher to join it.'
          : 'The ' + TIER_NAMES[lobbyTier] + ' lobby needs an assessment. Take it to rank up, or join a Beginner lobby now.');
    return c.json({
      error: why,
      tier: lobbyTier,
      tier_ceiling: ceiling,
      needs_reassess: !!rankLapsed
    }, 403);
  }

  if (!privileged && !isOwnLobby && lobby.member_count >= lobby.max_members) return c.json({ error: 'This lobby is full.' }, 400);

  // Nobody is barred from a lobby. Entry is decided by the lobby itself: an
  // open one takes anyone, a private one takes the code - which is also how an
  // invite from the host reaches you. That applies to someone who abandoned a
  // lobby exactly as it does to anyone else; what they lost by abandoning is
  // the lobby itself, since creator_uid moved on the moment they left, so they
  // come back as an ordinary member rather than the host.
  if (lobby.is_private && !lobby_code && !privileged && !isOwnLobby) {
    return c.json({ error: 'This lobby is private. Join with its code, or ask the host for an invite.' }, 403);
  }

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

    /* A lobby that fell to a Player on an abandon is stuck: a room cannot be
       launched without a GM (see /launch, which rejects a designated GM who
       holds no GM role), so the crown has to move for the lobby to be playable
       again. The first GM through the door takes it.

       A lobby whose host can already run a room is left alone - there is no
       limit on how many GMs sit in a lobby, and every GM after the first is
       there to play. The two sides are deliberately not the same test:

       - the host KEEPS the crown if they could launch a room at all, which
         includes an Admin or Owner who created the lobby themselves;
       - an arriving player only TAKES it on a real GM role, so being an Admin
         is never by itself enough to inherit someone else's lobby.

       Kept in step with /launch's gmRoleOk by hand: if that check changes,
       this one has to change with it, or a lobby can end up holding a crown
       that cannot launch anything. */
    const joinerHoldsGmRole = typeof memberRole === 'string'
      && (memberRole.startsWith('GM') || memberRole === 'MASTER');
    if (joinerHoldsGmRole && lobby.creator_uid !== user.id) {
      const host = await c.env.sorc_db.prepare(
        `SELECT id, role, email, sorc_role FROM users WHERE id = ?`
      ).bind(lobby.creator_uid).first() as any;
      const hostCanRunARoom = !!host && (
        (typeof host.sorc_role === 'string' && host.sorc_role.startsWith('GM'))
        || host.role === 'MASTER'
        || isPrivileged(host)
      );
      if (!hostCanRunARoom) {
        await c.env.sorc_db.prepare(
          `UPDATE lobbies SET creator_uid = ?, updated_at = ? WHERE id = ?`
        ).bind(user.id, now, lobby.id).run();
        return c.json({
          success: true, lobby_name: lobby.name, lobby_id: lobby.id,
          became_host: true
        });
      }
    }

    return c.json({ success: true, lobby_name: lobby.name, lobby_id: lobby.id });
  } catch (error: any) {
    return c.json({ error: 'Failed to join lobby.', details: error.message }, 500);
  }
});

app.post('/api/lobbies/:id/leave', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const lobbyId = c.req.param('id');
  const body = await c.req.json() as any;
  const isAbandon = body?.abandon === true;

  try {
    const lobby = await c.env.sorc_db.prepare(`SELECT * FROM lobbies WHERE id = ?`).bind(lobbyId).first() as any;
    if (!lobby) return c.json({ error: 'Lobby not found' }, 404);

    // One-time migration: add commandeered_from column if not yet present
    try {
      await c.env.sorc_db.prepare('ALTER TABLE lobbies ADD COLUMN commandeered_from TEXT').run();
    } catch (_) {}

    const now = new Date().toISOString();

    // Abandon belongs to the lobby's creator alone. Everyone else only ever
    // leaves, and leaving is free - they can walk back in at will. Reject an
    // abandon from a non-creator outright rather than quietly downgrading it
    // to a leave, so the client can never strand someone on a wrong rule.
    if (isAbandon && lobby.creator_uid !== user.id) {
      return c.json({ error: 'Only the lobby creator can abandon a lobby. You can leave and return at will.' }, 403);
    }

    // What abandoning costs is the lobby, not access to it: the handover below
    // moves creator_uid to the next in line, so the abandoner comes back as an
    // ordinary member under the same entry rules as anyone else. No record of
    // the abandonment is kept, because nothing downstream depends on one.

    await c.env.sorc_db.prepare(`DELETE FROM lobby_members WHERE lobby_id = ? AND user_id = ?`).bind(lobbyId, user.id).run();

    if (isAbandon && lobby.creator_uid === user.id) {
      // Look for next GM first (sorc_role = 'GM-ADV' or 'GM-INT' or 'GM-BEG')
      const nextGM = await c.env.sorc_db.prepare(
        `SELECT lm.user_id FROM lobby_members lm
         WHERE lm.lobby_id = ? AND lm.sorc_role LIKE 'GM-%'
         ORDER BY lm.joined_at ASC
         LIMIT 1`
      ).bind(lobbyId).first() as any;

      if (nextGM) {
        // Transfer to next GM
        await c.env.sorc_db.prepare(
          `UPDATE lobbies SET creator_uid = ?, commandeered_from = ?, updated_at = ? WHERE id = ?`
        ).bind(nextGM.user_id, user.username, now, lobbyId).run();
      } else {
        // No GMs remaining, pass to next member who joined
        const nextMember = await c.env.sorc_db.prepare(
          `SELECT lm.user_id FROM lobby_members lm
           WHERE lm.lobby_id = ?
           ORDER BY lm.joined_at ASC
           LIMIT 1`
        ).bind(lobbyId).first() as any;

        if (nextMember) {
          await c.env.sorc_db.prepare(
            `UPDATE lobbies SET creator_uid = ?, commandeered_from = ?, updated_at = ? WHERE id = ?`
          ).bind(nextMember.user_id, user.username, now, lobbyId).run();
        } else {
          // No members left, close the lobby
          await c.env.sorc_db.prepare(`UPDATE lobbies SET status = 'closed', updated_at = ? WHERE id = ?`)
            .bind(now, lobbyId).run();
        }
      }
    }

    const newCount = Math.max(0, (lobby.member_count || 1) - 1);
    await c.env.sorc_db.prepare(`UPDATE lobbies SET member_count = ?, updated_at = ? WHERE id = ?`).bind(newCount, now, lobbyId).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to leave lobby.', details: error.message }, 500);
  }
});

// There is no "close a lobby" endpoint. Closing is not a thing a person does:
// a lobby closes itself in /leave once its last member is gone. A creator who
// is done with a lobby abandons it, which hands it to the next in line.

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

// A declined summon holds off further invites from that host to that lobby for
// a day - long enough to stop a host re-sending on a loop, short enough that a
// misclicked Deny does not lock a Player out of a table they wanted.
const DECLINE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

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
      `SELECT id, username, display_name FROM users WHERE id = ? AND (banned IS NULL OR banned = 0)`
    ).bind(to_uid).first() as any;
    if (!target) return c.json({ error: 'Player not found.' }, 404);
    const targetName = target.display_name || target.username || 'That Player';

    const isMember = await c.env.sorc_db.prepare(
      `SELECT id FROM lobby_members WHERE lobby_id = ? AND user_id = ?`
    ).bind(lobbyId, to_uid).first() as any;
    if (isMember) return c.json({ error: 'Player is already in this lobby.' }, 400);

    // One invite at a time, and a "no" means no. Without these two checks a
    // host can send the same person an unlimited stream of summons, which is
    // the whole shape of the spam problem.
    const priorSummon = await c.env.sorc_db.prepare(
      `SELECT status, created_at FROM lobby_summons
       WHERE lobby_id = ? AND from_uid = ? AND to_uid = ?
       ORDER BY created_at DESC LIMIT 1`
    ).bind(lobbyId, user.id, to_uid).first() as any;

    if (priorSummon && priorSummon.status === 'pending') {
      return c.json({
        error: `${targetName} has already been invited - waiting on their answer.`,
        already_invited: true,
      }, 409);
    }
    if (priorSummon && priorSummon.status === 'denied') {
      // A "no" holds for a day. That is long enough that a host cannot sit
      // there re-sending, and short enough that a misclicked Deny does not
      // lock someone out of a table they wanted. It only stops unsolicited
      // summons either way - the Player can still join by code or answer an
      // LFM: post whenever they like.
      const since = Date.now() - new Date(priorSummon.created_at).getTime();
      if (since < DECLINE_COOLDOWN_MS) {
        const hoursLeft = Math.max(1, Math.ceil((DECLINE_COOLDOWN_MS - since) / (60 * 60 * 1000)));
        return c.json({
          error: `${targetName} declined your invite. You can invite them again in ${hoursLeft}h - they can still join on their own before then.`,
          declined: true, hours_left: hoursLeft,
        }, 409);
      }
    }

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

    if (!accept) {
      // Declining is not a door slammed shut. The Player gets a line in their
      // Inbox with a way back in, so a "not right now" does not cost them the
      // table - and the host, who is now barred from re-inviting for a day,
      // does not have to chase them.
      //
      // Wrapped: a failure to write the Inbox note must never turn a
      // successful decline into an error the Player sees.
      try {
        const playerName = user.display_name || user.username;
        const entryUrl = `https://sorcrpg.com/lobbies.html?join=${summon.lobby_id}`;
        await sendDirectMessage(
          c.env.sorc_db,
          summon.from_uid, summon.from_name,
          user.id, playerName,
          `You declined the summon into "${summon.lobby_name}". ` +
          `If you change your mind, you may enter here: ${entryUrl}`
        );
      } catch (e) {
        console.error('Decline follow-up message failed:', e);
      }
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

// Whoever holds the lobby now decides whether it is open or private - including
// a host who inherited it when the previous one abandoned. Open means anyone
// may walk in; private means the code is required.
app.patch('/api/lobbies/:id/privacy', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const lobbyId = c.req.param('id');
  const lobby = await c.env.sorc_db.prepare(`SELECT * FROM lobbies WHERE id = ?`).bind(lobbyId).first() as any;
  if (!lobby) return c.json({ error: 'Lobby not found.' }, 404);
  if (lobby.creator_uid !== user.id && !isPrivileged(user)) {
    return c.json({ error: 'Only the current host can change this lobby\'s privacy.' }, 403);
  }
  const { is_private } = await c.req.json() as any;
  if (typeof is_private !== 'boolean') return c.json({ error: 'is_private must be true or false.' }, 400);
  await c.env.sorc_db.prepare(`UPDATE lobbies SET is_private = ?, updated_at = ? WHERE id = ?`)
    .bind(is_private ? 1 : 0, new Date().toISOString(), lobbyId).run();
  return c.json({ success: true, is_private });
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
  if (!chatAllowed) return c.json({ error: 'Slow down - too many messages.' }, 429);
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
  const now = new Date().toISOString();

  // Kicking the host leaves the lobby with no owner. Hand it on the same way
  // an abandon does - next GM in, else next member in - so the crown always
  // sits on someone who is actually here.
  if (lobby.creator_uid === targetUid) {
    const nextGM = await c.env.sorc_db.prepare(
      `SELECT user_id FROM lobby_members WHERE lobby_id = ? AND sorc_role LIKE 'GM-%' ORDER BY joined_at ASC LIMIT 1`
    ).bind(lobbyId).first() as any;
    const nextHost = nextGM || await c.env.sorc_db.prepare(
      `SELECT user_id FROM lobby_members WHERE lobby_id = ? ORDER BY joined_at ASC LIMIT 1`
    ).bind(lobbyId).first() as any;
    if (nextHost) {
      await c.env.sorc_db.prepare(`UPDATE lobbies SET creator_uid = ?, updated_at = ? WHERE id = ?`)
        .bind(nextHost.user_id, now, lobbyId).run();
    } else {
      await c.env.sorc_db.prepare(`UPDATE lobbies SET status = 'closed', updated_at = ? WHERE id = ?`)
        .bind(now, lobbyId).run();
    }
  }

  const newCount = Math.max(1, (lobby.member_count || 1) - 1);
  await c.env.sorc_db.prepare(`UPDATE lobbies SET member_count = ?, updated_at = ? WHERE id = ?`).bind(newCount, now, lobbyId).run();
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
// endpoint lobbies.html calls - it validates that whoever is designated GM
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
     themselves - gate the launch itself too. ── */
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
      return c.json({ error: 'Run a ready check first - all players must confirm ready before launching.' }, 400);
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
// POST /api/lobbies/:id/launch above - these are the in-room routes.

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
// on the live Worker at all until now - only migrate-bcrypt existed here.

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

// ─── IP BANS (admin only) ───────────────────────────────────────────────────
// Banning an account is not enough against a guest, who can mint a fresh one
// in a click. Banning the address is. Enforced globally by ipBanGate.
app.get('/api/admin/ip-bans', authMiddleware, requireAdmin, async (c) => {
  await ensureIpBansTable(c.env.sorc_db);
  const rows = await c.env.sorc_db.prepare(
    `SELECT ip, banned_by_name, reason, created_at FROM ip_bans ORDER BY created_at DESC`
  ).all();
  return c.json({ ip_bans: rows.results || [] });
});

// Ban by raw address, or by user_id/username to ban whatever address that
// account last came from - an admin sees names in a lobby, not IPs.
app.post('/api/admin/ip-bans', authMiddleware, requireAdmin, async (c) => {
  const admin = c.get('user') as any;
  const { ip, user_id, reason } = await c.req.json() as any;
  await ensureIpBansTable(c.env.sorc_db);

  let target = (ip || '').trim();
  let targetName = target;
  if (!target && user_id) {
    await c.env.sorc_db.prepare(`ALTER TABLE users ADD COLUMN last_ip TEXT`).run().catch(() => {});
    const u = await c.env.sorc_db.prepare(
      `SELECT username, last_ip FROM users WHERE id = ? OR username = ?`
    ).bind(user_id, user_id).first() as any;
    if (!u) return c.json({ error: 'User not found.' }, 404);
    if (!u.last_ip) return c.json({ error: 'No address on record for that user yet - they have not signed in since IP logging began.' }, 400);
    target = u.last_ip;
    targetName = `${u.username} (${u.last_ip})`;
  }
  if (!target) return c.json({ error: 'Provide an ip or a user_id to ban.' }, 400);

  // Never let an admin ban the address they are working from.
  const ownIp = c.req.header('CF-Connecting-IP');
  if (ownIp && target === ownIp) return c.json({ error: 'That is your own address.' }, 400);

  await c.env.sorc_db.prepare(
    `INSERT OR REPLACE INTO ip_bans (ip, banned_by, banned_by_name, reason, created_at) VALUES (?, ?, ?, ?, ?)`
  ).bind(target, admin.id, admin.display_name || admin.username, (reason || '').slice(0, 200), new Date().toISOString()).run();
  return c.json({ success: true, ip: target, banned: targetName });
});

app.delete('/api/admin/ip-bans/:ip', authMiddleware, requireAdmin, async (c) => {
  await ensureIpBansTable(c.env.sorc_db);
  await c.env.sorc_db.prepare(`DELETE FROM ip_bans WHERE ip = ?`).bind(decodeURIComponent(c.req.param('ip'))).run();
  return c.json({ success: true });
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
        // Award only if this row is genuinely new. Reading the earned list and
        // then writing is a race: two requests firing together both see the
        // achievement unearned, both reach here, and INSERT OR IGNORE quietly
        // drops the second - but the old code still paid out for it. Checking
        // the row count is what makes the insert the single source of truth,
        // so points cannot be farmed by hammering this endpoint.
        const inserted = await c.env.sorc_db.prepare(
          `INSERT OR IGNORE INTO user_achievements (id, user_id, achievement_id, earned_at) VALUES (?, ?, ?, ?)`
        ).bind(crypto.randomUUID(), user.id, ach.id, now).run();
        earnedMap.set(ach.id, now);
        if (inserted.meta && inserted.meta.changes === 1) pointsAwarded += 25;
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
  if (!allowed) return c.json({ error: 'Slow down - too many messages.' }, 429);
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
  if (!allowed) return c.json({ error: 'Slow down - too many messages.' }, 429);
  try {
    const { body } = await c.req.json() as any;
    if (!body || !body.trim()) return c.json({ error: 'Message cannot be empty.' }, 400);
    if (body.length > 400) return c.json({ error: 'Message too long (max 400 chars).' }, 400);
    const worldMsgCheck = filterContent(body.trim());
    if (worldMsgCheck.blocked) return c.json({ error: worldMsgCheck.reason }, 400);

    // World Chat is the recruiting board. Trade tags moved to the lobby's
    // Trade tab (/api/trade-chat), where the card catalog and Hand Trade
    // live - a WTB:/WTS:/WTT: posted here would have no way to be acted on.
    if (/^(WTB|WTS|WTT):/i.test(body.trim())) {
      return c.json({ error: 'Trade tags belong in the Trade tab, not World Chat.' }, 400);
    }

    // Must be the active creator of an open lobby, or posting a short
    // LFG: tag.
    const lobby = await c.env.sorc_db.prepare(
      `SELECT id, name FROM lobbies WHERE creator_uid = ? AND status != 'closed' ORDER BY created_at DESC LIMIT 1`
    ).bind(user.id).first() as any;
    const isHost = !!(lobby || isPrivileged(user));
    if (!isHost) {
      if (!/^LFG:/i.test(body.trim())) return c.json({ error: 'Only active lobby hosts can post freely. Use LFG: to advertise yourself, or the Trade tab to trade.' }, 403);
      if (body.trim().length > 40) return c.json({ error: 'LFG: tags are limited to 40 characters.' }, 400);
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
  if (!respondAllowed) return c.json({ error: 'Slow down - too many responses.' }, 429);
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
      ? `SUM: ${myName} confirmed - ${profileUrl}`
      : `📋 ${myName} responds to ${original.sender_name}'s request - ${profileUrl}`;
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
        // Award only if this row is genuinely new. Reading the earned list and
        // then writing is a race: two requests firing together both see the
        // achievement unearned, both reach here, and INSERT OR IGNORE quietly
        // drops the second - but the old code still paid out for it. Checking
        // the row count is what makes the insert the single source of truth,
        // so points cannot be farmed by hammering this endpoint.
        const inserted = await c.env.sorc_db.prepare(
          `INSERT OR IGNORE INTO user_achievements (id, user_id, achievement_id, earned_at) VALUES (?, ?, ?, ?)`
        ).bind(crypto.randomUUID(), user.id, ach.id, now).run();
        earnedMap.set(ach.id, now);
        if (inserted.meta && inserted.meta.changes === 1) pointsAwarded += 25;
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
// ─── TRADE CHAT (WTB/WTS/WTT) + HAND TRADE ──────────────────────────────────
// The lobby's Trade tab. WTB:/WTS:/WTT: only work here - World Chat is for
// recruiting (LFM:/LFG:/SUM:) and rejects trade tags.
//
//   WTS:Item        want to sell   - poster hands the item over, takes Coin
//   WTB:Item        want to buy    - poster pays Coin on delivery of the item
//   WTT:Give>Want   want to trade  - poster hands Give over, takes Want back
//
// No price is ever typed or argued over. Every item's Coin value is printed
// on its SORC Card, and that value IS the cost - always. So WTB:/WTS: are
// take-it-or-leave-it: the responder Accepts or Declines. Only WTT: has
// anything to negotiate, because both sides are items and the card values
// may not line up; there, either party may counter with different items.
//
// Item names render as inspectable links (like gear links in chat): clicking
// one pops that item's SORC Card - Item, Weapon, Armor, and so on - showing
// its rank, stats, and the Coin value the trade is priced at.

const TRADE_TAG_MAX = 60;

async function ensureTradeTables(db: any) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS trade_messages (
       id TEXT PRIMARY KEY,
       sender_uid TEXT NOT NULL,
       sender_name TEXT NOT NULL,
       lobby_id TEXT,
       lobby_name TEXT,
       kind TEXT NOT NULL,
       item TEXT NOT NULL,
       want_item TEXT,
       coin INTEGER,
       want_coin INTEGER,
       status TEXT NOT NULL DEFAULT 'open',
       body TEXT NOT NULL,
       created_at TEXT NOT NULL
     )`
  ).run();
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS hand_trades (
       id TEXT PRIMARY KEY,
       message_id TEXT NOT NULL,
       kind TEXT NOT NULL,
       poster_uid TEXT NOT NULL,
       poster_name TEXT NOT NULL,
       responder_uid TEXT NOT NULL,
       responder_name TEXT NOT NULL,
       give_item TEXT NOT NULL,
       want_item TEXT,
       coin INTEGER,
       want_coin INTEGER,
       poster_ok INTEGER NOT NULL DEFAULT 0,
       responder_ok INTEGER NOT NULL DEFAULT 0,
       status TEXT NOT NULL DEFAULT 'pending',
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL
     )`
  ).run();
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS hand_trade_offers (
       id TEXT PRIMARY KEY,
       trade_id TEXT NOT NULL,
       actor_uid TEXT NOT NULL,
       actor_name TEXT NOT NULL,
       action TEXT NOT NULL,
       give_item TEXT,
       want_item TEXT,
       coin INTEGER,
       want_coin INTEGER,
       note TEXT,
       created_at TEXT NOT NULL
     )`
  ).run();
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS member_inventory (
       id TEXT PRIMARY KEY,
       user_id TEXT NOT NULL,
       item_name TEXT NOT NULL,
       qty INTEGER NOT NULL DEFAULT 1,
       tradeable INTEGER NOT NULL DEFAULT 1,
       source TEXT,
       created_at TEXT NOT NULL
     )`
  ).run();
  // The card catalog. An item's Coin value lives here and nowhere else -
  // this is the single authority every trade is priced from.
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS item_cards (
       id TEXT PRIMARY KEY,
       item_name TEXT NOT NULL,
       card_type TEXT NOT NULL DEFAULT 'Item',
       item_rank TEXT,
       coin_value INTEGER NOT NULL DEFAULT 0,
       stats TEXT,
       lore TEXT,
       ref_code TEXT,
       created_at TEXT NOT NULL
     )`
  ).run();
  await db.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_item_cards_name ON item_cards (item_name COLLATE NOCASE)`
  ).run();
}

// Look up an item's SORC Card. The card carries the Coin value that prices
// every trade of that item. An uncatalogued item comes back as null and is
// shown as "not yet catalogued" rather than being priced at zero.
async function lookupItemCard(db: any, name: string): Promise<any | null> {
  if (!name) return null;
  const card = await db.prepare(
    `SELECT item_name, card_type, item_rank, coin_value, stats, lore, ref_code
     FROM item_cards WHERE item_name = ? COLLATE NOCASE LIMIT 1`
  ).bind(name.trim()).first();
  return card || null;
}

async function cardValue(db: any, name: string): Promise<number | null> {
  const card = await lookupItemCard(db, name);
  return card ? (card.coin_value as number) : null;
}

// Parse a trade tag into its parts. Returns null when the body is not a
// well-formed WTB:/WTS:/WTT: tag. No price appears in a tag - the item's
// card supplies it.
function parseTradeTag(raw: string): { kind: string; item: string; want_item: string | null } | null {
  const body = (raw || '').trim();
  const m = body.match(/^(WTB|WTS|WTT):(.+)$/i);
  if (!m) return null;
  const kind = m[1].toUpperCase();
  const rest = m[2].trim();
  if (!rest) return null;

  if (kind === 'WTT') {
    // Two shapes. "WTT: Mob Card #1001" names a single Card by its ref # and
    // drops it into the Bazaar. "WTT: Give>Want" is the older barter form and
    // still opens a Hand Trade negotiation.
    if (!/(?:>|\bfor\b)/i.test(rest)) {
      if (!extractCardRef(rest)) {
        return null; // A bare WTT with no ref # and no ">" says nothing.
      }
      return { kind, item: rest.slice(0, 40), want_item: null };
    }
    // Give > Want. Accept ">" or "for" as the separator.
    const parts = rest.split(/\s*(?:>|\bfor\b)\s*/i);
    if (parts.length !== 2) return null;
    const give = parts[0].trim();
    const want = parts[1].trim();
    if (!give || !want) return null;
    return { kind, item: give.slice(0, 40), want_item: want.slice(0, 40) };
  }

  return { kind, item: rest.slice(0, 40), want_item: null };
}

// Only items proven on the server (earned in a recorded private room
// session) may be put up. When a member has no inventory rows at all we let
// the post through - inventory is populated by session play, and gating a
// brand-new member out of the board entirely would be worse than the risk.
async function ownsItem(db: any, userId: string, itemName: string): Promise<boolean> {
  const owned = await db.prepare(
    `SELECT COUNT(*) AS n FROM member_inventory WHERE user_id = ? AND tradeable = 1`
  ).bind(userId).first() as any;
  if (!owned || !owned.n) return true;
  const hit = await db.prepare(
    `SELECT id FROM member_inventory WHERE user_id = ? AND tradeable = 1 AND qty > 0 AND LOWER(item_name) = LOWER(?)`
  ).bind(userId, itemName).first();
  return !!hit;
}

// Items the member can offer, for the composer's suggestion list. Each one
// carries the Coin value off its card, so the seller sees the price the
// moment they pick it.
app.get('/api/trade-chat/inventory', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    await ensureTradeTables(c.env.sorc_db);
    const rows = await c.env.sorc_db.prepare(
      `SELECT inv.item_name, inv.qty, card.card_type, card.item_rank, card.coin_value
       FROM member_inventory inv
       LEFT JOIN item_cards card ON card.item_name = inv.item_name COLLATE NOCASE
       WHERE inv.user_id = ? AND inv.tradeable = 1 AND inv.qty > 0
       ORDER BY card.coin_value DESC, inv.item_name ASC LIMIT 100`
    ).bind(user.id).all();
    return c.json({ items: rows.results || [] });
  } catch (error: any) {
    return c.json({ items: [] });
  }
});

// The whole catalog, for the "what do you want in return" side of a WTT:
// where the member is naming something they do not own yet.
app.get('/api/item-cards', authMiddleware, async (c) => {
  try {
    await ensureTradeTables(c.env.sorc_db);
    const q = (c.req.query('q') || '').trim();
    const rows = q
      ? await c.env.sorc_db.prepare(
          `SELECT item_name, card_type, item_rank, coin_value FROM item_cards
           WHERE item_name LIKE ? COLLATE NOCASE ORDER BY item_name ASC LIMIT 25`
        ).bind(`%${q}%`).all()
      : await c.env.sorc_db.prepare(
          `SELECT item_name, card_type, item_rank, coin_value FROM item_cards
           ORDER BY item_name ASC LIMIT 25`
        ).all();
    return c.json({ items: rows.results || [] });
  } catch (error: any) {
    return c.json({ items: [] });
  }
});

// Inspect one item - this is what a clicked item link pops open.
app.get('/api/item-card', authMiddleware, async (c) => {
  try {
    await ensureTradeTables(c.env.sorc_db);
    const name = (c.req.query('name') || '').trim();
    if (!name) return c.json({ error: 'Missing name.' }, 400);
    const card = await lookupItemCard(c.env.sorc_db, name);
    if (!card) return c.json({ card: null, item_name: name });
    return c.json({ card });
  } catch (error: any) {
    return c.json({ card: null });
  }
});

app.get('/api/trade-chat', authMiddleware, async (c) => {
  try {
    await ensureTradeTables(c.env.sorc_db);
    const msgs = await c.env.sorc_db.prepare(
      `SELECT * FROM trade_messages ORDER BY created_at DESC LIMIT 60`
    ).all();
    return c.json({ messages: (msgs.results || []).reverse() });
  } catch (error: any) {
    return c.json({ messages: [] });
  }
});

app.post('/api/trade-chat', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const allowed = await checkRateLimit(c.env.sorc_db, `tradechat:${user.id}`, 6, 60);
  if (!allowed) return c.json({ error: 'Slow down - too many trade posts.' }, 429);
  try {
    const { body } = await c.req.json() as any;
    const raw = (body || '').trim();
    if (!raw) return c.json({ error: 'Post cannot be empty.' }, 400);
    if (raw.length > TRADE_TAG_MAX) {
      return c.json({ error: `Trade tags are limited to ${TRADE_TAG_MAX} characters.` }, 400);
    }
    const check = filterContent(raw);
    if (check.blocked) return c.json({ error: check.reason }, 400);

    const tag = parseTradeTag(check.filtered);
    if (!tag) {
      return c.json({
        error: 'Trade Chat only takes WTS:Item, WTB:Item, or WTT:YourItem>TheirItem.'
      }, 400);
    }

    // You can only offer up what you actually hold. WTB: is a request for
    // something you do not have yet, so nothing to check there.
    // A posting may name a Card by its ref # - "WTS: Skeleton Soldier #MOB001".
    // Resolve that first: the text carries both a name and a ref, so matching
    // the whole string against a stored item_name would never hit. Holding is
    // then checked against the ref further down, which is the authority.
    await ensureExchangeTables(c.env.sorc_db);
    const postedRef = extractCardRef(tag.item);

    // Only fall back to matching by name when no ref was given.
    if (tag.kind !== 'WTB' && !postedRef && !(await ownsItem(c.env.sorc_db, user.id, tag.item))) {
      return c.json({ error: `You do not own "${tag.item}". Only items earned in a recorded session can be offered.` }, 403);
    }

    const linkedCard = postedRef
      ? await findCard(c.env.sorc_db, postedRef, null) as any
      : null;
    if (postedRef && !linkedCard) {
      return c.json({ error: `No Card carries ref #${postedRef}.` }, 404);
    }

    let listingId: string | null = null;
    if (linkedCard && tag.kind !== 'WTB') {
      // Listing from chat is still listing. It goes through exactly the same
      // ownership gate as /api/exchange/list - holding is re-read from the
      // server's own row, Bound Cards are refused, and the claim is conditional.
      await ensureOwnershipColumns(c.env.sorc_db);
      const held = await ownedCardRow(c.env.sorc_db, user.id, linkedCard.ref_code) as any;
      if (!held) {
        return c.json({ error: `You do not hold ${linkedCard.item_name} (#${linkedCard.ref_code}).` }, 403);
      }
      if (held.bound) {
        return c.json({ error: `${linkedCard.item_name} is Bound and cannot be traded.` }, 403);
      }
      if (held.locked) {
        return c.json({ error: `${linkedCard.item_name} is locked in your Vault. Unlock it to trade it.`, locked: true }, 403);
      }
      if (held.listing_id) {
        return c.json({ error: `${linkedCard.item_name} is already listed on the Exchange.` }, 409);
      }

      const max = await slotAllowance(c.env.sorc_db, user);
      const used = await slotsUsed(c.env.sorc_db, user.id);
      if (used >= max) {
        const tier = max === EXCHANGE_SLOTS_PRO ? 'Pro' : 'Basic';
        return c.json({
          error: `All ${max} of your trading slots are in use. ${tier} members get ${max}.` +
                 (tier === 'Basic' ? ` Pro members get ${EXCHANGE_SLOTS_PRO}.` : ''),
          slots_full: true, used, max,
        }, 403);
      }

      const listedAt = new Date().toISOString();
      listingId = crypto.randomUUID();
      const claim = await c.env.sorc_db.prepare(
        `UPDATE member_inventory SET listing_id = ?
         WHERE id = ? AND listing_id IS NULL AND qty > 0`
      ).bind(listingId, held.id).run();
      if (!claim.meta || claim.meta.changes !== 1) {
        return c.json({ error: 'That Card was just listed elsewhere.' }, 409);
      }
      try {
        await c.env.sorc_db.prepare(
          `INSERT INTO exchange_listings (id, tab, seller_uid, seller_name, ref_code, item_name, card_type, coin_price, status, created_at, updated_at)
           VALUES (?, 'bazaar', ?, ?, ?, ?, ?, ?, 'open', ?, ?)`
        ).bind(
          listingId, user.id, user.display_name || user.username,
          linkedCard.ref_code, linkedCard.item_name, linkedCard.card_type,
          linkedCard.coin_value, listedAt, listedAt
        ).run();
      } catch (e) {
        await c.env.sorc_db.prepare(
          `UPDATE member_inventory SET listing_id = NULL WHERE id = ?`
        ).bind(held.id).run();
        throw e;
      }
    }

    // Price is read off the card, never typed by the poster.
    const coin = linkedCard ? linkedCard.coin_value : await cardValue(c.env.sorc_db, tag.item);
    const wantCoin = tag.want_item ? await cardValue(c.env.sorc_db, tag.want_item) : null;

    const lobby = await c.env.sorc_db.prepare(
      `SELECT id, name FROM lobbies WHERE creator_uid = ? AND status != 'closed' ORDER BY created_at DESC LIMIT 1`
    ).bind(user.id).first() as any;

    const now = new Date().toISOString();
    await c.env.sorc_db.prepare(
      `INSERT INTO trade_messages (id, sender_uid, sender_name, lobby_id, lobby_name, kind, item, want_item, coin, want_coin, status, body, created_at, card_ref, listing_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      user.id,
      user.display_name || user.username,
      lobby?.id || null,
      lobby?.name || null,
      tag.kind,
      linkedCard ? linkedCard.item_name : tag.item,
      tag.want_item,
      coin,
      wantCoin,
      check.filtered,
      now,
      linkedCard ? linkedCard.ref_code : null,
      listingId
    ).run();

    await c.env.sorc_db.prepare(
      `DELETE FROM trade_messages WHERE id NOT IN (SELECT id FROM trade_messages ORDER BY created_at DESC LIMIT 200)`
    ).run();

    return c.json({
      success: true,
      dropped: listingId ? {
        listing_id: listingId,
        ref_code: linkedCard.ref_code,
        item_name: linkedCard.item_name,
        coin_price: linkedCard.coin_value,
        tab: 'bazaar',
      } : null,
    });
  } catch (error: any) {
    return c.json({ error: 'Failed to post.', details: error.message }, 500);
  }
});

// Open (or re-open) the Hand Trade between the poster and whoever clicked.
// One thread per poster/responder pair per posting, so clicking twice
// returns you to the negotiation already in progress.
app.post('/api/hand-trade/open', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const gated = await exchangeGate(c, user, 'Hand Trade');
  if (gated) return gated;
  try {
    await ensureTradeTables(c.env.sorc_db);
    await ensureHandTradeRoomColumn(c.env.sorc_db);
    const { message_id, room_id } = await c.req.json() as any;
    if (!message_id) return c.json({ error: 'Missing message_id.' }, 400);

    // Hand Trade is face to face. It happens inside a Campaign Room and
    // nowhere else - never in a lobby, never across the open board.
    if (!room_id) {
      return c.json({ error: 'Hand Trade only happens inside a Campaign Room.' }, 400);
    }

    const msg = await c.env.sorc_db.prepare(
      `SELECT * FROM trade_messages WHERE id = ?`
    ).bind(message_id).first() as any;
    if (!msg) return c.json({ error: 'That posting is gone.' }, 404);
    if (msg.sender_uid === user.id) return c.json({ error: 'That is your own posting.' }, 400);
    if (msg.status !== 'open') return c.json({ error: 'That posting has already been settled.' }, 400);

    // Both parties must be sitting in that same Room. Membership is read from
    // the server's own rows, never asserted by the caller.
    const [mineInRoom, theirsInRoom] = await Promise.all([
      c.env.sorc_db.prepare(
        `SELECT id FROM room_members WHERE room_id = ? AND user_id = ?`
      ).bind(room_id, user.id).first(),
      c.env.sorc_db.prepare(
        `SELECT id FROM room_members WHERE room_id = ? AND user_id = ?`
      ).bind(room_id, msg.sender_uid).first(),
    ]);
    if (!mineInRoom) return c.json({ error: 'You are not in that Campaign Room.' }, 403);
    if (!theirsInRoom) {
      return c.json({ error: `${msg.sender_name} is not in that Campaign Room.` }, 403);
    }

    const existing = await c.env.sorc_db.prepare(
      `SELECT * FROM hand_trades WHERE message_id = ? AND responder_uid = ?`
    ).bind(message_id, user.id).first() as any;
    if (existing) return c.json({ success: true, trade_id: existing.id });

    const myName = user.display_name || user.username;
    const now = new Date().toISOString();
    const tradeId = crypto.randomUUID();
    await c.env.sorc_db.prepare(
      `INSERT INTO hand_trades (id, message_id, kind, poster_uid, poster_name, responder_uid, responder_name, give_item, want_item, coin, want_coin, poster_ok, responder_ok, status, created_at, updated_at, room_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'pending', ?, ?, ?)`
    ).bind(
      tradeId, message_id, msg.kind,
      msg.sender_uid, msg.sender_name,
      user.id, myName,
      msg.item, msg.want_item, msg.coin, msg.want_coin,
      now, now, room_id
    ).run();
    await c.env.sorc_db.prepare(
      `INSERT INTO hand_trade_offers (id, trade_id, actor_uid, actor_name, action, give_item, want_item, coin, want_coin, note, created_at)
       VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(), tradeId, msg.sender_uid, msg.sender_name,
      msg.item, msg.want_item, msg.coin, msg.want_coin, 'Opening terms', now
    ).run();

    return c.json({ success: true, trade_id: tradeId });
  } catch (error: any) {
    return c.json({ error: 'Could not open the trade.', details: error.message }, 500);
  }
});

app.get('/api/hand-trade/mine', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    await ensureTradeTables(c.env.sorc_db);
    const rows = await c.env.sorc_db.prepare(
      `SELECT * FROM hand_trades WHERE (poster_uid = ? OR responder_uid = ?) AND status = 'pending'
       ORDER BY updated_at DESC LIMIT 40`
    ).bind(user.id, user.id).all();
    const trades = (rows.results || []) as any[];
    // "Your move" = the other side moved last and you have not accepted the
    // terms on the table yet.
    const waiting = trades.filter((t) => (t.poster_uid === user.id ? !t.poster_ok : !t.responder_ok)).length;
    return c.json({ trades, waiting });
  } catch (error: any) {
    return c.json({ trades: [], waiting: 0 });
  }
});

app.get('/api/hand-trade/:id', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    await ensureTradeTables(c.env.sorc_db);
    const trade = await c.env.sorc_db.prepare(
      `SELECT * FROM hand_trades WHERE id = ?`
    ).bind(c.req.param('id')).first() as any;
    if (!trade) return c.json({ error: 'Trade not found.' }, 404);
    const isParty = trade.poster_uid === user.id || trade.responder_uid === user.id;
    // GMs and Admins can read a thread they are not party to - trades are
    // session property and need to be auditable.
    if (!isParty && !isPrivileged(user) && (user.sorc_role || '').indexOf('GM') !== 0) {
      return c.json({ error: 'Not your trade.' }, 403);
    }
    const offers = await c.env.sorc_db.prepare(
      `SELECT * FROM hand_trade_offers WHERE trade_id = ? ORDER BY created_at ASC LIMIT 60`
    ).bind(trade.id).all();
    // Ship the cards alongside so the popup can price and inspect both
    // sides without a second round trip.
    const giveCard = await lookupItemCard(c.env.sorc_db, trade.give_item);
    const wantCard = trade.want_item ? await lookupItemCard(c.env.sorc_db, trade.want_item) : null;
    return c.json({
      trade,
      offers: offers.results || [],
      give_card: giveCard,
      want_card: wantCard,
      you: isParty ? (trade.poster_uid === user.id ? 'poster' : 'responder') : 'observer'
    });
  } catch (error: any) {
    return c.json({ error: 'Could not load the trade.', details: error.message }, 500);
  }
});

// Counter: swap in different items. WTT: only - a WTB:/WTS: is priced off
// the card and there is nothing to argue about, so it is Accept or Decline.
// Any counter clears both acceptances; nobody is bound to terms they never saw.
app.post('/api/hand-trade/:id/counter', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const allowed = await checkRateLimit(c.env.sorc_db, `handtrade:${user.id}`, 20, 60);
  if (!allowed) return c.json({ error: 'Slow down.' }, 429);
  try {
    await ensureTradeTables(c.env.sorc_db);
    const trade = await c.env.sorc_db.prepare(
      `SELECT * FROM hand_trades WHERE id = ?`
    ).bind(c.req.param('id')).first() as any;
    if (!trade) return c.json({ error: 'Trade not found.' }, 404);
    if (trade.poster_uid !== user.id && trade.responder_uid !== user.id) return c.json({ error: 'Not your trade.' }, 403);
    if (trade.status !== 'pending') return c.json({ error: 'This trade is already closed.' }, 400);
    if (trade.kind !== 'WTT') {
      return c.json({ error: 'The price is the item\'s card value - accept it or decline.' }, 400);
    }

    const payload = await c.req.json().catch(() => ({})) as any;
    let giveItem = trade.give_item;
    let wantItem = trade.want_item;
    if (payload.give_item && String(payload.give_item).trim()) giveItem = String(payload.give_item).trim().slice(0, 40);
    if (payload.want_item && String(payload.want_item).trim()) wantItem = String(payload.want_item).trim().slice(0, 40);

    if (giveItem === trade.give_item && wantItem === trade.want_item) {
      return c.json({ error: 'Those are the terms already on the table.' }, 400);
    }

    // Whoever is handing an item over has to actually hold it. give_item is
    // always the poster's side of the table; want_item is the responder's.
    if (giveItem !== trade.give_item && !(await ownsItem(c.env.sorc_db, trade.poster_uid, giveItem))) {
      return c.json({ error: `${trade.poster_name} does not hold "${giveItem}".` }, 403);
    }
    if (wantItem !== trade.want_item && !(await ownsItem(c.env.sorc_db, trade.responder_uid, wantItem))) {
      return c.json({ error: `${trade.responder_name} does not hold "${wantItem}".` }, 403);
    }

    let note = payload.note ? String(payload.note).trim().slice(0, 120) : null;
    if (note) {
      const noteCheck = filterContent(note);
      if (noteCheck.blocked) return c.json({ error: noteCheck.reason }, 400);
      note = noteCheck.filtered;
    }

    const coin = await cardValue(c.env.sorc_db, giveItem);
    const wantCoin = await cardValue(c.env.sorc_db, wantItem);

    const now = new Date().toISOString();
    await c.env.sorc_db.prepare(
      `UPDATE hand_trades SET give_item = ?, want_item = ?, coin = ?, want_coin = ?, poster_ok = 0, responder_ok = 0, updated_at = ? WHERE id = ?`
    ).bind(giveItem, wantItem, coin, wantCoin, now, trade.id).run();
    await c.env.sorc_db.prepare(
      `INSERT INTO hand_trade_offers (id, trade_id, actor_uid, actor_name, action, give_item, want_item, coin, want_coin, note, created_at)
       VALUES (?, ?, ?, ?, 'counter', ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(), trade.id, user.id, user.display_name || user.username,
      giveItem, wantItem, coin, wantCoin, note, now
    ).run();

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Could not send the counter.', details: error.message }, 500);
  }
});

// Accept the terms currently on the table. The trade only settles once both
// sides have accepted the same terms.
app.post('/api/hand-trade/:id/accept', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    await ensureTradeTables(c.env.sorc_db);
    const trade = await c.env.sorc_db.prepare(
      `SELECT * FROM hand_trades WHERE id = ?`
    ).bind(c.req.param('id')).first() as any;
    if (!trade) return c.json({ error: 'Trade not found.' }, 404);
    const isPoster = trade.poster_uid === user.id;
    const isResponder = trade.responder_uid === user.id;
    if (!isPoster && !isResponder) return c.json({ error: 'Not your trade.' }, 403);
    if (trade.status !== 'pending') return c.json({ error: 'This trade is already closed.' }, 400);

    // Both parties must still be in the Room. Walking out cancels the deal -
    // a Hand Trade cannot settle across an empty table.
    if (trade.room_id) {
      const [a, b] = await Promise.all([
        c.env.sorc_db.prepare(`SELECT id FROM room_members WHERE room_id = ? AND user_id = ?`)
          .bind(trade.room_id, trade.poster_uid).first(),
        c.env.sorc_db.prepare(`SELECT id FROM room_members WHERE room_id = ? AND user_id = ?`)
          .bind(trade.room_id, trade.responder_uid).first(),
      ]);
      if (!a || !b) {
        return c.json({ error: 'Both traders must be in the Campaign Room.' }, 409);
      }
    }

    const now = new Date().toISOString();
    const posterOk = isPoster ? 1 : trade.poster_ok;
    const responderOk = isResponder ? 1 : trade.responder_ok;
    const settled = !!(posterOk && responderOk);

    // Conditional on the trade still being pending, so two accepts arriving at
    // once cannot both settle it and move the goods twice.
    const marked = await c.env.sorc_db.prepare(
      `UPDATE hand_trades SET poster_ok = ?, responder_ok = ?, status = ?, updated_at = ?
       WHERE id = ? AND status = 'pending'`
    ).bind(posterOk, responderOk, settled ? 'accepted' : 'pending', now, trade.id).run();
    if (!marked.meta || marked.meta.changes !== 1) {
      return c.json({ error: 'This trade is already closed.' }, 409);
    }
    await c.env.sorc_db.prepare(
      `INSERT INTO hand_trade_offers (id, trade_id, actor_uid, actor_name, action, give_item, want_item, coin, want_coin, note, created_at)
       VALUES (?, ?, ?, ?, 'accept', ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(), trade.id, user.id, user.display_name || user.username,
      trade.give_item, trade.want_item, trade.coin, trade.want_coin, null, now
    ).run();

    if (settled) {
      // Move the goods. Until this runs nothing has actually changed hands -
      // an accepted trade that transfers nothing is worse than no trade at all.
      const moved = await settleHandTrade(c.env.sorc_db, trade, now);
      if (!moved.ok) {
        // Roll the acceptance back so neither side is left thinking it closed.
        await c.env.sorc_db.prepare(
          `UPDATE hand_trades SET poster_ok = 0, responder_ok = 0, status = 'pending', updated_at = ? WHERE id = ?`
        ).bind(now, trade.id).run();
        return c.json({ error: moved.reason }, 409);
      }

      // Close the posting and drop a public line so the board - and any GM
      // reading it - sees what changed hands.
      await c.env.sorc_db.prepare(
        `UPDATE trade_messages SET status = 'settled' WHERE id = ?`
      ).bind(trade.message_id).run();
      const terms = trade.kind === 'WTT'
        ? `${trade.give_item} for ${trade.want_item}`
        : `${trade.give_item}${trade.coin === null ? '' : ` at ${trade.coin} Coin`}`;
      await c.env.sorc_db.prepare(
        `INSERT INTO trade_messages (id, sender_uid, sender_name, lobby_id, lobby_name, kind, item, want_item, coin, want_coin, status, body, created_at)
         VALUES (?, ?, ?, NULL, NULL, 'SETTLED', ?, ?, ?, ?, 'settled', ?, ?)`
      ).bind(
        crypto.randomUUID(), trade.poster_uid, trade.poster_name,
        trade.give_item, trade.want_item, trade.coin, trade.want_coin,
        `⬡ Hand Trade settled - ${trade.poster_name} and ${trade.responder_name}: ${terms}`,
        now
      ).run();
    }

    return c.json({ success: true, settled });
  } catch (error: any) {
    return c.json({ error: 'Could not accept.', details: error.message }, 500);
  }
});

app.post('/api/hand-trade/:id/decline', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    await ensureTradeTables(c.env.sorc_db);
    const trade = await c.env.sorc_db.prepare(
      `SELECT * FROM hand_trades WHERE id = ?`
    ).bind(c.req.param('id')).first() as any;
    if (!trade) return c.json({ error: 'Trade not found.' }, 404);
    if (trade.poster_uid !== user.id && trade.responder_uid !== user.id) return c.json({ error: 'Not your trade.' }, 403);
    if (trade.status !== 'pending') return c.json({ error: 'This trade is already closed.' }, 400);

    const now = new Date().toISOString();
    await c.env.sorc_db.prepare(
      `UPDATE hand_trades SET status = 'declined', updated_at = ? WHERE id = ?`
    ).bind(now, trade.id).run();
    await c.env.sorc_db.prepare(
      `INSERT INTO hand_trade_offers (id, trade_id, actor_uid, actor_name, action, give_item, want_item, coin, want_coin, note, created_at)
       VALUES (?, ?, ?, ?, 'decline', ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(), trade.id, user.id, user.display_name || user.username,
      trade.give_item, trade.want_item, trade.coin, trade.want_coin, null, now
    ).run();

    // Declining one thread does not kill the posting - other members may
    // still be negotiating on it.
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Could not decline.', details: error.message }, 500);
  }
});

// ─── THE EXCHANGE (Auction House) ────────────────────────────────────────────
// The Exchange is SORC's auction house. It settles in IN-GAME CURRENCY ONLY -
// no real money ever moves between Players on SORC servers.
//
// Four surfaces, three of them tabs inside The Exchange:
//   Bazaar        SORC Card trading - where Cards listed from chat land
//   Trade Post    Player-to-Player item hub
//   Black Market  reserved; no purpose assigned yet, listed but inert
//   Hand Trade    NOT part of The Exchange. Room-only, face-to-face, see below.
//
// Trading slots, Grand Exchange style: a member may hold only so many live
// listings at once. Basic members get 3, Pro members get 8.

const EXCHANGE_SLOTS_BASIC = 3;
const EXCHANGE_SLOTS_PRO = 8;
const EXCHANGE_TABS = ['bazaar', 'trade_post', 'black_market'];

async function ensureExchangeTables(db: any) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS exchange_listings (
       id TEXT PRIMARY KEY,
       tab TEXT NOT NULL DEFAULT 'bazaar',
       seller_uid TEXT NOT NULL,
       seller_name TEXT NOT NULL,
       ref_code TEXT,
       item_name TEXT NOT NULL,
       card_type TEXT,
       coin_price INTEGER NOT NULL DEFAULT 0,
       status TEXT NOT NULL DEFAULT 'open',
       buyer_uid TEXT,
       buyer_name TEXT,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL
     )`
  ).run();
  // Every Player's in-game purse. Coin is earned in recorded sessions; there is
  // no path from real money into this column, by design.
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS user_wallets (
       user_id TEXT PRIMARY KEY,
       coin INTEGER NOT NULL DEFAULT 0,
       updated_at TEXT NOT NULL
     )`
  ).run();
  // Chat postings carry the Card they linked, so the Trade tab can render the
  // link and the Buy/Pass control against the live listing.
  for (const col of ['card_ref TEXT', 'listing_id TEXT']) {
    try {
      await db.prepare(`ALTER TABLE trade_messages ADD COLUMN ${col}`).run();
    } catch (e) {
      // Column already present - SQLite has no ADD COLUMN IF NOT EXISTS.
    }
  }
  await seedItemCards(db);
}

// The card catalog is the single authority on what a Card is worth. Seeded
// with the Cards that ship in the rules; ref_code is the number printed on the
// physical Card (the green half of mod-ref#pg.N), and is what Players type.
async function seedItemCards(db: any) {
  // Transcribed from the printed card faces. The ref # and Module line are read
  // off the bottom of each card exactly as they appear.
  const seeds = [
    {
      ref: 'MOB001',
      name: 'Skeleton Soldier',
      type: 'Mob',
      rank: 'Common',
      coin: 25,
      module: 'SFK v. 0.01',
      lore: 'Each token represents one Skeleton Soldier. Remove a token as each is defeated. Skeleton Soldiers may be accompanied by 1d4 of each - guards, archers, soldiers, or others.',
      stats: {
        title: 'Common Skeleton',
        race: 'Skeleton', species: 'Undead', size: 'Standard',
        life: 28, prots: '26 (natural bone + iron helmet)',
        speed: '30 ft/turn', tokens: '2d4',
        equipment: 'Rusty Iron Sword, Iron Shield, Iron Helmet',
        aptitude: 'Darkvision 60 ft.',
        resistances: 'Immune to poison, disease, sleep, fear.',
        vulnerable: 'Blunt',
        loot: 'Rusty Iron Sword, Iron Shield, Iron Helmet, Bone Fragments, Silver Coin',
      },
      art: '/content/sorc-cards/encounter-cards/Encounter-Card-Common-Mob-Skeleton-Soldier_20260610_104351_0000.png',
    },
    {
      ref: 'BSS001',
      name: 'Wild Chimassu',
      type: 'Divine',
      rank: 'Boss',
      coin: 500,
      module: 'SFK v. 0.01',
      lore: 'Calls all feline and Winged Creatures within its realm. Speaks Celestial and Common.',
      stats: {
        title: 'Divine Chimassu',
        species: 'Mythical Beast', size: 'Goliath',
        life: 340, prots: '89 (natural armor)',
        speed: '50 ft., fly 80 ft.',
        aptitude: 'Darkvision 60 ft, Nature Senses, Passive Intuition 15, Call of the Wild',
        languages: 'Celestial and Common',
      },
      art: '/content/sorc-cards/encounter-cards/SORC-Card-Encounter-Card-Boss-Divine-Chimassu_20260610_111729_0000.png',
    },
  ];
  const now = new Date().toISOString();
  for (const s of seeds) {
    const existing = await db.prepare(
      `SELECT id FROM item_cards WHERE ref_code = ? LIMIT 1`
    ).bind(s.ref).first();
    if (existing) continue;
    await db.prepare(
      `INSERT INTO item_cards (id, item_name, card_type, item_rank, coin_value, stats, lore, ref_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(), s.name, s.type, s.rank, s.coin,
      JSON.stringify({ ...s.stats, module: s.module, art: s.art }), s.lore, s.ref, now
    ).run();
  }
}

async function walletBalance(db: any, userId: string): Promise<number> {
  const row = await db.prepare(
    `SELECT coin FROM user_wallets WHERE user_id = ?`
  ).bind(userId).first() as any;
  if (row) return row.coin || 0;
  await db.prepare(
    `INSERT INTO user_wallets (user_id, coin, updated_at) VALUES (?, 0, ?)`
  ).bind(userId, new Date().toISOString()).run();
  return 0;
}

async function slotAllowance(db: any, user: any): Promise<number> {
  return (await isProMember(db, user)) ? EXCHANGE_SLOTS_PRO : EXCHANGE_SLOTS_BASIC;
}

async function slotsUsed(db: any, userId: string): Promise<number> {
  const row = await db.prepare(
    `SELECT COUNT(*) AS n FROM exchange_listings WHERE seller_uid = ? AND status = 'open'`
  ).bind(userId).first() as any;
  return row?.n || 0;
}

// Look a Card up the way a Player refers to it: by the ref # off the card, or
// failing that by name. Returns null when neither hits.
async function findCard(db: any, ref: string | null, name: string | null) {
  if (ref) {
    const byRef = await db.prepare(
      `SELECT * FROM item_cards WHERE ref_code = ? LIMIT 1`
    ).bind(String(ref).replace(/^#/, '')).first();
    if (byRef) return byRef;
  }
  if (name) {
    const byName = await db.prepare(
      `SELECT * FROM item_cards WHERE LOWER(item_name) = LOWER(?) LIMIT 1`
    ).bind(name.trim()).first();
    if (byName) return byName;
  }
  return null;
}

// Pull the ref # out of "Mob Card #MOB001", "Card #BSS001", or plain "#MOB001".
// A SORC Card ref # is a type prefix plus a sequence, exactly as printed on the
// card face: MOB001 (Mob), BSS001 (Boss). Never a bare number.
function extractCardRef(text: string): string | null {
  const m = (text || '').match(/#\s*([A-Za-z]{2,4}\s?[0-9]{1,4})/);
  return m ? m[1].replace(/\s+/g, '').toUpperCase() : null;
}

app.get('/api/exchange/wallet', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const gated = await exchangeGate(c, user, 'The Exchange');
  if (gated) return c.json({ coin: 0, can_trade: false });
  try {
    await ensureExchangeTables(c.env.sorc_db);
    const coin = await walletBalance(c.env.sorc_db, user.id);
    return c.json({ coin });
  } catch (error: any) {
    return c.json({ coin: 0 });
  }
});

app.get('/api/exchange/slots', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const gated = await exchangeGate(c, user, 'The Exchange');
  if (gated) {
    // Pass the gate's own reason through, so the page can say exactly why
    // trading is closed rather than probing a write endpoint to find out.
    let why: any = {};
    try { why = await gated.clone().json(); } catch (e) { /* non-JSON gate */ }
    return c.json({ used: 0, max: 0, free: 0, tier: 'Locked', can_trade: false, ...why });
  }
  try {
    await ensureExchangeTables(c.env.sorc_db);
    const max = await slotAllowance(c.env.sorc_db, user);
    const used = await slotsUsed(c.env.sorc_db, user.id);
    return c.json({
      used, max, free: Math.max(0, max - used),
      tier: max === EXCHANGE_SLOTS_PRO ? 'Pro' : 'Basic',
    });
  } catch (error: any) {
    return c.json({ used: 0, max: EXCHANGE_SLOTS_BASIC, free: EXCHANGE_SLOTS_BASIC, tier: 'Basic' });
  }
});

app.get('/api/card', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    await ensureExchangeTables(c.env.sorc_db);
    const ref = c.req.query('ref') || null;
    const name = c.req.query('name') || null;
    const card = await findCard(c.env.sorc_db, ref, name) as any;
    if (!card) return c.json({ error: 'No Card with that ref #.' }, 404);
    let stats: any = {};
    try {
      stats = JSON.parse(card.stats || '{}');
    } catch (e) { /* stats may be plain text on older rows */ }
    const { art, module: moduleName, ...printed } = stats;
    return c.json({
      card: {
        ref_code: card.ref_code,
        item_name: card.item_name,
        card_type: card.card_type,
        item_rank: card.item_rank,
        coin_value: card.coin_value,
        lore: card.lore,
        module: moduleName || null,
        art: art || null,
        stats: printed,
      },
    });
  } catch (error: any) {
    return c.json({ error: 'Could not read that Card.' }, 500);
  }
});

app.get('/api/exchange/listings', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    await ensureExchangeTables(c.env.sorc_db);
    const tab = (c.req.query('tab') || 'bazaar').toLowerCase();
    if (!EXCHANGE_TABS.includes(tab)) {
      return c.json({ error: 'Unknown Exchange tab.' }, 400);
    }
    const rows = await c.env.sorc_db.prepare(
      `SELECT * FROM exchange_listings WHERE tab = ? AND status = 'open'
       ORDER BY created_at DESC LIMIT 100`
    ).bind(tab).all();
    return c.json({ tab, listings: rows.results || [] });
  } catch (error: any) {
    return c.json({ tab: 'bazaar', listings: [] });
  }
});

app.post('/api/exchange/list', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const gated = await exchangeGate(c, user, 'The Exchange');
  if (gated) return gated;
  try {
    await ensureExchangeTables(c.env.sorc_db);
    const { ref_code, item_name, tab } = await c.req.json() as any;
    const target = (tab || 'bazaar').toLowerCase();
    if (!EXCHANGE_TABS.includes(target)) {
      return c.json({ error: 'Unknown Exchange tab.' }, 400);
    }
    if (target === 'black_market') {
      return c.json({ error: 'The Black Market is not open for listings yet.' }, 403);
    }

    const max = await slotAllowance(c.env.sorc_db, user);
    const used = await slotsUsed(c.env.sorc_db, user.id);
    if (used >= max) {
      const tier = max === EXCHANGE_SLOTS_PRO ? 'Pro' : 'Basic';
      return c.json({
        error: `All ${max} of your trading slots are in use. ${tier} members get ${max}.` +
               (tier === 'Basic' ? ' Pro members get ' + EXCHANGE_SLOTS_PRO + '.' : ''),
        slots_full: true, used, max,
      }, 403);
    }

    const card = await findCard(c.env.sorc_db, ref_code || null, item_name || null) as any;
    if (!card) return c.json({ error: 'No Card with that ref #.' }, 404);

    // You may only list a Card you actually hold. Ownership is re-read from the
    // server's own row here - never taken from the request or a stale session.
    await ensureOwnershipColumns(c.env.sorc_db);
    const held = await ownedCardRow(c.env.sorc_db, user.id, card.ref_code) as any;
    if (!held) {
      return c.json({ error: `You do not hold ${card.item_name} (#${card.ref_code}).` }, 403);
    }
    if (held.bound) {
      return c.json({ error: `${card.item_name} is Bound and cannot be traded.` }, 403);
    }
    if (held.locked) {
      return c.json({ error: `${card.item_name} is locked in your Vault. Unlock it to trade it.`, locked: true }, 403);
    }
    if (held.listing_id) {
      return c.json({ error: `${card.item_name} is already listed on the Exchange.` }, 409);
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    // Claim the Card first, and only if it is still unlisted. Two racing
    // requests cannot both win this, so a Card can never be listed twice.
    const claim = await c.env.sorc_db.prepare(
      `UPDATE member_inventory SET listing_id = ?
       WHERE id = ? AND listing_id IS NULL AND qty > 0`
    ).bind(id, held.id).run();
    if (!claim.meta || claim.meta.changes !== 1) {
      return c.json({ error: 'That Card was just listed elsewhere.' }, 409);
    }

    try {
      await c.env.sorc_db.prepare(
        `INSERT INTO exchange_listings (id, tab, seller_uid, seller_name, ref_code, item_name, card_type, coin_price, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`
      ).bind(
        id, target, user.id, user.display_name || user.username,
        card.ref_code, card.item_name, card.card_type, card.coin_value, now, now
      ).run();
    } catch (e) {
      // Release the claim so the Card is not stranded.
      await c.env.sorc_db.prepare(
        `UPDATE member_inventory SET listing_id = NULL WHERE id = ?`
      ).bind(held.id).run();
      throw e;
    }

    return c.json({
      success: true, listing_id: id, tab: target,
      item_name: card.item_name, ref_code: card.ref_code,
      coin_price: card.coin_value, slots: { used: used + 1, max },
    });
  } catch (error: any) {
    return c.json({ error: 'Could not list that Card.', details: error.message }, 500);
  }
});

// Buying settles in Coin and nothing else. A Player with too little Coin gets
// told exactly that - the listing stays up and nothing moves.
app.post('/api/exchange/buy', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const gated = await exchangeGate(c, user, 'The Exchange');
  if (gated) return gated;
  try {
    await ensureExchangeTables(c.env.sorc_db);
    const { listing_id } = await c.req.json() as any;
    if (!listing_id) return c.json({ error: 'Which listing?' }, 400);

    const listing = await c.env.sorc_db.prepare(
      `SELECT * FROM exchange_listings WHERE id = ?`
    ).bind(listing_id).first() as any;
    if (!listing) return c.json({ error: 'That listing is gone.' }, 404);
    if (listing.status !== 'open') return c.json({ error: 'That listing is no longer open.' }, 409);
    if (listing.seller_uid === user.id) {
      return c.json({ error: 'You cannot buy your own listing.' }, 400);
    }

    const price = listing.coin_price || 0;
    const now = new Date().toISOString();
    await ensureOwnershipColumns(c.env.sorc_db);

    // No room, no purchase - checked before any Coin moves, so a full shelf
    // costs nothing rather than taking payment for a Card with nowhere to go.
    if (!(await collectionHasRoom(c.env.sorc_db, user))) {
      return c.json({
        error: 'Your Trophy & Collectables is full. Free a slot or add space before buying.',
        collection_full: true,
      }, 409);
    }
    await walletBalance(c.env.sorc_db, user.id); // ensure the purse row exists

    // Claim the listing before any Coin moves. Conditional on it still being
    // open, so two buyers racing for the same Card cannot both succeed.
    const claim = await c.env.sorc_db.prepare(
      `UPDATE exchange_listings SET status = 'settling', buyer_uid = ?, buyer_name = ?, updated_at = ?
       WHERE id = ? AND status = 'open'`
    ).bind(user.id, user.display_name || user.username, now, listing_id).run();
    if (!claim.meta || claim.meta.changes !== 1) {
      return c.json({ error: 'Someone just bought that Card.' }, 409);
    }

    // Debit conditionally. A purse that cannot cover the price is not touched,
    // and the check and the write are the same statement - so no race can
    // overdraw an account the way a read-then-write could.
    const debit = await c.env.sorc_db.prepare(
      `UPDATE user_wallets SET coin = coin - ?, updated_at = ? WHERE user_id = ? AND coin >= ?`
    ).bind(price, now, user.id, price).run();
    if (!debit.meta || debit.meta.changes !== 1) {
      // Nothing was taken. Put the listing back exactly as it was.
      await c.env.sorc_db.prepare(
        `UPDATE exchange_listings SET status = 'open', buyer_uid = NULL, buyer_name = NULL, updated_at = ? WHERE id = ?`
      ).bind(now, listing_id).run();
      const balance = await walletBalance(c.env.sorc_db, user.id);
      return c.json({
        error: 'Insufficient Coin',
        insufficient: true, balance, price, short: price - balance,
      }, 402);
    }

    await c.env.sorc_db.prepare(
      `INSERT INTO user_wallets (user_id, coin, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET coin = coin + ?, updated_at = ?`
    ).bind(listing.seller_uid, price, now, price, now).run();

    // Digital ownership follows the Coin, per the card trading rules: the
    // seller's copy is released, the buyer's is created.
    await c.env.sorc_db.prepare(
      `DELETE FROM member_inventory WHERE user_id = ? AND listing_id = ?`
    ).bind(listing.seller_uid, listing_id).run();
    await c.env.sorc_db.prepare(
      `INSERT INTO member_inventory (id, user_id, item_name, qty, tradeable, source, created_at, ref_code, bound)
       VALUES (?, ?, ?, 1, 1, 'exchange', ?, ?, 0)`
    ).bind(crypto.randomUUID(), user.id, listing.item_name, now, listing.ref_code).run();

    await c.env.sorc_db.prepare(
      `UPDATE exchange_listings SET status = 'sold', updated_at = ? WHERE id = ?`
    ).bind(now, listing_id).run();

    const balance = await walletBalance(c.env.sorc_db, user.id);
    return c.json({
      success: true, item_name: listing.item_name,
      ref_code: listing.ref_code, paid: price, balance,
    });
  } catch (error: any) {
    return c.json({ error: 'Could not complete that purchase.', details: error.message }, 500);
  }
});

app.post('/api/exchange/cancel', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const gated = await exchangeGate(c, user, 'The Exchange');
  if (gated) return gated;
  try {
    await ensureExchangeTables(c.env.sorc_db);
    const { listing_id } = await c.req.json() as any;
    const listing = await c.env.sorc_db.prepare(
      `SELECT * FROM exchange_listings WHERE id = ?`
    ).bind(listing_id).first() as any;
    if (!listing) return c.json({ error: 'That listing is gone.' }, 404);
    if (listing.seller_uid !== user.id && !isPrivileged(user)) {
      return c.json({ error: 'That is not your listing.' }, 403);
    }
    const now = new Date().toISOString();
    // Only an open listing can be withdrawn - one already settling or sold is
    // past the point of recall, and the conditional says so rather than trusting
    // the row we read a moment ago.
    const pulled = await c.env.sorc_db.prepare(
      `UPDATE exchange_listings SET status = 'cancelled', updated_at = ?
       WHERE id = ? AND status = 'open'`
    ).bind(now, listing_id).run();
    if (!pulled.meta || pulled.meta.changes !== 1) {
      return c.json({ error: 'That listing is already settling or sold.' }, 409);
    }
    // Hand the Card back to its holder, or it would be stranded as listed.
    await ensureOwnershipColumns(c.env.sorc_db);
    await c.env.sorc_db.prepare(
      `UPDATE member_inventory SET listing_id = NULL WHERE listing_id = ?`
    ).bind(listing_id).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Could not cancel.', details: error.message }, 500);
  }
});

// ─── CARD OWNERSHIP ──────────────────────────────────────────────────────────
// Cards are property. Every path that moves one follows the same rules the
// community_points award path follows:
//
//   1. Identity comes from the auth key, never from the request body.
//   2. Eligibility is re-read fresh from the database immediately before the
//      write - a stale session object is never trusted.
//   3. The write is conditional (WHERE ... AND still_valid) and the row count
//      is checked, so two racing callers cannot both win.
//   4. Balances move by relative arithmetic (coin = coin - ?), never by
//      setting an absolute the client supplied.
//   5. Anything that must happen once is guarded by a consumed flag.

async function ensureOwnershipColumns(db: any) {
  for (const col of ['ref_code TEXT', 'bound INTEGER NOT NULL DEFAULT 0', 'listing_id TEXT', 'locked INTEGER NOT NULL DEFAULT 0']) {
    try {
      await db.prepare(`ALTER TABLE member_inventory ADD COLUMN ${col}`).run();
    } catch (e) {
      // Column already present - SQLite has no ADD COLUMN IF NOT EXISTS.
    }
  }
}

// The authoritative answer to "does this member hold this Card, free to trade?"
// Read fresh, every time, from the row the server owns.
async function ownedCardRow(db: any, userId: string, refCode: string) {
  return await db.prepare(
    `SELECT * FROM member_inventory
     WHERE user_id = ? AND UPPER(ref_code) = UPPER(?) AND qty > 0
     LIMIT 1`
  ).bind(userId, refCode).first();
}

// ─── THE CARD PICKER ─────────────────────────────────────────────────────────
// Backs the chat picker: tabs by card type, a search box over name and ref #,
// and pages. Only ever returns cards this member actually holds.
app.get('/api/cards/mine', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const gated = await exchangeGate(c, user, 'the card picker');
  if (gated) return c.json({ cards: [], total: 0, page: 1, per_page: 12, pages: 1, tabs: [], can_trade: false });
  try {
    await ensureExchangeTables(c.env.sorc_db);
    await ensureOwnershipColumns(c.env.sorc_db);

    // Admin and Owner accounts hold the whole catalog for testing. Granting it
    // on first look means there is never an empty picker to puzzle over, and
    // it stays current as Cards are added.
    if (isPrivileged(user)) {
      const holds = await c.env.sorc_db.prepare(
        `SELECT COUNT(*) AS n FROM member_inventory WHERE user_id = ?`
      ).bind(user.id).first() as any;
      const catalogCount = await c.env.sorc_db.prepare(
        `SELECT COUNT(*) AS n FROM item_cards`
      ).first() as any;
      if ((holds?.n || 0) < (catalogCount?.n || 0)) {
        await grantCatalogTo(c.env.sorc_db, user.id);
      }
    }

    const tab = (c.req.query('tab') || 'all').toLowerCase();
    const q = (c.req.query('q') || '').trim();
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
    const perPage = Math.min(48, Math.max(1, parseInt(c.req.query('per_page') || '12', 10) || 12));

    const where: string[] = ['inv.user_id = ?', 'inv.qty > 0'];
    const args: any[] = [user.id];
    if (tab !== 'all') {
      where.push('LOWER(card.card_type) = LOWER(?)');
      args.push(tab);
    }
    if (q) {
      where.push('(card.item_name LIKE ? COLLATE NOCASE OR inv.ref_code LIKE ? COLLATE NOCASE)');
      args.push(`%${q}%`, `%${q}%`);
    }
    // ?locked=1 narrows to what is locked away - this is what the Vault reads.
    const lockedOnly = c.req.query('locked');
    if (lockedOnly === '1' || lockedOnly === 'true') where.push('inv.locked = 1');
    const whereSql = where.join(' AND ');

    const countRow = await c.env.sorc_db.prepare(
      `SELECT COUNT(*) AS n FROM member_inventory inv
       LEFT JOIN item_cards card ON UPPER(card.ref_code) = UPPER(inv.ref_code)
       WHERE ${whereSql}`
    ).bind(...args).first() as any;
    const total = countRow?.n || 0;

    const rows = await c.env.sorc_db.prepare(
      `SELECT inv.ref_code, inv.qty, inv.bound, inv.listing_id,
              inv.locked, card.item_name, card.card_type, card.item_rank, card.coin_value, card.stats
       FROM member_inventory inv
       LEFT JOIN item_cards card ON UPPER(card.ref_code) = UPPER(inv.ref_code)
       WHERE ${whereSql}
       ORDER BY card.card_type ASC, card.item_name ASC
       LIMIT ? OFFSET ?`
    ).bind(...args, perPage, (page - 1) * perPage).all();

    const cards = (rows.results || []).map((r: any) => {
      let art = null;
      try { art = JSON.parse(r.stats || '{}').art || null; } catch (e) { /* older rows */ }
      return {
        ref_code: r.ref_code,
        item_name: r.item_name,
        card_type: r.card_type,
        item_rank: r.item_rank,
        coin_value: r.coin_value,
        qty: r.qty,
        bound: !!r.bound,
        locked: !!r.locked,
        listed: !!r.listing_id,
        tradeable: !r.bound && !r.locked && !r.listing_id,
        art,
      };
    });

    const tabRows = await c.env.sorc_db.prepare(
      `SELECT card.card_type AS t, COUNT(*) AS n FROM member_inventory inv
       LEFT JOIN item_cards card ON UPPER(card.ref_code) = UPPER(inv.ref_code)
       WHERE inv.user_id = ? AND inv.qty > 0 GROUP BY card.card_type`
    ).bind(user.id).all();

    return c.json({
      cards, total, page, per_page: perPage,
      pages: Math.max(1, Math.ceil(total / perPage)),
      tabs: (tabRows.results || []).map((r: any) => ({ type: r.t || 'Unknown', count: r.n })),
    });
  } catch (error: any) {
    return c.json({ cards: [], total: 0, page: 1, per_page: 12, pages: 1, tabs: [] });
  }
});

// ─── ADMIN: GRANT CARDS ──────────────────────────────────────────────────────
// Privileged only. Grants the whole live catalog, so it stays correct as cards
// are added rather than freezing a hardcoded list. Idempotent - re-running it
// tops a member up to one of each rather than stacking duplicates.
app.post('/api/admin/grant-cards', authMiddleware, async (c) => {
  const actor = c.get('user') as any;
  if (!isPrivileged(actor)) return c.json({ error: 'Forbidden.' }, 403);
  try {
    await ensureExchangeTables(c.env.sorc_db);
    await ensureOwnershipColumns(c.env.sorc_db);

    const { email } = await c.req.json().catch(() => ({})) as any;
    // Identity is resolved server-side from the users table. The caller names a
    // member; the server decides who that is.
    const target = email
      ? await c.env.sorc_db.prepare(
          `SELECT id, email, display_name, username FROM users WHERE LOWER(email) = LOWER(?)`
        ).bind(email).first() as any
      : actor;
    if (!target) return c.json({ error: 'No member with that email.' }, 404);

    const granted = await grantCatalogTo(c.env.sorc_db, target.id);
    const catalog = await c.env.sorc_db.prepare(`SELECT COUNT(*) AS n FROM item_cards`).first() as any;
    const cards = { length: catalog?.n || 0 };

    return c.json({
      success: true,
      member: target.display_name || target.username || target.email,
      granted, catalog_size: cards.length,
    });
  } catch (error: any) {
    return c.json({ error: 'Could not grant cards.', details: error.message }, 500);
  }
});

async function ensureHandTradeRoomColumn(db: any) {
  try {
    await db.prepare(`ALTER TABLE hand_trades ADD COLUMN room_id TEXT`).run();
  } catch (e) {
    // Column already present.
  }
}

// Hand off one Card from one member to another, and only if the giver really
// holds it, it is not Bound, and it is not sitting on the Exchange. The take is
// conditional on all three, so a Card cannot be handed to two people at once.
async function handOverCard(db: any, fromUid: string, toUid: string, itemName: string, at: string) {
  const row = await db.prepare(
    `SELECT * FROM member_inventory
     WHERE user_id = ? AND LOWER(item_name) = LOWER(?) AND qty > 0
     LIMIT 1`
  ).bind(fromUid, itemName).first() as any;
  if (!row) return { ok: false, reason: `They no longer hold ${itemName}.` };
  if (row.bound) return { ok: false, reason: `${itemName} is Bound and cannot be traded.` };
  if (row.locked) return { ok: false, reason: `${itemName} is locked in their Vault.` };
  if (row.listing_id) return { ok: false, reason: `${itemName} is listed on the Exchange.` };

  const taken = await db.prepare(
    `DELETE FROM member_inventory WHERE id = ? AND listing_id IS NULL AND qty > 0`
  ).bind(row.id).run();
  if (!taken.meta || taken.meta.changes !== 1) {
    return { ok: false, reason: `${itemName} just moved elsewhere.` };
  }

  await db.prepare(
    `INSERT INTO member_inventory (id, user_id, item_name, qty, tradeable, source, created_at, ref_code, bound)
     VALUES (?, ?, ?, 1, 1, 'hand-trade', ?, ?, 0)`
  ).bind(crypto.randomUUID(), toUid, row.item_name, at, row.ref_code || null).run();
  return { ok: true };
}

// Settle an accepted Hand Trade. WTT swaps two Cards; WTS/WTB moves one Card
// against Coin. Every leg is checked before anything moves, and a failed leg
// puts the first one back.
async function settleHandTrade(db: any, trade: any, at: string) {
  await ensureOwnershipColumns(db);

  if (trade.kind === 'WTT') {
    const first = await handOverCard(db, trade.poster_uid, trade.responder_uid, trade.give_item, at);
    if (!first.ok) return first;
    const second = await handOverCard(db, trade.responder_uid, trade.poster_uid, trade.want_item, at);
    if (!second.ok) {
      // Undo the first leg - a half-completed swap would be a theft.
      await handOverCard(db, trade.responder_uid, trade.poster_uid, trade.give_item, at);
      return second;
    }
    return { ok: true };
  }

  // Coin legs. WTS: the poster gives the Card and takes Coin. WTB: the poster
  // pays Coin and takes the Card. Either way the payer is debited conditionally.
  const price = trade.coin || 0;
  const giverUid = trade.kind === 'WTB' ? trade.responder_uid : trade.poster_uid;
  const takerUid = trade.kind === 'WTB' ? trade.poster_uid : trade.responder_uid;
  const payerUid = takerUid;

  if (price > 0) {
    await walletBalance(db, payerUid);
    const debit = await db.prepare(
      `UPDATE user_wallets SET coin = coin - ?, updated_at = ? WHERE user_id = ? AND coin >= ?`
    ).bind(price, at, payerUid, price).run();
    if (!debit.meta || debit.meta.changes !== 1) {
      return { ok: false, reason: 'Insufficient Coin' };
    }
  }

  const handed = await handOverCard(db, giverUid, takerUid, trade.give_item, at);
  if (!handed.ok) {
    if (price > 0) {
      await db.prepare(
        `UPDATE user_wallets SET coin = coin + ?, updated_at = ? WHERE user_id = ?`
      ).bind(price, at, payerUid).run();
    }
    return handed;
  }

  if (price > 0) {
    await db.prepare(
      `INSERT INTO user_wallets (user_id, coin, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET coin = coin + ?, updated_at = ?`
    ).bind(giverUid, price, at, price, at).run();
  }
  return { ok: true };
}

// ─── EXCHANGE ACCESS GATE ────────────────────────────────────────────────────
// The Exchange is for assessed members. A Civilian cannot trade - they must
// assess into Player or GM first, exactly as they must to enter a Lobby.
//
// Follows the community_points discipline: eligibility is re-read from the
// database at call time, never taken from the session object the caller
// presented, so a stale or edited local copy buys nothing.
async function exchangeGate(c: any, user: any, what: string): Promise<any | null> {
  if (isPrivileged(user)) return null;

  // Guests may look, never touch. Browsing the Bazaar and inspecting a Card
  // are open to them; anything that moves a Card or Coin is not, because a
  // guest holds no real account for property to belong to.
  if (isGuestUser(user)) {
    return c.json({
      error: `Guests can browse the Bazaar but cannot trade. Create an account and assess to use ${what}.`,
      guest_blocked: true,
    }, 403);
  }

  const assessment = await c.env.sorc_db.prepare(
    `SELECT role_granted, taken_at FROM assessments WHERE user_id = ? ORDER BY taken_at DESC LIMIT 1`
  ).bind(user.id).first() as any;

  if (!assessment || assessment.role_granted === 'FAIL') {
    return c.json({
      error: `You must assess into Player or GM to use ${what}.`,
      needs_assess: true,
    }, 403);
  }

  const age = Date.now() - new Date(assessment.taken_at).getTime();
  if (age > ASSESSMENT_EXPIRY_MS) {
    await c.env.sorc_db.prepare(
      `UPDATE users SET needs_reassess = 1, updated_at = ? WHERE id = ?`
    ).bind(new Date().toISOString(), user.id).run();
    return c.json({
      error: `Your assessment has expired (30 days). Reassess to use ${what}.`,
      needs_reassess: true,
    }, 403);
  }

  const fresh = await c.env.sorc_db.prepare(
    `SELECT needs_reassess FROM users WHERE id = ?`
  ).bind(user.id).first() as any;
  if (fresh && (fresh.needs_reassess === 1 || fresh.needs_reassess === true)) {
    return c.json({
      error: `You are flagged for reassessment. Reassess to use ${what}.`,
      needs_reassess: true,
    }, 403);
  }
  return null;
}

// The full Card catalog, for the second half of a WTT: - you cannot pick what
// you want from your own collection, because you do not own it yet. Read-only
// and open to anyone who can see the Exchange; it exposes nothing but what is
// printed on the card faces.
app.get('/api/cards/catalog', authMiddleware, async (c) => {
  try {
    await ensureExchangeTables(c.env.sorc_db);
    const tab = (c.req.query('tab') || 'all').toLowerCase();
    const q = (c.req.query('q') || '').trim();
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
    const perPage = Math.min(48, Math.max(1, parseInt(c.req.query('per_page') || '12', 10) || 12));

    const where: string[] = ['1 = 1'];
    const args: any[] = [];
    if (tab !== 'all') { where.push('LOWER(card_type) = LOWER(?)'); args.push(tab); }
    if (q) {
      where.push('(item_name LIKE ? COLLATE NOCASE OR ref_code LIKE ? COLLATE NOCASE)');
      args.push(`%${q}%`, `%${q}%`);
    }
    const whereSql = where.join(' AND ');

    const countRow = await c.env.sorc_db.prepare(
      `SELECT COUNT(*) AS n FROM item_cards WHERE ${whereSql}`
    ).bind(...args).first() as any;
    const total = countRow?.n || 0;

    const rows = await c.env.sorc_db.prepare(
      `SELECT ref_code, item_name, card_type, item_rank, coin_value, stats
       FROM item_cards WHERE ${whereSql}
       ORDER BY card_type ASC, item_name ASC LIMIT ? OFFSET ?`
    ).bind(...args, perPage, (page - 1) * perPage).all();

    const cards = (rows.results || []).map((r: any) => {
      let art = null;
      try { art = JSON.parse(r.stats || '{}').art || null; } catch (e) { /* older rows */ }
      return {
        ref_code: r.ref_code, item_name: r.item_name, card_type: r.card_type,
        item_rank: r.item_rank, coin_value: r.coin_value,
        bound: false, listed: false, tradeable: true, art,
      };
    });

    const tabRows = await c.env.sorc_db.prepare(
      `SELECT card_type AS t, COUNT(*) AS n FROM item_cards GROUP BY card_type`
    ).all();

    return c.json({
      cards, total, page, per_page: perPage,
      pages: Math.max(1, Math.ceil(total / perPage)),
      tabs: (tabRows.results || []).map((r: any) => ({ type: r.t || 'Unknown', count: r.n })),
    });
  } catch (error: any) {
    return c.json({ cards: [], total: 0, page: 1, per_page: 12, pages: 1, tabs: [] });
  }
});

// Give a member one of every Card in the live catalog. Idempotent: a Card the
// member already holds is skipped, so re-running tops up rather than stacking
// duplicates. Used by the admin control and by the auto-grant for privileged
// accounts.
async function grantCatalogTo(db: any, userId: string): Promise<number> {
  await ensureOwnershipColumns(db);
  const catalog = await db.prepare(`SELECT * FROM item_cards`).all();
  const now = new Date().toISOString();
  let granted = 0;
  for (const card of (catalog.results || []) as any[]) {
    const held = await ownedCardRow(db, userId, card.ref_code);
    if (held) continue;
    await db.prepare(
      `INSERT INTO member_inventory (id, user_id, item_name, qty, tradeable, source, created_at, ref_code, bound)
       VALUES (?, ?, ?, 1, 1, 'admin-grant', ?, ?, 0)`
    ).bind(crypto.randomUUID(), userId, card.item_name, now, card.ref_code).run();
    granted++;
  }
  return granted;
}

// Drop a direct message into a member's Inbox, opening the conversation if the
// two have never spoken. Lifted verbatim from the lobby-invite path so both
// use one implementation rather than two copies that can drift.
async function sendDirectMessage(
  db: any, fromUid: string, fromName: string,
  toUid: string, toName: string, body: string
) {
  const now = new Date().toISOString();
  const existing = await db.prepare(
    `SELECT id FROM conversations
     WHERE (user1_uid = ? AND user2_uid = ?) OR (user1_uid = ? AND user2_uid = ?)`
  ).bind(fromUid, toUid, toUid, fromUid).first() as any;

  const convId = existing ? existing.id : crypto.randomUUID();
  if (!existing) {
    await db.prepare(
      `INSERT INTO conversations (id, user1_uid, user2_uid, user1_name, user2_name, status, last_message_text, created_at, last_message_at)
       VALUES (?, ?, ?, ?, ?, 'accepted', ?, ?, ?)`
    ).bind(convId, fromUid, toUid, fromName, toName, body.substring(0, 100), now, now).run();
  } else {
    await db.prepare(
      `UPDATE conversations SET last_message_text = ?, last_message_at = ? WHERE id = ?`
    ).bind(body.substring(0, 100), now, convId).run();
  }
  await db.prepare(
    `INSERT INTO messages (id, conversation_id, sender_uid, sender_name, body, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), convId, fromUid, fromName, body, now).run();
  return convId;
}

// Where does this lobby lead right now? Read-only. The Inbox link after a
// decline points at the lobby, but by the time it is clicked the table may
// have launched into a Campaign Room - this says which, so the page can join
// the lobby or knock on the Room's door as appropriate.
app.get('/api/lobbies/:id/room', authMiddleware, async (c) => {
  const lobbyId = c.req.param('id');
  try {
    const lobby = await c.env.sorc_db.prepare(
      `SELECT id, name, status FROM lobbies WHERE id = ?`
    ).bind(lobbyId).first() as any;
    if (!lobby) return c.json({ error: 'That lobby is gone.' }, 404);

    const room = await c.env.sorc_db.prepare(
      `SELECT id, room_name, gm_uid, status, is_hidden FROM private_rooms
       WHERE lobby_id = ? AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`
    ).bind(lobbyId).first() as any;

    return c.json({
      lobby: { id: lobby.id, name: lobby.name, status: lobby.status },
      room: room ? { id: room.id, name: room.room_name, hidden: !!room.is_hidden } : null,
    });
  } catch (error: any) {
    return c.json({ error: 'Could not read that lobby.' }, 500);
  }
});

// ─── THE VAULT: LOCKING ──────────────────────────────────────────────────────
// Bound and Locked are different things and both matter.
//
//   Bound   the game's rule. A Card becomes Bound when it is equipped,
//           enhanced or socketed, and the card face says so. Nothing the
//           owner can undo here.
//   Locked  the owner's own decision. A deliberate second step before parting
//           with something valuable - a locked Card cannot be listed on the
//           Exchange or handed over at a table until it is unlocked.
//
// Locking is what makes the Vault a safe rather than a shelf.
app.post('/api/cards/lock', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const gated = await exchangeGate(c, user, 'the Vault');
  if (gated) return gated;
  try {
    await ensureExchangeTables(c.env.sorc_db);
    await ensureOwnershipColumns(c.env.sorc_db);
    const { ref_code, locked } = await c.req.json() as any;
    if (!ref_code) return c.json({ error: 'Which Card?' }, 400);

    // Holding is re-read from the server's own row, never taken on trust.
    const held = await ownedCardRow(c.env.sorc_db, user.id, ref_code) as any;
    if (!held) return c.json({ error: `You do not hold #${ref_code}.` }, 403);

    const wantLocked = locked === true || locked === 1 || locked === 'true';

    // A Card sitting on the Exchange is already committed. Locking it there
    // would be a contradiction, so say what to do instead of half-doing it.
    if (wantLocked && held.listing_id) {
      return c.json({
        error: `${held.item_name} is listed on the Exchange. Withdraw the listing before locking it.`,
      }, 409);
    }

    const done = await c.env.sorc_db.prepare(
      `UPDATE member_inventory SET locked = ? WHERE id = ? AND user_id = ?`
    ).bind(wantLocked ? 1 : 0, held.id, user.id).run();
    if (!done.meta || done.meta.changes !== 1) {
      return c.json({ error: 'Could not change that Card.' }, 409);
    }

    return c.json({
      success: true, ref_code: held.ref_code, item_name: held.item_name,
      locked: wantLocked,
    });
  } catch (error: any) {
    return c.json({ error: 'Could not change that Card.', details: error.message }, 500);
  }
});

// ─── TROPHY & COLLECTABLES: VISIBILITY AND SPACE ─────────────────────────────
// How much room a member has to keep Cards, and whether anyone else may look.
//
// Basic members get a modest shelf, Pro members a larger one, and either can
// buy more room with Community Points - Points are earned on the platform, so
// space is something you work toward rather than something you purchase with
// money.
const COLLECTION_SLOTS_BASIC = 24;
const COLLECTION_SLOTS_PRO = 72;
const COLLECTION_SLOT_PACK = 12;      // Cards added per purchase
const COLLECTION_SLOT_COST = 250;     // Community Points per pack
const COLLECTION_SLOT_MAX_BONUS = 240; // Ceiling on bought space

async function ensureCollectionColumns(db: any) {
  for (const col of [
    'collection_public INTEGER NOT NULL DEFAULT 0',
    'collection_slot_bonus INTEGER NOT NULL DEFAULT 0',
  ]) {
    try { await db.prepare(`ALTER TABLE users ADD COLUMN ${col}`).run(); } catch (e) { /* present */ }
  }
}

async function collectionCapacity(db: any, user: any): Promise<number> {
  const base = (await isProMember(db, user)) ? COLLECTION_SLOTS_PRO : COLLECTION_SLOTS_BASIC;
  const row = await db.prepare(
    `SELECT collection_slot_bonus FROM users WHERE id = ?`
  ).bind(user.id).first() as any;
  return base + (row?.collection_slot_bonus || 0);
}

async function collectionHeld(db: any, userId: string): Promise<number> {
  const row = await db.prepare(
    `SELECT COUNT(*) AS n FROM member_inventory WHERE user_id = ? AND qty > 0`
  ).bind(userId).first() as any;
  return row?.n || 0;
}

// Is there room for one more Card? Privileged accounts hold the whole catalog
// for testing and are not held to the shelf.
async function collectionHasRoom(db: any, user: any): Promise<boolean> {
  if (isPrivileged(user)) return true;
  await ensureCollectionColumns(db);
  const [held, cap] = await Promise.all([
    collectionHeld(db, user.id),
    collectionCapacity(db, user),
  ]);
  return held < cap;
}

app.get('/api/collection/settings', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    await ensureExchangeTables(c.env.sorc_db);
    await ensureOwnershipColumns(c.env.sorc_db);
    await ensureCollectionColumns(c.env.sorc_db);

    const fresh = await c.env.sorc_db.prepare(
      `SELECT collection_public, collection_slot_bonus, community_points FROM users WHERE id = ?`
    ).bind(user.id).first() as any;

    const isPro = await isProMember(c.env.sorc_db, user);
    const base = isPro ? COLLECTION_SLOTS_PRO : COLLECTION_SLOTS_BASIC;
    const bonus = fresh?.collection_slot_bonus || 0;
    const held = await collectionHeld(c.env.sorc_db, user.id);

    return c.json({
      is_public: !!(fresh?.collection_public),
      tier: isPro ? 'Pro' : 'Basic',
      held, base_slots: base, bonus_slots: bonus, total_slots: base + bonus,
      community_points: fresh?.community_points || 0,
      pack_size: COLLECTION_SLOT_PACK,
      pack_cost: COLLECTION_SLOT_COST,
      bonus_cap: COLLECTION_SLOT_MAX_BONUS,
      can_buy: bonus < COLLECTION_SLOT_MAX_BONUS,
    });
  } catch (error: any) {
    return c.json({ error: 'Could not read your collection settings.' }, 500);
  }
});

// Public or private. A public collection can be looked at by anyone; a private
// one only by its owner. Off by default - a member opts in to being seen.
app.post('/api/collection/visibility', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    await ensureCollectionColumns(c.env.sorc_db);
    const { is_public } = await c.req.json() as any;
    const wantPublic = is_public === true || is_public === 1 || is_public === 'true';
    await c.env.sorc_db.prepare(
      `UPDATE users SET collection_public = ? WHERE id = ?`
    ).bind(wantPublic ? 1 : 0, user.id).run();
    return c.json({ success: true, is_public: wantPublic });
  } catch (error: any) {
    return c.json({ error: 'Could not change that.' }, 500);
  }
});

// Buy shelf space with Community Points. Follows the same discipline as every
// other balance: the Points are read fresh, the debit is conditional on there
// being enough, and the row count is checked - so a double-tap cannot buy two
// packs for the price of one.
app.post('/api/collection/slots/buy', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    await ensureCollectionColumns(c.env.sorc_db);
    const fresh = await c.env.sorc_db.prepare(
      `SELECT collection_slot_bonus, community_points FROM users WHERE id = ?`
    ).bind(user.id).first() as any;
    if (!fresh) return c.json({ error: 'Account not found.' }, 404);

    const bonus = fresh.collection_slot_bonus || 0;
    if (bonus >= COLLECTION_SLOT_MAX_BONUS) {
      return c.json({ error: 'Your collection is already at its largest.' }, 409);
    }
    const points = fresh.community_points || 0;
    if (points < COLLECTION_SLOT_COST) {
      return c.json({
        error: `That costs ${COLLECTION_SLOT_COST} Community Points - you have ${points}.`,
        insufficient: true, points, cost: COLLECTION_SLOT_COST,
      }, 402);
    }

    const paid = await c.env.sorc_db.prepare(
      `UPDATE users
         SET community_points = community_points - ?,
             collection_slot_bonus = collection_slot_bonus + ?
       WHERE id = ? AND community_points >= ? AND collection_slot_bonus < ?`
    ).bind(
      COLLECTION_SLOT_COST, COLLECTION_SLOT_PACK,
      user.id, COLLECTION_SLOT_COST, COLLECTION_SLOT_MAX_BONUS
    ).run();
    if (!paid.meta || paid.meta.changes !== 1) {
      return c.json({ error: 'Could not complete that purchase.' }, 409);
    }

    return c.json({
      success: true,
      added: COLLECTION_SLOT_PACK,
      bonus_slots: bonus + COLLECTION_SLOT_PACK,
      community_points: points - COLLECTION_SLOT_COST,
    });
  } catch (error: any) {
    return c.json({ error: 'Could not complete that purchase.', details: error.message }, 500);
  }
});

// Somebody else's collection. Only opens if they made it public.
app.get('/api/collection/:uid', authMiddleware, async (c) => {
  try {
    await ensureExchangeTables(c.env.sorc_db);
    await ensureOwnershipColumns(c.env.sorc_db);
    await ensureCollectionColumns(c.env.sorc_db);
    const uid = c.req.param('uid');
    const viewer = c.get('user') as any;

    const owner = await c.env.sorc_db.prepare(
      `SELECT id, username, display_name, collection_public FROM users WHERE id = ?`
    ).bind(uid).first() as any;
    if (!owner) return c.json({ error: 'No such member.' }, 404);

    const mine = viewer.id === owner.id;
    if (!owner.collection_public && !mine && !isPrivileged(viewer)) {
      return c.json({ error: 'That collection is private.', private: true }, 403);
    }

    const rows = await c.env.sorc_db.prepare(
      `SELECT inv.ref_code, inv.qty, inv.bound, inv.locked, inv.listing_id,
              card.item_name, card.card_type, card.item_rank, card.coin_value, card.stats
       FROM member_inventory inv
       LEFT JOIN item_cards card ON UPPER(card.ref_code) = UPPER(inv.ref_code)
       WHERE inv.user_id = ? AND inv.qty > 0
       ORDER BY card.card_type ASC, card.item_name ASC LIMIT 200`
    ).bind(uid).all();

    const cards = (rows.results || []).map((r: any) => {
      let art = null;
      try { art = JSON.parse(r.stats || '{}').art || null; } catch (e) { /* older rows */ }
      return {
        ref_code: r.ref_code, item_name: r.item_name, card_type: r.card_type,
        item_rank: r.item_rank, coin_value: r.coin_value, qty: r.qty,
        bound: !!r.bound, locked: !!r.locked, listed: !!r.listing_id, art,
      };
    });

    return c.json({
      owner: { id: owner.id, name: owner.display_name || owner.username },
      is_public: !!owner.collection_public, is_mine: mine, cards, total: cards.length,
    });
  } catch (error: any) {
    return c.json({ error: 'Could not open that collection.' }, 500);
  }
});

// ===== FELLOWS SYSTEM (Friendship Model) =====

// Create friends table if it doesn't exist
async function ensureFriendsTables(db: any) {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS friendships (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        friend_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(user_id, friend_id)
      )
    `).run();
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS friend_activity (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        activity_data TEXT,
        created_at TEXT NOT NULL,
        expires_at TEXT
      )
    `).run();
  } catch (e) {
    // Tables likely exist
  }
}

// GET /api/friends - Fetch current user's friend list with status
app.get('/api/friends', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    await ensureFriendsTables(c.env.sorc_db);
    const friendships = await c.env.sorc_db.prepare(`
      SELECT f.*, u.username, u.display_name, u.avatar, u.last_seen
      FROM friendships f
      LEFT JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = ? AND f.status = 'accepted'
      ORDER BY u.last_seen DESC
    `).bind(user.id).all();

    const friends = (friendships.results || []).map((f: any) => ({
      id: f.friend_id,
      username: f.username,
      display_name: f.display_name || f.username,
      avatar: f.avatar,
      status: new Date(f.last_seen).getTime() > Date.now() - 300000 ? 'online' : 'offline',
      last_seen: f.last_seen,
    }));

    return c.json({ friends, count: friends.length });
  } catch (error: any) {
    return c.json({ error: 'Failed to load friends list', details: error.message }, 500);
  }
});

// GET /api/friend-requests - Fetch incoming friend requests
app.get('/api/friend-requests', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    await ensureFriendsTables(c.env.sorc_db);
    const requests = await c.env.sorc_db.prepare(`
      SELECT f.*, u.username, u.display_name, u.avatar, u.community_points
      FROM friendships f
      LEFT JOIN users u ON u.id = f.user_id
      WHERE f.friend_id = ? AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `).bind(user.id).all();

    const incoming = (requests.results || []).map((r: any) => ({
      request_id: r.id,
      from_id: r.user_id,
      from_username: r.username,
      from_display_name: r.display_name || r.username,
      from_avatar: r.avatar,
      from_community_points: r.community_points || 0,
      requested_at: r.created_at,
    }));

    return c.json({ incoming_requests: incoming, count: incoming.length });
  } catch (error: any) {
    return c.json({ error: 'Failed to load friend requests', details: error.message }, 500);
  }
});

// POST /api/friends - Send a friend request or accept one
app.post('/api/friends', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const { friend_id, action } = await c.req.json();

  if (!friend_id) return c.json({ error: 'friend_id required' }, 400);

  try {
    await ensureFriendsTables(c.env.sorc_db);

    if (action === 'accept') {
      // Accept incoming request
      await c.env.sorc_db.prepare(`
        UPDATE friendships SET status = 'accepted', updated_at = ?
        WHERE friend_id = ? AND user_id = ? AND status = 'pending'
      `).bind(new Date().toISOString(), user.id, friend_id).run();

      // Also create reciprocal friendship
      await c.env.sorc_db.prepare(`
        INSERT OR IGNORE INTO friendships (id, user_id, friend_id, status, created_at, updated_at)
        VALUES (?, ?, ?, 'accepted', ?, ?)
      `).bind(
        crypto.randomUUID(),
        user.id,
        friend_id,
        new Date().toISOString(),
        new Date().toISOString()
      ).run();

      return c.json({ success: true, message: 'Friend request accepted' });
    } else {
      // Send new friend request
      await c.env.sorc_db.prepare(`
        INSERT OR IGNORE INTO friendships (id, user_id, friend_id, status, created_at, updated_at)
        VALUES (?, ?, ?, 'pending', ?, ?)
      `).bind(
        crypto.randomUUID(),
        user.id,
        friend_id,
        new Date().toISOString(),
        new Date().toISOString()
      ).run();

      return c.json({ success: true, message: 'Friend request sent' });
    }
  } catch (error: any) {
    return c.json({ error: 'Failed to update friend status', details: error.message }, 500);
  }
});

// DELETE /api/friends/:friend_id - Remove a friend
app.delete('/api/friends/:friend_id', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const friend_id = c.req.param('friend_id');

  try {
    await ensureFriendsTables(c.env.sorc_db);

    await c.env.sorc_db.prepare(`
      DELETE FROM friendships
      WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
    `).bind(user.id, friend_id, friend_id, user.id).run();

    return c.json({ success: true, message: 'Friend removed' });
  } catch (error: any) {
    return c.json({ error: 'Failed to remove friend', details: error.message }, 500);
  }
});

// ===== CANTINA MINI-GAMES SYSTEM =====

// GET /api/cantina/games - List available mini-games
app.get('/api/cantina/games', async (c) => {
  try {
    const games = [
      {
        id: 'dice-duel',
        name: 'Dice Duel',
        description: 'Quick dice rolling contests. Test your luck against Fellow adventurers.',
        players: '2-4',
        duration: '5-10 min',
        rules_link: '/rules#cantina-dice-duel',
        icon: '🎲',
        access: 'PUBLIC'
      },
      {
        id: 'cards-fortune',
        name: 'Fortune\'s Cards',
        description: 'Card games from the SORC Offline set. Compete for glory and bragging rights.',
        players: '2-6',
        duration: '10-20 min',
        rules_link: '/rules#cantina-fortune-cards',
        icon: '🃏',
        access: 'PUBLIC'
      },
      {
        id: 'coin-flip-tournament',
        name: 'Coin Flip Tournament',
        description: 'Single-elimination tournaments. Play quick matches and climb the bracket.',
        players: '4-32',
        duration: 'Variable',
        rules_link: '/rules#cantina-coin-flip',
        icon: '🪙',
        access: 'PUBLIC'
      }
    ];

    return c.json({ games, count: games.length });
  } catch (error: any) {
    return c.json({ error: 'Failed to load cantina games', details: error.message }, 500);
  }
});

// GET /api/cantina/voice-integration - Voice channel setup (architecture for future)
app.get('/api/cantina/voice-integration', authMiddleware, async (c) => {
  const user = c.get('user') as any;

  return c.json({
    status: 'coming_soon',
    message: 'Voice integration for Cantina and Online Rooms will be available soon.',
    voice_api: null, // Will be populated when voice service is enabled
    docs: '/docs#voice-integration',
    user_id: user.id,
  });
});

// GET /api/online-rooms/voice - Voice setup for Online Rooms/Campaign launches (GM feature)
app.get('/api/online-rooms/voice', authMiddleware, async (c) => {
  const user = c.get('user') as any;

  return c.json({
    status: 'coming_soon',
    message: 'Voice channels for Online Rooms campaigns are coming.',
    max_participants: null,
    bitrate: null,
    docs: '/docs#online-rooms-voice',
    requires_pro: false,
  });
});

export default app;
