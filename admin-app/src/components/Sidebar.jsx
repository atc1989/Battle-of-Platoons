import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { getMyProfile } from "../services/profile.service";

const DashboardIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 12l4.5-2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" />
  </svg>
);

const ParticipantsIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4" y="4" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <rect x="13" y="4" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <rect x="4" y="13" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <rect x="13" y="13" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

const UpdatesIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 5a7 7 0 1 1-5.1 2.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path d="M6 5v3.5h3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M12 8.5v4.5l3 1.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const FormulasIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M6 6h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-3 3v-3H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path d="M8.5 11h7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M8.5 14h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 4v10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M8.5 7.5L12 4l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CompareIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 7h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M11 7l-2-2M11 7l-2 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M17 17h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M13 17l2-2M13 17l2 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const PublishingIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 12c3.3-3.3 6.8-3.4 9-1.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M12 12c2.1-2.1 4.4-2.2 6-0.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    <path d="M12 12c-3.3 3.3-6.8 3.4-9 1.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M12 12c-2.1 2.1-4.4 2.2-6 0.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const AuditIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 4h8l3 3v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M9 11h6M9 15h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const FinalizationIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4" y="6" width="16" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M8 4v4M16 4v4M7.5 11.5h9M7.5 15.5h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export default function Sidebar() {
  const [role, setRole] = useState(null);

  useEffect(() => {
    let active = true;
    getMyProfile()
      .then(profile => {
        if (!active) return;
        setRole(profile?.role ?? null);
      })
      .catch(() => {
        if (!active) return;
        setRole(null);
      });

    return () => {
      active = false;
    };
  }, []);

  const isSuperAdmin = role === "super_admin";

  return (
    <aside className="sidebar">
      <div className="sb-header">
        <img src="/gg-logo.png" alt="Grinders Guild logo" className="sb-logo" />
        <div className="sb-brand">Grinders Guild</div>
      </div>

      <nav className="sb-nav">
        <NavLink to="/dashboard" className={({ isActive }) => "sb-link" + (isActive ? " active" : "")}>
          <span className="sb-icon">
            <DashboardIcon />
          </span>
          <span className="sb-label">Dashboard</span>
        </NavLink>

        <NavLink to="/participants" className={({ isActive }) => "sb-link" + (isActive ? " active" : "")}>
          <span className="sb-icon">
            <ParticipantsIcon />
          </span>
          <span className="sb-label">Participants</span>
        </NavLink>

        <NavLink to="/updates" className={({ isActive }) => "sb-link" + (isActive ? " active" : "")}>
          <span className="sb-icon">
            <UpdatesIcon />
          </span>
          <span className="sb-label">Updates History</span>
        </NavLink>

        <NavLink
          to="/scoring-formulas"
          className={({ isActive }) => "sb-link" + (isActive ? " active" : "")}
        >
          <span className="sb-icon">
            <FormulasIcon />
          </span>
          <span className="sb-label">Scoring Formulas</span>
        </NavLink>

        <div className="sb-section">TOOLS</div>

        <NavLink to="/upload" className={({ isActive }) => "sb-link" + (isActive ? " active" : "")}>
          <span className="sb-icon">
            <UploadIcon />
          </span>
          <span className="sb-label">Upload Data</span>
        </NavLink>

        <NavLink to="/compare" className={({ isActive }) => "sb-link" + (isActive ? " active" : "")}>
          <span className="sb-icon">
            <CompareIcon />
          </span>
          <span className="sb-label">Compare Data</span>
        </NavLink>

        <NavLink to="/publishing" className={({ isActive }) => "sb-link" + (isActive ? " active" : "")}>
          <span className="sb-icon">
            <PublishingIcon />
          </span>
          <span className="sb-label">Publishing</span>
        </NavLink>

        {isSuperAdmin ? (
          <>
            <NavLink to="/audit-log" className={({ isActive }) => "sb-link" + (isActive ? " active" : "")}>
              <span className="sb-icon">
                <AuditIcon />
              </span>
              <span className="sb-label">Audit Log</span>
            </NavLink>
            <NavLink to="/finalization" className={({ isActive }) => "sb-link" + (isActive ? " active" : "")}>
              <span className="sb-icon">
                <FinalizationIcon />
              </span>
              <span className="sb-label">Week Finalization</span>
            </NavLink>
          </>
        ) : null}

        {/* Later: Download Template & Reset Sample can be inside Upload page */}
      </nav>
    </aside>
  );
}
