import { supabase } from "../lib/supabase";

/**
 * Cloud project + asset persistence backed by Supabase.
 *
 * These helpers are all best-effort: when Supabase is not configured (or the
 * user is signed out) they return empty/failed results so the local-first
 * editor keeps working unchanged.
 */

export interface CloudProjectSummary {
  id: string;
  name: string;
  duration: number;
  width: number;
  height: number;
  thumbnailUrl: string | null;
  updatedAt: string;
}

export interface CloudProjectRecord extends CloudProjectSummary {
  document: unknown;
}

/** List the signed-in user's cloud projects, newest first. */
export async function listCloudProjects(): Promise<CloudProjectSummary[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, duration, width, height, thumbnail_url, updated_at")
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id as string,
    name: (row.name as string) ?? "Untitled Project",
    duration: (row.duration as number) ?? 0,
    width: (row.width as number) ?? 1920,
    height: (row.height as number) ?? 1080,
    thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  }));
}

/** Load a single cloud project document by id. */
export async function loadCloudProject(
  id: string,
): Promise<CloudProjectRecord | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id as string,
    name: (data.name as string) ?? "Untitled Project",
    duration: (data.duration as number) ?? 0,
    width: (data.width as number) ?? 1920,
    height: (data.height as number) ?? 1080,
    thumbnailUrl: (data.thumbnail_url as string | null) ?? null,
    updatedAt: (data.updated_at as string) ?? new Date().toISOString(),
    document: data.document,
  };
}

export interface SaveCloudProjectInput {
  /** existing project id to update; omit to create a new one */
  id?: string;
  name: string;
  document: unknown;
  duration?: number;
  width?: number;
  height?: number;
  thumbnailUrl?: string | null;
}

/** Create or update a cloud project. Returns the row id, or null on failure. */
export async function saveCloudProject(
  input: SaveCloudProjectInput,
): Promise<string | null> {
  if (!supabase) return null;
  const { data: userData } = await supabase.auth.getUser();
  const ownerId = userData.user?.id;
  if (!ownerId) return null;

  const row = {
    ...(input.id ? { id: input.id } : {}),
    owner_id: ownerId,
    name: input.name,
    document: input.document as never,
    duration: input.duration ?? 0,
    width: input.width ?? 1920,
    height: input.height ?? 1080,
    thumbnail_url: input.thumbnailUrl ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("projects")
    .upsert(row, { onConflict: "id" })
    .select("id")
    .maybeSingle();
  if (error || !data) return null;
  return data.id as string;
}

/** Delete a cloud project. */
export async function deleteCloudProject(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("projects").delete().eq("id", id);
  return !error;
}

/**
 * Upload a media file to the user's asset bucket and record it. Returns the
 * public/signed path or null on failure.
 */
export async function uploadAsset(
  file: File,
  opts: { projectId?: string; kind?: string } = {},
): Promise<{ path: string; id: string } | null> {
  if (!supabase) return null;
  const { data: userData } = await supabase.auth.getUser();
  const ownerId = userData.user?.id;
  if (!ownerId) return null;

  const safeName = file.name.replace(/[^\w.-]+/g, "_");
  const path = `${ownerId}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("assets")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (uploadError) return null;

  const { data, error } = await supabase
    .from("assets")
    .insert({
      owner_id: ownerId,
      project_id: opts.projectId ?? null,
      name: file.name,
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
      kind: opts.kind ?? file.type.split("/")[0] ?? "file",
    })
    .select("id")
    .maybeSingle();
  if (error || !data) return null;
  return { path, id: data.id as string };
}
