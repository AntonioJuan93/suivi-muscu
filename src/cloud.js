import { supabase } from "./supabase";

export function clearCloudCache() {}

export async function loadCloud() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("tracker")
    .select("data")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) return null;
  return data.data;
}

export async function saveCloud(appData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("tracker")
    .upsert(
      { user_id: user.id, data: appData, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
}

export async function createBackup(appData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("backups").insert({ user_id: user.id, data: appData });
  // Keep only last 8 backups
  const { data: all } = await supabase
    .from("backups")
    .select("id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (all && all.length > 8) {
    const toDelete = all.slice(8).map(b => b.id);
    await supabase.from("backups").delete().in("id", toDelete);
  }
}

export async function listBackups() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("backups")
    .select("id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function restoreBackup(id) {
  const { data } = await supabase
    .from("backups")
    .select("data")
    .eq("id", id)
    .single();
  return data?.data || null;
}

export async function searchUserByEmail(email) {
  const { data, error } = await supabase
    .from("tracker")
    .select("data")
    .filter("data->>email", "eq", email.toLowerCase().trim())
    .maybeSingle();
  if (error || !data) return null;
  return data.data;
}

export async function fetchAllUsers() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("tracker")
    .select("data->>email");
  if (error || !data) return [];
  return data
    .map(r => r.email)
    .filter(e => e && e !== user.email);
}
