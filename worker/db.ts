import type { Campaign, Prefab, Scene } from "../shared/api";
import type { PrefabField } from "../shared/prefab";
import { HttpError } from "./router";

export interface CampaignRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  created_at: number;
  updated_at: number;
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

export interface PrefabRow {
  id: string;
  user_id: string;
  name: string;
  fields: string;
  created_at: number;
  updated_at: number;
}

// Resources owned by someone else are indistinguishable from missing ones.
function found<T>(row: T | null): T {
  if (!row) throw new HttpError(404, "Not found");
  return row;
}

export async function getCampaignOwned(db: D1Database, id: string, userId: string): Promise<CampaignRow> {
  return found(
    await db
      .prepare("SELECT id, user_id, name, description, created_at, updated_at FROM campaigns WHERE id = ? AND user_id = ?")
      .bind(id, userId)
      .first<CampaignRow>(),
  );
}

export async function getSceneOwned(db: D1Database, id: string, userId: string): Promise<SceneRow> {
  return found(
    await db
      .prepare("SELECT id, campaign_id, user_id, name, x, y, color, created_at, updated_at FROM scenes WHERE id = ? AND user_id = ?")
      .bind(id, userId)
      .first<SceneRow>(),
  );
}

export async function getPrefabOwned(db: D1Database, id: string, userId: string): Promise<PrefabRow> {
  return found(
    await db
      .prepare("SELECT id, user_id, name, fields, created_at, updated_at FROM prefabs WHERE id = ? AND user_id = ?")
      .bind(id, userId)
      .first<PrefabRow>(),
  );
}

export function toCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

export function toPrefab(row: PrefabRow): Prefab {
  return {
    id: row.id,
    name: row.name,
    fields: JSON.parse(row.fields) as PrefabField[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
