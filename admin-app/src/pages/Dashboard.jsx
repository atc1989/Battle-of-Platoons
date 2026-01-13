import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getDashboardSummary } from "../services/dashboard.service";

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

    getDashboardSummary({
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
      view: activeView,
    })
      .then(result => {
        if (cancelled) return;
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
  const podium = data?.podium || [];
  const rows = data?.rows || [];

  return (
    <div className="dashboard-page">
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
        <div className="dashboard-section-title">Platoon Leader Rankings</div>

        {error ? <div className="dashboard-error">{error}</div> : null}

        {loading ? (
          <div className="dashboard-podium dashboard-podium--loading">
            <div className="dashboard-podium-card" />
            <div className="dashboard-podium-card" />
            <div className="dashboard-podium-card" />
          </div>
        ) : (
          <div className="dashboard-podium">
            {podium.map(item => (
              <div key={item.key || item.id} className={`dashboard-podium-card rank-${item.rank}`}>
                <div className="dashboard-podium-rank">{item.rank}</div>
                <div className="dashboard-podium-avatar">
                  {item.avatarUrl ? (
                    <img src={item.avatarUrl} alt={item.name} />
                  ) : (
                    <span>{getInitials(item.name)}</span>
                  )}
                </div>
                <div className="dashboard-podium-name">{item.name}</div>
                <div className="dashboard-podium-points">{item.points.toFixed(1)}</div>
                <div className="dashboard-podium-label">points</div>
                <div className="dashboard-podium-stats">
                  <div>
                    <span className="dashboard-stat-value">{formatNumber(item.leads)}</span>
                    <span className="dashboard-stat-label">leads</span>
                  </div>
                  <div>
                    <span className="dashboard-stat-value">{formatNumber(item.payins)}</span>
                    <span className="dashboard-stat-label">payins</span>
                  </div>
                  <div>
                    <span className="dashboard-stat-value">{formatCurrency(item.sales)}</span>
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
            <div>Leader Name</div>
            <div>Leads</div>
            <div>Payins</div>
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
                  <span className="dashboard-skeleton" />
                  <span className="dashboard-skeleton" />
                  <span className="dashboard-skeleton" />
                </div>
              ))
            ) : rows.length ? (
              rows.map(row => (
                <div key={`${row.rank}-${row.key}`} className="dashboard-table-row">
                  <div className="dashboard-rank">{row.rank}</div>
                  <div className="dashboard-name-cell">
                    <div className="dashboard-row-avatar">
                      {row.avatarUrl ? (
                        <img src={row.avatarUrl} alt={row.name} />
                      ) : (
                        <span>{getInitials(row.name)}</span>
                      )}
                    </div>
                    <span>{row.name}</span>
                  </div>
                  <div>{formatNumber(row.leads)}</div>
                  <div>{formatNumber(row.payins)}</div>
                  <div>{formatCurrency(row.sales)}</div>
                  <div>{row.points.toFixed(1)}</div>
                </div>
              ))
            ) : (
              <div className="dashboard-empty">No rankings available.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
