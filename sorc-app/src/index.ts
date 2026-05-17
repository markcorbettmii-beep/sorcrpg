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
  origin: ['http://localhost:3000', 'https://sorcrpg.com', 'https://www.sorcrpg.com'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
}));

const authMiddleware = async (c: any, next: any) => {
  const authKey = c.req.header('X-Auth-Key');
  if (!authKey) return c.json({ error: 'Missing auth key' }, 401);
  const user = await c.env.sorc_db.prepare(
    'SELECT * FROM users WHERE auth_key = ? AND (banned IS NULL OR banned = 0) AND (suspended_until IS NULL OR suspended_until < datetime(\'now\'))'
  ).bind(authKey).first();
  if (!user) return c.json({ error: 'Invalid auth key' }, 401);
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
  const { email, username, firstName, password } = await c.req.json();
  if (!email || !username) return c.json({ error: 'Email and username required' }, 400);
  if (!password || password.length < 6) return c.json({ error: 'Password must be at least 6 characters' }, 400);
  if (!/^[a-zA-Z0-9-]+$/.test(username)) return c.json({ error: 'Username can only contain letters, numbers, and hyphens' }, 400);
  const existingUser = await c.env.sorc_db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').bind(email, username).first();
  if (existingUser) return c.json({ error: 'Email or username already exists' }, 400);
  const passwordHash = await hashPassword(password);
  const authKey = crypto.randomUUID();
  const verificationToken = crypto.randomUUID();
  const userId = Math.floor(Math.random() * 90000) + 10000;
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
  if (!token) return c.json({ error: 'Missing token' }, 400);
  const user = await c.env.sorc_db.prepare('SELECT * FROM users WHERE verification_token = ?').bind(token).first() as any;
  if (!user) return c.json({ error: 'Invalid or expired token' }, 400);
  await c.env.sorc_db.prepare('UPDATE users SET email_verified = TRUE, verification_token = NULL WHERE id = ?').bind(user.id).run();
  return c.redirect('https://sorcrpg.com/signin?verified=true');
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
  const { email, username, password } = await c.req.json();
  if (!email && !username) return c.json({ error: 'Email or username required' }, 400);
  if (!password) return c.json({ error: 'Invalid credentials' }, 401);
  const user = await c.env.sorc_db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').bind(email || '', username || '').first() as any;
  if (!user) return c.json({ error: 'Invalid credentials' }, 401);
  if (!user.password_hash) return c.json({ error: 'Invalid credentials' }, 401);
  const passwordValid = await verifyPassword(password, user.password_hash);
  if (!passwordValid) return c.json({ error: 'Invalid credentials' }, 401);
  if (!user.email_verified) {
    return c.json({ error: 'Please verify your email before signing in. Check your spam folder if you did not receive it.', unverified: true }, 403);
  }
  const authKey = crypto.randomUUID();
  await c.env.sorc_db.prepare('UPDATE users SET auth_key = ? WHERE id = ?').bind(authKey, user.id).run();
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

app.get('/api/profile/:userId', async (c) => {
  const userId = c.req.param('userId');
  try {
    const user = await c.env.sorc_db.prepare(`SELECT id, username, display_name, first_name, surname, prefix, suffix, avatar, bio, role, community_points, post_count, titles, join_date, last_seen, created_at, email_verified FROM users WHERE id = ? OR username = ?`).bind(userId, userId).first();
    if (!user) return c.json({ error: 'User not found' }, 404);
    return c.json({ user });
  } catch (error: any) {
    return c.json({ error: 'Failed to load profile', details: error.message }, 500);
  }
});

app.put('/api/profile', authMiddleware, async (c) => {
  const updates = await c.req.json();
  const user = c.get('user') as any;
  const allowedFields = ['display_name', 'first_name', 'surname', 'prefix', 'suffix', 'bio', 'avatar', 'website', 'social_twitter', 'social_twitch', 'signature'];
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
    const receiver = await c.env.sorc_db.prepare('SELECT id, username, display_name FROM users WHERE id = ?').bind(receiver_uid).first() as any;
    if (!receiver) return c.json({ error: 'User not found' }, 404);
    const existing = await c.env.sorc_db.prepare(
      `SELECT id FROM fellowships WHERE ((sender_uid = ? AND receiver_uid = ?) OR (sender_uid = ? AND receiver_uid = ?)) AND status IN ('pending','accepted')`
    ).bind(user.id, receiver_uid, receiver_uid, user.id).first();
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

export default app;
