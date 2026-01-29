import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";

export default function AppShell() {
  return (
    <div className="admin-shell">
      <TopBar />
      <div className="admin-body">
        <Sidebar />
        <div className="admin-main">
          <div className="admin-content">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
