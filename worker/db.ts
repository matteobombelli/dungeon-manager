import type { Campaign, Scene } from "../shared/api";
import { HttpError } from "./router";

export interface CampaignRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface SceneRow {
  id: string;
  campaign_id: string;
  user_id: string;
  name: string;
  x: number;
  y: number;
  color: string | null;
  created_at: number;
  updated_at: number;
}

// Resources owned by someone else are indistinguishable from missing ones.
function found<T>(row: T | null): T {
  if (!row) throw new HttpError(404, "Not found");
  return row;
}

// A trashed campaign reads as missing; only restore and permanent delete look one up, with getCampaignTrashed.
export async function getCampaignOwned(db: D1Database, id: string, userId: string): Promise<CampaignRow> {
  return found(
    await db
      .prepare(
        "SELECT id, user_id, name, description, created_at, updated_at, deleted_at FROM campaigns WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
      )
      .bind(id, userId)
      .first<CampaignRow>(),
  );
}

export async function getCampaignTrashed(db: D1Database, id: string, userId: string): Promise<CampaignRow> {
  return found(
    await db
      .prepare(
        "SELECT id, user_id, name, description, created_at, updated_at, deleted_at FROM campaigns WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL",
      )
      .bind(id, userId)
      .first<CampaignRow>(),
  );
}

export async function getSceneOwned(db: D1Database, id: string, userId: string): Promise<SceneRow> {
  return found(
    await db
      .prepare(
        "SELECT s.id, s.campaign_id, s.user_id, s.name, s.x, s.y, s.color, s.created_at, s.updated_at FROM scenes s JOIN campaigns c ON c.id = s.campaign_id WHERE s.id = ? AND s.user_id = ? AND c.deleted_at IS NULL",
      )
      .bind(id, userId)
      .first<SceneRow>(),
  );
}

export function toCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function toScene(row: SceneRow): Scene {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    name: row.name,
    x: row.x,
    y: row.y,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
