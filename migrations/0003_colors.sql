-- Dungeon Manager v1.2: per-scene and per-node colour. NULL means the type's default pastel.

ALTER TABLE scenes ADD COLUMN color TEXT;
ALTER TABLE nodes ADD COLUMN color TEXT;
