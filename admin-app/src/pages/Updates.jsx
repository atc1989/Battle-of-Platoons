import React, { useEffect, useMemo, useState } from "react";
import { listAgents } from "../services/agents.service";
import { deleteRawData, listRawData, updateRawData } from "../services/rawData.service";

// ----------------------
// Formatting helpers
// ----------------------
function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  return num.toLocaleString();
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  return num.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// ----------------------
// Date parsing (timezone-safe)
// Supports: YYYY-MM-DD, MM/DD/YYYY, M/D/YYYY
// Returns: YYYY-MM-DD or ""
// ----------------------
function normalizeToYmd(input) {
  if (!input) return "";
  const s = String(input).trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // MM/DD/YYYY or M/D/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mm = String(m[1]).padStart(2, "0");
    const dd = String(m[2]).padStart(2, "0");
    const yyyy = String(m[3]);
    return `${yyyy}-${mm}-${dd}`;
  }

  return "";
}

function toTsYmd(ymd) {
  const norm = normalizeToYmd(ymd);
  if (!norm) return null;
  const ts = new Date(`${norm}T00:00:00`).getTime();
  return Number.isNaN(ts) ? null : ts;
}

// ----------------------
// Tabs config
// ----------------------
const TABS = [
  { key: "leaders", label: "Leaders" },
  { key: "depots", label: "Depots" },
  { key: "companies", label: "Companies" },
  { key: "platoons", label: "Platoons" },
];

const initialFilters = {
  dateFrom: "",
  dateTo: "",
  leaders: "",
  depots: "",
  companies: "",
  platoons: "",
};

export default function Updates() {
  const [activeTab, setActiveTab] = useState("leaders");

  const [agents, setAgents] = useState([]);
  const [rows, setRows] = useState([]);

  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  // Two-state filtering: input vs applied
  const [filtersInput, setFiltersInput] = useState(initialFilters);
  const [filtersApplied, setFiltersApplied] = useState(initialFilters);

  // Editing (Leaders only)
  const [editingId, setEditingId] = useState("");
  const [editValues, setEditValues] = useState({ leads: "", payins: "", sales: "" });

  const agentMap = useMemo(() => {
    const map = {};
    for (const a of agents) map[a.id] = a;
    return map;
  }, [agents]);

  // Load agents once
  useEffect(() => {
    (async () => {
      try {
        const data = await listAgents();
        setAgents(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // Initial fetch (no filters)
  useEffect(() => {
    void applyFilters(initialFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If user changes tab while editing, cancel edit
  useEffect(() => {
    if (activeTab !== "leaders" && editingId) cancelEdit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ----------------------
  // Apply/Clear filters
  // ----------------------
  async function applyFilters(customFilters = filtersInput) {
    // Normalize and apply
    const normalized = { ...initialFilters, ...(customFilters || {}) };
    normalized.dateFrom = normalizeToYmd(normalized.dateFrom);
    normalized.dateTo = normalizeToYmd(normalized.dateTo);

    setFiltersApplied(normalized);
    setLoading(true);
    setError("");
    setStatus("");

    try {
      // IMPORTANT: fetch without relying on server-side string date filtering
      // We will always filter client-side correctly.
      const data = await listRawData({ limit: 500 });
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Failed to load updates");
    } finally {
      setLoading(false);
    }
  }

  async function clearFilters() {
    setFiltersInput(initialFilters);
    setFiltersApplied(initialFilters);
    cancelEdit();
    await applyFilters(initialFilters);
  }

  // ----------------------
  // Options for dropdown (per tab)
  // ----------------------
  const filterOptions = useMemo(() => {
    const map = new Map();

    for (const r of rows) {
      const a = agentMap[r.agent_id];
      let value = "";
      let label = "";

      if (activeTab === "leaders") {
        value = r.agent_id || "";
        label = a?.name ? `${a.name} (${r.agent_id})` : r.agent_id || "Unknown leader";
      } else if (activeTab === "depots") {
        value = a?.depotId || "";
        label = r.depotName || a?.depot?.name || a?.depotId || "Unknown depot";
      } else if (activeTab === "companies") {
        value = a?.companyId || "";
        label = r.companyName || a?.company?.name || a?.companyId || "Unknown company";
      } else if (activeTab === "platoons") {
        value = a?.platoonId || "";
        label = r.platoonName || a?.platoon?.name || a?.platoonId || "Unknown platoon";
      }

      if (!value) continue;
      if (!map.has(value)) map.set(value, label);
    }

    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((x, y) => x.label.localeCompare(y.label));
  }, [activeTab, agentMap, rows]);

  // ----------------------
  // Filtered rows shown in table
  // ----------------------
  const visibleRows = useMemo(() => {
    const fromTs = toTsYmd(filtersApplied.dateFrom);
    const toTs = toTsYmd(filtersApplied.dateTo);
    const selected = filtersApplied[activeTab];

    const filtered = rows.filter((r) => {
      const rowTs = toTsYmd(r.date_real); // row date_real should be YYYY-MM-DD
      if ((fromTs !== null || toTs !== null) && rowTs === null) return false;
      if (fromTs !== null && rowTs < fromTs) return false;
      if (toTs !== null && rowTs > toTs) return false;

      if (!selected) return true;

      const a = agentMap[r.agent_id];
      if (activeTab === "leaders") return (r.agent_id || "") === selected;
      if (activeTab === "depots") return (a?.depotId || "") === selected;
      if (activeTab === "companies") return (a?.companyId || "") === selected;
      if (activeTab === "platoons") return (a?.platoonId || "") === selected;

      return true;
    });

    // Default sort: date desc
    filtered.sort((a, b) => {
      const ad = toTsYmd(a.date_real) ?? 0;
      const bd = toTsYmd(b.date_real) ?? 0;
      if (ad === bd) return String(b.id || "").localeCompare(String(a.id || ""));
      return bd - ad;
    });

    return filtered;
  }, [activeTab, agentMap, filtersApplied, rows]);

  // ----------------------
  // Editing (Leaders only)
  // ----------------------
  function startEdit(row) {
    if (activeTab !== "leaders") return;
    setEditingId(row.id);
    setEditValues({
      leads: row.leads ?? "",
      payins: row.payins ?? "",
      sales: row.sales ?? "",
    });
    setError("");
    setStatus("");
  }

  function cancelEdit() {
    setEditingId("");
    setEditValues({ leads: "", payins: "", sales: "" });
  }

  function onEditChange(field, value) {
    setEditValues((prev) => ({ ...prev, [field]: value }));
  }

  async function saveEdit(rowId) {
    const leadsNum = Number(editValues.leads);
    const payinsNum = Number(editValues.payins);
    const salesNum = Number(editValues.sales);

    if ([leadsNum, payinsNum, salesNum].some((n) => Number.isNaN(n))) {
      setError("Please enter valid numbers for leads, payins, and sales.");
      return;
    }

    setSavingId(rowId);
    setError("");
    setStatus("");

    try {
      const updated = await updateRawData(rowId, {
        leads: leadsNum,
        payins: payinsNum,
        sales: salesNum,
      });

      setRows((prev) => prev.map((r) => (r.id === rowId ? updated : r)));
      setStatus("Row updated.");
      cancelEdit();
    } catch (e) {
      console.error(e);
      setError(e?.message || "Failed to update row");
    } finally {
      setSavingId("");
    }
  }

  // ----------------------
  // Delete
  // ----------------------
  async function handleDelete(rowId) {
    const confirmed = window.confirm("Delete this entry? This cannot be undone.");
    if (!confirmed) return;

    setDeletingId(rowId);
    setError("");
    setStatus("");

    try {
      await deleteRawData(rowId);
      setRows((prev) => prev.filter((r) => r.id !== rowId));
      setStatus("Row deleted.");
    } catch (e) {
      console.error(e);
      const msg = e?.message || "Failed to delete row";
      const low = msg.toLowerCase();
      if (low.includes("policy") || low.includes("rls") || low.includes("permission")) {
        setError(
          "Delete blocked by RLS policy. Ensure admin is authenticated and raw_data delete policy allows authenticated."
        );
      } else {
        setError(msg);
      }
    } finally {
      setDeletingId("");
    }
  }

  // ----------------------
  // Render helpers for tab identity column
  // ----------------------
  function renderIdentityCell(row) {
    const a = agentMap[row.agent_id];

    if (activeTab === "leaders") {
      return (
        <div>
          <div>{row.leaderName || a?.name || "—"}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {row.agent_id}
          </div>
        </div>
      );
    }

    if (activeTab === "depots") return row.depotName || a?.depot?.name || a?.depotId || "—";
    if (activeTab === "companies") return row.companyName || a?.company?.name || a?.companyId || "—";
    if (activeTab === "platoons") return row.platoonName || a?.platoon?.name || a?.platoonId || "—";

    return "—";
  }

  const identityHeader =
    activeTab === "leaders"
      ? "Leader"
      : activeTab === "depots"
      ? "Depot"
      : activeTab === "companies"
      ? "Company"
      : "Platoon";

  const filterLabel =
    activeTab === "leaders"
      ? "Leader"
      : activeTab === "depots"
      ? "Depot"
      : activeTab === "companies"
      ? "Company"
      : "Platoon";

  return (
    <div className="card">
      <div className="card-title">Updates History</div>
      <div className="muted">Review, edit, or delete uploaded daily performance data.</div>

      {/* Tabs */}
      <div className="tabs" style={{ marginTop: 12 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab-button${activeTab === t.key ? " active" : ""}`}
            onClick={() => setActiveTab(t.key)}
            disabled={loading}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 12,
          alignItems: "end",
        }}
      >
        <div>
          <label className="input-label">Date From</label>
          <input
            type="date"
            className="input"
            value={filtersInput.dateFrom}
            onChange={(e) => setFiltersInput((p) => ({ ...p, dateFrom: e.target.value }))}
          />
        </div>

        <div>
          <label className="input-label">Date To</label>
          <input
            type="date"
            className="input"
            value={filtersInput.dateTo}
            onChange={(e) => setFiltersInput((p) => ({ ...p, dateTo: e.target.value }))}
          />
        </div>

        <div>
          <label className="input-label">{filterLabel}</label>
          <select
            className="input"
            value={filtersInput[activeTab]}
            onChange={(e) => setFiltersInput((p) => ({ ...p, [activeTab]: e.target.value }))}
          >
            <option value="">All {TABS.find((x) => x.key === activeTab)?.label.toLowerCase()}</option>
            {filterOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {/* IMPORTANT: do NOT pass applyFilters directly (it would receive click event) */}
          <button
            type="button"
            className="button primary"
            onClick={() => applyFilters(filtersInput)}
            disabled={loading}
          >
            Apply Filters
          </button>

          <button type="button" className="button secondary" onClick={clearFilters} disabled={loading}>
            Clear
          </button>
        </div>
      </div>

      {/* Status/Error */}
      {(error || status) && (
        <div style={{ marginTop: 12 }}>
          {error ? (
            <div className="error-box" role="alert">
              {error}
            </div>
          ) : null}
          {status ? <div className="hint">{status}</div> : null}
        </div>
      )}

      {loading ? (
        <div className="muted" style={{ marginTop: 12 }}>
          Loading…
        </div>
      ) : null}

      {/* Table */}
      <div className="table-scroll" style={{ marginTop: 14 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>{identityHeader}</th>
              <th>Leads</th>
              <th>Payins</th>
              <th>Sales</th>
              <th>Computed ID</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {visibleRows.map((row) => {
              const isEditing = activeTab === "leaders" && row.id === editingId;

              return (
                <tr key={row.id}>
                  <td>{row.date_real}</td>
                  <td>{renderIdentityCell(row)}</td>

                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        className="input"
                        style={{ maxWidth: 120 }}
                        value={editValues.leads}
                        onChange={(e) => onEditChange("leads", e.target.value)}
                      />
                    ) : (
                      formatNumber(row.leads)
                    )}
                  </td>

                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        className="input"
                        style={{ maxWidth: 120 }}
                        value={editValues.payins}
                        onChange={(e) => onEditChange("payins", e.target.value)}
                      />
                    ) : (
                      formatNumber(row.payins)
                    )}
                  </td>

                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        className="input"
                        style={{ maxWidth: 140 }}
                        value={editValues.sales}
                        onChange={(e) => onEditChange("sales", e.target.value)}
                      />
                    ) : (
                      formatCurrency(row.sales)
                    )}
                  </td>

                  <td>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {row.id}
                    </div>
                  </td>

                  <td>
                    {isEditing ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className="button primary"
                          onClick={() => saveEdit(row.id)}
                          disabled={savingId === row.id}
                        >
                          {savingId === row.id ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          className="button secondary"
                          onClick={cancelEdit}
                          disabled={savingId === row.id}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 8 }}>
                        {activeTab === "leaders" ? (
                          <button
                            type="button"
                            className="button secondary"
                            onClick={() => startEdit(row)}
                            disabled={savingId === row.id || deletingId === row.id}
                          >
                            Edit
                          </button>
                        ) : (
                          <button type="button" className="button secondary" disabled title="Editable only on Leaders tab">
                            Edit
                          </button>
                        )}

                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => handleDelete(row.id)}
                          disabled={deletingId === row.id || savingId === row.id}
                          style={{ background: "#ffe8e8", color: "#b00020" }}
                        >
                          {deletingId === row.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}

            {!visibleRows.length && !loading ? (
              <tr>
                <td colSpan={7} className="muted" style={{ textAlign: "center", padding: 16 }}>
                  No data to display.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
