import React from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { useAuth } from "../auth/AuthProvider";

export default function AppShell() {
  const { sessionError, clearSessionError, logout } = useAuth();
  const nav = useNavigate();

  async function handleReauth() {
    await logout();
    clearSessionError();
    nav("/login");
  }

  return (
    <div className="admin-shell">
      <TopBar />
      <div className="admin-body">
        <Sidebar />
        <div className="admin-main">
          <div className="admin-content">
            {sessionError && (
              <div className="error-box" role="alert" style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>{sessionError}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="button secondary" onClick={clearSessionError}>
                      Dismiss
                    </button>
                    <button type="button" className="button primary" onClick={handleReauth}>
                      Sign in again
                    </button>
                  </div>
                </div>
              </div>
            )}
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
