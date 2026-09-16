-- Dungeon Manager v1 schema.
-- Ids are TEXT UUIDs, timestamps INTEGER unix milliseconds.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- id is hex(sha256(session token)); the raw token only ever lives in the cookie.
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_campaigns_user_created ON campaigns(user_id, created_at DESC);

-- user_id is denormalised from campaigns so ownership checks are one query.
CREATE TABLE scenes (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_scenes_campaign_created ON scenes(campaign_id, created_at DESC);
CREATE INDEX idx_scenes_user_id ON scenes(user_id);

CREATE TABLE nodes (
  scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  type TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  data TEXT NOT NULL,
  sort INTEGER NOT NULL,
  PRIMARY KEY (scene_id, id)
);

CREATE TABLE edges (
  scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (scene_id, id),
  FOREIGN KEY (scene_id, source) REFERENCES nodes(scene_id, id) ON DELETE CASCADE,
  FOREIGN KEY (scene_id, target) REFERENCES nodes(scene_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_edges_source ON edges(scene_id, source);
CREATE INDEX idx_edges_target ON edges(scene_id, target);

CREATE TABLE prefabs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  fields TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_prefabs_user_created ON prefabs(user_id, created_at DESC);

-- r2_key is users/{user_id}/{id}.{ext}
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_assets_user_id ON assets(user_id);
