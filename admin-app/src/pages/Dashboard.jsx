import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getDashboardRankings } from "../services/dashboardRankings.service";
import "./Dashboard.css";

const DEBUG_DASHBOARD = Boolean(import.meta?.env?.DEV);
const DEBUG = true;
const VIEW_TABS = [
  { key: "depots", label: "Depots" },
  { key: "leaders", label: "Leaders" },
  { key: "companies", label: "Companies" },
];

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-PH");

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function formatNumber(value) {
  return numberFormatter.format(Number(value) || 0);
}

function toYMD(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function arrangePodiumRows(rows = []) {
  const cleaned = rows.filter(Boolean);
  if (cleaned.length >= 3) return [cleaned[1], cleaned[0], cleaned[2]];
  if (cleaned.length === 2) return [cleaned[1], cleaned[0]];
  return cleaned;
}

export default function Dashboard() {
  const today = useMemo(() => new Date(), []);
  const dateRange = useMemo(
    () => ({
      start: toYMD(startOfMonth(today)),
      end: toYMD(today),
    }),
    [today]
  );

  const [activeView, setActiveView] = useState("leaders");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [pendingView, setPendingView] = useState("");
  const [panelMinHeight, setPanelMinHeight] = useState(null);

  const animationTimerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    return () => {
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setData(null);

    getDashboardRankings({
      mode: activeView,
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
    })
      .then(result => {
        if (cancelled) return;
        if (DEBUG_DASHBOARD) {
          console.info("[dashboard] mode", activeView);
          console.info("[dashboard] rows", result?.rows?.length ?? 0);
          console.info("[dashboard] sample row", result?.rows?.[0] ?? null);
          console.info("[dashboard] kpis", result?.kpis ?? null);
        }
        setData(result);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err?.message || "Failed to load dashboard.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeView, dateRange.end, dateRange.start]);

  useLayoutEffect(() => {
    if (isAnimating) return;
    const panelEl = panelRef.current;
    if (!panelEl) return;
    setPanelMinHeight(panelEl.offsetHeight);
  }, [activeView, isAnimating, loading]);

  function handleViewChange(nextView) {
    if (nextView === activeView && !pendingView) return;
    if (animationTimerRef.current) clearTimeout(animationTimerRef.current);

    const panelEl = panelRef.current;
    if (panelEl) setPanelMinHeight(panelEl.offsetHeight);

    setPendingView(nextView);
    setIsAnimating(true);

    animationTimerRef.current = setTimeout(() => {
      setActiveView(nextView);
      setIsAnimating(false);
      setPendingView("");
    }, 100);
  }

  const kpis = data?.kpis || {
    leadersCount: 0,
    companiesCount: 0,
    depotsCount: 0,
    totalLeads: 0,
    totalSales: 0,
  };
  const leaderboardRows = data?.rows || [];
  const labelHeader =
    activeView === "depots"
      ? "Depot Name"
      : activeView === "companies"
      ? "Company Name"
      : "Leader Name";

  const sectionTitle =
    activeView === "depots"
      ? "Depot Rankings"
      : activeView === "companies"
      ? "Company Rankings"
      : "Platoon Leader Rankings";

  const showPayins = activeView !== "depots";

  const sortedRows = [...leaderboardRows].sort(
    (a, b) =>
      (b.points || 0) - (a.points || 0) ||
      (b.sales || 0) - (a.sales || 0) ||
      (b.leads || 0) - (a.leads || 0) ||
      String(a.name || "").localeCompare(String(b.name || "")) ||
      String(a.id || "").localeCompare(String(b.id || ""))
  );

  const podiumRows = arrangePodiumRows(sortedRows.slice(0, 3));
  const tableRows = sortedRows.slice(3);

  return (
    <div className="dashboard-page" data-mode={activeView}>
      <div className="dashboard-kpis">
        <div className={`dashboard-kpi-strip${loading ? " is-loading" : ""}`}>
          <div className="dashboard-kpi">
            <div className="dashboard-kpi-label">Leaders</div>
            <div className="dashboard-kpi-value">
              {loading ? <span className="dashboard-kpi-skeleton" /> : formatNumber(kpis.leadersCount)}
            </div>
          </div>
          <div className="dashboard-kpi">
            <div className="dashboard-kpi-label">Companies</div>
            <div className="dashboard-kpi-value">
              {loading ? <span className="dashboard-kpi-skeleton" /> : formatNumber(kpis.companiesCount)}
            </div>
          </div>
          <div className="dashboard-kpi">
            <div className="dashboard-kpi-label">Depots</div>
            <div className="dashboard-kpi-value">
              {loading ? <span className="dashboard-kpi-skeleton" /> : formatNumber(kpis.depotsCount)}
            </div>
          </div>
          <div className="dashboard-kpi">
            <div className="dashboard-kpi-label">Total Leads</div>
            <div className="dashboard-kpi-value">
              {loading ? <span className="dashboard-kpi-skeleton" /> : formatNumber(kpis.totalLeads)}
            </div>
          </div>
          <div className="dashboard-kpi">
            <div className="dashboard-kpi-label">Total Sales</div>
            <div className="dashboard-kpi-value">
              {loading ? <span className="dashboard-kpi-skeleton" /> : formatCurrency(kpis.totalSales)}
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-tabs">
        {VIEW_TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            className={`dashboard-pill${activeView === tab.key ? " active" : ""}`}
            onClick={() => handleViewChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className="tab-panel"
        data-state={isAnimating ? "out" : "in"}
        ref={panelRef}
        style={panelMinHeight ? { minHeight: panelMinHeight } : undefined}
      >
        <div className="dashboard-section-title">{sectionTitle}</div>

        {error ? <div className="dashboard-error">{error}</div> : null}

        {loading ? (
          <div className="dashboard-podium dashboard-podium--loading">
            <div className="dashboard-podium-card" />
            <div className="dashboard-podium-card" />
            <div className="dashboard-podium-card" />
          </div>
        ) : (
          <div className="dashboard-podium">
            {podiumRows.map(item => (
              <div key={item.key || item.id} className={`dashboard-podium-card rank-${item.rank}`}>
                <div className="dashboard-podium-rank">{item.rank}</div>
                <div className="dashboard-podium-avatar">
                  {item.photoUrl ? (
                    <img src={item.photoUrl} alt={item.name} />
                  ) : (
                    <span>{getInitials(item.name)}</span>
                  )}
                </div>
                <div className="dashboard-podium-name">{item.name}</div>
                <div className="dashboard-podium-points">{Number(item.points || 0).toFixed(1)}</div>
                <div className="dashboard-podium-label">points</div>
                <div className="dashboard-podium-stats">
                  <div>
                    <span className="dashboard-stat-value">{formatNumber(item.leads || 0)}</span>
                    <span className="dashboard-stat-label">leads</span>
                  </div>
                  {showPayins && (
                    <div>
                      <span className="dashboard-stat-value">{formatNumber(item.payins || 0)}</span>
                      <span className="dashboard-stat-label">payins</span>
                    </div>
                  )}
                  <div>
                    <span className="dashboard-stat-value">{formatCurrency(item.sales || 0)}</span>
                    <span className="dashboard-stat-label">sales</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="dashboard-table">
          <div className="dashboard-table-head">
            <div>Rank</div>
            <div>{labelHeader}</div>
            <div>Leads</div>
            {showPayins && <div>Payins</div>}
            <div>Sales</div>
            <div>Points</div>
          </div>
          <div className="dashboard-table-body">
            {loading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="dashboard-table-row dashboard-table-row--loading">
                  <span className="dashboard-skeleton" />
                  <span className="dashboard-skeleton" />
                  <span className="dashboard-skeleton" />
                  {showPayins && <span className="dashboard-skeleton" />}
                  <span className="dashboard-skeleton" />
                  <span className="dashboard-skeleton" />
                </div>
              ))
            ) : tableRows.length ? (
              tableRows.map(row => (
                <div key={`${row.rank}-${row.id}`} className="dashboard-table-row">
                  <div className="dashboard-rank">{row.rank}</div>
                  <div className="dashboard-name-cell">
                    <div className="dashboard-row-avatar">
                      {row.photoUrl ? (
                        <img src={row.photoUrl} alt={row.name} />
                      ) : (
                        <span>{getInitials(row.name)}</span>
                      )}
                    </div>
                    <span>{row.name}</span>
                  </div>
                  <div>{formatNumber(row.leads || 0)}</div>
                  {showPayins && <div>{formatNumber(row.payins || 0)}</div>}
                  <div>{formatCurrency(row.sales || 0)}</div>
                  <div>{Number(row.points || 0).toFixed(1)}</div>
                </div>
              ))
            ) : (
              <div className="dashboard-empty">No rankings available.</div>
            )}
          </div>
        </div>
        {DEBUG && (
          <div style={{ marginTop: 16, padding: 12, background: "#fff", borderRadius: 8, fontSize: 12 }}>
            <div><b>mode:</b> {activeView}</div>
            <div><b>rows:</b> {sortedRows?.length ?? 0}</div>
            <div><b>podium names:</b> {(sortedRows ?? []).slice(0, 3).map(r => r?.name).join(", ")}</div>
            <div><b>table names:</b> {(tableRows ?? []).slice(0, 5).map(r => r?.name).join(", ")}</div>
            <pre style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify({ sampleRows: (sortedRows ?? []).slice(0, 3) }, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
