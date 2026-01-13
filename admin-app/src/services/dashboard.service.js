import { listAgents } from "./agents.service";
import { listCompanies } from "./companies.service";
import { listDepots } from "./depots.service";
import { supabase } from "./supabase";
import { computeTotalScore } from "./scoringEngine";

const DEBUG_DASHBOARD = Boolean(import.meta?.env?.DEV);

function toYMD(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function toIsoWeekKey(dateStr) {
  if (!dateStr) return null;
  const ref = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(ref.getTime())) return null;

  const utcDate = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);

  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utcDate - yearStart) / 86400000 + 1) / 7);

  return `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function normalizeViewKey(view) {
  const key = String(view || "").toLowerCase();
  if (key === "depots") return "depots";
  if (key === "companies") return "companies";
  return "leaders";
}

function isLeaderRole(role) {
  const normalized = String(role || "").toLowerCase();
  return normalized === "platoon" || normalized === "leader" || normalized === "squad" || normalized === "team";
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function parseFirestoreTimestampJson(ts) {
  if (!ts) return null;
  if (typeof ts === "string") {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const sec = ts._seconds ?? ts.seconds;
  const nsec = ts._nanoseconds ?? ts.nanoseconds ?? 0;
  if (typeof sec === "number") {
    const ms = sec * 1000 + Math.floor(nsec / 1e6);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function getRowDate(row) {
  if (row?.date_real) return new Date(`${row.date_real}T00:00:00`);
  return parseFirestoreTimestampJson(row?.date);
}

async function fetchRawData({
  startDate,
  endDate,
  requireApproved,
  requireNotVoided,
  useDateFilter,
}) {
  let query = supabase
    .from("raw_data")
    .select(
      `
      id,
      agent_id,
      leads,
      payins,
      sales,
      date_real,
      date,
      approved,
      voided,
      source,
      agents:agents (
        id,
        name,
        photo_url,
        photoURL,
        depot_id,
        company_id,
        platoon_id,
        role
      )
    `
    );

  if (useDateFilter && startDate && endDate) {
    query = query.gte("date_real", startDate).lte("date_real", endDate);
  }
  if (requireApproved) query = query.eq("approved", true);
  if (requireNotVoided) query = query.eq("voided", false);

  return query;
}

export async function getDashboardData({ mode, dateFrom, dateTo } = {}) {
  const resolvedView = normalizeViewKey(mode);
  const today = new Date();
  const startDate = dateFrom || toYMD(startOfMonth(today));
  const endDate = dateTo || toYMD(today);
  const weekKey = toIsoWeekKey(endDate);

  const [agents, depots, companies, formulaResult, rawResult] = await Promise.all([
    listAgents(),
    listDepots(),
    listCompanies(),
    supabase.rpc("get_active_scoring_formula", {
      battle_type: resolvedView,
      week_key: weekKey,
    }),
    fetchRawData({
      startDate,
      endDate,
      requireApproved: true,
      requireNotVoided: true,
      useDateFilter: true,
    }),
  ]);

  if (rawResult.error) throw rawResult.error;
  if (formulaResult.error) throw formulaResult.error;

  if (DEBUG_DASHBOARD) {
    console.info("[dashboard] raw_data filters", {
      dateFrom: startDate,
      dateTo: endDate,
      approved: true,
      voided: false,
    });
    console.info("[dashboard] raw_data count", rawResult.data?.length ?? 0);
    console.info("[dashboard] raw_data sample", rawResult.data?.[0] ?? null);
  }

  const depotsMap = new Map((depots ?? []).map((d) => [String(d.id), d]));
  const companiesMap = new Map((companies ?? []).map((c) => [String(c.id), c]));
  const agentsMap = new Map((agents ?? []).map((a) => [String(a.id), a]));
  const formulaRow = Array.isArray(formulaResult.data)
    ? formulaResult.data[0]
    : formulaResult.data;
  const scoringConfig = formulaRow?.config ?? null;

  const grouped = new Map();
  let rows = rawResult.data ?? [];
  let relaxedFilter = null;

  if (rows.length === 0) {
    const relaxedDateResult = await fetchRawData({
      startDate,
      endDate,
      requireApproved: true,
      requireNotVoided: true,
      useDateFilter: false,
    });
    if (relaxedDateResult?.data?.length) {
      rows = relaxedDateResult.data;
      relaxedFilter = "date";
    }
  }

  if (rows.length === 0) {
    const relaxedApprovedResult = await fetchRawData({
      startDate,
      endDate,
      requireApproved: false,
      requireNotVoided: true,
      useDateFilter: true,
    });
    if (relaxedApprovedResult?.data?.length) {
      rows = relaxedApprovedResult.data;
      relaxedFilter = "approved";
    }
  }

  if (rows.length === 0) {
    const relaxedVoidedResult = await fetchRawData({
      startDate,
      endDate,
      requireApproved: true,
      requireNotVoided: false,
      useDateFilter: true,
    });
    if (relaxedVoidedResult?.data?.length) {
      rows = relaxedVoidedResult.data;
      relaxedFilter = "voided";
    }
  }

  if (rows.length === 0) {
    const relaxedAllResult = await fetchRawData({
      startDate,
      endDate,
      requireApproved: false,
      requireNotVoided: false,
      useDateFilter: false,
    });
    if (relaxedAllResult?.data?.length) {
      rows = relaxedAllResult.data;
      relaxedFilter = "all";
    }
  }

  if (DEBUG_DASHBOARD && relaxedFilter) {
    console.warn("[dashboard] raw_data filter relaxed", relaxedFilter);
    console.info("[dashboard] raw_data relaxed count", rows.length);
  }

  if (!rawResult.data?.length && rows.length && relaxedFilter === "date") {
    rows = rows.filter((row) => {
      const d = getRowDate(row);
      if (!d) return false;
      const start = new Date(`${startDate}T00:00:00`);
      const end = new Date(`${endDate}T23:59:59`);
      return d >= start && d <= end;
    });
  }

  if (relaxedFilter === "approved" || relaxedFilter === "all") {
    rows = rows.filter((row) => row.approved === true || row.approved == null);
  }

  if (relaxedFilter === "voided" || relaxedFilter === "all") {
    rows = rows.filter((row) => row.voided !== true);
  }
  const totals = rows.reduce(
    (acc, row) => {
      acc.totalLeads += toNumber(row.leads);
      acc.totalSales += toNumber(row.sales);
      return acc;
    },
    { totalLeads: 0, totalSales: 0 }
  );

  rows.forEach((row) => {
    const agentId = String(row.agent_id ?? "");
    const agent = row.agents ?? agentsMap.get(agentId) ?? {};
    if (resolvedView === "leaders" && !isLeaderRole(agent.role)) return;
    const depotId = agent.depot_id ?? agent.depotId ?? "";
    const companyId = agent.company_id ?? agent.companyId ?? "";

    let key = "";
    let name = "";
    let avatarUrl = "";

    if (resolvedView === "leaders") {
      key = agentId;
      name = agent.name ?? "Unknown Leader";
      avatarUrl = agent.photoURL ?? agent.photo_url ?? "";
    } else if (resolvedView === "depots") {
      key = String(depotId || "");
      const depot = depotsMap.get(key);
      name = depot?.name ?? "Unknown Depot";
      avatarUrl = depot?.photoURL ?? depot?.photo_url ?? "";
    } else if (resolvedView === "companies") {
      key = String(companyId || "");
      const company = companiesMap.get(key);
      name = company?.name ?? "Unknown Commander";
      avatarUrl = company?.photoURL ?? company?.photo_url ?? "";
    }

    if (!key) return;

    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        name,
        avatarUrl,
        leads: 0,
        payins: 0,
        sales: 0,
        points: 0,
        rank: 0,
      });
    }

    const item = grouped.get(key);
    item.leads += toNumber(row.leads);
    item.payins += toNumber(row.payins);
    item.sales += toNumber(row.sales);
  });

  const aggregated = Array.from(grouped.values()).map((row) => ({
    ...row,
    points: computeTotalScore(resolvedView, row, scoringConfig),
  }));

  if (DEBUG_DASHBOARD) {
    console.info("[dashboard] leaderboard rows", aggregated.length);
  }

  aggregated.sort(
    (a, b) =>
      b.points - a.points ||
      b.sales - a.sales ||
      b.leads - a.leads ||
      b.payins - a.payins ||
      a.name.localeCompare(b.name) ||
      String(a.key).localeCompare(String(b.key))
  );
  aggregated.forEach((row, idx) => {
    row.rank = idx + 1;
  });

  const leadersCount = (agents ?? []).filter((agent) => isLeaderRole(agent.role)).length;

  return {
    kpis: {
      leadersCount,
      companiesCount: (companies ?? []).length,
      depotsCount: (depots ?? []).length,
      totalLeads: totals.totalLeads,
      totalSales: totals.totalSales,
    },
    leaderboardRows: aggregated,
  };
}

export async function getDashboardSummary({ dateFrom, dateTo, view = "leaders" } = {}) {
  return getDashboardData({ mode: view, dateFrom, dateTo });
}
