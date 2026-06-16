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
