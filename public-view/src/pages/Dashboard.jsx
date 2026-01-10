import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getDashboardSummary } from "../services/dashboard.service";
import "./Dashboard.css";

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

function buildPodium(podium) {
  const map = new Map((podium || []).map((row) => [row.rank, row]));
  const ordered = [2, 1, 3].map((rank) => map.get(rank)).filter(Boolean);
  if (ordered.length) return ordered;
  return (podium || []).slice(0, 3);
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
      battleType: activeView,
    })
      .then((result) => {
        if (cancelled) return;
        setData(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || "Failed to load dashboard.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeView, dateRange.start, dateRange.end]);

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
  const podium = buildPodium(data?.podium || []);
  const rows = data?.rows || [];
  const tableRows = rows;
  const loadingSkeletons = loading && !data;

  const labelHeader =
    activeView === "leaders"
      ? "Leader Name"
      : activeView === "depots"
      ? "Depot"
      : "Company";

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-title">Battle of Platoons</div>
        <div className="dashboard-user">
          <div className="dashboard-user__avatar" />
          <span className="dashboard-user__name">Guest</span>
        </div>
      </header>

      <section className="dashboard-kpis">
        <div className={`kpi-strip ${loadingSkeletons ? "kpi-strip--loading" : ""}`}>
          <div className="kpi-tile">
            <div className="kpi-label">Leaders</div>
            <div className="kpi-value">
              {loadingSkeletons ? <span className="kpi-skeleton" /> : formatNumber(kpis.leadersCount)}
            </div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Companies</div>
            <div className="kpi-value">
              {loadingSkeletons ? <span className="kpi-skeleton" /> : formatNumber(kpis.companiesCount)}
            </div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Depots</div>
            <div className="kpi-value">
              {loadingSkeletons ? <span className="kpi-skeleton" /> : formatNumber(kpis.depotsCount)}
            </div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Total Leads</div>
            <div className="kpi-value">
              {loadingSkeletons ? <span className="kpi-skeleton" /> : formatNumber(kpis.totalLeads)}
            </div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Total Sales</div>
            <div className="kpi-value">
              {loadingSkeletons ? <span className="kpi-skeleton" /> : formatCurrency(kpis.totalSales)}
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-tabs">
        <div className="dash-tabs">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`dash-pill${activeView === tab.key ? " dash-pill--active" : ""}`}
              onClick={() => handleViewChange(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section
        className="dash-panel"
        data-state={isAnimating ? "out" : "in"}
        ref={panelRef}
        style={panelMinHeight ? { minHeight: panelMinHeight } : undefined}
      >
        <h2 className="dashboard-section-title">Platoon Leader Rankings</h2>

        {error ? <div className="dashboard-error">Failed to load dashboard</div> : null}

        {loadingSkeletons ? (
          <div className="podium-skeleton">
            <div className="podium-card skeleton-card" />
            <div className="podium-card skeleton-card" />
            <div className="podium-card skeleton-card" />
          </div>
        ) : (
          <div className="podium-grid">
            {podium.map((leader) => (
              <div
                key={leader.key || leader.id}
                className={`podium-card podium-card--rank-${leader.rank}`}
              >
                <div className="podium-rank">{leader.rank}</div>
                <div className="podium-avatar">
                  {leader.avatarUrl ? (
                    <img src={leader.avatarUrl} alt={leader.name} />
                  ) : (
                    <span>{getInitials(leader.name)}</span>
                  )}
                </div>
                <div className="podium-name">{leader.name}</div>
                <div className="podium-points">{leader.points.toFixed(1)} points</div>
                <div className="podium-stats">
                  <div>{formatNumber(leader.leads)} leads</div>
                  <div>{formatNumber(leader.payins)} payins</div>
                  <div>{formatCurrency(leader.sales)} sales</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="dashboard-table">
          <div className="dashboard-table__header">
            <div>Rank</div>
            <div>{labelHeader}</div>
            <div>Leads</div>
            <div>Payins</div>
            <div>Sales</div>
            <div>Points</div>
          </div>
          <div className="dashboard-table__body">
            {loadingSkeletons ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="dashboard-row dashboard-row--skeleton">
                  <div className="skeleton-block" />
                  <div className="skeleton-block" />
                  <div className="skeleton-block" />
                  <div className="skeleton-block" />
                  <div className="skeleton-block" />
                  <div className="skeleton-block" />
                </div>
              ))
            ) : tableRows.length ? (
              tableRows.map((row) => (
                <div key={`${row.rank}-${row.key}`} className="dashboard-row">
                  <div className="dashboard-rank">{row.rank}</div>
                  <div className="dashboard-name">
                    <div className="table-avatar">
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
      </section>
    </div>
  );
}
