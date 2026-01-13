import { supabase } from "./supabase";

export async function getMyProfile() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("No authenticated user found");

  const { data, error } = await supabase
    .from("profiles")
    .select("role,depot_id")
    .eq("user_id", user.id)
    .single();

  if (error) throw error;
  return data ?? { role: null, depot_id: null };
}
