import { Hono } from 'hono';
import { cors } from 'hono/cors';

interface Env {
  sorc_db: D1Database;
  AVATARS: R2Bucket;
  FORUM_MEDIA: R2Bucket;
  RESEND_API_KEY: string;
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
  origin: ['https://sorcrpg.com', 'https://www.sorcrpg.com'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
}));

const authMiddleware = async (c: any, next: any) => {
  const authKey = c.req.header('X-Auth-Key');
  if (!authKey) return c.json({ error: 'Missing auth key' }, 401);
  const user = await c.env.sorc_db.prepare(
    'SELECT * FROM users WHERE auth_key = ? AND (banned IS NULL OR banned = 0) AND (suspended_until IS NULL OR suspended_until < datetime(\'now\'))'
  ).bind(authKey).first() as any;
  if (!user) return c.json({ error: 'Invalid auth key' }, 401);
  if (user.auth_key_expires_at && new Date(user.auth_key_expires_at) < new Date()) {
    return c.json({ error: 'Session expired', expired: true }, 401);
  }
  c.set('user', user);
  await next();
};

async function sendVerificationEmail(email: string, username: string, token: string, apiKey: string) {
  const verifyUrl = `https://api.sorcrpg.com/api/auth/verify-email?token=${token}`;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'SORC RPG <noreply@sorcrpg.com>',
      to: email,
      subject: 'Verify your SORC RPG account',
      html: `
        <h2>Welcome to SORC RPG, ${username}!</h2>
        <p>Please verify your email address by clicking the link below:</p>
        <a href="${verifyUrl}" style="background:#d0021b;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;">Verify Email</a>
        <p>Or copy this link: ${verifyUrl}</p>
        <p>This link expires in 24 hours.</p>
      `
    })
  });
}

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
    return true;
  }
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
  const saltHex = Array.from(salt).map((b: number) => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(bits)).map((b: number) => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((b: string) => parseInt(b, 16)));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
  const newHashHex = Array.from(new Uint8Array(bits)).map((b: number) => b.toString(16).padStart(2, '0')).join('');
  return newHashHex === hashHex;
}

app.post('/api/auth/register', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const allowed = await checkRateLimit(c.env.sorc_db, `register:${ip}`, 5, 3600);
  if (!allowed) return c.json({ error: 'Too many attempts. Please try again later.' }, 429);
  const { email, username, firstName, password } = await c.req.json();
  if (!email || !username) return c.json({ error: 'Email and username required' }, 400);
  if (!password || password.length < 6) return c.json({ error: 'Password must be at least 6 characters' }, 400);
  if (!/^[a-zA-Z0-9-]+$/.test(username)) return c.json({ error: 'Username can only contain letters, numbers, and hyphens' }, 400);
  const existingUser = await c.env.sorc_db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').bind(email, username).first();
  if (existingUser) return c.json({ error: 'Email or username already exists' }, 400);
  const passwordHash = await hashPassword(password);
  const authKey = crypto.randomUUID();
  const verificationToken = crypto.randomUUID();
  const userId = Math.floor(Math.random() * 90000000) + 10000000;
  const now = new Date().toISOString();
  const uuid = crypto.randomUUID();
  try {
    await c.env.sorc_db.prepare(`
      INSERT INTO users (id, email, auth_key, username, display_name, first_name, role, join_date, created_at, updated_at, user_id, email_verified, verification_token, password_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, ?, ?)
    `).bind(uuid, email, authKey, username, firstName || username, firstName || '', 'CIVILIAN', now, now, now, userId, verificationToken, passwordHash).run();
    await sendVerificationEmail(email, username, verificationToken, c.env.RESEND_API_KEY);
    return c.json({ success: true, message: 'Please check your email to verify your account.' });
  } catch (error: any) {
    return c.json({ error: 'Registration failed', details: error.message }, 500);
  }
});

app.get('/api/auth/verify-email', async (c) => {
  const token = c.req.query('token');
  if (!token) return c.redirect('https://sorcrpg.com/signin?verify_error=true');
  const user = await c.env.sorc_db.prepare('SELECT * FROM users WHERE verification_token = ?').bind(token).first() as any;
  if (!user) return c.redirect('https://sorcrpg.com/signin?verify_error=true');
  await c.env.sorc_db.prepare('UPDATE users SET email_verified = TRUE, verification_token = NULL WHERE id = ?').bind(user.id).run();
  return c.redirect('https://sorcrpg.com/signin?verified=true');
});

app.post('/api/auth/forgot-password', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const allowed = await checkRateLimit(c.env.sorc_db, `forgot:${ip}`, 5, 3600);
  if (!allowed) return c.json({ error: 'Too many attempts. Please try again later.' }, 429);
  const { email } = await c.req.json();
  if (!email) return c.json({ error: 'Email required' }, 400);
  const user = await c.env.sorc_db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first() as any;
  if (!user) return c.json({ success: true });
  const resetToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await c.env.sorc_db.prepare('UPDATE users SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?').bind(resetToken, expiresAt, user.id).run();
  const resetUrl = `https://sorcrpg.com/reset-password.html?token=${resetToken}`;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${c.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'SORC RPG <noreply@sorcrpg.com>',
      to: email,
      subject: 'Reset your SORC RPG password',
      html: `
        <h2>Password Reset</h2>
        <p>We received a request to reset the password for your SORC RPG account.</p>
        <p>Click the button below to choose a new password. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="background:#d0021b;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">Reset Password</a>
        <p>If you did not request this, you can safely ignore this email.</p>
      `
    })
  });
  return c.json({ success: true });
});

app.post('/api/auth/reset-password', async (c) => {
  const { token, password } = await c.req.json();
  if (!token || !password) return c.json({ error: 'Token and password required' }, 400);
  if (password.length < 6) return c.json({ error: 'Password must be at least 6 characters' }, 400);
  const user = await c.env.sorc_db.prepare('SELECT * FROM users WHERE reset_token = ?').bind(token).first() as any;
  if (!user) return c.json({ error: 'Invalid or expired reset link' }, 400);
  if (new Date(user.reset_token_expires_at) < new Date()) return c.json({ error: 'Reset link has expired. Please request a new one.' }, 400);
  const passwordHash = await hashPassword(password);
  const authKey = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await c.env.sorc_db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires_at = NULL, auth_key = ?, auth_key_expires_at = ?, email_verified = TRUE WHERE id = ?').bind(passwordHash, authKey, expiresAt, user.id).run();
  return c.json({ success: true });
});

app.post('/api/auth/resend-verification', async (c) => {
  const { email } = await c.req.json();
  if (!email) return c.json({ error: 'Email required' }, 400);
  const user = await c.env.sorc_db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first() as any;
  if (!user) return c.json({ error: 'User not found' }, 404);
  if (user.email_verified) return c.json({ error: 'Email already verified' }, 400);
  const verificationToken = crypto.randomUUID();
  await c.env.sorc_db.prepare('UPDATE users SET verification_token = ? WHERE id = ?').bind(verificationToken, user.id).run();
  await sendVerificationEmail(email, user.username, verificationToken, c.env.RESEND_API_KEY);
  return c.json({ success: true, message: 'Verification email sent.' });
});

app.post('/api/auth/signin', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const allowed = await checkRateLimit(c.env.sorc_db, `signin:${ip}`, 10, 600);
  if (!allowed) return c.json({ error: 'Too many sign-in attempts. Please wait 10 minutes.' }, 429);
  const { email, username, password } = await c.req.json();
  if (!email && !username) return c.json({ error: 'Email or username required' }, 400);
  if (!password) return c.json({ error: 'Invalid credentials' }, 401);
  const user = await c.env.sorc_db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').bind(email || '', username || '').first() as any;
  if (!user) return c.json({ error: 'Invalid credentials' }, 401);
  if (!user.password_hash) return c.json({ error: 'We recently upgraded account security. No password is set for this account yet — please use "Forgot password" to create one.' }, 401);
  const passwordValid = await verifyPassword(password, user.password_hash);
  if (!passwordValid) return c.json({ error: 'Invalid credentials' }, 401);
  if (!user.email_verified) {
    return c.json({ error: 'Please verify your email before signing in. Check your spam folder if you did not receive it.', unverified: true }, 403);
  }
  const authKey = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await c.env.sorc_db.prepare('UPDATE users SET auth_key = ?, auth_key_expires_at = ? WHERE id = ?').bind(authKey, expiresAt, user.id).run();
  return c.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
      community_points: user.community_points,
      created_at: user.created_at,
      avatar: user.avatar,
      email_verified: user.email_verified
    },
    authKey
  });
});

// ========== FORUM ENDPOINTS ==========

app.get('/api/forum/categories', async (c) => {
  try {
    const categories: any[] = [
      { id: 'announcements', name: 'News & Announcements', icon: '📣', desc: null, color: '#d0021b', readOnly: true, adminOnly: true },
      { id: 'conduct', name: 'Conduct & Rules', icon: '⚖️', desc: 'The laws of Essentia and the SORC community. Read before you post.', color: '#8B0000', readOnly: true, adminOnly: true },
      { id: 'general', name: 'General Discussion', icon: '💬', desc: 'The heart of the SORC community. Talk about anything and everything.', color: '#333' },
      { id: 'sorc-beyond', name: 'SORC Beyond', icon: '⚡', desc: 'Discuss digital features, online lobbies, and the SORC Beyond platform.', color: '#1a3a6b' },
      { id: 'x-roads', name: 'The X Roads', icon: '🗺', desc: "Where lore, legend, and mystery converge. Share campaign stories, discuss Essentia's history, prophecies, and secrets.", color: '#4a1a6b' },
      { id: 'rules', name: 'Rules & Gameplay Advice', icon: '📖', desc: 'Questions, clarifications, and discussions about SORC mechanics and rules.', color: '#1a4a1a' },
      { id: 'majestic-worlds', name: 'The Majestic Worlds of Essentia', icon: '🌍', desc: 'Harnessing the powers of Adoria, the thirteen worlds of Essentia breathe with magic, war, and wonder.', color: '#1a3a1a' },
      { id: 'tawdry-dwarf', name: 'Tawdry Dwarf & Beyond', icon: '🔭', desc: "Far from Adoria's reach, where magic fades and ingenuity reigns.", color: '#1a1a3a' },
      { id: 'lfg', name: 'Looking for Group', icon: '⚔️', desc: 'Find players and Game Masters for home campaigns and SORC Beyond lobbies.', color: '#3a1a00' }
    ];
    for (const cat of categories) {
      const threadCount = await c.env.sorc_db.prepare('SELECT COUNT(*) as count FROM threads WHERE category_id = ?').bind(cat.id).first() as any;
      const lastPost = await c.env.sorc_db.prepare(`SELECT t.last_reply_at, t.title, u.username as author_name FROM threads t JOIN users u ON t.author_uid = u.id WHERE t.category_id = ? ORDER BY t.last_reply_at DESC LIMIT 1`).bind(cat.id).first() as any;
      cat.threadCount = threadCount?.count || 0;
      cat.lastPost = lastPost ? { time: lastPost.last_reply_at, title: lastPost.title, author: lastPost.author_name } : null;
    }
    return c.json({ categories });
  } catch (error: any) {
    return c.json({ error: 'Failed to load categories', details: error.message }, 500);
  }
});

app.get("/api/forum/category/:categoryId", async (c) => {
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

app.get("/api/forum/thread/:threadId", async (c) => {
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
    await c.env.sorc_db.prepare('UPDATE users SET post_count = post_count + 1 WHERE id = ?').bind(user.id).run();
    return c.json({ success: true, threadId });
  } catch (error: any) {
    return c.json({ error: 'Failed to create thread', details: error.message }, 500);
  }
});

app.post('/api/forum/post', authMiddleware, async (c) => {
  const { threadId, body, quoted_text, quoted_author } = await c.req.json();
  const user = c.get('user') as any;
  if (!body) return c.json({ error: 'Body required' }, 400);
  try {
    const postId = crypto.randomUUID();
    const now = new Date().toISOString();
    await c.env.sorc_db.prepare(`INSERT INTO posts (id, thread_id, body, author_uid, author_name, author_role, quoted_text, quoted_author, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(postId, threadId, body, user.id, user.display_name || user.username, user.role, quoted_text || null, quoted_author || null, now).run();
    await c.env.sorc_db.prepare(`UPDATE threads SET reply_count = reply_count + 1, last_reply_at = ?, last_reply_by = ? WHERE id = ?`).bind(now, user.display_name || user.username, threadId).run();
    await c.env.sorc_db.prepare('UPDATE users SET post_count = post_count + 1 WHERE id = ?').bind(user.id).run();
    return c.json({ success: true, postId });
  } catch (error: any) {
    return c.json({ error: 'Failed to create post', details: error.message }, 500);
  }
});

// ========== PROFILE ENDPOINTS ==========

app.get('/api/me', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    const fullUser = await c.env.sorc_db.prepare(`SELECT * FROM users WHERE id = ?`).bind(user.id).first() as any;
    if (!fullUser) return c.json({ error: 'User not found' }, 404);
    delete fullUser.password_hash;
    delete fullUser.auth_key;
    return c.json({ user: fullUser });
  } catch (error: any) {
    return c.json({ error: 'Failed to load profile', details: error.message }, 500);
  }
});

app.get('/api/profile/:userId', async (c) => {
  const userId = c.req.param('userId');
  try {
    const user = await c.env.sorc_db.prepare(`SELECT id, username, display_name, first_name, surname, prefix, suffix, avatar, bio, website, social_twitter, social_twitch, signature, role, community_points, post_count, titles, join_date, last_seen, created_at, email_verified, unlocked_features, email, privacy_email FROM users WHERE id = ? OR username = ?`).bind(userId, userId).first() as any;
    if (!user) return c.json({ error: 'User not found' }, 404);
    // Only show email when explicitly set to public (0); default (null/1) is private
    if (user.privacy_email !== 0 && user.privacy_email !== false) {
      delete user.email;
    }
    return c.json({ user });
  } catch (error: any) {
    return c.json({ error: 'Failed to load profile', details: error.message }, 500);
  }
});

app.post('/api/unlock', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const { feature } = await c.req.json();
  const costs: Record<string, number> = { fellowships: 50, signature: 100, socials: 250, banner: 500 };
  if (!feature || !(feature in costs)) return c.json({ error: 'Invalid feature' }, 400);
  const OWNER_EMAILS = ['corbett@sorcrpg.com'];
  const isPrivileged = OWNER_EMAILS.includes(user.email) || user.role === 'OWNER' || user.role === 'ADMIN';
  const cost = isPrivileged ? 0 : costs[feature];
  const cp = user.community_points || 0;
  if (!isPrivileged && cp < cost) return c.json({ error: 'Not enough Community Points' }, 400);
  let unlocked: string[] = [];
  try { unlocked = JSON.parse(user.unlocked_features || '[]'); } catch { unlocked = []; }
  if (unlocked.includes(feature)) return c.json({ error: 'Already unlocked' }, 400);
  unlocked.push(feature);
  const newCp = cp - cost;
  await c.env.sorc_db.prepare(
    'UPDATE users SET community_points = ?, unlocked_features = ?, updated_at = ? WHERE id = ?'
  ).bind(newCp, JSON.stringify(unlocked), new Date().toISOString(), user.id).run();
  return c.json({ success: true, community_points: newCp, unlocked_features: unlocked });
});

app.put('/api/profile', authMiddleware, async (c) => {
  const updates = await c.req.json();
  const user = c.get('user') as any;
  const OWNER_EMAILS = ['corbett@sorcrpg.com'];
  const isPrivileged = OWNER_EMAILS.includes(user.email) || user.role === 'OWNER' || user.role === 'ADMIN';
  const allowedFields = ['display_name', 'first_name', 'surname', 'prefix', 'suffix', 'bio', 'avatar', 'website', 'social_twitter', 'social_twitch', 'signature', 'privacy_email',
    ...(isPrivileged ? ['community_points'] : [])
  ];
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

// ===== FELLOWSHIPS =====

app.get('/api/fellowships', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    const result = await c.env.sorc_db.prepare(
      `SELECT f.*,
        su.role as role, su.avatar as avatar, su.last_seen as last_seen
       FROM fellowships f
       LEFT JOIN users su ON su.id = CASE WHEN f.sender_uid = ? THEN f.receiver_uid ELSE f.sender_uid END
       WHERE (f.sender_uid = ? OR f.receiver_uid = ?) AND f.status = 'accepted'
       ORDER BY f.accepted_at DESC`
    ).bind(user.id, user.id, user.id).all();
    return c.json({ fellows: result.results || [] });
  } catch (error: any) {
    return c.json({ error: 'Failed to load fellowships', details: error.message }, 500);
  }
});

app.get('/api/notifications', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    const [incoming, accepted, pendingMsgs] = await Promise.all([
      c.env.sorc_db.prepare(
        `SELECT COUNT(*) as count FROM fellowships WHERE receiver_uid = ? AND status = 'pending'`
      ).bind(user.id).first(),
      c.env.sorc_db.prepare(
        `SELECT id, receiver_name, accepted_at FROM fellowships WHERE sender_uid = ? AND status = 'accepted' ORDER BY accepted_at DESC LIMIT 50`
      ).bind(user.id).all(),
      c.env.sorc_db.prepare(
        `SELECT COUNT(*) as count FROM conversations WHERE user2_uid = ? AND status = 'pending'`
      ).bind(user.id).first()
    ]);
    return c.json({
      fellowship_incoming_count: (incoming as any)?.count || 0,
      fellowship_recently_accepted: (accepted as any)?.results || [],
      admin_invite: user.admin_invited === 1 || user.admin_invited === true,
      community_points: user.community_points || 0,
      inbox_unread: (pendingMsgs as any)?.count || 0
    });
  } catch (error: any) {
    return c.json({ error: 'Failed', details: error.message }, 500);
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
    if (accept) {
      const newCp = (user.community_points || 0) + 10000;
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

app.get('/api/fellowships/notifications', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    const [incoming, accepted] = await Promise.all([
      c.env.sorc_db.prepare(
        `SELECT COUNT(*) as count FROM fellowships WHERE receiver_uid = ? AND status = 'pending'`
      ).bind(user.id).first(),
      c.env.sorc_db.prepare(
        `SELECT id, receiver_name, accepted_at FROM fellowships WHERE sender_uid = ? AND status = 'accepted' ORDER BY accepted_at DESC LIMIT 50`
      ).bind(user.id).all()
    ]);
    return c.json({
      incoming_count: (incoming as any)?.count || 0,
      recent_accepted: (accepted as any)?.results || []
    });
  } catch (error: any) {
    return c.json({ error: 'Failed', details: error.message }, 500);
  }
});

app.get('/api/fellowships/requests/incoming', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    const result = await c.env.sorc_db.prepare(
      `SELECT f.*, su.role as role, su.avatar as avatar, su.last_seen as last_seen
       FROM fellowships f
       LEFT JOIN users su ON su.id = f.sender_uid
       WHERE f.receiver_uid = ? AND f.status = 'pending'
       ORDER BY f.created_at DESC`
    ).bind(user.id).all();
    return c.json({ requests: result.results || [] });
  } catch (error: any) {
    return c.json({ error: 'Failed to load requests', details: error.message }, 500);
  }
});

app.get('/api/fellowships/requests/outgoing', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    const result = await c.env.sorc_db.prepare(
      `SELECT f.*, su.role as role, su.avatar as avatar, su.last_seen as last_seen
       FROM fellowships f
       LEFT JOIN users su ON su.id = f.receiver_uid
       WHERE f.sender_uid = ? AND f.status = 'pending'
       ORDER BY f.created_at DESC`
    ).bind(user.id).all();
    return c.json({ requests: result.results || [] });
  } catch (error: any) {
    return c.json({ error: 'Failed to load outgoing requests', details: error.message }, 500);
  }
});

app.post('/api/fellowships/request', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    const { receiver_uid } = await c.req.json();
    if (!receiver_uid) return c.json({ error: 'receiver_uid required' }, 400);
    const receiver = await c.env.sorc_db.prepare('SELECT id, username, display_name FROM users WHERE id = ? OR username = ?').bind(receiver_uid, receiver_uid).first() as any;
    if (!receiver) return c.json({ error: 'User not found' }, 404);
    let fellowBlock = null;
    try { fellowBlock = await c.env.sorc_db.prepare(`SELECT id FROM blocks WHERE (blocker_uid = ? AND blocked_uid = ?) OR (blocker_uid = ? AND blocked_uid = ?)`).bind(user.id, receiver.id, receiver.id, user.id).first(); } catch(e) {}
    if (fellowBlock) return c.json({ error: 'Unable to send request' }, 403);
    const existing = await c.env.sorc_db.prepare(
      `SELECT id FROM fellowships WHERE ((sender_uid = ? AND receiver_uid = ?) OR (sender_uid = ? AND receiver_uid = ?)) AND status IN ('pending','accepted')`
    ).bind(user.id, receiver.id, receiver.id, user.id).first();
    if (existing) return c.json({ error: 'Request already exists or already fellows' }, 409);
    const id = crypto.randomUUID();
    const senderName = user.display_name || user.username;
    const receiverName = receiver.display_name || receiver.username;
    await c.env.sorc_db.prepare(
      `INSERT INTO fellowships (id, sender_uid, sender_name, receiver_uid, receiver_name, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)`
    ).bind(id, user.id, senderName, receiver_uid, receiverName, new Date().toISOString()).run();
    return c.json({ success: true, id });
  } catch (error: any) {
    return c.json({ error: 'Failed to send request', details: error.message }, 500);
  }
});

app.post('/api/fellowships/:id/accept', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const id = c.req.param('id');
  try {
    await c.env.sorc_db.prepare(
      `UPDATE fellowships SET status = 'accepted', accepted_at = ? WHERE id = ? AND receiver_uid = ? AND status = 'pending'`
    ).bind(new Date().toISOString(), id, user.id).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to accept', details: error.message }, 500);
  }
});

app.post('/api/fellowships/:id/decline', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const id = c.req.param('id');
  try {
    await c.env.sorc_db.prepare(
      `UPDATE fellowships SET status = 'declined' WHERE id = ? AND receiver_uid = ? AND status = 'pending'`
    ).bind(id, user.id).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to decline', details: error.message }, 500);
  }
});

app.get('/api/fellowships/status/:uid', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const uid = c.req.param('uid');
  try {
    const row = await c.env.sorc_db.prepare(
      `SELECT id, status, sender_uid FROM fellowships WHERE ((sender_uid = ? AND receiver_uid = ?) OR (sender_uid = ? AND receiver_uid = ?)) AND status IN ('pending','accepted')`
    ).bind(user.id, uid, uid, user.id).first() as any;
    if (!row) return c.json({ status: 'none' });
    if (row.status === 'accepted') return c.json({ status: 'accepted' });
    return c.json({ status: row.sender_uid === user.id ? 'pending_sent' : 'pending_received' });
  } catch (error: any) {
    return c.json({ status: 'none' });
  }
});

// ===== BLOCKS =====

app.get('/api/blocks/check/:uid', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const uid = c.req.param('uid');
  try {
    const [iBlocked, theyBlocked] = await Promise.all([
      c.env.sorc_db.prepare(`SELECT id FROM blocks WHERE blocker_uid = ? AND blocked_uid = ?`).bind(user.id, uid).first(),
      c.env.sorc_db.prepare(`SELECT id FROM blocks WHERE blocker_uid = ? AND blocked_uid = ?`).bind(uid, user.id).first()
    ]);
    return c.json({ i_blocked: !!iBlocked, they_blocked: !!theyBlocked });
  } catch (error: any) {
    return c.json({ i_blocked: false, they_blocked: false });
  }
});

app.post('/api/blocks/:uid', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const uid = c.req.param('uid');
  if (uid === user.id) return c.json({ error: 'Cannot block yourself' }, 400);
  try {
    await c.env.sorc_db.prepare(
      `INSERT OR IGNORE INTO blocks (id, blocker_uid, blocked_uid, created_at) VALUES (?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), user.id, uid, new Date().toISOString()).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to block', details: error.message }, 500);
  }
});

app.delete('/api/blocks/:uid', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const uid = c.req.param('uid');
  try {
    await c.env.sorc_db.prepare(`DELETE FROM blocks WHERE blocker_uid = ? AND blocked_uid = ?`).bind(user.id, uid).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to unblock', details: error.message }, 500);
  }
});

app.delete('/api/fellowships/:id', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const id = c.req.param('id');
  try {
    await c.env.sorc_db.prepare(
      `DELETE FROM fellowships WHERE id = ? AND (sender_uid = ? OR receiver_uid = ?)`
    ).bind(id, user.id, user.id).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to remove', details: error.message }, 500);
  }
});

app.put('/api/forum/posts/:id', authMiddleware, async (c) => {
  const postId = c.req.param('id');
  const user = c.get('user') as any;
  const { body } = await c.req.json();
  if (!body) return c.json({ error: 'Body required' }, 400);
  try {
    const post = await c.env.sorc_db.prepare('SELECT * FROM posts WHERE id = ?').bind(postId).first() as any;
    if (!post) {
      // OP edit — update thread body
      const thread = await c.env.sorc_db.prepare('SELECT * FROM threads WHERE id = ?').bind(postId).first() as any;
      if (!thread) return c.json({ error: 'Post not found' }, 404);
      if (thread.author_uid !== user.id) return c.json({ error: 'Not your post' }, 403);
      await c.env.sorc_db.prepare('UPDATE threads SET body = ?, updated_at = ? WHERE id = ?').bind(body, new Date().toISOString(), postId).run();
      return c.json({ success: true });
    }
    if (post.author_uid !== user.id) return c.json({ error: 'Not your post' }, 403);
    await c.env.sorc_db.prepare('UPDATE posts SET body = ?, updated_at = ? WHERE id = ?').bind(body, new Date().toISOString(), postId).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to edit post', details: error.message }, 500);
  }
});

app.delete('/api/forum/posts/:id', authMiddleware, async (c) => {
  const postId = c.req.param('id');
  const user = c.get('user') as any;
  try {
    const post = await c.env.sorc_db.prepare('SELECT * FROM posts WHERE id = ?').bind(postId).first() as any;
    if (!post) {
      // OP delete — delete whole thread
      const thread = await c.env.sorc_db.prepare('SELECT * FROM threads WHERE id = ?').bind(postId).first() as any;
      if (!thread) return c.json({ error: 'Post not found' }, 404);
      if (thread.author_uid !== user.id) return c.json({ error: 'Not your post' }, 403);
      await c.env.sorc_db.prepare('DELETE FROM posts WHERE thread_id = ?').bind(postId).run();
      await c.env.sorc_db.prepare('DELETE FROM threads WHERE id = ?').bind(postId).run();
      return c.json({ success: true });
    }
    if (post.author_uid !== user.id) return c.json({ error: 'Not your post' }, 403);
    await c.env.sorc_db.prepare('DELETE FROM posts WHERE id = ?').bind(postId).run();
    await c.env.sorc_db.prepare('UPDATE threads SET reply_count = MAX(0, reply_count - 1) WHERE id = ?').bind(post.thread_id).run();
    await c.env.sorc_db.prepare('UPDATE users SET post_count = MAX(0, post_count - 1) WHERE id = ?').bind(user.id).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to delete post', details: error.message }, 500);
  }
});

app.delete('/api/forum/posts/:id/mod', authMiddleware, async (c) => {
  const postId = c.req.param('id');
  const user = c.get('user') as any;
  const OWNER_EMAILS = ['corbett@sorcrpg.com'];
  const ADMIN_EMAILS = ['markcorbett.mii@gmail.com'];
  if (!OWNER_EMAILS.includes(user.email) && !ADMIN_EMAILS.includes(user.email)) return c.json({ error: 'Not authorized' }, 403);
  try {
    const post = await c.env.sorc_db.prepare('SELECT * FROM posts WHERE id = ?').bind(postId).first() as any;
    if (!post) return c.json({ error: 'Post not found' }, 404);
    await c.env.sorc_db.prepare('DELETE FROM posts WHERE id = ?').bind(postId).run();
    await c.env.sorc_db.prepare('UPDATE threads SET reply_count = MAX(0, reply_count - 1) WHERE id = ?').bind(post.thread_id).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to remove post', details: error.message }, 500);
  }
});

app.post('/api/presence', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    await c.env.sorc_db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').bind(new Date().toISOString(), user.id).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to update presence', details: error.message }, 500);
  }
});

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

const adminMiddleware = async (c: any, next: any) => {
  const authKey = c.req.header('X-Auth-Key');
  if (!authKey) return c.json({ error: 'Unauthorized' }, 401);
  const user = await c.env.sorc_db.prepare('SELECT * FROM users WHERE auth_key = ?').bind(authKey).first() as any;
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const OWNER_EMAILS = ['corbett@sorcrpg.com'];
  const ADMIN_EMAILS = ['markcorbett.mii@gmail.com'];
  if (!OWNER_EMAILS.includes(user.email) && !ADMIN_EMAILS.includes(user.email)) return c.json({ error: 'Not authorized' }, 403);
  c.set('user', user);
  await next();
};

app.get('/api/admin/reports', adminMiddleware, async (c) => {
  try {
    const result = await c.env.sorc_db.prepare('SELECT * FROM reports WHERE dismissed = 0 ORDER BY report_count DESC, created_at DESC').all();
    return c.json({ reports: result.results || [] });
  } catch (error: any) {
    return c.json({ error: 'Failed to load reports', details: error.message }, 500);
  }
});

app.post('/api/admin/reports/:id/dismiss', adminMiddleware, async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.sorc_db.prepare('UPDATE reports SET dismissed = 1 WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to dismiss report', details: error.message }, 500);
  }
});

app.get('/api/admin/members', adminMiddleware, async (c) => {
  const search = c.req.query('search') || '';
  const limit = parseInt(c.req.query('limit') || '100');
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

app.put('/api/admin/members/:uid/role', adminMiddleware, async (c) => {
  const uid = c.req.param('uid');
  const admin = c.get('user') as any;
  const OWNER_EMAILS = ['corbett@sorcrpg.com'];
  if (!OWNER_EMAILS.includes(admin.email)) return c.json({ error: 'Owner only' }, 403);
  const { role } = await c.req.json();
  const validRoles = ['CIVILIAN', 'PLAYER', 'MASTER', 'ADMIN'];
  if (!validRoles.includes(role)) return c.json({ error: 'Invalid role' }, 400);
  try {
    await c.env.sorc_db.prepare('UPDATE users SET role = ? WHERE id = ? OR username = ?').bind(role, uid, uid).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to update role', details: error.message }, 500);
  }
});

app.post('/api/admin/members/:uid/warn', adminMiddleware, async (c) => {
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

app.post('/api/admin/members/:uid/suspend', adminMiddleware, async (c) => {
  const uid = c.req.param('uid');
  const { days } = await c.req.json();
  const until = new Date(Date.now() + (days || 1) * 86400000).toISOString();
  try {
    await c.env.sorc_db.prepare('UPDATE users SET suspended_until = ? WHERE id = ? OR username = ?').bind(until, uid, uid).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to suspend member', details: error.message }, 500);
  }
});

app.post('/api/admin/members/:uid/ban', adminMiddleware, async (c) => {
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

app.post('/api/admin/invitations', adminMiddleware, async (c) => {
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

app.get('/api/forum/recent-visitors', async (c) => {
  try {
    const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const result = await c.env.sorc_db.prepare(
      `SELECT id, username, display_name, role, avatar, last_seen
       FROM users
       WHERE last_seen >= ?
       ORDER BY last_seen DESC
       LIMIT 50`
    ).bind(cutoff).all();
    return c.json({ visitors: result.results || [] });
  } catch (error: any) {
    return c.json({ error: 'Failed to load recent visitors', details: error.message }, 500);
  }
});

app.get('/api/health', (c) => c.json({ ok: true }));

// ===== CONVERSATIONS / INBOX =====

// Only accepted conversations appear in the main list
app.get('/api/conversations', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    const result = await c.env.sorc_db.prepare(
      `SELECT * FROM conversations WHERE (user1_uid = ? OR user2_uid = ?) AND status = 'accepted' ORDER BY last_message_at DESC`
    ).bind(user.id, user.id).all();
    return c.json({ conversations: result.results || [] });
  } catch (error: any) {
    return c.json({ error: 'Failed to load conversations', details: error.message }, 500);
  }
});

// Pending message requests sent BY the current user (awaiting recipient approval)
app.get('/api/conversations/sent', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    const result = await c.env.sorc_db.prepare(
      `SELECT * FROM conversations WHERE user1_uid = ? AND status = 'pending' ORDER BY created_at DESC`
    ).bind(user.id).all();
    return c.json({ conversations: result.results || [] });
  } catch (error: any) {
    return c.json({ error: 'Failed', details: error.message }, 500);
  }
});

// Conversation status with a specific user (for profile page button state)
app.get('/api/conversations/status/:uid', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const uid = c.req.param('uid');
  try {
    const conv = await c.env.sorc_db.prepare(
      `SELECT id, status, user1_uid FROM conversations WHERE (user1_uid = ? AND user2_uid = ?) OR (user1_uid = ? AND user2_uid = ?)`
    ).bind(user.id, uid, uid, user.id).first() as any;
    if (!conv) return c.json({ status: 'none' });
    return c.json({ status: conv.status, conversation_id: conv.id, i_am_sender: conv.user1_uid === user.id });
  } catch (error: any) {
    return c.json({ status: 'none' });
  }
});

// Pending message requests sent TO the current user
app.get('/api/conversations/requests', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  try {
    const result = await c.env.sorc_db.prepare(
      `SELECT * FROM conversations WHERE user2_uid = ? AND status = 'pending' ORDER BY created_at DESC`
    ).bind(user.id).all();
    return c.json({ requests: result.results || [] });
  } catch (error: any) {
    return c.json({ error: 'Failed to load requests', details: error.message }, 500);
  }
});

// Create or get a conversation — always starts as pending unless one already exists
app.post('/api/conversations', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const { recipient_uid, initial_message } = await c.req.json();
  if (!recipient_uid) return c.json({ error: 'recipient_uid required' }, 400);
  if (recipient_uid === user.id) return c.json({ error: 'Cannot message yourself' }, 400);
  if (!initial_message || !initial_message.trim()) return c.json({ error: 'A message is required to start a conversation' }, 400);
  if (initial_message.length > 2000) return c.json({ error: 'Message too long (max 2000 chars)' }, 400);
  try {
    const recipient = await c.env.sorc_db.prepare('SELECT id, username, display_name FROM users WHERE id = ?').bind(recipient_uid).first() as any;
    if (!recipient) return c.json({ error: 'User not found' }, 404);
    let msgBlock = null;
    try { msgBlock = await c.env.sorc_db.prepare(`SELECT id FROM blocks WHERE (blocker_uid = ? AND blocked_uid = ?) OR (blocker_uid = ? AND blocked_uid = ?)`).bind(user.id, recipient_uid, recipient_uid, user.id).first(); } catch(e) {}
    if (msgBlock) return c.json({ error: 'Unable to send message' }, 403);
    const existing = await c.env.sorc_db.prepare(
      `SELECT * FROM conversations WHERE (user1_uid = ? AND user2_uid = ?) OR (user1_uid = ? AND user2_uid = ?)`
    ).bind(user.id, recipient_uid, recipient_uid, user.id).first() as any;
    if (existing) {
      const otherName = existing.user1_uid === user.id ? existing.user2_name : existing.user1_name;
      return c.json({ conversation_id: existing.id, other_name: otherName, status: existing.status });
    }
    const id = crypto.randomUUID();
    const otherName = recipient.display_name || recipient.username;
    const myName = user.display_name || user.username;
    const now = new Date().toISOString();
    const msgBody = initial_message.trim();
    await c.env.sorc_db.prepare(
      `INSERT INTO conversations (id, user1_uid, user2_uid, user1_name, user2_name, status, last_message_text, created_at, last_message_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
    ).bind(id, user.id, recipient_uid, myName, otherName, msgBody.substring(0, 100), now, now).run();
    // Store initial message — visible after acceptance
    await c.env.sorc_db.prepare(
      `INSERT INTO messages (id, conversation_id, sender_uid, sender_name, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), id, user.id, myName, msgBody, now).run();
    return c.json({ conversation_id: id, other_name: otherName, status: 'pending' });
  } catch (error: any) {
    return c.json({ error: 'Failed to create conversation', details: error.message }, 500);
  }
});

app.post('/api/conversations/:id/accept', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const convId = c.req.param('id');
  try {
    const conv = await c.env.sorc_db.prepare(
      `SELECT * FROM conversations WHERE id = ? AND user2_uid = ? AND status = 'pending'`
    ).bind(convId, user.id).first();
    if (!conv) return c.json({ error: 'Request not found' }, 404);
    await c.env.sorc_db.prepare(`UPDATE conversations SET status = 'accepted' WHERE id = ?`).bind(convId).run();
    // Return messages in the same response to avoid D1 replica read-after-write inconsistency
    const messages = await c.env.sorc_db.prepare(
      `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 200`
    ).bind(convId).all();
    return c.json({ success: true, messages: messages.results || [] });
  } catch (error: any) {
    return c.json({ error: 'Failed to accept', details: error.message }, 500);
  }
});

app.post('/api/conversations/:id/decline', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const convId = c.req.param('id');
  try {
    const conv = await c.env.sorc_db.prepare(
      `SELECT * FROM conversations WHERE id = ? AND user2_uid = ? AND status = 'pending'`
    ).bind(convId, user.id).first();
    if (!conv) return c.json({ error: 'Request not found' }, 404);
    await c.env.sorc_db.prepare(`DELETE FROM conversations WHERE id = ?`).bind(convId).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to decline', details: error.message }, 500);
  }
});

// Sender cancels their own pending request
app.delete('/api/conversations/:id', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const convId = c.req.param('id');
  try {
    const conv = await c.env.sorc_db.prepare(
      `SELECT * FROM conversations WHERE id = ? AND (user1_uid = ? OR user2_uid = ?)`
    ).bind(convId, user.id, user.id).first();
    if (!conv) return c.json({ error: 'Not found' }, 404);
    await c.env.sorc_db.prepare(`DELETE FROM messages WHERE conversation_id = ?`).bind(convId).run();
    await c.env.sorc_db.prepare(`DELETE FROM conversations WHERE id = ?`).bind(convId).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to delete', details: error.message }, 500);
  }
});

// Sender can view their pending conversation; recipient cannot until accepted
app.get('/api/conversations/:id', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const convId = c.req.param('id');
  try {
    const conv = await c.env.sorc_db.prepare(
      `SELECT * FROM conversations WHERE id = ? AND (user1_uid = ? OR user2_uid = ?)`
    ).bind(convId, user.id, user.id).first() as any;
    if (!conv) return c.json({ error: 'Conversation not found' }, 404);
    if (conv.status === 'pending' && conv.user2_uid === user.id) return c.json({ error: 'Conversation not yet accepted' }, 403);
    const messages = await c.env.sorc_db.prepare(
      `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 200`
    ).bind(convId).all();
    return c.json({ messages: messages.results || [] });
  } catch (error: any) {
    return c.json({ error: 'Failed to load messages', details: error.message }, 500);
  }
});

app.post('/api/conversations/:id/messages', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const convId = c.req.param('id');
  const { body } = await c.req.json();
  if (!body || !body.trim()) return c.json({ error: 'Message cannot be empty' }, 400);
  if (body.length > 2000) return c.json({ error: 'Message too long (max 2000 chars)' }, 400);
  try {
    const conv = await c.env.sorc_db.prepare(
      `SELECT * FROM conversations WHERE id = ? AND (user1_uid = ? OR user2_uid = ?) AND status = 'accepted'`
    ).bind(convId, user.id, user.id).first();
    if (!conv) return c.json({ error: 'Conversation not found or not yet accepted' }, 404);
    const msgId = crypto.randomUUID();
    const now = new Date().toISOString();
    const senderName = user.display_name || user.username;
    await c.env.sorc_db.prepare(
      `INSERT INTO messages (id, conversation_id, sender_uid, sender_name, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(msgId, convId, user.id, senderName, body.trim(), now).run();
    await c.env.sorc_db.prepare(
      `UPDATE conversations SET last_message_text = ?, last_message_at = ? WHERE id = ?`
    ).bind(body.trim().substring(0, 100), now, convId).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed to send message', details: error.message }, 500);
  }
});

// ─── ASSESSMENT SYSTEM ────────────────────────────────────────────────────────

const ASSESSMENT_QUESTIONS = [
  {
    q: "When rolling d100, your tens die shows 7 and your ones die shows 3. What is your result?",
    options: ["37", "73", "3", "7"],
    answer: 1
  },
  {
    q: "Which die combination is used for Rare and Divine item drops in SORC?",
    options: ["1D6", "1D4", "D100 + D100", "2D6"],
    answer: 2
  },
  {
    q: "What does rolling 00 on the d100 equal?",
    options: ["0", "10", "50", "100"],
    answer: 3
  },
  {
    q: "The D4 is primarily used for which type of roll?",
    options: ["Damage", "Luck", "Initiative", "Loot"],
    answer: 1
  },
  {
    q: "Which color token represents Lifeblood (HP)?",
    options: ["Blue", "Red", "Yellow", "Green"],
    answer: 1
  },
  {
    q: "What is the maximum number of abilities a character can learn?",
    options: ["40", "50", "59", "75"],
    answer: 2
  },
  {
    q: "What is the correct rank order from lowest to highest for ranks 1, 2, and 3?",
    options: ["Adventurer, Peasant, Pauper", "Pauper, Peasant, Commoner", "Legend, Master, Pauper", "Commoner, Peasant, Pauper"],
    answer: 1
  },
  {
    q: "How much time does each player have per turn before it is forfeited?",
    options: ["30 seconds", "1 minute", "2 minutes", "5 minutes"],
    answer: 2
  },
  {
    q: "In SORC's armor system, when does an attack successfully hit?",
    options: ["When the roll is lower than the Armor Score (AS)", "When the roll equals zero", "When the roll equals or exceeds the Armor Score (AS)", "When the roll is a natural 1"],
    answer: 2
  },
  {
    q: "When using the D100+D100 system, what is the minimum possible total result?",
    options: ["1", "2", "10", "0"],
    answer: 1
  }
];

function calcSorcRole(score: number, gmTrack: boolean): string {
  if (score < 6) return 'FAIL';
  if (gmTrack && score >= 9) return 'GM-ADV';
  if (score >= 9) return 'PC-ADV';
  if (score === 8) return 'PC-INT';
  return 'PC-BEG';
}

app.get('/api/assess', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const result = await c.env.sorc_db.prepare(
    `SELECT * FROM assessments WHERE user_id = ?`
  ).bind(user.id).first() as any;
  return c.json({ assessment: result || null });
});

app.get('/api/assess/questions', authMiddleware, async (c) => {
  const questions = ASSESSMENT_QUESTIONS.map((q, i) => ({
    id: i,
    q: q.q,
    options: q.options
  }));
  return c.json({ questions });
});

app.post('/api/assess/submit', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const allowed = await checkRateLimit(c.env.sorc_db, `assess:${user.id}:${ip}`, 5, 3600);
  if (!allowed) return c.json({ error: 'Too many assessment attempts. Please try again later.' }, 429);

  const existing = await c.env.sorc_db.prepare(
    `SELECT id FROM assessments WHERE user_id = ?`
  ).bind(user.id).first();
  if (existing) return c.json({ error: 'Already assessed. Use reassess to retake.' }, 400);

  const { answers, gm_track } = await c.req.json() as any;
  if (!Array.isArray(answers) || answers.length !== 10) {
    return c.json({ error: 'Must answer all 10 questions.' }, 400);
  }

  let score = 0;
  for (let i = 0; i < 10; i++) {
    if (answers[i] === ASSESSMENT_QUESTIONS[i].answer) score++;
  }

  const role = calcSorcRole(score, !!gm_track);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const siteRole = (role && role.startsWith('GM')) ? 'MASTER' : 'PLAYER';

  if (role === 'FAIL') {
    return c.json({ score, role: 'FAIL', passed: false, message: 'Score too low. Study the rules and reassess.' });
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

    await c.env.sorc_db.prepare(
      `UPDATE users SET role = ?, sorc_role = ?, needs_reassess = 0, assessment_rewarded = 1,
       community_points = community_points + ?, updated_at = ? WHERE id = ?`
    ).bind(siteRole, role, pointsAwarded, now, user.id).run();

    return c.json({ score, role, site_role: siteRole, passed: true, points_awarded: pointsAwarded });
  } catch (error: any) {
    return c.json({ error: 'Failed to save assessment.', details: error.message }, 500);
  }
});

app.delete('/api/assess', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const now = new Date().toISOString();
  await c.env.sorc_db.prepare(`DELETE FROM assessments WHERE user_id = ?`).bind(user.id).run();
  // Revert to CIVILIAN until they complete a new assessment
  await c.env.sorc_db.prepare(
    `UPDATE users SET sorc_role = NULL, role = 'CIVILIAN', needs_reassess = 0, updated_at = ? WHERE id = ?`
  ).bind(now, user.id).run();
  return c.json({ success: true });
});

// ─── BOX SET CODE VALIDATION ───────────────────────────────────────────────────

async function validateBoxSetCode(db: D1Database, code: string, userId: string): Promise<{ valid: boolean; error?: string }> {
  const row = await db.prepare(`SELECT * FROM box_set_codes WHERE code = ?`).bind(code.toUpperCase().trim()).first() as any;
  if (!row) return { valid: false, error: 'Invalid box set code.' };
  if (row.owner_uid && row.owner_uid !== userId) return { valid: false, error: 'This box set code is already registered to another account.' };
  return { valid: true };
}

async function claimBoxSetCode(db: D1Database, code: string, userId: string) {
  const now = new Date().toISOString();
  await db.prepare(`UPDATE box_set_codes SET owner_uid = ?, claimed_at = ? WHERE code = ? AND (owner_uid IS NULL OR owner_uid = ?)`)
    .bind(userId, now, code.toUpperCase().trim(), userId).run();
}

// ─── BOX CODE GENERATION (admin/owner only) ────────────────────────────────────

app.post('/api/box-codes/generate', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  if (!isPrivileged(user)) return c.json({ error: 'Forbidden.' }, 403);

  const { note } = await c.req.json().catch(() => ({} as any)) as any;
  const now = new Date().toISOString();

  // Generate a unique 10-char alphanumeric code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'SORC-';
  const arr = crypto.getRandomValues(new Uint8Array(6));
  for (let i = 0; i < 6; i++) code += chars[arr[i] % chars.length];

  await c.env.sorc_db.prepare(
    `INSERT INTO box_set_codes (id, code, created_by, note, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), code, user.id, note ? note.substring(0, 100) : null, now).run();

  return c.json({ success: true, code });
});

// ─── LOBBIES ───────────────────────────────────────────────────────────────────

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
  if (!assessment && !isPrivileged(user)) return c.json({ error: 'You must complete the assessment before creating a lobby.' }, 403);

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
    `SELECT lm.*, u.avatar, u.user_id as public_uid FROM lobby_members lm
     LEFT JOIN users u ON lm.user_id = u.id WHERE lm.lobby_id = ? ORDER BY lm.joined_at ASC`
  ).bind(lobbyId).all();

  const memberList = (members.results || []).map((m: any) => {
    const out: any = {
      id: m.id, lobby_id: m.lobby_id, user_id: m.user_id,
      sorc_role: m.sorc_role, username: m.username, display_name: m.display_name,
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
  if (!assessment && !privileged) return c.json({ error: 'You must complete the assessment before joining a lobby.' }, 403);

  // Warn about reassess requirement but don't hard-block
  if (user.needs_reassess && !privileged) {
    return c.json({
      error: 'You have been flagged for reassessment due to an incompetence report. Please reassess before joining lobbies.',
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
  const lobby = await c.env.sorc_db.prepare(`SELECT * FROM lobbies WHERE id = ?`).bind(lobbyId).first() as any;
  if (!lobby) return c.json({ error: 'Lobby not found' }, 404);

  const now = new Date().toISOString();
  await c.env.sorc_db.prepare(`DELETE FROM lobby_members WHERE lobby_id = ? AND user_id = ?`).bind(lobbyId, user.id).run();

  if (lobby.creator_uid === user.id) {
    const next = await c.env.sorc_db.prepare(
      `SELECT user_id FROM lobby_members WHERE lobby_id = ? ORDER BY joined_at ASC LIMIT 1`
    ).bind(lobbyId).first() as any;
    if (next) {
      await c.env.sorc_db.prepare(`UPDATE lobbies SET creator_uid = ?, updated_at = ? WHERE id = ?`)
        .bind(next.user_id, now, lobbyId).run();
    } else {
      await c.env.sorc_db.prepare(`UPDATE lobbies SET status = 'closed', updated_at = ? WHERE id = ?`)
        .bind(now, lobbyId).run();
    }
  }

  const newCount = Math.max(0, (lobby.member_count || 1) - 1);
  await c.env.sorc_db.prepare(`UPDATE lobbies SET member_count = ?, updated_at = ? WHERE id = ?`).bind(newCount, now, lobbyId).run();
  return c.json({ success: true });
});

app.post('/api/lobbies/close-all-mine', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const now = new Date().toISOString();
  const result = await c.env.sorc_db.prepare(
    `UPDATE lobbies SET status = 'closed', updated_at = ? WHERE creator_uid = ? AND status != 'closed'`
  ).bind(now, user.id).run();
  return c.json({ success: true, closed: result.meta?.changes ?? 0 });
});

app.post('/api/lobbies/admin/deduplicate', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  if (!isPrivileged(user)) return c.json({ error: 'Admin only' }, 403);
  const now = new Date().toISOString();
  // For each creator_uid with multiple active lobbies, keep the newest (max updated_at), close the rest
  const dupes = await c.env.sorc_db.prepare(
    `SELECT id FROM lobbies
     WHERE status != 'closed'
       AND id NOT IN (
         SELECT id FROM lobbies
         WHERE status != 'closed'
         GROUP BY creator_uid
         HAVING id = MAX(id)
       )`
  ).all();
  if (!dupes.results || dupes.results.length === 0) {
    return c.json({ success: true, closed: 0 });
  }
  const ids = dupes.results.map((r: any) => r.id);
  let closed = 0;
  for (const id of ids) {
    await c.env.sorc_db.prepare(
      `UPDATE lobbies SET status = 'closed', updated_at = ? WHERE id = ?`
    ).bind(now, id).run();
    closed++;
  }
  return c.json({ success: true, closed });
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
  return c.json({ messages: msgs.results || [], lobby_status: lobbyStatus?.status || 'open' });
});

app.post('/api/lobbies/:id/messages', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const lobbyId = c.req.param('id');
  const member = await c.env.sorc_db.prepare(`SELECT * FROM lobby_members WHERE lobby_id = ? AND user_id = ?`).bind(lobbyId, user.id).first() as any;
  if (!member) return c.json({ error: 'Not a member of this lobby.' }, 403);
  if (member.is_muted) return c.json({ error: 'You are muted in this lobby.' }, 403);
  const { body } = await c.req.json() as any;
  if (!body || !body.trim()) return c.json({ error: 'Message cannot be empty.' }, 400);
  if (body.length > 500) return c.json({ error: 'Message too long (max 500 chars).' }, 400);
  const msgId = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.sorc_db.prepare(
    `INSERT INTO lobby_messages (id, lobby_id, user_id, username, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(msgId, lobbyId, user.id, user.display_name || user.username, body.trim(), now).run();
  return c.json({ success: true, message_id: msgId });
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

// ─── LOBBY REPORTS ─────────────────────────────────────────────────────────────

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

  // Store the lobby report
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

// ─── PRIVATE ROOMS ─────────────────────────────────────────────────────────────

app.post('/api/lobbies/:id/launch', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const lobbyId = c.req.param('id');

  const lobby = await c.env.sorc_db.prepare(`SELECT * FROM lobbies WHERE id = ?`).bind(lobbyId).first() as any;
  if (!lobby) return c.json({ error: 'Lobby not found.' }, 404);

  const members = await c.env.sorc_db.prepare(`SELECT * FROM lobby_members WHERE lobby_id = ?`).bind(lobbyId).all();
  const memberList = members.results as any[] || [];

  const { selected_members, gm_uid } = await c.req.json() as any;
  if (!gm_uid) return c.json({ error: 'A GM is required to launch a room.' }, 400);
  if (!selected_members || selected_members.length < 2) return c.json({ error: 'At least 2 PCs required.' }, 400);
  if (selected_members.length > 5) return c.json({ error: 'Maximum 5 PCs per room.' }, 400);

  const gmMember = memberList.find((m: any) => m.user_id === gm_uid);
  if (!gmMember) return c.json({ error: 'GM must be a lobby member.' }, 400);
  if (!gmMember.sorc_role.startsWith('GM')) return c.json({ error: 'Selected GM must hold a GM role.' }, 400);

  const isCreatorOrGM = lobby.creator_uid === user.id || user.id === gm_uid;
  if (!isCreatorOrGM) return c.json({ error: 'Only the lobby creator or GM can launch a room.' }, 403);

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

// ─── USER LOOKUP (safe - no sensitive fields) ─────────────────────────────────

app.get('/api/users/lookup', authMiddleware, async (c) => {
  const requester = c.get('user') as any;
  const username = c.req.query('username');
  if (!username || username.trim().length < 1) return c.json({ error: 'Username required.' }, 400);
  if (username.length > 40) return c.json({ error: 'Invalid username.' }, 400);

  // Rate limit: 20 lookups per minute per user
  const allowed = await checkRateLimit(c.env.sorc_db, `lookup:${requester.id}`, 20, 60);
  if (!allowed) return c.json({ error: 'Too many lookups. Please wait.' }, 429);

  const found = await c.env.sorc_db.prepare(
    `SELECT id, username, display_name, sorc_role, avatar
     FROM users
     WHERE username = ? AND (banned IS NULL OR banned = 0) AND (suspended_until IS NULL OR suspended_until < datetime('now'))`
  ).bind(username.trim()).first() as any;

  if (!found) return c.json({ error: 'User not found.' }, 404);

  // Don't allow looking up yourself
  if (found.id === requester.id) return c.json({ error: 'Cannot invite yourself.' }, 400);

  return c.json({ user: { id: found.id, username: found.username, display_name: found.display_name, sorc_role: found.sorc_role, avatar: found.avatar } });
});

// ─── ROOMS ────────────────────────────────────────────────────────────────────

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

app.get('/api/rooms/:id/messages', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const roomId = c.req.param('id');
  const isMember = await c.env.sorc_db.prepare(`SELECT id FROM room_members WHERE room_id = ? AND user_id = ?`).bind(roomId, user.id).first();
  if (!isMember) return c.json({ error: 'Not a room member.' }, 403);
  const messages = await c.env.sorc_db.prepare(
    `SELECT rm.*, u.sorc_role FROM room_messages rm JOIN users u ON rm.user_id = u.id WHERE rm.room_id = ? ORDER BY rm.created_at ASC LIMIT 100`
  ).bind(roomId).all();
  return c.json({ messages: messages.results || [] });
});

app.post('/api/rooms/:id/messages', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const roomId = c.req.param('id');
  const isMember = await c.env.sorc_db.prepare(`SELECT id FROM room_members WHERE room_id = ? AND user_id = ?`).bind(roomId, user.id).first();
  if (!isMember) return c.json({ error: 'Not a room member.' }, 403);
  const { body } = await c.req.json() as any;
  if (!body || !body.trim()) return c.json({ error: 'Message cannot be empty.' }, 400);
  if (body.length > 500) return c.json({ error: 'Message too long.' }, 400);
  const now = new Date().toISOString();
  await c.env.sorc_db.prepare(
    `INSERT INTO room_messages (id, room_id, user_id, username, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), roomId, user.id, user.username, body.trim(), now).run();
  return c.json({ success: true });
});

// ─── ROOM VISIBILITY & SPECTATE ───────────────────────────────────────────────

// List all visible (not hidden) active rooms — for the lobbies page rooms section
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

// Toggle spectate mode (GM only)
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

// Toggle room visibility (GM only)
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

// ─── ROOM INVITES (GM invites fellows) ────────────────────────────────────────

app.post('/api/rooms/:id/invite/:uid', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const roomId = c.req.param('id');
  const invitedUid = c.req.param('uid');

  const room = await c.env.sorc_db.prepare(`SELECT * FROM private_rooms WHERE id = ?`).bind(roomId).first() as any;
  if (!room) return c.json({ error: 'Room not found.' }, 404);
  if (room.gm_uid !== user.id) return c.json({ error: 'Only the GM can send invites.' }, 403);
  if (room.status !== 'active') return c.json({ error: 'Room is not active.' }, 400);

  // Must be a fellowship connection
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

// Get invites for the current user
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

  const assessment = await c.env.sorc_db.prepare(`SELECT * FROM assessments WHERE user_id = ?`).bind(user.id).first() as any;
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

// ─── ROOM JOIN REQUESTS (lobby members request to join visible rooms) ──────────

app.post('/api/rooms/:id/request', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const roomId = c.req.param('id');
  const { request_type } = await c.req.json() as any;  // 'join' or 'spectate'
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

// GM views pending requests for their room
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

export default app;

