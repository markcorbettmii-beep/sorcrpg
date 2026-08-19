CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  auth_key TEXT UNIQUE NOT NULL,
  auth_key_expires_at TIMESTAMP,
  reset_token TEXT,
  reset_token_expires_at TIMESTAMP,
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
  social_twitch TEXT DEFAULT '',
  signature TEXT DEFAULT '',
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
  email_verified BOOLEAN DEFAULT FALSE,
  verification_token TEXT,
  password_hash TEXT,
  unlocked_features TEXT DEFAULT '[]',
  admin_invited BOOLEAN DEFAULT FALSE,
  banned BOOLEAN DEFAULT FALSE,
  ban_reason TEXT DEFAULT '',
  suspended_until TIMESTAMP,
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
  status TEXT DEFAULT 'pending',
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

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_preview TEXT,
  reason TEXT,
  reporter_uid TEXT,
  reporter_name TEXT,
  report_count INTEGER DEFAULT 1,
  dismissed INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_reports_target ON reports(target_id);
CREATE INDEX idx_reports_dismissed ON reports(dismissed);

CREATE TABLE IF NOT EXISTS blocks (
  id TEXT PRIMARY KEY,
  blocker_uid TEXT NOT NULL,
  blocked_uid TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (blocker_uid) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_uid) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(blocker_uid, blocked_uid)
);
CREATE INDEX idx_blocks_blocker ON blocks(blocker_uid);
CREATE INDEX idx_blocks_blocked ON blocks(blocked_uid);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_rate_limits_key ON rate_limits(key);
CREATE INDEX idx_rate_limits_created ON rate_limits(created_at);

CREATE TABLE IF NOT EXISTS lobby_dms (
  id TEXT PRIMARY KEY,
  lobby_id TEXT NOT NULL,
  sender_uid TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  recipient_uid TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lobby_dms_lobby ON lobby_dms(lobby_id);
CREATE INDEX IF NOT EXISTS idx_lobby_dms_participant ON lobby_dms(lobby_id, recipient_uid);
CREATE INDEX IF NOT EXISTS idx_lobby_dms_sender ON lobby_dms(lobby_id, sender_uid);

-- ===== LOBBIES (Campaign Lobbies) =====
CREATE TABLE IF NOT EXISTS lobbies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  creator_uid TEXT NOT NULL,
  creator_name TEXT NOT NULL,
  lobby_code TEXT UNIQUE NOT NULL,
  is_private BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active',
  member_count INTEGER DEFAULT 1,
  max_members INTEGER DEFAULT 20,
  module TEXT,
  theme TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_uid) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_lobbies_creator ON lobbies(creator_uid);
CREATE INDEX idx_lobbies_code ON lobbies(lobby_code);
CREATE INDEX idx_lobbies_status ON lobbies(status);
CREATE INDEX idx_lobbies_is_private ON lobbies(is_private);
CREATE INDEX idx_lobbies_created ON lobbies(created_at);

-- ===== ROOMS (Campaign Rooms within Lobbies) =====
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  lobby_id TEXT NOT NULL,
  name TEXT NOT NULL,
  gm_uid TEXT NOT NULL,
  gm_name TEXT NOT NULL,
  is_hidden BOOLEAN DEFAULT FALSE,
  spectate_enabled BOOLEAN DEFAULT TRUE,
  member_count INTEGER DEFAULT 1,
  max_players INTEGER DEFAULT 20,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lobby_id) REFERENCES lobbies(id) ON DELETE CASCADE,
  FOREIGN KEY (gm_uid) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_rooms_lobby ON rooms(lobby_id);
CREATE INDEX idx_rooms_gm ON rooms(gm_uid);
CREATE INDEX idx_rooms_created ON rooms(created_at);

-- ===== ROOM MEMBERS =====
CREATE TABLE IF NOT EXISTS room_members (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'PLAYER',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(room_id, user_id)
);
CREATE INDEX idx_room_members_room ON room_members(room_id);
CREATE INDEX idx_room_members_user ON room_members(user_id);

-- ===== ROOM MESSAGES (Chat) =====
CREATE TABLE IF NOT EXISTS room_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_room_messages_room ON room_messages(room_id);
CREATE INDEX idx_room_messages_sender ON room_messages(sender_id);
CREATE INDEX idx_room_messages_created ON room_messages(created_at);

-- ===== ROOM ROLLS (Dice Rolls) =====
CREATE TABLE IF NOT EXISTS room_rolls (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  die_type TEXT NOT NULL,
  result1 INTEGER,
  result2 INTEGER,
  total INTEGER,
  roll_purpose TEXT,
  rolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_room_rolls_room ON room_rolls(room_id);
CREATE INDEX idx_room_rolls_player ON room_rolls(player_id);
CREATE INDEX idx_room_rolls_created ON room_rolls(rolled_at);

-- ===== ROOM REQUESTS (Join/Spectate Requests) =====
CREATE TABLE IF NOT EXISTS room_requests (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  request_type TEXT DEFAULT 'join',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(room_id, user_id, request_type)
);
CREATE INDEX idx_room_requests_room ON room_requests(room_id);
CREATE INDEX idx_room_requests_user ON room_requests(user_id);
CREATE INDEX idx_room_requests_status ON room_requests(status);

-- ===== BOX SET CODES (Physical Product Codes) =====
CREATE TABLE IF NOT EXISTS box_set_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  used_count INTEGER DEFAULT 0,
  max_uses INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP,
  created_by_uid TEXT,
  FOREIGN KEY (created_by_uid) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_box_set_codes_code ON box_set_codes(code);
CREATE INDEX idx_box_set_codes_created ON box_set_codes(created_at);

-- ===== GM CODES (One-time GM Upgrade Codes) =====
CREATE TABLE IF NOT EXISTS gm_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  generated_by_uid TEXT NOT NULL,
  redeemed_by_uid TEXT,
  redeemed_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (generated_by_uid) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (redeemed_by_uid) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_gm_codes_code ON gm_codes(code);
CREATE INDEX idx_gm_codes_generated_by ON gm_codes(generated_by_uid);
CREATE INDEX idx_gm_codes_redeemed_by ON gm_codes(redeemed_by_uid);
CREATE INDEX idx_gm_codes_expires ON gm_codes(expires_at);
