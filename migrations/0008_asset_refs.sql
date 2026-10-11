-- Dungeon Manager: uploaded files are garbage-collected. A scene save records which assets its
-- nodes (and its groups' children) reference; an asset no scene references is marked orphaned by
-- the daily sweep and deleted, row and R2 object, once it has stayed orphaned for the grace period.

CREATE TABLE asset_refs (
  scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  PRIMARY KEY (scene_id, asset_id)
);

CREATE INDEX idx_asset_refs_asset_id ON asset_refs(asset_id);

-- When the sweep first found the asset unreferenced; NULL while something references it.
ALTER TABLE assets ADD COLUMN orphaned_at INTEGER;

-- Backfill from the stored node data. A substring match can only over-count, which keeps an
-- asset longer, never deletes one in use; the next save of each scene makes its rows exact.
INSERT OR IGNORE INTO asset_refs (scene_id, asset_id)
SELECT DISTINCT n.scene_id, a.id
FROM nodes n
JOIN scenes s ON s.id = n.scene_id
JOIN assets a ON a.user_id = s.user_id AND instr(n.data, a.id) > 0;
