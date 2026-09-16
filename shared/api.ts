import { z } from "zod";
import { PrefabFieldsSchema, type PrefabField } from "./prefab";

export const APP_BASE = "/projects/dungeon-manager";
export const API_PREFIX = `${APP_BASE}/api`;

const Email = z.string().trim().toLowerCase().pipe(z.email());
const Password = z.string().min(8).max(200);
const Name = z.string().trim().min(1).max(120);
const Description = z.string().max(2000);

// Body types are the wire (input) shape, i.e. what a client sends.
export const RegisterBody = z.object({ email: Email, password: Password, inviteCode: z.string().min(1) });
export type RegisterBody = z.input<typeof RegisterBody>;

export const LoginBody = z.object({ email: Email, password: z.string().min(1).max(200) });
export type LoginBody = z.input<typeof LoginBody>;

export const CampaignCreate = z.object({ name: Name, description: Description.default("") });
export type CampaignCreate = z.input<typeof CampaignCreate>;

export const CampaignUpdate = z.object({ name: Name.optional(), description: Description.optional() });
export type CampaignUpdate = z.input<typeof CampaignUpdate>;

export const SceneCreate = z.object({ name: Name, x: z.number().optional(), y: z.number().optional() });
export type SceneCreate = z.input<typeof SceneCreate>;

export const SceneUpdate = z.object({ name: Name });
export type SceneUpdate = z.input<typeof SceneUpdate>;

export const PrefabCreate = z.object({ name: Name, fields: PrefabFieldsSchema });
export type PrefabCreate = z.input<typeof PrefabCreate>;

export const PrefabUpdate = z.object({ name: Name.optional(), fields: PrefabFieldsSchema.optional() });
export type PrefabUpdate = z.input<typeof PrefabUpdate>;

export interface User {
  id: string;
  email: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface Scene {
  id: string;
  campaignId: string;
  name: string;
  // React Flow top-left position on the campaign canvas.
  x: number;
  y: number;
  // Hex fill or null for the default scene pastel.
  color: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface SceneLink {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface Prefab {
  id: string;
  name: string;
  fields: PrefabField[];
  createdAt: number;
  updatedAt: number;
}

export interface Asset {
  id: string;
  contentType: string;
  size: number;
  // `${API_PREFIX}/assets/${id}`
  url: string;
}
