const API_BASE =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    (import.meta.env as { VITE_API_URL?: string }).VITE_API_URL) ||
  "";

type RequestOptions = Omit<RequestInit, "body"> & { body?: object };

async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const { body, ...init } = options ?? {};
  const fetchOptions: RequestInit = {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
    body:
      body !== undefined ? JSON.stringify(body) : (init as RequestInit).body,
  };
  const res = await fetch(`${API_BASE}${path}`, fetchOptions);
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};
  if (!res.ok) {
    const msg = (data as { error?: string }).error || `${res.status} ${res.statusText}` || "Request failed";
    throw new Error(msg);
  }
  return data as T;
}

export interface ConfigApi {
  saveFolder: string;
  vehiclesDbPath: string;
  playersDbPath: string;
  vehiclesDbPathOverride: string;
  playersDbPathOverride: string;
}

export interface VehicleRow {
  id: number;
  x?: number | null;
  y?: number | null;
  type: string;
  extracted?: { vehicleType?: string; partNames?: string[]; customNames?: string[] };
  raw?: number[];
}

export interface PlayerRow {
  id: number;
  x?: number | null;
  y?: number | null;
  z?: number | null;
  name?: string | null;
  username?: string | null;
  profession?: string | null;
  traits?: string[];
  recipeIds?: string[];
  extracted?: {
    usernameFromBuffer?: string;
    characterNames?: string[];
    professionIds?: string[];
    traitOrSkillIds?: string[];
    statNames?: string[];
    appearance?: string[];
    clothingTypes?: string[];
    clothingCustomNames?: string[];
    inventoryStrings?: string[];
    recipeIds?: string[];
    skillXp?: Record<string, unknown>;
  };
  raw?: number[];
}

export interface BrowseEntry {
  name: string;
  isDirectory: boolean;
}

export interface BrowseResponse {
  path: string;
  entries: BrowseEntry[];
}

export function getConfig(): Promise<ConfigApi> {
  return request<ConfigApi>("/api/config");
}

export function putConfig(body: {
  saveFolder?: string;
  vehiclesDbPath?: string;
  playersDbPath?: string;
}): Promise<ConfigApi> {
  return request<ConfigApi>("/api/config", { method: "PUT", body });
}

export function postSync(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/sync", { method: "POST" });
}

export function getVehicles(): Promise<VehicleRow[]> {
  return request<VehicleRow[]>("/api/vehicles");
}

export function getVehicleById(id: number | string): Promise<VehicleRow> {
  return request<VehicleRow>(`/api/vehicles/${id}`);
}

export function getPlayers(): Promise<PlayerRow[]> {
  return request<PlayerRow[]>("/api/players");
}

export function getPlayerById(id: number | string): Promise<PlayerRow> {
  return request<PlayerRow>(`/api/players/${id}`);
}

export function uploadVehicles(content: string): Promise<{ ok: boolean; path?: string }> {
  return request("/api/upload/vehicles", { method: "POST", body: { content } });
}

export function uploadPlayers(content: string): Promise<{ ok: boolean; path?: string }> {
  return request("/api/upload/players", { method: "POST", body: { content } });
}

export function browse(path: string): Promise<BrowseResponse> {
  const q = encodeURIComponent(path);
  return request<BrowseResponse>(`/api/browse?path=${q}`);
}
