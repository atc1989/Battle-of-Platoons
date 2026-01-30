import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../services/supabase";

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) console.error(error);
      setUser(data?.session?.user ?? null);
      setBooting(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESH_FAILED") {
        setSessionError("Session refresh failed or was rate-limited. Please sign in again.");
        setUser(null);
        setBooting(false);
        supabase.auth.signOut();
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setSessionError("");
      }

      setUser(session?.user ?? null);
      setBooting(false);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  async function login(email, password) {
    setSessionError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function logout() {
    setSessionError("");
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  const value = {
    user,
    booting,
    sessionError,
    clearSessionError: () => setSessionError(""),
    login,
    logout,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(Ctx);
}
