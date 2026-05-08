import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono<{ Bindings: Env }>();

interface Env {
  sorc_db: D1Database;
  sorc_files: R2Bucket;
  AVATARS: R2Bucket;
  FORUM_MEDIA: R2Bucket;
  SESSIONS: KVNamespace;
  ASSETS: Fetcher;
  OPENAI_API_KEY: string;
}

app.use('*', cors({
  origin: ['http://localhost:3000', 'https://sorcrpg.com', 'https://www.sorcrpg.com'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
}));

const authMiddleware = async (c: any, next: any) => {
  const authKey = c.req.header('X-Auth-Key');

  if (!authKey) {
    return c.json({ error: 'Missing auth key' }, 401);
  }

  const user = await c.env.sorc_db.prepare(
    'SELECT * FROM users WHERE auth_key = ?'
  ).bind(authKey).first();

  if (!user) {
    return c.json({ error: 'Invalid auth key' }, 401);
  }

  c.set('user', user);
  c.set('authKey', authKey);
  await next();
};

app.post('/api/auth/register', async (c) => {
  const { email, password, username, firstName, accountType } = await c.req.json();

  if (!email || !username) {
    return c.json({ error: 'Email and username required' }, 400);
  }

  if (!/^[a-zA-Z0-9-]+$/.test(username) || username.includes('_')) {
    return c.json({ error: 'Username can only contain letters, numbers, and hyphens' }, 400);
  }

  const existingUser = await c.env.sorc_db.prepare(
    'SELECT id FROM users WHERE email = ? OR username = ?'
  ).bind(email, username).first();

  if (existingUser) {
    return c.json({ error: 'Email or username already exists' }, 400);
  }

  const authKey = btoa(`${email}:${Date.now()}:${Math.random()}`);
  const userId = Math.floor(Math.random() * 90000) + 10000;
  const now = new Date().toISOString();
  const uuid = crypto.randomUUID();

  try {
    await c.env.sorc_db.prepare(`
      INSERT INTO users (
        id, email, auth_key, username, display_name, first_name,
        role, join_date, created_at, updated_at, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      uuid,
      email,
      authKey,
      username,
      firstName || username,
      firstName || '',
      'CIVILIAN',
      now,
      now,
      now,
      userId
    ).run();

    const newUser = await c.env.sorc_db.prepare(
      'SELECT id, email, username, display_name, role, community_points, created_at FROM users WHERE email = ?'
    ).bind(email).first();

    return c.json({
      success: true,
      user: newUser,
      authKey: authKey,
    });
  } catch (error: any) {
    return c.json({ error: 'Registration failed', details: error.message }, 500);
  }
});

app.post('/api/auth/signin', async (c) => {
  const { email, username, password } = await c.req.json();

  if (!email && !username) {
    return c.json({ error: 'Email or username required' }, 400);
  }

  const user = await c.env.sorc_db.prepare(
    'SELECT * FROM users WHERE email = ? OR username = ?'
  ).bind(email || '', username || '').first();

  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const authKey = btoa(`${user.email}:${Date.now()}:${Math.random()}`);

  await c.env.sorc_db.prepare(
    'UPDATE users SET auth_key = ? WHERE id = ?'
  ).bind(authKey, user.id).run();

  return c.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
      community_points: user.community_points,
      created_at: user.created_at
    },
    authKey: authKey
  });
});

app.post('/api/ai/chat', authMiddleware, async (c) => {
  const body = await c.req.json();
  const messages = body.messages;
  const model = body.model || 'gpt-4o-mini';
  const maxTokens = typeof body.max_tokens === 'number' ? body.max_tokens : 500;
  const temperature = typeof body.temperature === 'number' ? body.temperature : 0.7;

  if (!Array.isArray(messages) || messages.length === 0) {
    return c.json({ error: 'messages array is required' }, 400);
  }

  const apiKey = c.env.OPENAI_API_KEY;
  if (!apiKey) {
    return c.json({ error: 'OpenAI API key is not configured' }, 500);
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature })
  });

  const aiData = await response.json();
  return c.json(aiData, response.status);
});

// ========== FORUM ENDPOINTS ==========

app.get('/api/forum/categories', async (c) => {
  try {
    const categories = [
      { id: 'announcements', name: 'News & Announcements', icon: '📣', desc: null, color: '#d0021b', readOnly: true, adminOnly: true },
      { id: 'conduct', name: 'Conduct & Rules', icon: '⚖️', desc: 'The laws of Essentia and the SorC community. Read before you post.', color: '#8B0000', readOnly: true, adminOnly: true },
      { id: 'general', name: 'General Discussion', icon: '💬', desc: 'The heart of the SorC community. Talk about anything and everything.', color: '#333' },
      { id: 'sorc-beyond', name: 'SORC Beyond', icon: '⚡', desc: 'Discuss digital features, online lobbies, and the SORC Beyond platform.', color: '#1a3a6b' },
      { id: 'x-roads', name: 'The X Roads', icon: '🗺', desc: "Where lore, legend, and mystery converge. Share campaign stories, discuss Essentia's history, prophecies, and secrets.", color: '#4a1a6b' },
      { id: 'rules', name: 'Rules & Gameplay Advice', icon: '📖', desc: 'Questions, clarifications, and discussions about SorC mechanics and rules.', color: '#1a4a1a' },
      { id: 'majestic-worlds', name: 'The Majestic Worlds of Essentia', icon: '🌍', desc: 'Harnessing the powers of Adoria, the thirteen worlds of Essentia breathe with magic, war, and wonder.', color: '#1a3a1a' },
      { id: 'tawdry-dwarf', name: 'Tawdry Dwarf & Beyond', icon: '🔭', desc: "Far from Adoria's reach, where magic fades and ingenuity reigns.", color: '#1a1a3a' },
      { id: 'lfg', name: 'Looking for Group', icon: '⚔️', desc: 'Find players and Game Masters for home campaigns and SORC Beyond lobbies.', color: '#3a1a00' }
    ];

    for (const cat of categories as any[]) {
      const threadCount = await c.env.sorc_db.prepare(
        'SELECT COUNT(*) as count FROM threads WHERE category_id = ?'
      ).bind(cat.id).first() as any;

      const lastPost = await c.env.sorc_db.prepare(`
        SELECT t.last_reply_at, t.title, u.username as author_name
        FROM threads t
        JOIN users u ON t.author_uid = u.id
        WHERE t.category_id = ?
        ORDER BY t.last_reply_at DESC
        LIMIT 1
      `).bind(cat.id).first() as any;

      cat.threadCount = threadCount?.count || 0;
      cat.lastPost = lastPost ? {
        time: lastPost.last_reply_at,
        title: lastPost.title,
        author: lastPost.author_name
      } : null;
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
    const threads = await c.env.sorc_db.prepare(`
      SELECT t.*, u.username as author_name, u.display_name, u.role as author_role
      FROM threads t
      JOIN users u ON t.author_uid = u.id
      WHERE t.category_id = ?
      ORDER BY t.pinned DESC, t.last_reply_at DESC
      LIMIT ? OFFSET ?
    `).bind(categoryId, limit, offset).all();

    const totalThreads = await c.env.sorc_db.prepare(
      'SELECT COUNT(*) as count FROM threads WHERE category_id = ?'
    ).bind(categoryId).first() as any;

    return c.json({
      threads: threads.results,
      total: totalThreads.count,
      page,
      totalPages: Math.ceil(totalThreads.count / limit)
    });
  } catch (error: any) {
    return c.json({ error: 'Failed to load threads', details: error.message }, 500);
  }
});

app.get('/api/forum/thread/:threadId', authMiddleware, async (c) => {
  const threadId = c.req.param('threadId');

  try {
    const thread = await c.env.sorc_db.prepare(`
      SELECT t.*, u.username as author_name, u.display_name, u.role as author_role
      FROM threads t
      JOIN users u ON t.author_uid = u.id
      WHERE t.id = ?
    `).bind(threadId).first();

    if (!thread) {
      return c.json({ error: 'Thread not found' }, 404);
    }

    const posts = await c.env.sorc_db.prepare(`
      SELECT p.*, u.username as author_name, u.display_name, u.role as author_role
      FROM posts p
      JOIN users u ON p.author_uid = u.id
      WHERE p.thread_id = ?
      ORDER BY p.created_at ASC
    `).bind(threadId).all();

    await c.env.sorc_db.prepare(
      'UPDATE threads SET views = views + 1 WHERE id = ?'
    ).bind(threadId).run();

    return c.json({ thread, posts: posts.results });
  } catch (error: any) {
    return c.json({ error: 'Failed to load thread', details: error.message }, 500);
  }
});

app.post('/api/forum/thread', authMiddleware, async (c) => {
  const { categoryId, title, body } = await c.req.json();
  const user = c.get('user') as any;

  if (!title || !body) {
    return c.json({ error: 'Title and body required' }, 400);
  }

  try {
    const threadId = crypto.randomUUID();
    const now = new Date().toISOString();

    await c.env.sorc_db.prepare(`
      INSERT INTO threads (id, category_id, title, body, author_uid, author_name, author_role, created_at, last_reply_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(threadId, categoryId, title, body, user.id, user.display_name || user.username, user.role, now, now).run();

    const postId = crypto.randomUUID();
    await c.env.sorc_db.prepare(`
      INSERT INTO posts (id, thread_id, body, author_uid, author_name, author_role, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(postId, threadId, body, user.id, user.display_name || user.username, user.role, now).run();

    await c.env.sorc_db.prepare(
      'UPDATE users SET post_count = post_count + 1 WHERE id = ?'
    ).bind(user.id).run();

    return c.json({ success: true, threadId });
  } catch (error: any) {
    return c.json({ error: 'Failed to create thread', details: error.message }, 500);
  }
});

app.post('/api/forum/post', authMiddleware, async (c) => {
  const { threadId, body } = await c.req.json();
  const user = c.get('user') as any;

  if (!body) {
    return c.json({ error: 'Body required' }, 400);
  }

  try {
    const postId = crypto.randomUUID();
    const now = new Date().toISOString();

    await c.env.sorc_db.prepare(`
      INSERT INTO posts (id, thread_id, body, author_uid, author_name, author_role, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(postId, threadId, body, user.id, user.display_name || user.username, user.role, now).run();

    await c.env.sorc_db.prepare(`
      UPDATE threads SET reply_count = reply_count + 1, last_reply_at = ?, last_reply_by = ? WHERE id = ?
    `).bind(now, user.display_name || user.username, threadId).run();

    await c.env.sorc_db.prepare(
      'UPDATE users SET post_count = post_count + 1 WHERE id = ?'
    ).bind(user.id).run();

    return c.json({ success: true, postId });
  } catch (error: any) {
    return c.json({ error: 'Failed to create post', details: error.message }, 500);
  }
});

// ========== PROFILE ENDPOINTS ==========

app.get('/api/profile/:userId', async (c) => {
  const userId = c.req.param('userId');

  try {
    const user = await c.env.sorc_db.prepare(`
      SELECT id, username, display_name, first_name, surname, prefix, suffix, avatar, bio,
             role, community_points, post_count, titles, join_date, last_seen, created_at
      FROM users WHERE id = ? OR username = ?
    `).bind(userId, userId).first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

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

  if (setParts.length === 0) {
    return c.json({ error: 'No valid fields to update' }, 400);
  }

  try {
    await c.env.sorc_db.prepare(`
      UPDATE users SET ${setParts.join(', ')}, updated_at = ? WHERE id = ?
    `).bind(...values, new Date().toISOString(), user.id).run();

    const updatedUser = await c.env.sorc_db.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(user.id).first();

    return c.json({ success: true, user: updatedUser });
  } catch (error: any) {
    return c.json({ error: 'Failed to update profile', details: error.message }, 500);
  }
});

// ========== EXPORT — API routes first, then static assets ==========
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return app.fetch(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
  }
};
