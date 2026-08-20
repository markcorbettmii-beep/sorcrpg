import { Hono } from 'hono';
import { cors } from 'hono/cors';

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

// Trigger deployment with fixed wrangler secret put syntax
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

    // If user doesn't exist, create them
    if (!existingUser) {
      await c.env.sorc_db.prepare(`INSERT INTO users (id, email, auth_key, username, display_name, first_name, role, join_date, created_at, updated_at, user_id, verification_token, email_verified, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(uuid, email, authKey, username, firstName || username, firstName || '', 'CIVILIAN', now, now, now, userId, verificationToken, false, passwordHash).run();
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
  // TODO: Add verification_token_created_at column to enforce 24-hour expiration
  // Currently tokens never expire - SECURITY RISK
  const user = await c.env.sorc_db.prepare('SELECT id, email FROM users WHERE verification_token = ?').bind(token).first() as any;
  if (!user) return c.json({ error: 'Invalid or expired verification token' }, 400);
  await c.env.sorc_db.prepare('UPDATE users SET email_verified = ?, verification_token = NULL WHERE id = ?').bind(true, user.id).run();
  return c.json({ success: true, message: 'Email verified' });
});

app.post('/api/auth/resend-verification', async (c) => {
  const { email } = await c.req.json();
  if (!email) return c.json({ error: 'Email required' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'Invalid email address' }, 400);

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

app.post('/api/auth/forgot-password', async (c) => {
  const { email } = await c.req.json();
  if (!email) return c.json({ error: 'Email required' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'Invalid email address' }, 400);

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

      try {
        await c.env.sorc_db.prepare(`
          INSERT INTO users (id, email, auth_key, username, display_name, first_name, role, join_date, created_at, updated_at, user_id, email_verified, password_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(uuid, googleUser.email, authKey, username, googleUser.name || googleUser.email, googleUser.given_name || '', 'CIVILIAN', now, now, now, userId, true, '').run();
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
      try {
        await c.env.sorc_db.prepare('UPDATE users SET auth_key = ? WHERE id = ?').bind(authKey, user.id).run();
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
    const fullUser = await c.env.sorc_db.prepare('SELECT id, username, display_name, first_name, surname, prefix, suffix, avatar, bio, role, community_points, post_count, titles, join_date, last_seen, created_at FROM users WHERE id = ?').bind(user.id).first();
    if (!fullUser) return c.json({ error: 'User not found' }, 404);
    return c.json({ user: fullUser });
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

export default app;
