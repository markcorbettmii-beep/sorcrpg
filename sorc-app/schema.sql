CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  auth_key TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  first_name TEXT,
  surname TEXT,
  prefix TEXT DEFAULT '',
  suffix TEXT DEFAULT '',
  avatar TEXT,
  bio TEXT DEFAULT '',
  website TEXT DEFAULT '',
  social_twitter TEXT DEFAULT '',
  social_instagram TEXT DEFAULT '',
  birthday TEXT,
  role TEXT DEFAULT 'CIVILIAN',
  community_points INTEGER DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  titles TEXT DEFAULT '[]',
  join_date TEXT,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_bonus_at TIMESTAMP,
  username_changed BOOLEAN DEFAULT FALSE,
  user_id INTEGER UNIQUE,
  unlocked_fellowships BOOLEAN DEFAULT FALSE,
  unlocked_basic BOOLEAN DEFAULT FALSE,
  unlocked_surname BOOLEAN DEFAULT FALSE,
  unlocked_prefix_suffix BOOLEAN DEFAULT FALSE,
  unlocked_pro BOOLEAN DEFAULT FALSE,
  is_pro BOOLEAN DEFAULT FALSE,
  privacy_email BOOLEAN DEFAULT TRUE,
  privacy_birthday BOOLEAN DEFAULT TRUE,
  privacy_bio BOOLEAN DEFAULT TRUE,
  privacy_social BOOLEAN DEFAULT TRUE,
  last_thread_points_date TEXT,
  last_reply_points_date TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_auth_key ON users(auth_key);
CREATE INDEX idx_users_username ON users(username);
CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author_uid TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT DEFAULT 'CIVILIAN',
  views INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  liked_by TEXT DEFAULT '[]',
  pinned BOOLEAN DEFAULT FALSE,
  locked BOOLEAN DEFAULT FALSE,
  edited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_reply_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_reply_by TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_uid) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_threads_category ON threads(category_id);
CREATE INDEX idx_threads_author ON threads(author_uid);
CREATE INDEX idx_threads_created ON threads(created_at);
CREATE INDEX idx_threads_pinned_last_reply ON threads(pinned DESC, last_reply_at DESC);
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  body TEXT NOT NULL,
  author_uid TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT DEFAULT 'CIVILIAN',
  like_count INTEGER DEFAULT 0,
  liked_by TEXT DEFAULT '[]',
  edited BOOLEAN DEFAULT FALSE,
  quoted_text TEXT,
  quoted_author TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
  FOREIGN KEY (author_uid) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_posts_thread ON posts(thread_id);
CREATE INDEX idx_posts_author ON posts(author_uid);
CREATE INDEX idx_posts_created ON posts(created_at);
