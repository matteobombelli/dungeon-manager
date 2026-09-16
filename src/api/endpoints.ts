import type {
  Asset,
  Campaign,
  CampaignCreate,
  CampaignUpdate,
  LoginBody,
  Prefab,
  PrefabCreate,
  PrefabUpdate,
  RegisterBody,
  Scene,
  SceneCreate,
  SceneLink,
  SceneUpdate,
  User,
} from "../../shared/api";
import { API_PREFIX } from "../../shared/api";
import type { CampaignGraph } from "../../shared/campaign-graph";
import type { Graph } from "../../shared/graph";
import { api } from "./client";

export const auth = {
  me: () => api<{ user: User }>("/auth/me").then((r) => r.user),
  login: (body: LoginBody) => api<{ user: User }>("/auth/login", { body }).then((r) => r.user),
  register: (body: RegisterBody) => api<{ user: User }>("/auth/register", { body }).then((r) => r.user),
  logout: () => api<void>("/auth/logout", { method: "POST" }),
};

export const campaigns = {
  list: () => api<{ campaigns: Campaign[] }>("/campaigns").then((r) => r.campaigns),
  create: (body: CampaignCreate) => api<{ campaign: Campaign }>("/campaigns", { body }).then((r) => r.campaign),
  get: (id: string) => api<{ campaign: Campaign; scenes: Scene[]; links: SceneLink[] }>(`/campaigns/${id}`),
  update: (id: string, body: CampaignUpdate) =>
    api<{ campaign: Campaign }>(`/campaigns/${id}`, { method: "PATCH", body }).then((r) => r.campaign),
  remove: (id: string) => api<void>(`/campaigns/${id}`, { method: "DELETE" }),
  createScene: (campaignId: string, body: SceneCreate) =>
    api<{ scene: Scene }>(`/campaigns/${campaignId}/scenes`, { body }).then((r) => r.scene),
  putGraph: (id: string, graph: CampaignGraph) =>
    api<{ updatedAt: number }>(`/campaigns/${id}/graph`, { method: "PUT", body: graph }),
};

export const scenes = {
  get: (id: string) => api<{ scene: Scene; graph: Graph }>(`/scenes/${id}`),
  update: (id: string, body: SceneUpdate) =>
    api<{ scene: Scene }>(`/scenes/${id}`, { method: "PATCH", body }).then((r) => r.scene),
  remove: (id: string) => api<void>(`/scenes/${id}`, { method: "DELETE" }),
  putGraph: (id: string, graph: Graph) =>
    api<{ updatedAt: number }>(`/scenes/${id}/graph`, { method: "PUT", body: graph }),
};

export const prefabs = {
  list: () => api<{ prefabs: Prefab[] }>("/prefabs").then((r) => r.prefabs),
  create: (body: PrefabCreate) => api<{ prefab: Prefab }>("/prefabs", { body }).then((r) => r.prefab),
  update: (id: string, body: PrefabUpdate) =>
    api<{ prefab: Prefab }>(`/prefabs/${id}`, { method: "PATCH", body }).then((r) => r.prefab),
  remove: (id: string) => api<void>(`/prefabs/${id}`, { method: "DELETE" }),
};

export const assets = {
  upload: (file: File) =>
    api<{ asset: Asset }>("/assets", {
      method: "POST",
      raw: file,
      headers: { "Content-Type": file.type },
    }).then((r) => r.asset),
  url: (id: string) => `${API_PREFIX}/assets/${id}`,
  remove: (id: string) => api<void>(`/assets/${id}`, { method: "DELETE" }),
};
