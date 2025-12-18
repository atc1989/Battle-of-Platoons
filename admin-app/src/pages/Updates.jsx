import React, { useEffect, useMemo, useState } from "react";
import { listAgents } from "../services/agents.service";
import { deleteRawData, listRawData, updateRawData } from "../services/rawData.service";

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
  return num.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });
}

export default function Updates() {
  const [rows, setRows] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    agentId: "",
  });

  const [editingId, setEditingId] = useState("");
  const [editValues, setEditValues] = useState({ leads: "", payins: "", sales: "" });

  const agentOptions = useMemo(
    () => agents.map(a => ({ value: a.id, label: a.name || a.id })),
    [agents]
  );

  useEffect(() => {
    listAgents()
      .then(data => setAgents(data))
      .catch(e => console.error("Failed to load agents", e));
  }, []);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applyFilters() {
    setLoading(true);
    setError("");
    setStatus("");
    try {
      const data = await listRawData(filters);
      setRows(data);
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to load updates");
    } finally {
      setLoading(false);
    }
  }

  async function clearFilters() {
    const cleared = { dateFrom: "", dateTo: "", agentId: "" };
    setFilters(cleared);
    setEditingId("");
    setEditValues({ leads: "", payins: "", sales: "" });
    setLoading(true);
    setError("");
    setStatus("");
    try {
      const data = await listRawData(cleared);
      setRows(data);
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to load updates");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(row) {
    setEditingId(row.id);
    setEditValues({
      leads: row.leads ?? "",
      payins: row.payins ?? "",
      sales: row.sales ?? "",
    });
    setStatus("");
    setError("");
  }

  function cancelEdit() {
    setEditingId("");
    setEditValues({ leads: "", payins: "", sales: "" });
  }

  function onEditValueChange(field, value) {
    setEditValues(prev => ({ ...prev, [field]: value }));
  }

  async function saveEdit(rowId) {
    const leadsNum = Number(editValues.leads);
    const payinsNum = Number(editValues.payins);
    const salesNum = Number(editValues.sales);
    if ([leadsNum, payinsNum, salesNum].some(n => Number.isNaN(n))) {
      setError("Please enter valid numbers for leads, payins, and sales.");
      return;
    }

    setSavingId(rowId);
    setError("");
    setStatus("");
    try {
      const updated = await updateRawData(rowId, { leads: leadsNum, payins: payinsNum, sales: salesNum });
      setRows(prev => prev.map(r => (r.id === rowId ? updated : r)));
      setStatus("Row updated successfully.");
      cancelEdit();
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to update row");
    } finally {
      setSavingId("");
    }
  }

  async function handleDelete(rowId) {
    const confirmed = window.confirm("Delete this row? This cannot be undone.");
    if (!confirmed) return;

    setDeletingId(rowId);
    setError("");
    setStatus("");
    try {
      await deleteRawData(rowId);
      setRows(prev => prev.filter(r => r.id !== rowId));
      setStatus("Row deleted.");
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to delete row");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <div className="card">
      <div className="card-title">Updates History</div>
      <div className="muted">Review, edit, or delete uploaded daily performance data.</div>

      <div className="filters-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 16, alignItems: "end" }}>
        <div>
          <label className="input-label" htmlFor="dateFrom">Date From</label>
          <input
            id="dateFrom"
            type="date"
            value={filters.dateFrom}
            onChange={e => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
            className="input"
          />
        </div>
        <div>
          <label className="input-label" htmlFor="dateTo">Date To</label>
          <input
            id="dateTo"
            type="date"
            value={filters.dateTo}
            onChange={e => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
            className="input"
          />
        </div>
        <div>
          <label className="input-label" htmlFor="leader">Leader</label>
          <select
            id="leader"
            value={filters.agentId}
            onChange={e => setFilters(prev => ({ ...prev, agentId: e.target.value }))}
            className="input"
          >
            <option value="">All leaders</option>
            {agentOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="button primary" type="button" onClick={applyFilters} disabled={loading}>
            Apply Filters
          </button>
          <button className="button secondary" type="button" onClick={clearFilters} disabled={loading}>
            Clear
          </button>
        </div>
      </div>

      {(error || status) ? (
        <div style={{ marginTop: 12 }}>
          {error ? <div className="error-box" role="alert">{error}</div> : null}
          {status ? <div className="hint">{status}</div> : null}
        </div>
      ) : null}

      {loading ? <div className="muted" style={{ marginTop: 12 }}>Loading updates…</div> : null}

      <div className="table-scroll" style={{ marginTop: 16 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Leader</th>
              <th>Depot</th>
              <th>Company</th>
              <th>Platoon</th>
              <th>Leads</th>
              <th>Payins</th>
              <th>Sales</th>
              <th>Computed ID</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const isEditing = row.id === editingId;
              return (
                <tr key={row.id}>
                  <td>{row.date_real}</td>
                  <td>
                    <div>{row.leaderName || "—"}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{row.agent_id}</div>
                  </td>
                  <td>{row.depotName || "—"}</td>
                  <td>{row.companyName || "—"}</td>
                  <td>{row.platoonName || "—"}</td>
                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        className="input"
                        value={editValues.leads}
                        onChange={e => onEditValueChange("leads", e.target.value)}
                        style={{ maxWidth: 120 }}
                      />
                    ) : formatNumber(row.leads)}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        className="input"
                        value={editValues.payins}
                        onChange={e => onEditValueChange("payins", e.target.value)}
                        style={{ maxWidth: 120 }}
                      />
                    ) : formatNumber(row.payins)}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        className="input"
                        value={editValues.sales}
                        onChange={e => onEditValueChange("sales", e.target.value)}
                        style={{ maxWidth: 140 }}
                      />
                    ) : formatCurrency(row.sales)}
                  </td>
                  <td>
                    <div className="muted" style={{ fontSize: 12 }}>{row.id}</div>
                  </td>
                  <td>
                    {isEditing ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          className="button primary"
                          type="button"
                          onClick={() => saveEdit(row.id)}
                          disabled={savingId === row.id}
                        >
                          {savingId === row.id ? "Saving…" : "Save"}
                        </button>
                        <button className="button secondary" type="button" onClick={cancelEdit} disabled={savingId === row.id}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="button secondary" type="button" onClick={() => startEdit(row)} disabled={savingId || deletingId}>
                          Edit
                        </button>
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => handleDelete(row.id)}
                          disabled={deletingId === row.id || savingId || editingId}
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
            {!rows.length && !loading ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", padding: 16 }} className="muted">
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
