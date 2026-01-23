import React, { useEffect, useMemo, useState } from "react";
import { listAgents } from "../services/agents.service";
import { listPublishingRows, setPublished, setVoided } from "../services/rawData.service";
import { getMyProfile } from "../services/profile.service";
import { Navigate } from "react-router-dom";

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

  const canViewAudit = ADMIN_ROLES.has(profile?.role ?? "");
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
    if (!canViewAudit || !row?.id) return;
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

  function openVoidModal(row) {
    setVoidModalRowId(row.id);
    setVoidReason("");
    setVoidModalOpen(true);
  }

  function closeVoidModal() {
    setVoidModalOpen(false);
    setVoidModalRowId(null);
    setVoidReason("");
    setVoidSubmitting(false);
  }

  async function handleConfirmVoid() {
    if (!canVoid || !voidModalRowId) return;
    const trimmedReason = voidReason.trim();
    if (!trimmedReason) {
      setError("Reason for void is required.");
      return;
    }

    setVoidSubmitting(true);
    setError("");

    try {
      await setVoided(voidModalRowId, true, trimmedReason);
      setRows(prev =>
        prev.map(item => (item.id === voidModalRowId ? { ...item, voided: true } : item))
      );
      setAppliedFilters(prev => ({ ...prev }));
      closeVoidModal();
    } catch (e) {
      console.error(e);
      setError(normalizeSchemaErrorMessage(e, "Failed to void row"));
    } finally {
      setVoidSubmitting(false);
    }
  }

  if (!profileLoading && !canViewAudit) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="card">
      <div className="card-title">Publishing</div>
      <div className="muted" style={{ marginBottom: 12 }}>
        Only rows published by a Super Admin appear on the public leaderboard.
      </div>

      {!profileLoading && !canViewAudit ? (
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
              <th>#</th>
              <th>Date</th>
              <th>Leader</th>
              <th>Leads Depot</th>
              <th>Sales Depot</th>
              <th>Leads</th>
              <th>Payins</th>
              <th>Sales</th>
              <th>Status</th>
              <th>Void Reason</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const agent = agentMap[row.agent_id];
              const canModify = canEditRow(row, profile, agent) && ADMIN_ROLES.has(currentRole);
              const isEditDisabled = savingId === row.id || row.voided || !canModify;

              return (
                <tr key={row.id}>
                  <td>
                    <div className="muted" style={{ fontSize: 12 }}>{index + 1}</div>
                  </td>
                  <td>{row.date_real}</td>
                  <td>{renderIdentityCell(row)}</td>

                  <td>{row.leadsDepotName || depotMap[row.leads_depot_id]?.name || "—"}</td>
                  <td>{row.salesDepotName || depotMap[row.sales_depot_id]?.name || "—"}</td>
                  <td>{formatNumber(row.leads)}</td>
                  <td>{formatNumber(row.payins)}</td>
                  <td>{formatCurrency(row.sales)}</td>

                  <td>
                    {row.voided ? (
                      <span style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        background: "#ffe8e8",
                        color: "#b00020",
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                      }}>
                        Voided
                      </span>
                    ) : (
                      <span style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        background: row.published ? "#e6f5e6" : "#f5f5f5",
                        color: row.published ? "#1b6b1b" : "#666",
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                      }}>
                        {row.published ? "Published" : "Unpublished"}
                      </span>
                    )}
                  </td>

                  <td>
                    {row.voided && row.void_reason ? (
                      <div className="muted" style={{ fontSize: 12, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }} title={row.void_reason}>
                        {row.void_reason}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>

                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {canModify ? (
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => startEdit(row)}
                          disabled={isEditDisabled}
                          style={isEditDisabled ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
                        >
                          Edit
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!rows.length && !loading ? (
              <tr>
                <td colSpan={11} className="muted" style={{ textAlign: "center" }}>
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
