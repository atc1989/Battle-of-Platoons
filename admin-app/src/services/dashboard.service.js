import { listAgents } from "./agents.service";
import { listCompanies } from "./companies.service";
import { listDepots } from "./depots.service";
import { supabase } from "./supabase";
import { computeTotalScore } from "./scoringEngine";

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
    supabase
      .from("raw_data")
      .select(
        `
        id,
        agent_id,
        leads,
        payins,
        sales,
        date_real,
        approved,
        voided,
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
      )
      .gte("date_real", startDate)
      .lte("date_real", endDate)
      .eq("approved", true)
      .eq("voided", false),
  ]);

  if (rawResult.error) throw rawResult.error;
  if (formulaResult.error) throw formulaResult.error;

  const depotsMap = new Map((depots ?? []).map((d) => [String(d.id), d]));
  const companiesMap = new Map((companies ?? []).map((c) => [String(c.id), c]));
  const agentsMap = new Map((agents ?? []).map((a) => [String(a.id), a]));
  const formulaRow = Array.isArray(formulaResult.data)
    ? formulaResult.data[0]
    : formulaResult.data;
  const scoringConfig = formulaRow?.config ?? null;

  const grouped = new Map();
  const rows = rawResult.data ?? [];
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
