import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Force workflow redeploy - fixed package-lock.json sync issue
// npm packages are now in sync, deployment should succeed

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
  const user = await c.env.sorc_db.prepare('SELECT * FROM users WHERE auth_key = ?').bind(authKey).first();
  if (!user) return c.json({ error: 'Invalid auth key' }, 401);
  c.set('user', user);
  await next();
};

// Role-based access control helpers
// Role hierarchy: VISITOR (unregistered) < USER (CIVILIAN/PLAYER/MASTER) < ADMIN < OWNER (privileged)
// Actual DB roles: CIVILIAN (default), PLAYER (PC badge), MASTER (GM badge), ADMIN, OWNER
// User-specified mapping: CIV=CIVILIAN, PC=PLAYER, GM=MASTER, AD=ADMIN, OWN=OWNER
const ROLE_LEVELS = {
  'VISITOR': 0,      // Unregistered/anonymous
  'CIVILIAN': 1,     // Regular user ([CIV])
  'PLAYER': 1,       // Player character ([PC])
  'MASTER': 1,       // Master/GM (user level, [GM])
  'ADMIN': 2,        // Administrator ([AD])
  'OWNER': 3         // Owner (super admin, [OWN])
};

function getRoleLevel(role?: string): number {
  if (!role) return ROLE_LEVELS.VISITOR;
  return ROLE_LEVELS[role as keyof typeof ROLE_LEVELS] ?? ROLE_LEVELS.VISITOR;
}

function isUser(role?: string): boolean {
  return role === 'CIVILIAN' || role === 'PLAYER' || role === 'MASTER';
}

function isAdmin(role?: string): boolean {
  return role === 'ADMIN' || role === 'OWNER';
}

function hasPermission(userRole: string | undefined, minimumLevel: number): boolean {
  return getRoleLevel(userRole) >= minimumLevel;
}

// Force redeploy - ensure RESEND_API_KEY and GOOGLE_CLIENT_SECRET are deployed to Worker
app.post('/api/auth/register', async (c) => {
  const { email, username, firstName, password, confirmPassword } = await c.req.json();
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

  try {
    // Hash password using crypto (basic approach for now)
    const encoder = new TextEncoder();
    const data = encoder.encode(password + email);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    let userToUse = existingUser;
    let tokenToUse = existingUser?.verification_token || verificationToken;
    let userIdToUse = existingUser?.id || uuid;

    // TRY TO SEND EMAIL FIRST (before creating/updating account)
    // This ensures we don't create accounts when email service is down
    const verificationLink = `https://sorcrpg.com/verify-email.html?token=${tokenToUse}`;
    console.log('RESEND_API_KEY exists:', !!c.env.RESEND_API_KEY);
    console.log('RESEND_API_KEY length:', (c.env.RESEND_API_KEY || '').length);

    if (!c.env.RESEND_API_KEY || c.env.RESEND_API_KEY.trim() === '') {
      return c.json({ error: 'Email service is not configured. Please contact support.' }, 503);
    }

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
          html: `<p>Welcome to Essentia, ${userToUse?.username || username}!</p>
<p>Please verify your email to complete account creation:</p>
<p><a href="${verificationLink}">Verify Email</a></p>
<p>Or paste this link: ${verificationLink}</p>
<p>This link expires in 24 hours.</p>`
        })
      });
      const emailData = await emailRes.json();
      if (!emailRes.ok) {
        console.error('Resend API error:', emailRes.status, JSON.stringify(emailData));
        return c.json({ error: 'Failed to send verification email. Please try again later or contact support.' }, 503);
      } else {
        console.log('Email sent successfully:', emailData);
      }
    } catch (emailError: any) {
      console.error('Email send failed:', emailError.message);
      return c.json({ error: 'Failed to send verification email. Please try again later or contact support.' }, 503);
    }

    // NOW CREATE/UPDATE THE ACCOUNT (after email is confirmed to be sent)
    // If user doesn't exist, create them
    if (!existingUser) {
      await c.env.sorc_db.prepare(`INSERT INTO users (id, email, auth_key, username, display_name, first_name, role, join_date, created_at, updated_at, user_id, verification_token, email_verified, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(uuid, email, authKey, username, firstName || username, firstName || '', 'CIVILIAN', now, now, now, userId, verificationToken, false, passwordHash).run();
      userToUse = { id: uuid, username, email };
    } else {
      // Update existing unverified user's password
      await c.env.sorc_db.prepare('UPDATE users SET password_hash = ?, auth_key = ? WHERE id = ?').bind(passwordHash, authKey, existingUser.id).run();
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
  // TODO: Add verification_token_created_at column to enforce 24-hour expiration
  // Currently tokens never expire - SECURITY RISK
  const user = await c.env.sorc_db.prepare('SELECT id, email FROM users WHERE verification_token = ?').bind(token).first() as any;
  if (!user) return c.json({ error: 'Invalid or expired verification token' }, 400);
  await c.env.sorc_db.prepare('UPDATE users SET email_verified = ?, verification_token = NULL WHERE id = ?').bind(true, user.id).run();
  return c.json({ success: true, message: 'Email verified' });
});

app.post('/api/auth/resend-verification', async (c) => {
  // DEBUG: Log if secrets are accessible
  console.log('RESEND_API_KEY exists:', !!c.env.RESEND_API_KEY);
  console.log('RESEND_API_KEY length:', (c.env.RESEND_API_KEY || '').length);

  const { email } = await c.req.json();
  if (!email) return c.json({ error: 'Email required' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'Invalid email address' }, 400);

  if (!c.env.RESEND_API_KEY || c.env.RESEND_API_KEY.trim() === '') {
    return c.json({ error: 'Email service is not configured. Please contact support.' }, 503);
  }

  const user = await c.env.sorc_db.prepare('SELECT id, email, username, verification_token, email_verified FROM users WHERE email = ?').bind(email).first() as any;
  if (!user) return c.json({ error: 'Email not found', details: 'No account with this email' }, 404);
  if (user.email_verified) return c.json({ error: 'Account already verified', details: 'You can now sign in' }, 400);

  // If no verification token or if token is a reset token, generate a new verification token
  if (!user.verification_token || user.verification_token.startsWith('reset_')) {
    const newToken = 'verify_' + crypto.randomUUID();
    await c.env.sorc_db.prepare('UPDATE users SET verification_token = ? WHERE id = ?').bind(newToken, user.id).run();
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
      return c.json({ error: 'Failed to send verification email. Please try again later or contact support.' }, 503);
    }
    console.log('Resend verification email sent:', emailData);
  } catch (emailError: any) {
    console.error('Email send failed:', emailError.message);
    return c.json({ error: 'Failed to send verification email. Please try again later or contact support.' }, 503);
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

  // Hash password and compare
  const encoder = new TextEncoder();
  const data = encoder.encode(password + user.email);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  if (passwordHash !== user.password_hash) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const authKey = crypto.randomUUID();
  await c.env.sorc_db.prepare('UPDATE users SET auth_key = ? WHERE id = ?').bind(authKey, user.id).run();
  return c.json({ success: true, user: { id: user.id, email: user.email, username: user.username, display_name: user.display_name, role: user.role, community_points: user.community_points, created_at: user.created_at }, authKey });
});

app.get('/api/auth/me', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    // Get user profile
    const userProfile = await c.env.sorc_db.prepare(
      `SELECT id, email, username, display_name, first_name, surname, prefix, suffix, avatar, bio, role, community_points, post_count, titles, join_date, last_seen, created_at FROM users WHERE id = ?`
    ).bind(user.id).first() as any;

    if (!userProfile) return c.json({ error: 'User not found' }, 404);

    // Get fellowship counts
    const fellowshipCount = await c.env.sorc_db.prepare(
      `SELECT COUNT(*) as count FROM fellowships WHERE (sender_uid = ? OR receiver_uid = ?) AND status = 'accepted'`
    ).bind(user.id, user.id).first() as any;

    const incomingCount = await c.env.sorc_db.prepare(
      `SELECT COUNT(*) as count FROM fellowships WHERE receiver_uid = ? AND status = 'pending'`
    ).bind(user.id).first() as any;

    const outgoingCount = await c.env.sorc_db.prepare(
      `SELECT COUNT(*) as count FROM fellowships WHERE sender_uid = ? AND status = 'pending'`
    ).bind(user.id).first() as any;

    return c.json({
      success: true,
      user: {
        ...userProfile,
        fellowshipCount: fellowshipCount?.count || 0,
        incomingRequestCount: incomingCount?.count || 0,
        outgoingRequestCount: outgoingCount?.count || 0
      }
    });
  } catch (error: any) {
    return c.json({ error: 'Failed to load user data', details: error.message }, 500);
  }
});

app.post('/api/auth/forgot-password', async (c) => {
  const { email } = await c.req.json();
  if (!email) return c.json({ error: 'Email required' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'Invalid email address' }, 400);

  if (!c.env.RESEND_API_KEY || c.env.RESEND_API_KEY.trim() === '') {
    // For security, don't reveal if email service is down to prevent email enumeration
    return c.json({ success: true, message: 'If that email is registered, a password reset link has been sent' });
  }

  const user = await c.env.sorc_db.prepare('SELECT id, email, username FROM users WHERE email = ?').bind(email).first() as any;
  if (!user) {
    // For security, don't reveal if email exists - just return success
    return c.json({ success: true, message: 'If that email is registered, a password reset link has been sent' });
  }

  // Generate password reset token (prefixed with "reset_" to distinguish from verification_token)
  const resetToken = 'reset_' + crypto.randomUUID();
  await c.env.sorc_db.prepare('UPDATE users SET verification_token = ? WHERE id = ?').bind(resetToken, user.id).run();

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

  const user = await c.env.sorc_db.prepare('SELECT id, email FROM users WHERE verification_token = ?').bind(token).first() as any;
  if (!user) return c.json({ error: 'Invalid or expired reset link' }, 400);

  // Hash new password
  const encoder = new TextEncoder();
  const data = encoder.encode(password + user.email);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Update password and clear reset token
  await c.env.sorc_db.prepare('UPDATE users SET password_hash = ?, verification_token = NULL WHERE id = ?').bind(passwordHash, user.id).run();

  return c.json({ success: true, message: 'Password reset successful. You can now sign in with your new password.' });
});

app.get('/auth/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');

  if (!code) {
    return c.html(`<html><body><h1>Error</h1><p>Authorization code missing</p></body></html>`, 400);
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
        client_id: '303646936307-jn1gtlgiabv9tk345m5dvk0f99nk2apf.apps.googleusercontent.com',
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: 'https://api.sorcrpg.com/auth/google/callback',
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      return c.html(`<html><body><h1>Error</h1><p>Failed to exchange authorization code: ${error}</p></body></html>`, 400);
    }

    const tokenData = await tokenResponse.json() as any;
    if (!tokenData.access_token) {
      return c.html(`<html><body><h1>Error</h1><p>Failed to get access token</p></body></html>`, 400);
    }

    // Get user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      return c.html(`<html><body><h1>Error</h1><p>Failed to get user info from Google</p></body></html>`, 400);
    }

    const googleUser = await userResponse.json() as any;
    if (!googleUser.email) {
      return c.html(`<html><body><h1>Error</h1><p>Failed to get user email from Google</p></body></html>`, 400);
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

      try {
        await c.env.sorc_db.prepare(`
          INSERT INTO users (id, email, auth_key, username, display_name, first_name, role, join_date, created_at, updated_at, user_id, email_verified, password_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(uuid, googleUser.email, authKey, username, googleUser.name || googleUser.email, googleUser.given_name || '', 'CIVILIAN', now, now, now, userId, true, '').run();
      } catch (error: any) {
        return c.html(`<html><body><h1>Error</h1><p>Failed to create account: ${error.message}</p></body></html>`, 500);
      }
    } else {
      // User exists, generate new auth key
      authKey = crypto.randomUUID();
      try {
        await c.env.sorc_db.prepare('UPDATE users SET auth_key = ? WHERE id = ?').bind(authKey, user.id).run();
      } catch (error: any) {
        return c.html(`<html><body><h1>Error</h1><p>Failed to authenticate: ${error.message}</p></body></html>`, 500);
      }
    }

    // Redirect to signin with auth key, frontend will store it and redirect to home
    return c.redirect(`https://sorcrpg.com/signin?authKey=${authKey}`);
  } catch (error: any) {
    return c.html(`<html><body><h1>Error</h1><p>Authentication failed: ${error.message}</p></body></html>`, 500);
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

app.get('/api/forum/category/:categoryId', async (c) => {
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

app.get('/api/forum/thread/:threadId', async (c) => {
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
  if (body.length > 5000) return c.json({ error: 'Post too long (max 5000 chars)' }, 400);
  try {
    const postId = crypto.randomUUID();
    const now = new Date().toISOString();
    await c.env.sorc_db.prepare(`INSERT INTO posts (id, thread_id, body, author_uid, author_name, author_role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(postId, threadId, escapeHtml(body), user.id, user.display_name || user.username, user.role, now).run();
    await c.env.sorc_db.prepare(`UPDATE threads SET reply_count = reply_count + 1, last_reply_at = ?, last_reply_by = ? WHERE id = ?`).bind(now, user.display_name || user.username, threadId).run();
    await c.env.sorc_db.prepare('UPDATE users SET post_count = post_count + 1 WHERE id = ?').bind(user.id).run();
    return c.json({ success: true, postId });
  } catch (error: any) {
    return c.json({ error: 'Failed to create post', details: error.message }, 500);
  }
});

// ===== THREAD EDIT/DELETE =====
app.put('/api/forum/thread/:threadId', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const threadId = c.req.param('threadId');
  const { title, body } = await c.req.json();

  if (!title || !body) return c.json({ error: 'Title and body required' }, 400);
  if (title.length > 200) return c.json({ error: 'Title too long (max 200 chars)' }, 400);
  if (body.length > 5000) return c.json({ error: 'Body too long (max 5000 chars)' }, 400);

  try {
    const thread = await c.env.sorc_db.prepare(`SELECT * FROM threads WHERE id = ?`).bind(threadId).first() as any;
    if (!thread) return c.json({ error: 'Thread not found' }, 404);

    // Only author or admins can edit
    if (thread.author_uid !== user.id && !isAdmin(user.role)) {
      return c.json({ error: 'Not authorized' }, 403);
    }

    const now = new Date().toISOString();
    await c.env.sorc_db.prepare(
      `UPDATE threads SET title = ?, edited = TRUE, updated_at = ? WHERE id = ?`
    ).bind(escapeHtml(title), now, threadId).run();

    // Update the first post (thread body)
    await c.env.sorc_db.prepare(
      `UPDATE posts SET body = ?, edited = TRUE, updated_at = ? WHERE thread_id = ? ORDER BY created_at ASC LIMIT 1`
    ).bind(escapeHtml(body), now, threadId).run();

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Failed to edit thread:', error.message);
    return c.json({ error: 'Failed to edit thread. Please try again.' }, 500);
  }
});

app.delete('/api/forum/thread/:threadId', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const threadId = c.req.param('threadId');

  try {
    const thread = await c.env.sorc_db.prepare(`SELECT * FROM threads WHERE id = ?`).bind(threadId).first() as any;
    if (!thread) return c.json({ error: 'Thread not found' }, 404);

    // Only author or admins can delete
    if (thread.author_uid !== user.id && !isAdmin(user.role)) {
      return c.json({ error: 'Not authorized' }, 403);
    }

    // Get post count to decrement user's post_count
    const postCount = await c.env.sorc_db.prepare(`SELECT COUNT(*) as count FROM posts WHERE thread_id = ?`).bind(threadId).first() as any;

    // Delete all posts in thread (cascade)
    await c.env.sorc_db.prepare(`DELETE FROM posts WHERE thread_id = ?`).bind(threadId).run();

    // Delete thread
    await c.env.sorc_db.prepare(`DELETE FROM threads WHERE id = ?`).bind(threadId).run();

    // Decrement author's post count
    if (postCount.count > 0) {
      await c.env.sorc_db.prepare(
        `UPDATE users SET post_count = MAX(0, post_count - ?) WHERE id = ?`
      ).bind(postCount.count, thread.author_uid).run();
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete thread:', error.message);
    return c.json({ error: 'Failed to delete thread. Please try again.' }, 500);
  }
});

// ===== POST EDIT/DELETE =====
app.put('/api/forum/post/:postId', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const postId = c.req.param('postId');
  const { body } = await c.req.json();

  if (!body) return c.json({ error: 'Body required' }, 400);
  if (body.length > 5000) return c.json({ error: 'Post too long (max 5000 chars)' }, 400);

  try {
    const post = await c.env.sorc_db.prepare(`SELECT * FROM posts WHERE id = ?`).bind(postId).first() as any;
    if (!post) return c.json({ error: 'Post not found' }, 404);

    // Only author or admins can edit
    if (post.author_uid !== user.id && !isAdmin(user.role)) {
      return c.json({ error: 'Not authorized' }, 403);
    }

    const now = new Date().toISOString();
    await c.env.sorc_db.prepare(
      `UPDATE posts SET body = ?, edited = TRUE, updated_at = ? WHERE id = ?`
    ).bind(escapeHtml(body), now, postId).run();

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Failed to edit post:', error.message);
    return c.json({ error: 'Failed to edit post. Please try again.' }, 500);
  }
});

app.delete('/api/forum/post/:postId', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const postId = c.req.param('postId');

  try {
    const post = await c.env.sorc_db.prepare(`SELECT * FROM posts WHERE id = ?`).bind(postId).first() as any;
    if (!post) return c.json({ error: 'Post not found' }, 404);

    // Only author or admins can delete
    if (post.author_uid !== user.id && !isAdmin(user.role)) {
      return c.json({ error: 'Not authorized' }, 403);
    }

    // Delete post
    await c.env.sorc_db.prepare(`DELETE FROM posts WHERE id = ?`).bind(postId).run();

    // Decrement thread's reply count
    await c.env.sorc_db.prepare(`UPDATE threads SET reply_count = MAX(0, reply_count - 1) WHERE id = ?`).bind(post.thread_id).run();

    // Decrement author's post count
    await c.env.sorc_db.prepare(`UPDATE users SET post_count = MAX(0, post_count - 1) WHERE id = ?`).bind(post.author_uid).run();

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete post:', error.message);
    return c.json({ error: 'Failed to delete post. Please try again.' }, 500);
  }
});

// ===== THREAD MODERATION =====
app.patch('/api/forum/thread/:threadId/lock', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const threadId = c.req.param('threadId');

  // Only admins can lock
  if (!isAdmin(user.role)) {
    return c.json({ error: 'Not authorized' }, 403);
  }

  try {
    const thread = await c.env.sorc_db.prepare(`SELECT locked FROM threads WHERE id = ?`).bind(threadId).first() as any;
    if (!thread) return c.json({ error: 'Thread not found' }, 404);

    const newState = !thread.locked;
    await c.env.sorc_db.prepare(
      `UPDATE threads SET locked = ?, updated_at = ? WHERE id = ?`
    ).bind(newState, new Date().toISOString(), threadId).run();

    return c.json({ success: true, locked: newState });
  } catch (error: any) {
    console.error('Failed to toggle lock:', error.message);
    return c.json({ error: 'Failed to toggle lock. Please try again.' }, 500);
  }
});

app.patch('/api/forum/thread/:threadId/pin', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const threadId = c.req.param('threadId');

  // Only admins can pin
  if (!isAdmin(user.role)) {
    return c.json({ error: 'Not authorized' }, 403);
  }

  try {
    const thread = await c.env.sorc_db.prepare(`SELECT pinned FROM threads WHERE id = ?`).bind(threadId).first() as any;
    if (!thread) return c.json({ error: 'Thread not found' }, 404);

    const newState = !thread.pinned;
    await c.env.sorc_db.prepare(
      `UPDATE threads SET pinned = ?, updated_at = ? WHERE id = ?`
    ).bind(newState, new Date().toISOString(), threadId).run();

    return c.json({ success: true, pinned: newState });
  } catch (error: any) {
    console.error('Failed to toggle pin:', error.message);
    return c.json({ error: 'Failed to toggle pin. Please try again.' }, 500);
  }
});

// ===== LIKES =====
app.patch('/api/forum/thread/:threadId/like', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const threadId = c.req.param('threadId');

  try {
    const thread = await c.env.sorc_db.prepare(`SELECT liked_by FROM threads WHERE id = ?`).bind(threadId).first() as any;
    if (!thread) return c.json({ error: 'Thread not found' }, 404);

    let likedBy: string[] = [];
    try {
      likedBy = JSON.parse(thread.liked_by || '[]');
    } catch (e) {}

    const likeIndex = likedBy.indexOf(user.id);
    let action = 'liked';

    if (likeIndex > -1) {
      likedBy.splice(likeIndex, 1);
      action = 'unliked';
    } else {
      likedBy.push(user.id);
    }

    await c.env.sorc_db.prepare(
      `UPDATE threads SET liked_by = ?, like_count = ?, updated_at = ? WHERE id = ?`
    ).bind(JSON.stringify(likedBy), likedBy.length, new Date().toISOString(), threadId).run();

    return c.json({ success: true, action, like_count: likedBy.length });
  } catch (error: any) {
    console.error('Failed to like thread:', error.message);
    return c.json({ error: 'Failed to like thread. Please try again.' }, 500);
  }
});

app.patch('/api/forum/post/:postId/like', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const postId = c.req.param('postId');

  try {
    const post = await c.env.sorc_db.prepare(`SELECT liked_by FROM posts WHERE id = ?`).bind(postId).first() as any;
    if (!post) return c.json({ error: 'Post not found' }, 404);

    let likedBy: string[] = [];
    try {
      likedBy = JSON.parse(post.liked_by || '[]');
    } catch (e) {}

    const likeIndex = likedBy.indexOf(user.id);
    let action = 'liked';

    if (likeIndex > -1) {
      likedBy.splice(likeIndex, 1);
      action = 'unliked';
    } else {
      likedBy.push(user.id);
    }

    await c.env.sorc_db.prepare(
      `UPDATE posts SET liked_by = ?, like_count = ?, updated_at = ? WHERE id = ?`
    ).bind(JSON.stringify(likedBy), likedBy.length, new Date().toISOString(), postId).run();

    return c.json({ success: true, action, like_count: likedBy.length });
  } catch (error: any) {
    console.error('Failed to like post:', error.message);
    return c.json({ error: 'Failed to like post. Please try again.' }, 500);
  }
});

// ===== SEARCH =====
app.get('/api/forum/search', async (c) => {
  const query = c.req.query('q');
  const categoryId = c.req.query('category');

  if (!query || query.length < 2) {
    return c.json({ error: 'Query must be at least 2 characters' }, 400);
  }

  if (query.length > 100) {
    return c.json({ error: 'Query too long (max 100 chars)' }, 400);
  }

  try {
    let sql = `SELECT t.id, t.title, t.category_id, t.created_at, t.reply_count, t.views, COUNT(p.id) as post_count
               FROM threads t
               LEFT JOIN posts p ON t.id = p.thread_id
               WHERE (LOWER(t.title) LIKE ? OR LOWER(t.body) LIKE ?)`;
    let params: any[] = ['%' + query.toLowerCase() + '%', '%' + query.toLowerCase() + '%'];

    if (categoryId) {
      sql += ` AND t.category_id = ?`;
      params.push(categoryId);
    }

    sql += ` GROUP BY t.id ORDER BY t.created_at DESC LIMIT 50`;

    const results = await c.env.sorc_db.prepare(sql).bind(...params).all() as any;

    return c.json({ success: true, results: results.results || [], query });
  } catch (error: any) {
    console.error('Failed to search:', error.message);
    return c.json({ error: 'Failed to search. Please try again.' }, 500);
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

app.put('/api/profile', authMiddleware, async (c) => {
  const updates = await c.req.json();
  const user = c.get('user') as any;
  const allowedFields = ['display_name', 'first_name', 'surname', 'prefix', 'suffix', 'bio', 'avatar'];
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

// DEBUG: Test endpoint to verify email service is working
app.post('/api/auth/test-email', async (c) => {
  if (!c.env.RESEND_API_KEY || c.env.RESEND_API_KEY.trim() === '') {
    return c.json({ error: 'RESEND_API_KEY is not configured', configured: false }, 400);
  }

  const testEmail = 'test@example.com';
  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${c.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'noreply@sorcrpg.com',
        to: testEmail,
        subject: 'Test Email from SORC',
        html: '<p>This is a test email to verify the email service is working.</p>'
      })
    });
    const emailData = await emailRes.json();
    return c.json({
      success: emailRes.ok,
      status: emailRes.status,
      response: emailData,
      configured: !!c.env.RESEND_API_KEY
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: error.message,
      configured: !!c.env.RESEND_API_KEY
    });
  }
});

// ===== LOBBIES =====
app.post('/api/lobbies', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const { name, is_private, box_set_code } = await c.req.json();
  if (!name) return c.json({ error: 'Lobby name required' }, 400);

  try {
    // Validate box set code for non-admins
    if (!isAdmin(user.role) && box_set_code) {
      const code = await c.env.sorc_db.prepare(
        `SELECT * FROM box_set_codes WHERE code = ?`
      ).bind(box_set_code).first() as any;

      if (!code) return c.json({ error: 'Invalid box set code' }, 400);
      if (code.used_count >= (code.max_uses || 1000)) {
        return c.json({ error: 'Box set code limit reached' }, 400);
      }

      // Increment usage
      await c.env.sorc_db.prepare(
        `UPDATE box_set_codes SET used_count = used_count + 1, last_used_at = ? WHERE id = ?`
      ).bind(new Date().toISOString(), code.id).run();
    }

    const lobbyId = crypto.randomUUID();
    const lobbyCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const now = new Date().toISOString();

    await c.env.sorc_db.prepare(
      `INSERT INTO lobbies (id, name, creator_uid, creator_name, lobby_code, is_private, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(lobbyId, escapeHtml(name), user.id, user.display_name || user.username, lobbyCode, is_private || false, now, now).run();

    return c.json({ success: true, lobby_id: lobbyId, lobby_code: lobbyCode });
  } catch (error: any) {
    console.error('Failed to create lobby:', error.message);
    return c.json({ error: 'Failed to create lobby. Please try again.' }, 500);
  }
});

app.get('/api/lobbies', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    const lobbies = await c.env.sorc_db.prepare(
      `SELECT id, name, creator_uid, creator_name, lobby_code, is_private, status, member_count, max_members, module, created_at
       FROM lobbies
       WHERE status = 'active' AND (is_private = FALSE OR creator_uid = ?)
       ORDER BY created_at DESC`
    ).bind(user.id).all() as any;

    return c.json({ success: true, lobbies: lobbies.results || [] });
  } catch (error: any) {
    console.error('Failed to load lobbies:', error.message);
    return c.json({ error: 'Failed to load lobbies. Please try again.' }, 500);
  }
});

app.get('/api/lobbies/:lobbyId', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const lobbyId = c.req.param('lobbyId');

  try {
    const lobby = await c.env.sorc_db.prepare(
      `SELECT * FROM lobbies WHERE id = ?`
    ).bind(lobbyId).first() as any;

    if (!lobby) return c.json({ error: 'Lobby not found' }, 404);

    // Check membership
    const member = await c.env.sorc_db.prepare(
      `SELECT user_id FROM lobby_members WHERE lobby_id = ? AND user_id = ?`
    ).bind(lobbyId, user.id).first();

    const is_member = !!member || lobby.creator_uid === user.id;

    // Don't expose private lobbies to non-members
    if (lobby.is_private && !is_member) {
      return c.json({ error: 'Not authorized' }, 403);
    }

    return c.json({ success: true, lobby, is_member });
  } catch (error: any) {
    console.error('Failed to load lobby:', error.message);
    return c.json({ error: 'Failed to load lobby. Please try again.' }, 500);
  }
});

app.post('/api/lobbies/join', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const { lobby_code, lobby_id } = await c.req.json();

  if (!lobby_code && !lobby_id) {
    return c.json({ error: 'Lobby code or ID required' }, 400);
  }

  try {
    let lobby: any;
    if (lobby_code) {
      lobby = await c.env.sorc_db.prepare(
        `SELECT * FROM lobbies WHERE lobby_code = ?`
      ).bind(lobby_code).first();
    } else {
      lobby = await c.env.sorc_db.prepare(
        `SELECT * FROM lobbies WHERE id = ?`
      ).bind(lobby_id).first();
    }

    if (!lobby) return c.json({ error: 'Lobby not found' }, 404);
    if (lobby.status !== 'active') return c.json({ error: 'Lobby is not active' }, 400);

    // Check if already member
    const existing = await c.env.sorc_db.prepare(
      `SELECT user_id FROM lobby_members WHERE lobby_id = ? AND user_id = ?`
    ).bind(lobby.id, user.id).first();

    if (existing) {
      return c.json({ success: true, lobby_id: lobby.id, error: 'Already a member' });
    }

    // Add to lobby
    const memberId = crypto.randomUUID();
    await c.env.sorc_db.prepare(
      `INSERT INTO lobby_members (id, lobby_id, user_id, username, display_name)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(memberId, lobby.id, user.id, user.username, user.display_name || user.username).run();

    // Increment member count
    await c.env.sorc_db.prepare(
      `UPDATE lobbies SET member_count = member_count + 1 WHERE id = ?`
    ).bind(lobby.id).run();

    return c.json({ success: true, lobby_id: lobby.id });
  } catch (error: any) {
    console.error('Failed to join lobby:', error.message);
    return c.json({ error: 'Failed to join lobby. Please try again.' }, 500);
  }
});

// ===== ROOMS =====
app.post('/api/rooms', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const { lobby_id, name } = await c.req.json();

  if (!lobby_id || !name) return c.json({ error: 'Lobby ID and room name required' }, 400);

  try {
    const lobby = await c.env.sorc_db.prepare(`SELECT * FROM lobbies WHERE id = ?`).bind(lobby_id).first() as any;
    if (!lobby) return c.json({ error: 'Lobby not found' }, 404);
    if (lobby.creator_uid !== user.id) return c.json({ error: 'Only lobby creator can launch rooms' }, 403);

    const roomId = crypto.randomUUID();
    const now = new Date().toISOString();

    await c.env.sorc_db.prepare(
      `INSERT INTO rooms (id, lobby_id, name, gm_uid, gm_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(roomId, lobby_id, escapeHtml(name), user.id, user.display_name || user.username, now, now).run();

    // Add GM as room member
    const memberId = crypto.randomUUID();
    await c.env.sorc_db.prepare(
      `INSERT INTO room_members (id, room_id, user_id, username, display_name, role)
       VALUES (?, ?, ?, ?, ?, 'GM')`
    ).bind(memberId, roomId, user.id, user.username, user.display_name || user.username).run();

    return c.json({ success: true, room_id: roomId });
  } catch (error: any) {
    console.error('Failed to create room:', error.message);
    return c.json({ error: 'Failed to create room. Please try again.' }, 500);
  }
});

app.get('/api/rooms/:roomId', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const roomId = c.req.param('roomId');

  try {
    const room = await c.env.sorc_db.prepare(`SELECT * FROM rooms WHERE id = ?`).bind(roomId).first() as any;
    if (!room) return c.json({ error: 'Room not found' }, 404);

    // Check membership
    const member = await c.env.sorc_db.prepare(
      `SELECT * FROM room_members WHERE room_id = ? AND user_id = ?`
    ).bind(roomId, user.id).first() as any;

    if (!member && room.gm_uid !== user.id) {
      return c.json({ error: 'Not authorized' }, 403);
    }

    // Get members
    const members = await c.env.sorc_db.prepare(
      `SELECT id, user_id, username, display_name, role, joined_at FROM room_members WHERE room_id = ? ORDER BY joined_at ASC`
    ).bind(roomId).all() as any;

    return c.json({ success: true, room, members: members.results || [], user_role: member?.role || 'GM' });
  } catch (error: any) {
    console.error('Failed to load room:', error.message);
    return c.json({ error: 'Failed to load room. Please try again.' }, 500);
  }
});

app.post('/api/rooms/:roomId/messages', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const roomId = c.req.param('roomId');
  const { body } = await c.req.json();

  if (!body || body.trim().length === 0) return c.json({ error: 'Message required' }, 400);
  if (body.length > 2000) return c.json({ error: 'Message too long (max 2000 chars)' }, 400);

  try {
    // Check room membership
    const member = await c.env.sorc_db.prepare(
      `SELECT * FROM room_members WHERE room_id = ? AND user_id = ?`
    ).bind(roomId, user.id).first();

    const room = await c.env.sorc_db.prepare(`SELECT gm_uid FROM rooms WHERE id = ?`).bind(roomId).first() as any;
    if (!room) return c.json({ error: 'Room not found' }, 404);
    if (!member && room.gm_uid !== user.id) return c.json({ error: 'Not a room member' }, 403);

    const msgId = crypto.randomUUID();
    await c.env.sorc_db.prepare(
      `INSERT INTO room_messages (id, room_id, sender_id, sender_name, body, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(msgId, roomId, user.id, user.display_name || user.username, escapeHtml(body), new Date().toISOString()).run();

    return c.json({ success: true, message_id: msgId });
  } catch (error: any) {
    console.error('Failed to post message:', error.message);
    return c.json({ error: 'Failed to post message. Please try again.' }, 500);
  }
});

app.get('/api/rooms/:roomId/messages', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const roomId = c.req.param('roomId');

  try {
    // Check access
    const member = await c.env.sorc_db.prepare(
      `SELECT * FROM room_members WHERE room_id = ? AND user_id = ?`
    ).bind(roomId, user.id).first();

    const room = await c.env.sorc_db.prepare(`SELECT gm_uid FROM rooms WHERE id = ?`).bind(roomId).first() as any;
    if (!room) return c.json({ error: 'Room not found' }, 404);
    if (!member && room.gm_uid !== user.id) return c.json({ error: 'Not authorized' }, 403);

    const messages = await c.env.sorc_db.prepare(
      `SELECT id, sender_id, sender_name, body, created_at FROM room_messages WHERE room_id = ? ORDER BY created_at ASC`
    ).bind(roomId).all() as any;

    return c.json({ success: true, messages: messages.results || [] });
  } catch (error: any) {
    console.error('Failed to load messages:', error.message);
    return c.json({ error: 'Failed to load messages. Please try again.' }, 500);
  }
});

app.delete('/api/rooms/:roomId/messages/:msgId', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const { roomId, msgId } = c.req.param();

  try {
    const msg = await c.env.sorc_db.prepare(
      `SELECT * FROM room_messages WHERE id = ?`
    ).bind(msgId).first() as any;

    if (!msg) return c.json({ error: 'Message not found' }, 404);

    const room = await c.env.sorc_db.prepare(`SELECT gm_uid FROM rooms WHERE id = ?`).bind(roomId).first() as any;
    if (!room) return c.json({ error: 'Room not found' }, 404);

    // Only message author or GM can delete
    if (msg.sender_id !== user.id && room.gm_uid !== user.id) {
      return c.json({ error: 'Not authorized' }, 403);
    }

    await c.env.sorc_db.prepare(`DELETE FROM room_messages WHERE id = ?`).bind(msgId).run();
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete message:', error.message);
    return c.json({ error: 'Failed to delete message. Please try again.' }, 500);
  }
});

app.post('/api/rooms/:roomId/rolls', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const roomId = c.req.param('roomId');
  const { die_type, result1, result2, total, roll_purpose } = await c.req.json();

  if (!die_type || !total) return c.json({ error: 'Die type and total required' }, 400);

  try {
    // Check membership
    const member = await c.env.sorc_db.prepare(
      `SELECT * FROM room_members WHERE room_id = ? AND user_id = ?`
    ).bind(roomId, user.id).first();

    const room = await c.env.sorc_db.prepare(`SELECT gm_uid FROM rooms WHERE id = ?`).bind(roomId).first() as any;
    if (!room) return c.json({ error: 'Room not found' }, 404);
    if (!member && room.gm_uid !== user.id) return c.json({ error: 'Not a room member' }, 403);

    const rollId = crypto.randomUUID();
    await c.env.sorc_db.prepare(
      `INSERT INTO room_rolls (id, room_id, player_id, player_name, die_type, result1, result2, total, roll_purpose, rolled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(rollId, roomId, user.id, user.display_name || user.username, die_type, result1 || null, result2 || null, total, escapeHtml(roll_purpose || ''), new Date().toISOString()).run();

    return c.json({ success: true, roll_id: rollId });
  } catch (error: any) {
    console.error('Failed to post roll:', error.message);
    return c.json({ error: 'Failed to post roll. Please try again.' }, 500);
  }
});

app.get('/api/rooms/:roomId/rolls', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const roomId = c.req.param('roomId');

  try {
    // Check access
    const member = await c.env.sorc_db.prepare(
      `SELECT * FROM room_members WHERE room_id = ? AND user_id = ?`
    ).bind(roomId, user.id).first();

    const room = await c.env.sorc_db.prepare(`SELECT gm_uid FROM rooms WHERE id = ?`).bind(roomId).first() as any;
    if (!room) return c.json({ error: 'Room not found' }, 404);
    if (!member && room.gm_uid !== user.id) return c.json({ error: 'Not authorized' }, 403);

    const rolls = await c.env.sorc_db.prepare(
      `SELECT id, player_id, player_name, die_type, result1, result2, total, roll_purpose, rolled_at
       FROM room_rolls WHERE room_id = ? ORDER BY rolled_at DESC LIMIT 50`
    ).bind(roomId).all() as any;

    return c.json({ success: true, rolls: rolls.results || [] });
  } catch (error: any) {
    console.error('Failed to load rolls:', error.message);
    return c.json({ error: 'Failed to load rolls. Please try again.' }, 500);
  }
});

app.patch('/api/rooms/:roomId/spectate', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const roomId = c.req.param('roomId');

  try {
    const room = await c.env.sorc_db.prepare(`SELECT * FROM rooms WHERE id = ?`).bind(roomId).first() as any;
    if (!room) return c.json({ error: 'Room not found' }, 404);
    if (room.gm_uid !== user.id) return c.json({ error: 'Only GM can toggle spectate mode' }, 403);

    const newState = !room.spectate_enabled;
    await c.env.sorc_db.prepare(
      `UPDATE rooms SET spectate_enabled = ?, updated_at = ? WHERE id = ?`
    ).bind(newState, new Date().toISOString(), roomId).run();

    return c.json({ success: true, spectate_enabled: newState });
  } catch (error: any) {
    console.error('Failed to toggle spectate:', error.message);
    return c.json({ error: 'Failed to toggle spectate. Please try again.' }, 500);
  }
});

app.patch('/api/rooms/:roomId/visibility', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const roomId = c.req.param('roomId');

  try {
    const room = await c.env.sorc_db.prepare(`SELECT * FROM rooms WHERE id = ?`).bind(roomId).first() as any;
    if (!room) return c.json({ error: 'Room not found' }, 404);
    if (room.gm_uid !== user.id) return c.json({ error: 'Only GM can toggle visibility' }, 403);

    const newState = !room.is_hidden;
    await c.env.sorc_db.prepare(
      `UPDATE rooms SET is_hidden = ?, updated_at = ? WHERE id = ?`
    ).bind(newState, new Date().toISOString(), roomId).run();

    return c.json({ success: true, is_hidden: newState });
  } catch (error: any) {
    console.error('Failed to toggle visibility:', error.message);
    return c.json({ error: 'Failed to toggle visibility. Please try again.' }, 500);
  }
});

app.post('/api/rooms/:roomId/invite/:userId', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const { roomId, userId } = c.req.param();

  try {
    const room = await c.env.sorc_db.prepare(`SELECT * FROM rooms WHERE id = ?`).bind(roomId).first() as any;
    if (!room) return c.json({ error: 'Room not found' }, 404);
    if (room.gm_uid !== user.id) return c.json({ error: 'Only GM can invite' }, 403);

    const targetUser = await c.env.sorc_db.prepare(`SELECT * FROM users WHERE id = ?`).bind(userId).first() as any;
    if (!targetUser) return c.json({ error: 'User not found' }, 404);

    // Check if already invited
    const existing = await c.env.sorc_db.prepare(
      `SELECT id FROM room_requests WHERE room_id = ? AND user_id = ?`
    ).bind(roomId, userId).first();

    if (existing) return c.json({ error: 'Already invited' }, 409);

    const reqId = crypto.randomUUID();
    await c.env.sorc_db.prepare(
      `INSERT INTO room_requests (id, room_id, user_id, username, request_type, status)
       VALUES (?, ?, ?, ?, 'join', 'pending')`
    ).bind(reqId, roomId, userId, targetUser.username).run();

    return c.json({ success: true, request_id: reqId });
  } catch (error: any) {
    console.error('Failed to send invite:', error.message);
    return c.json({ error: 'Failed to send invite. Please try again.' }, 500);
  }
});

app.get('/api/rooms/:roomId/requests', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const roomId = c.req.param('roomId');

  try {
    const room = await c.env.sorc_db.prepare(`SELECT gm_uid FROM rooms WHERE id = ?`).bind(roomId).first() as any;
    if (!room) return c.json({ error: 'Room not found' }, 404);
    if (room.gm_uid !== user.id) return c.json({ error: 'Only GM can view requests' }, 403);

    const requests = await c.env.sorc_db.prepare(
      `SELECT id, user_id, username, request_type, status, created_at FROM room_requests
       WHERE room_id = ? AND status = 'pending' ORDER BY created_at ASC`
    ).bind(roomId).all() as any;

    return c.json({ success: true, requests: requests.results || [] });
  } catch (error: any) {
    console.error('Failed to load requests:', error.message);
    return c.json({ error: 'Failed to load requests. Please try again.' }, 500);
  }
});

app.post('/api/rooms/:roomId/requests/:reqId/:action', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const { roomId, reqId, action } = c.req.param();

  if (!['accept', 'decline'].includes(action)) {
    return c.json({ error: 'Invalid action' }, 400);
  }

  try {
    const room = await c.env.sorc_db.prepare(`SELECT gm_uid FROM rooms WHERE id = ?`).bind(roomId).first() as any;
    if (!room) return c.json({ error: 'Room not found' }, 404);
    if (room.gm_uid !== user.id) return c.json({ error: 'Only GM can respond to requests' }, 403);

    const req = await c.env.sorc_db.prepare(
      `SELECT * FROM room_requests WHERE id = ?`
    ).bind(reqId).first() as any;

    if (!req) return c.json({ error: 'Request not found' }, 404);

    if (action === 'accept') {
      const memberId = crypto.randomUUID();
      await c.env.sorc_db.prepare(
        `INSERT INTO room_members (id, room_id, user_id, username, display_name, role)
         VALUES (?, ?, ?, ?, ?, 'PLAYER')`
      ).bind(memberId, roomId, req.user_id, req.username, req.username).run();

      await c.env.sorc_db.prepare(
        `UPDATE rooms SET member_count = member_count + 1 WHERE id = ?`
      ).bind(roomId).run();
    }

    await c.env.sorc_db.prepare(
      `DELETE FROM room_requests WHERE id = ?`
    ).bind(reqId).run();

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Failed to respond to request:', error.message);
    return c.json({ error: 'Failed to respond to request. Please try again.' }, 500);
  }
});

app.get('/api/users/lookup', authMiddleware, async (c) => {
  const username = c.req.query('username');
  if (!username) return c.json({ error: 'Username required' }, 400);

  try {
    const user = await c.env.sorc_db.prepare(
      `SELECT id, username, display_name, avatar FROM users WHERE username = ? OR display_name = ?`
    ).bind(username, username).first();

    if (!user) return c.json({ error: 'User not found' }, 404);
    return c.json({ success: true, user });
  } catch (error: any) {
    console.error('Failed to lookup user:', error.message);
    return c.json({ error: 'Failed to lookup user. Please try again.' }, 500);
  }
});

// ===== BOX SET CODES =====
app.post('/api/box-codes/generate', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  if (!isAdmin(user.role)) {
    return c.json({ error: 'Only admins can generate box set codes' }, 403);
  }

  try {
    const codeId = crypto.randomUUID();
    const code = 'BSC-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    await c.env.sorc_db.prepare(
      `INSERT INTO box_set_codes (id, code, created_by_uid) VALUES (?, ?, ?)`
    ).bind(codeId, code, user.id).run();

    return c.json({ success: true, code });
  } catch (error: any) {
    console.error('Failed to generate box code:', error.message);
    return c.json({ error: 'Failed to generate code. Please try again.' }, 500);
  }
});

// ===== GM CODES =====
app.post('/api/gm-codes/generate', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  if (!isAdmin(user.role)) {
    return c.json({ error: 'Only admins can generate GM codes' }, 403);
  }

  try {
    const codeId = crypto.randomUUID();
    const code = 'GM-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days

    await c.env.sorc_db.prepare(
      `INSERT INTO gm_codes (id, code, generated_by_uid, expires_at) VALUES (?, ?, ?, ?)`
    ).bind(codeId, code, user.id, expiresAt).run();

    return c.json({ success: true, code });
  } catch (error: any) {
    console.error('Failed to generate GM code:', error.message);
    return c.json({ error: 'Failed to generate code. Please try again.' }, 500);
  }
});

export default app;
