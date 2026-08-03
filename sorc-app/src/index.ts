import { Hono } from 'hono';
import { cors } from 'hono/cors';

// ─── CONTENT FILTER ────────────────────────────────────────────────────────────
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
  AVATARS: R2Bucket;
  FORUM_MEDIA: R2Bucket;
  RESEND_API_KEY: string;
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
  origin: ['https://sorcrpg.com', 'https://www.sorcrpg.com'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowHeaders: ['Content-Type', 'X-Auth-Key'],
  credentials: true,
}));

const authMiddleware = async (c: any, next: any) => {
  const authKey = c.req.header('X-Auth-Key');
  if (!authKey) return c.json({ error: 'Missing auth key' }, 401);
  const user = await c.env.sorc_db.prepare(
    `SELECT * FROM users WHERE auth_key = ?
     AND (banned IS NULL OR banned = 0)
     AND (suspended_until IS NULL OR suspended_until < datetime('now'))
     AND (auth_key_expires_at IS NULL OR auth_key_expires_at > datetime('now'))`
  ).bind(authKey).first() as any;
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
  const newHash = new Uint8Array(bits);
  const storedHash = new Uint8Array(hashHex.match(/.{2}/g)!.map((b: string) => parseInt(b, 16)));
  if (newHash.length !== storedHash.length) return false;
  return crypto.subtle.timingSafeEqual(newHash, storedHash);
}

app.post('/api/auth/register', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const allowed = await checkRateLimit(c.env.sorc_db, `register:${ip}`, 5, 3600);
  if (!allowed) return c.json({ error: 'Too many attempts. Please try again later.' }, 429);
  const { email, username, firstName, password } = await c.req.json();
  if (!email || !username) return c.json({ error: 'Email and username required' }, 400);
  if (email.length > 254) return c.json({ error: 'Email address too long.' }, 400);
  if (username.length > 30) return c.json({ error: 'Username too long (max 30 characters).' }, 400);
  if (firstName && firstName.length > 50) return c.json({ error: 'First name too long (max 50 characters).' }, 400);
  if (!password || password.length < 6) return c.json({ error: 'Password must be at least 6 characters' }, 400);
  if (!/^[a-zA-Z0-9-]+$/.test(username)) return c.json({ error: 'Username can only contain letters, numbers, and hyphens' }, 400);
  const existingUser = await c.env.sorc_db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').bind(email, username).first();
  if (existingUser) return c.json({ error: 'Email or username already exists' }, 400);
  const passwordHash = await hashPassword(password);
  const authKey = crypto.randomUUID();
  const verificationToken = crypto.randomUUID();
  let userId: number = 0;
  for (let attempt = 0; attempt < 10; attempt++) {
    userId = Math.floor(Math.random() * 90000000) + 10000000;
    const clash = await c.env.sorc_db.prepare('SELECT id FROM users WHERE user_id = ?').bind(userId).first();
    if (!clash) break;
    if (attempt === 9) return c.json({ error: 'Registration failed. Please try again.' }, 500);
  }
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
    const threads = await c.env.sorc_db.prepare(`SELECT t.id, t.category_id, t.title, t.body, t.author_uid, t.views, t.reply_count, t.like_count, t.liked_by, t.pinned, t.locked, t.edited, t.created_at, t.last_reply_at, t.last_reply_by, t.updated_at, u.username as author_name, u.display_name, u.role as author_role FROM threads t JOIN users u ON t.author_uid = u.id WHERE t.category_id = ? ORDER BY t.pinned DESC, t.last_reply_at DESC LIMIT ? OFFSET ?`).bind(categoryId, limit, offset).all();
    const totalThreads = await c.env.sorc_db.prepare('SELECT COUNT(*) as count FROM threads WHERE category_id = ?').bind(categoryId).first() as any;
    return c.json({ threads: threads.results, total: totalThreads.count, page, totalPages: Math.ceil(totalThreads.count / limit) });
  } catch (error: any) {
    return c.json({ error: 'Failed to load threads', details: error.message }, 500);
  }
});

app.get("/api/forum/thread/:threadId", async (c) => {
  const threadId = c.req.param('threadId');
  try {
    const thread = await c.env.sorc_db.prepare(`SELECT t.id, t.category_id, t.title, t.body, t.author_uid, t.views, t.reply_count, t.like_count, t.liked_by, t.pinned, t.locked, t.edited, t.created_at, t.last_reply_at, t.last_reply_by, t.updated_at, u.username as author_name, u.display_name, u.role as author_role FROM threads t JOIN users u ON t.author_uid = u.id WHERE t.id = ?`).bind(threadId).first();
    if (!thread) return c.json({ error: 'Thread not found' }, 404);
    const posts = await c.env.sorc_db.prepare(`SELECT p.id, p.thread_id, p.body, p.author_uid, p.like_count, p.liked_by, p.edited, p.quoted_text, p.quoted_author, p.created_at, p.updated_at, u.username as author_name, u.display_name, u.role as author_role FROM posts p JOIN users u ON p.author_uid = u.id WHERE p.thread_id = ? ORDER BY p.created_at ASC`).bind(threadId).all();
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
  const titleCheck = filterContent(title);
  if (titleCheck.blocked) return c.json({ error: titleCheck.reason }, 400);
  const bodyCheck = filterContent(body);
  if (bodyCheck.blocked) return c.json({ error: bodyCheck.reason }, 400);
  try {
    const threadId = crypto.randomUUID();
    const now = new Date().toISOString();
    await c.env.sorc_db.prepare(`INSERT INTO threads (id, category_id, title, body, author_uid, author_name, author_role, created_at, last_reply_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(threadId, categoryId, titleCheck.filtered, bodyCheck.filtered, user.id, user.display_name || user.username, user.role, now, now).run();
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
  const postCheck = filterContent(body);
  if (postCheck.blocked) return c.json({ error: postCheck.reason }, 400);
  try {
    const postId = crypto.randomUUID();
    const now = new Date().toISOString();
    await c.env.sorc_db.prepare(`INSERT INTO posts (id, thread_id, body, author_uid, author_name, author_role, quoted_text, quoted_author, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(postId, threadId, postCheck.filtered, user.id, user.display_name || user.username, user.role, quoted_text || null, quoted_author || null, now).run();
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
    const updatedUser = await c.env.sorc_db.prepare(
      'SELECT id, username, display_name, first_name, surname, prefix, suffix, bio, avatar, website, social_twitter, social_twitch, signature, privacy_email, role, community_points, user_id, join_date, updated_at FROM users WHERE id = ?'
    ).bind(user.id).first();
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
      gm_invite: user.gm_invited === 1 || user.gm_invited === true,
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

app.post('/api/fellowships/accept-by-uid/:uid', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const senderUid = c.req.param('uid');
  try {
    const row = await c.env.sorc_db.prepare(
      `SELECT id FROM fellowships WHERE sender_uid = ? AND receiver_uid = ? AND status = 'pending'`
    ).bind(senderUid, user.id).first() as any;
    if (!row) return c.json({ error: 'No pending request found.' }, 404);
    await c.env.sorc_db.prepare(
      `UPDATE fellowships SET status = 'accepted', accepted_at = ? WHERE id = ?`
    ).bind(new Date().toISOString(), row.id).run();
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
    if (row.status === 'accepted') return c.json({ status: 'accepted', id: row.id });
    return c.json({ status: row.sender_uid === user.id ? 'pending_sent' : 'pending_received', id: row.id });
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
  const editCheck = filterContent(body.trim());
  if (editCheck.blocked) return c.json({ error: editCheck.reason }, 400);
  const filteredBody = editCheck.filtered;
  try {
    const post = await c.env.sorc_db.prepare('SELECT * FROM posts WHERE id = ?').bind(postId).first() as any;
    if (!post) {
      // OP edit — update thread body
      const thread = await c.env.sorc_db.prepare('SELECT * FROM threads WHERE id = ?').bind(postId).first() as any;
      if (!thread) return c.json({ error: 'Post not found' }, 404);
      if (thread.author_uid !== user.id) return c.json({ error: 'Not your post' }, 403);
      await c.env.sorc_db.prepare('UPDATE threads SET body = ?, updated_at = ? WHERE id = ?').bind(filteredBody, new Date().toISOString(), postId).run();
      return c.json({ success: true });
    }
    if (post.author_uid !== user.id) return c.json({ error: 'Not your post' }, 403);
    await c.env.sorc_db.prepare('UPDATE posts SET body = ?, updated_at = ? WHERE id = ?').bind(filteredBody, new Date().toISOString(), postId).run();
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
  const user = await c.env.sorc_db.prepare(
    `SELECT * FROM users WHERE auth_key = ? AND (banned IS NULL OR banned = 0)
     AND (suspended_until IS NULL OR suspended_until < datetime('now'))`
  ).bind(authKey).first() as any;
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  if (user.auth_key_expires_at && new Date(user.auth_key_expires_at) < new Date()) {
    return c.json({ error: 'Session expired', expired: true }, 401);
  }
  if (user.role !== 'ADMIN' && user.role !== 'OWNER') return c.json({ error: 'Not authorized' }, 403);
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

app.put('/api/admin/members/:uid/role', adminMiddleware, async (c) => {
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
  const safeDays = Math.min(Math.max(parseInt(days) || 1, 1), 365);
  const until = new Date(Date.now() + safeDays * 86400000).toISOString();
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

// ─── GM INVITATIONS ────────────────────────────────────────────────────────────

app.post('/api/gm/invitations', authMiddleware, async (c) => {
  const admin = c.get('user') as any;
  if (!isPrivileged(admin)) return c.json({ error: 'Forbidden.' }, 403);
  const { uid } = await c.req.json().catch(() => ({} as any)) as any;
  if (!uid) return c.json({ error: 'uid required.' }, 400);
  try {
    await c.env.sorc_db.prepare(
      `ALTER TABLE users ADD COLUMN gm_invited INTEGER DEFAULT 0`
    ).run().catch(() => {});
    const target = await c.env.sorc_db.prepare(
      `SELECT id, role FROM users WHERE id = ? OR username = ?`
    ).bind(uid, uid).first() as any;
    if (!target) return c.json({ error: 'Member not found.' }, 404);
    if (target.role === 'MASTER') return c.json({ error: 'Already a GM.' }, 400);
    if (target.role !== 'PLAYER') return c.json({ error: 'Member must be a PLAYER first.' }, 400);
    await c.env.sorc_db.prepare(
      `UPDATE users SET gm_invited = 1 WHERE id = ?`
    ).bind(target.id).run();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: 'Failed.', details: error.message }, 500);
  }
});

app.post('/api/gm/invitations/respond', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  const { accept } = await c.req.json().catch(() => ({} as any)) as any;
  await c.env.sorc_db.prepare(`ALTER TABLE users ADD COLUMN gm_invited INTEGER DEFAULT 0`).run().catch(() => {});
  const fresh = await c.env.sorc_db.prepare('SELECT gm_invited FROM users WHERE id = ?').bind(user.id).first() as any;
  if (!fresh || !(fresh.gm_invited === 1 || fresh.gm_invited === true)) {
    return c.json({ error: 'No pending GM invitation.' }, 403);
  }
  const now = new Date().toISOString();
  if (accept) {
    await c.env.sorc_db.prepare(
      `UPDATE users SET role = 'MASTER', sorc_role = 'GM-ADV', gm_invited = 0,
       community_points = community_points + 500, updated_at = ? WHERE id = ?`
    ).bind(now, user.id).run();
    return c.json({ success: true, role: 'MASTER' });
  } else {
    await c.env.sorc_db.prepare(`UPDATE users SET gm_invited = 0, updated_at = ? WHERE id = ?`).bind(now, user.id).run();
    return c.json({ success: true, role: user.role });
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
  // PAGE 1 - Dice, Box Set, Action Resolution
  { q: "When rolling d100, your tens die shows 7 and your ones die shows 3. What is your result?", options: ["37", "73", "3", "7"], answer: 1, page: 1 },
  { q: "What does rolling 00 on the d100 equal?", options: ["0", "10", "50", "100"], answer: 3, page: 1 },
  { q: "When using the D100+D100 system, what is the minimum possible total result?", options: ["1", "2", "10", "0"], answer: 1, page: 1 },
  { q: "What is the maximum possible result when using the D100+D100 system?", options: ["100", "150", "200", "198"], answer: 2, page: 1 },
  { q: "Which two dice combine to form a d100 roll in SORC?", options: ["Two D6s", "Two D10s (tens and ones)", "D20 and D6", "D12 and D8"], answer: 1, page: 1 },
  { q: "When rolling d100, your tens die shows 4 and your ones die shows 0. What is your result?", options: ["4", "400", "40", "100"], answer: 2, page: 1 },
  { q: "When rolling d100, the tens die shows 1 and the ones die shows 0. What is your result?", options: ["1", "100", "10", "01"], answer: 2, page: 1 },
  { q: "When rolling d100, the tens die shows 0 and the ones die shows 5. What is your result?", options: ["50", "0", "15", "5"], answer: 3, page: 1 },
  { q: "What is the maximum possible result on a single d100 roll?", options: ["99", "10", "50", "100"], answer: 3, page: 1 },
  { q: "What is the minimum possible result on a single d100 roll?", options: ["0", "1", "10", "5"], answer: 1, page: 1 },
  { q: "Which die combination is used for Divine and Legendary item drops in SORC?", options: ["1D6", "1D4", "D100 + D100", "2D6"], answer: 2, page: 1 },
  { q: "The D4 is primarily used for which type of roll?", options: ["Damage", "Initiative", "Luck", "Loot"], answer: 2, page: 1 },
  { q: "How many D10 dice are included in the SORC box set?", options: ["4", "6", "8", "10"], answer: 2, page: 1 },
  { q: "How many D6 dice are included in the SORC box set?", options: ["4", "6", "8", "12"], answer: 1, page: 1 },
  { q: "What does DIFS stand for in SORC?", options: ["Defense Index Factor Score", "Damage Infliction Scale", "Difficulty Score", "Dice Influence Factor"], answer: 2, page: 1 },
  { q: "In SORC, a D100 action roll must do what to the DIFS to succeed?", options: ["Fall below it", "Equal exactly", "Meet or exceed it", "Exceed it by at least 5"], answer: 2, page: 1 },
  { q: "What is the rarest item drop rank in SORC?", options: ["Legendary", "Unique", "Divine", "Elite"], answer: 2, page: 1 },
  // PAGE 2 - Races & Character Creation
  { q: "Which color token represents Life (HP)?", options: ["Blue", "Red", "Yellow", "Green"], answer: 1, page: 2 },
  { q: "How many playable races and sub-races are available in SORC?", options: ["20", "30", "40", "50"], answer: 2, page: 2 },
  { q: "How many size categories do SORC races fall into?", options: ["2", "3", "4", "5"], answer: 1, page: 2 },
  { q: "What is the height range for Goliath size races?", options: ["5-7 ft", "7-9 ft", "9-11 ft", "3-5 ft"], answer: 1, page: 2 },
  { q: "What is the height range for Small size races?", options: ["3-4 ft", "2-4 ft", "3-5 ft", "4-6 ft"], answer: 2, page: 2 },
  { q: "In SORC, does a Human's culture (Omne, Nordkin, etc.) affect their base stats?", options: ["Yes, significantly", "Yes, slightly", "No, all humans share the same base stats", "Only in combat"], answer: 2, page: 2 },
  // PAGE 3 - Classes & Abilities
  { q: "What is the maximum number of abilities a character can learn?", options: ["40", "50", "59", "75"], answer: 2, page: 3 },
  { q: "How many main class trees exist in SORC?", options: ["8", "12", "16", "20"], answer: 2, page: 3 },
  { q: "How many paths does each main class tree have?", options: ["2", "3", "4", "5"], answer: 1, page: 3 },
  { q: "At what class level do Path Abilities become available?", options: ["Level 1", "Level 4", "Level 10", "Level 21"], answer: 1, page: 3 },
  { q: "At what class level do Branch Abilities unlock?", options: ["Level 10", "Level 15", "Level 21", "Level 30"], answer: 2, page: 3 },
  { q: "Which classes are restricted from using edged weapons?", options: ["Warlocks and Paladins", "Monks and Clerics", "Bards and Druids", "Rangers and Rogues"], answer: 1, page: 3 },
  { q: "Which class cannot use holy weapons?", options: ["Paladin", "Cleric", "Warlock", "Monk"], answer: 2, page: 3 },
  // PAGE 4 - Cards, Currency, Ranks
  { q: "What is the correct rank order from lowest to highest for ranks 1, 2, and 3?", options: ["Adventurer, Peasant, Pauper", "Pauper, Peasant, Commoner", "Legend, Master, Pauper", "Commoner, Peasant, Pauper"], answer: 1, page: 4 },
  { q: "What rank comes directly after Commoner (rank 3) in SORC?", options: ["Hero", "Peasant", "Adventurer", "Elite"], answer: 2, page: 4 },
  { q: "What is the highest rank a character can achieve in SORC?", options: ["Elite", "Hero", "Master", "Legend"], answer: 3, page: 4 },
  { q: "How many total ranks exist in the SORC rank system?", options: ["5", "6", "7", "8"], answer: 3, page: 4 },
  { q: "What rank comes directly after Hero (rank 5) in SORC?", options: ["Master", "Adventurer", "Legend", "Elite"], answer: 3, page: 4 },
  { q: "Can characters use items of a rank above their own?", options: ["Yes, with a penalty", "Yes, if given by the GM", "No, never", "Only in emergencies"], answer: 2, page: 4 },
  { q: "How many Silver coins equal one Gold coin in SORC?", options: ["10", "25", "50", "100"], answer: 2, page: 4 },
  { q: "How many Silver coins equal one Platinum coin in SORC?", options: ["50", "100", "200", "500"], answer: 1, page: 4 },
  { q: "What card rank is included in a module of levels 1-5?", options: ["Rare", "Uncommon", "Common", "Heroic"], answer: 2, page: 4 },
  { q: "What bonus does a Rare rank armor provide to the base Armor Score?", options: ["+3", "+5", "+8", "+10"], answer: 1, page: 4 },
  // PAGE 5 - Attributes, Vitality, Traits, Combat, Movement
  { q: "How many Attributes exist in SORC?", options: ["5", "6", "7", "8"], answer: 2, page: 5 },
  { q: "What is the maximum score any single Attribute can reach?", options: ["20", "25", "30", "50"], answer: 2, page: 5 },
  { q: "What does PROTS stand for in SORC?", options: ["Power Rating Over Target Score", "Protection Score", "Primary Roll Threshold", "Passive Resistance Stat"], answer: 1, page: 5 },
  { q: "What roll result counts as a Critical Hit in SORC?", options: ["Natural 1", "Natural 99", "Natural 100", "Any roll of 95+"], answer: 2, page: 5 },
  { q: "How much damage does a Critical Hit deal?", options: ["1.5x damage", "2x damage dice", "3x damage dice", "Instant incapacitation"], answer: 1, page: 5 },
  { q: "Which Traits are used in the Initiative formula?", options: ["Strength, Defense, Courage", "Agility, Vigilance, Luck", "Dexterity, Wit, Spirit", "Toughness, Constitution, Willpower"], answer: 1, page: 5 },
  { q: "How many real-time seconds does each combat turn represent in SORC?", options: ["3", "6", "10", "12"], answer: 1, page: 5 },
  { q: "How much time does each player have per turn before it is forfeited?", options: ["30 seconds", "1 minute", "2 minutes", "5 minutes"], answer: 2, page: 5 },
  { q: "What is the base movement speed for Standard size races?", options: ["25 ft", "30 ft", "35 ft", "40 ft"], answer: 1, page: 5 },
  { q: "What is the base movement speed for Goliath size races?", options: ["30 ft", "35 ft", "40 ft", "50 ft"], answer: 2, page: 5 },
  { q: "Which Trait determines how fast Life, Mana, Stamina, and Endurance regenerate?", options: ["Apex", "Spirit", "Willpower", "Focus"], answer: 1, page: 5 },
  { q: "Which Trait sets the maximum cap (Extent) for each Vitality resource?", options: ["Spirit", "Apex", "Capacity", "Knowledge"], answer: 1, page: 5 },
  { q: "What color chips represent Mana in SORC?", options: ["Red", "Blue", "Yellow", "Green"], answer: 1, page: 5 },
  { q: "What color chips represent Stamina in SORC?", options: ["Red", "Blue", "Yellow", "Green"], answer: 2, page: 5 },
  { q: "In SORC's armor system, when does an attack successfully hit?", options: ["When the roll is lower than PROTS", "When the roll equals zero", "When the roll equals or exceeds PROTS", "When the roll is a natural 1"], answer: 2, page: 5 },
  { q: "What does the abbreviation 'AS' stand for in SORC?", options: ["Attack Speed", "Armor Set", "Action Score", "Armor Score"], answer: 3, page: 5 },
  { q: "What is the base Armor Score (AS) of Heavy (Plate) armor?", options: ["25", "35", "40", "45"], answer: 3, page: 5 },
  { q: "What does LST stand for in SORC combat?", options: ["Long-range Stealth Training", "Limb-Specific Targeting", "Light Strike Technique", "Luck Saving Throw"], answer: 1, page: 5 },
  { q: "The maximum load a character can carry is determined by which formula?", options: ["STR x 10 lbs", "STR x 15 lbs", "STR x 20 lbs", "STR x 25 lbs"], answer: 1, page: 5 },
];

const ASSESSMENT_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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
  let expired = false;
  let expires_at: string | null = null;
  if (result) {
    const takenMs = new Date(result.taken_at).getTime();
    expires_at = new Date(takenMs + ASSESSMENT_EXPIRY_MS).toISOString();
    expired = Date.now() > takenMs + ASSESSMENT_EXPIRY_MS;
  }
  return c.json({ assessment: result || null, expired, expires_at, needs_reassess: !!(user.needs_reassess) });
});

app.get('/api/assess/questions', authMiddleware, async (c) => {
  const pool = ASSESSMENT_QUESTIONS.map((q, i) => ({ ...q, id: i }));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const questions = pool.slice(0, 10).map(q => ({
    id: q.id,
    q: q.q,
    options: q.options,
    page: q.page
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
  /* Allow overwrite when flagged for reassessment (expiry or incompetence) */
  if (existing && !user.needs_reassess) return c.json({ error: 'Already assessed. Use reassess to retake.' }, 400);
  if (existing && user.needs_reassess) {
    await c.env.sorc_db.prepare(`DELETE FROM assessments WHERE user_id = ?`).bind(user.id).run();
  }

  const { answers, gm_track } = await c.req.json() as any;
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

  const role = calcSorcRole(score, !!gm_track);
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
    return c.json({ score, role: 'FAIL', passed: false, message: 'Score too low — you have been downgraded to Civilian. Study the Basic Rules and reassess to regain lobby access.' });
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

    return c.json({ score, role, site_role: preserveRole ? user.role : siteRole, passed: true, points_awarded: pointsAwarded });
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

// ─── BOX CODE GENERATION (admin/owner only) ────────────────────────────────────

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

// ─── WORLD CHAT ──────────────────────────────────────────────────────────────

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

    // Must be the active creator of an open lobby, or posting a short LFG: tag
    const lobby = await c.env.sorc_db.prepare(
      `SELECT id, name FROM lobbies WHERE creator_uid = ? AND status != 'closed' ORDER BY created_at DESC LIMIT 1`
    ).bind(user.id).first() as any;
    const isHost = !!(lobby || isPrivileged(user));
    if (!isHost) {
      if (!/^LFG:/i.test(body.trim())) return c.json({ error: 'Only active lobby hosts can post freely. Use LFG: to advertise yourself.' }, 403);
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

// ===== READY CHECK =====
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

// ===== LOBBY DIRECT MESSAGES =====
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
  const roomMsgCheck = filterContent(body.trim());
  if (roomMsgCheck.blocked) return c.json({ error: roomMsgCheck.reason }, 400);
  const now = new Date().toISOString();
  await c.env.sorc_db.prepare(
    `INSERT INTO room_messages (id, room_id, user_id, username, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), roomId, user.id, user.username, roomMsgCheck.filtered, now).run();
  return c.json({ success: true });
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

// ─── GENERATED CODE LISTING (admin only) ─────────────────────────────────────

app.get('/api/box-codes/generated', authMiddleware, async (c) => {
  const user = c.get('user') as any;
  if (!isPrivileged(user)) return c.json({ error: 'Forbidden.' }, 403);
  try {
    await c.env.sorc_db.prepare(`ALTER TABLE box_set_codes ADD COLUMN expires_at TEXT`).run().catch(() => {});
    const codes = await c.env.sorc_db.prepare(
      `SELECT code, created_at, expires_at, owner_uid, claimed_at
       FROM box_set_codes
       WHERE code LIKE 'GEN%BSC'
       ORDER BY created_at DESC LIMIT 100`
    ).all();
    return c.json({ codes: codes.results || [] });
  } catch (e: any) {
    return c.json({ error: 'Failed to fetch codes.', details: e.message }, 500);
  }
});

// ─── SCHEDULED: rotate GEN codes every 2 days ────────────────────────────────

async function rotateGeneratedCodes(db: D1Database) {
  await db.prepare(`ALTER TABLE box_set_codes ADD COLUMN expires_at TEXT`).run().catch(() => {});

  const now = new Date().toISOString();

  // Expire all unclaimed GEN codes
  await db.prepare(
    `UPDATE box_set_codes SET expires_at = ? WHERE code LIKE 'GEN%BSC' AND (owner_uid IS NULL) AND (expires_at IS NULL OR expires_at > ?)`
  ).bind(now, now).run();

  // Generate a fresh batch of 10 codes valid for 48 hours
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const expiresAt = new Date(Date.now() + 2 * 86400000).toISOString();
  for (let n = 0; n < 10; n++) {
    const rng = crypto.getRandomValues(new Uint8Array(6));
    let code = 'GEN';
    for (let i = 0; i < 6; i++) code += rng[i] % 10;
    code += 'BSC';
    await db.prepare(
      `INSERT OR IGNORE INTO box_set_codes (id, code, created_by, note, created_at, expires_at) VALUES (?, ?, 'system', 'auto-generated', ?, ?)`
    ).bind(crypto.randomUUID(), code, now, expiresAt).run();
  }
}

export default {
  fetch: app.fetch,
  async scheduled(_event: any, env: Env, _ctx: any) {
    await rotateGeneratedCodes(env.sorc_db);
  },
};

