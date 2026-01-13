import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://tkqkamywlsjdkpfeljrg.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrcWthbXl3bHNqZGtwZmVsanJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MjU5ODEsImV4cCI6MjA4MTQwMTk4MX0.1Qiq6RlwA6FJ7VkcIh9cuFKlye-WxvD1hju1eCcnxsk",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
