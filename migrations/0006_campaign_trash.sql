-- Dungeon Manager v1.4: deleting a campaign moves it to the trash. NULL means live.

ALTER TABLE campaigns ADD COLUMN deleted_at INTEGER;
