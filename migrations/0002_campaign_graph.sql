-- Dungeon Manager v1.1: the campaign becomes a directed graph of scenes.
-- Existing scenes land at (0,0); the client treats that as unplaced and lets the layout seed them.

ALTER TABLE scenes ADD COLUMN x REAL NOT NULL DEFAULT 0;
ALTER TABLE scenes ADD COLUMN y REAL NOT NULL DEFAULT 0;

CREATE TABLE scene_links (
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  source TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  target TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (campaign_id, id)
);

CREATE INDEX idx_scene_links_source ON scene_links(source);
CREATE INDEX idx_scene_links_target ON scene_links(target);
