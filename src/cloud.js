import { supabase } from "./supabase";

// Cache the row ID so we don't re-query on every save
let rowId = null;

export function clearCloudCache() {
  rowId = null;
}

export async function loadCloud() {
  const { data, error } = await supabase
    .from("tracker")
    .select("id, data")
    .maybeSingle();
  if (error || !data) return null;
  rowId = data.id;
  return data.data;
}

export async function saveCloud(appData) {
  if (rowId) {
    await supabase
      .from("tracker")
      .update({ data: appData, updated_at: new Date().toISOString() })
      .eq("id", rowId);
  } else {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("tracker")
      .insert({ user_id: user.id, data: appData })
      .select("id")
      .single();
    if (data) rowId = data.id;
  }
}
