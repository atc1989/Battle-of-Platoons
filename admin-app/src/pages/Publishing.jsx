import React, { useEffect, useMemo, useState } from "react";
import { listAgents } from "../services/agents.service";
import { listPublishingRows, setPublished, setVoided } from "../services/rawData.service";
import { getMyProfile } from "../services/profile.service";

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultDateRange() {
  const today = new Date();
  const from = new Date();
  from.setDate(today.getDate() - 6);
  return {
    dateFrom: formatDateInput(from),
    dateTo: formatDateInput(today),
  };
}

const SCHEMA_MIGRATION_HINT = "Run SQL migration and reload schema.";
const ADMIN_ROLES = new Set(["company_admin", "depot_admin", "super_admin"]);

export default function Publishing() {
  const defaults = useMemo(() => getDefaultDateRange(), []);
  const [filters, setFilters] = useState({
    dateFrom: defaults.dateFrom,
    dateTo: defaults.dateTo,
    agentId: "",
    status: "",
  });
  const [appliedFilters, setAppliedFilters] = useState({
    dateFrom: defaults.dateFrom,
    dateTo: defaults.dateTo,
    agentId: "",
    status: "",
  });
  const [rows, setRows] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [error, setError] = useState("");

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const isSuperAdmin = profile?.role === "super_admin";
  const canVoid = ADMIN_ROLES.has(profile?.role ?? "");
  const [actionRowId, setActionRowId] = useState("");

  function normalizeSchemaErrorMessage(err, fallback) {
    const msg = err?.message || fallback || "";
    const lowered = msg.toLowerCase();
    if (lowered.includes("schema cache") || lowered.includes("approve_reason") || lowered.includes("publish_reason")) {
      return SCHEMA_MIGRATION_HINT;
    }
    return msg || fallback || "Unexpected error";
  }

  useEffect(() => {
    let mounted = true;
    listAgents()
      .then(data => {
        if (!mounted) return;
        setAgents(data ?? []);
      })
      .catch(err => {
        if (!mounted) return;
        setError(normalizeSchemaErrorMessage(err, "Failed to load agents"));
      })
      .finally(() => {
        if (mounted) setAgentsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    getMyProfile()
      .then(data => {
        if (!mounted) return;
        setProfile(data);
      })
      .catch(err => {
        if (!mounted) return;
        setError(normalizeSchemaErrorMessage(err, "Failed to load profile"));
      })
      .finally(() => {
        if (mounted) setProfileLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    listPublishingRows(appliedFilters)
      .then((dataRows) => {
        if (!mounted) return;
        setRows(dataRows ?? []);
      })
      .catch(err => {
        if (!mounted) return;
        setError(normalizeSchemaErrorMessage(err, "Failed to load publishing data"));
        setRows([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [appliedFilters]);

  const counters = useMemo(() => {
    const total = rows.length;
    const published = rows.filter(row => row.published && !row.voided).length;
    const voided = rows.filter(row => row.voided).length;
    const unpublished = rows.filter(row => !row.published && !row.voided).length;
    return { total, published, unpublished, voided };
  }, [rows]);

  function handleApplyFilters() {
    setError("");
    setLoading(true);
    setAppliedFilters({ ...filters });
  }

  function handleClearFilters() {
    setFilters({ dateFrom: defaults.dateFrom, dateTo: defaults.dateTo, agentId: "", status: "" });
    setAppliedFilters({ dateFrom: defaults.dateFrom, dateTo: defaults.dateTo, agentId: "", status: "" });
  }

  async function handleTogglePublished(row) {
    if (!isSuperAdmin || !row?.id) return;
    const nextValue = !row.published;
    setActionRowId(row.id);
    try {
      await setPublished(row.id, nextValue);
      setRows(prev =>
        prev.map(item => (item.id === row.id ? { ...item, published: nextValue } : item))
      );
      setAppliedFilters(prev => ({ ...prev }));
    } catch (e) {
      console.error(e);
      setError(normalizeSchemaErrorMessage(e, "Failed to update publish status"));
    } finally {
      setActionRowId("");
    }
  }

  async function handleToggleVoided(row) {
    if (!canVoid || !row?.id) return;
    const nextValue = !row.voided;
    let reason = null;
    if (nextValue) {
      reason = window.prompt("Please provide a void reason (required):", "");
      if (!reason || !reason.trim()) return;
    }
    setActionRowId(row.id);
    try {
      await setVoided(row.id, nextValue, reason);
      setRows(prev =>
        prev.map(item => (item.id === row.id ? { ...item, voided: nextValue } : item))
      );
      setAppliedFilters(prev => ({ ...prev }));
    } catch (e) {
      console.error(e);
      setError(normalizeSchemaErrorMessage(e, "Failed to update void status"));
    } finally {
      setActionRowId("");
    }
  }

  return (
    <div className="card">
      <div className="card-title">Publishing</div>
      <div className="muted" style={{ marginBottom: 12 }}>
        Only rows published by a Super Admin appear on the public leaderboard.
      </div>

      {!profileLoading && !isSuperAdmin ? (
        <div className="error-box" role="alert">
          Only Super Admins can publish or unpublish rows. You can still view the current publish state.
        </div>
      ) : null}

      <div
        className="filters-row"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}
      >
        <div>
          <label htmlFor="date-from" className="form-label">Date From</label>
          <input
            id="date-from"
            type="date"
            value={filters.dateFrom}
            onChange={e => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
          />
        </div>
        <div>
          <label htmlFor="date-to" className="form-label">Date To</label>
          <input
            id="date-to"
            type="date"
            value={filters.dateTo}
            onChange={e => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
          />
        </div>
        <div>
          <label htmlFor="leader-filter" className="form-label">Leader</label>
          <select
            id="leader-filter"
            value={filters.agentId}
            onChange={e => setFilters(prev => ({ ...prev, agentId: e.target.value }))}
            disabled={agentsLoading}
          >
            <option value="">All Leaders</option>
            {agents.map(agent => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status-filter" className="form-label">Status</label>
          <select
            id="status-filter"
            value={filters.status}
            onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
          >
            <option value="">All</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
            <option value="voided">Voided</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <button type="button" className="button primary" onClick={handleApplyFilters} disabled={loading}>
            Apply Filters
          </button>
          <button type="button" className="button secondary" onClick={handleClearFilters} disabled={loading}>
            Clear
          </button>
        </div>
      </div>

      <div className="summary-grid" style={{ marginTop: 12 }}>
        <div className="summary-pill">
          <div className="summary-label">Total</div>
          <div className="summary-value">{counters.total}</div>
        </div>
        <div className="summary-pill">
          <div className="summary-label">Published</div>
          <div className="summary-value valid">{counters.published}</div>
        </div>
        <div className="summary-pill">
          <div className="summary-label">Unpublished</div>
          <div className="summary-value">{counters.unpublished}</div>
        </div>
        <div className="summary-pill">
          <div className="summary-label">Voided</div>
          <div className="summary-value">{counters.voided}</div>
        </div>
      </div>

      {error ? (
        <div className="error-box" role="alert" style={{ marginTop: 12 }}>
          {error}
        </div>
      ) : null}

      {loading ? <div className="muted" style={{ marginTop: 12 }}>Loading publishing data…</div> : null}

      <div className="table-scroll" style={{ marginTop: 12 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Leader</th>
              <th>Leads Depot</th>
              <th>Leads</th>
              <th>Sales Depot</th>
              <th>Payins</th>
              <th>Sales</th>
              <th>Published</th>
              <th>Voided</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td>{row.date_real}</td>
                <td>
                  <div>{row.leaderName || "(Restricted)"}</div>
                </td>
                <td>{row.leadsDepotName || "—"}</td>
                <td>{row.leads ?? "—"}</td>
                <td>{row.salesDepotName || "—"}</td>
                <td>{row.payins ?? "—"}</td>
                <td>{row.sales ?? "—"}</td>
                <td>
                  {isSuperAdmin ? (
                    <input
                      type="checkbox"
                      checked={Boolean(row.published)}
                      onChange={() => handleTogglePublished(row)}
                      disabled={actionRowId === row.id}
                    />
                  ) : (
                    <span className={`status-pill ${row.published ? "valid" : "muted"}`}>
                      {row.published ? "Published" : "Unpublished"}
                    </span>
                  )}
                </td>
                <td>
                  {canVoid ? (
                    <input
                      type="checkbox"
                      checked={Boolean(row.voided)}
                      onChange={() => handleToggleVoided(row)}
                      disabled={actionRowId === row.id}
                    />
                  ) : (
                    <span className={`status-pill ${row.voided ? "invalid" : "muted"}`}>
                      {row.voided ? "Voided" : "Active"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && !loading ? (
              <tr>
                <td colSpan={9} className="muted" style={{ textAlign: "center" }}>
                  No rows found for the selected filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

    </div>
  );
}
