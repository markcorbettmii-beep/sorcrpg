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

CREATE TABLE IF NOT EXISTS fellowships (
  id TEXT PRIMARY KEY,
  sender_uid TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  receiver_uid TEXT NOT NULL,
  receiver_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  FOREIGN KEY (sender_uid) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_uid) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_fellowships_sender ON fellowships(sender_uid);
CREATE INDEX idx_fellowships_receiver ON fellowships(receiver_uid);
CREATE INDEX idx_fellowships_status ON fellowships(status);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user1_uid TEXT NOT NULL,
  user2_uid TEXT NOT NULL,
  user1_name TEXT NOT NULL,
  user2_name TEXT NOT NULL,
  last_message_text TEXT,
  last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user1_uid) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user2_uid) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_conversations_user1 ON conversations(user1_uid);
CREATE INDEX idx_conversations_user2 ON conversations(user2_uid);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_uid TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_uid) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_uid);
CREATE INDEX idx_messages_created ON messages(created_at);
