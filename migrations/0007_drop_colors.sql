-- Dungeon Manager v1.5: per-item colours are gone; every scene, node and link uses its type's light/dark default.

ALTER TABLE scenes DROP COLUMN color;
ALTER TABLE nodes DROP COLUMN color;
ALTER TABLE scene_links DROP COLUMN color;
