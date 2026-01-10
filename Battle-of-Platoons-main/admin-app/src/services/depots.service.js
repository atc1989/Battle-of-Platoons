import { supabase } from "./supabase";

export async function listDepots() {
  const { data, error } = await supabase.from("depots").select("*").order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function upsertDepot(id, data) {
  const payload = {
    id,
    name: data?.name ?? "",
    photoURL: (data?.photoURL ?? "").trim() || null,
  };

  const { error } = await supabase.from("depots").upsert(payload, { onConflict: "id" });
  if (error) throw error;
}
