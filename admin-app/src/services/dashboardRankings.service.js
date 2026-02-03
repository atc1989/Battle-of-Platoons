import { listAgents, listPlatoons } from "./agents.service";
import { listCompanies } from "./companies.service";
import { listDepotsDetailed } from "./depots.service";
import { supabase } from "./supabase";

function normalizeMode(mode) {
  const key = String(mode || "").toLowerCase();
  if (key === "depots") return "depots";
  if (key === "companies") return "companies";
  if (key === "commanders") return "commanders";
  return "leaders";
}

function normalizePhotoUrl(item) {
  return item?.photoURL ?? item?.photo_url ?? "";
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

export async function getDashboardRankings({ mode, dateFrom, dateTo, roleFilter } = {}) {
  const resolvedMode = normalizeMode(mode);
  const [agents, depots, companies, platoons, rawResult] = await Promise.all([
    listAgents(),
    listDepotsDetailed(),
    listCompanies(),
    listPlatoons(),
    supabase
      .from("raw_data")
      .select(
        `
        id,
        agent_id,
        leads,
        payins,
        sales,
        leads_depot_id,
        sales_depot_id,
        date_real,
        date,
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
      ),
  ]);

  if (rawResult?.error) throw rawResult.error;

  const agentsMap = new Map((agents ?? []).map((agent) => [String(agent.id), agent]));
  const depotsMap = new Map((depots ?? []).map((depot) => [String(depot.id), depot]));
  const companiesMap = new Map((companies ?? []).map((company) => [String(company.id), company]));
  const platoonsMap = new Map((platoons ?? []).map((platoon) => [String(platoon.id), platoon]));

  let rawRows = rawResult?.data ?? [];

  if (dateFrom && dateTo) {
    const start = new Date(`${dateFrom}T00:00:00`);
    const end = new Date(`${dateTo}T23:59:59`);
    rawRows = rawRows.filter((row) => {
      const d = getRowDate(row);
      return d && d >= start && d <= end;
    });
  }

  const grouped = new Map();
  let rows = [];

  const leadersMode = resolvedMode === "leaders";

  if (leadersMode && roleFilter && roleFilter !== "platoon") {
    rawRows = rawRows.filter((row) => {
      const agentId = String(row.agent_id ?? "");
      const agent = row.agents ?? agentsMap.get(agentId) ?? {};
      return (agent?.role ?? "platoon") === roleFilter;
    });
  }

  if (leadersMode && roleFilter === "platoon") {
    const NO_UPLINE_KEY = "no-upline";
    rawRows.forEach((row) => {
      const agentId = String(row.agent_id ?? "");
      const agent = row.agents ?? agentsMap.get(agentId) ?? {};
      const uplineId = agent.upline_agent_id ?? agent.uplineAgentId ?? "";
      const key = uplineId ? String(uplineId) : NO_UPLINE_KEY;

      if (!grouped.has(key)) {
        const uplineAgent = key !== NO_UPLINE_KEY ? agentsMap.get(key) : null;
        grouped.set(key, {
          id: key,
          name: uplineAgent?.name ?? (key === NO_UPLINE_KEY ? "No Upline" : "Unknown Upline"),
          photoUrl: normalizePhotoUrl(uplineAgent),
          leads: 0,
          payins: 0,
          sales: 0,
          points: 0,
        });
      }

      const item = grouped.get(key);
      item.leads += toNumber(row.leads);
      item.payins += toNumber(row.payins);
      item.sales += toNumber(row.sales);
    });
    rows = Array.from(grouped.values());
  } else if (leadersMode) {
    rawRows.forEach((row) => {
      const agentId = String(row.agent_id ?? "");
      const agent = row.agents ?? agentsMap.get(agentId) ?? {};
      if (!agentId) return;
      if (!grouped.has(agentId)) {
        grouped.set(agentId, {
          id: agentId,
          name: agent.name ?? "Unknown Leader",
          photoUrl: normalizePhotoUrl(agent),
          leads: 0,
          payins: 0,
          sales: 0,
          points: 0,
        });
      }
      const item = grouped.get(agentId);
      item.leads += toNumber(row.leads);
      item.payins += toNumber(row.payins);
      item.sales += toNumber(row.sales);
    });
    rows = Array.from(grouped.values());
  } else if (resolvedMode === "depots") {
    const ensureDepotBucket = (depotKey) => {
      if (!depotKey) return null;
      if (grouped.has(depotKey)) return grouped.get(depotKey);
      const depot = depotsMap.get(depotKey) ?? null;
      const depotName = depot?.name || (depotKey === "unassigned" ? "Unassigned" : depotKey);
      const bucket = {
        id: depotKey,
        name: depotName,
        photoUrl: normalizePhotoUrl(depot),
        leads: 0,
        payins: 0,
        sales: 0,
        points: 0,
      };
      grouped.set(depotKey, bucket);
      return bucket;
    };

    rawRows.forEach((row) => {
      const leadsKey = row.leads_depot_id ? String(row.leads_depot_id) : "unassigned";
      const salesKey = row.sales_depot_id ? String(row.sales_depot_id) : "unassigned";

      const leadsBucket = ensureDepotBucket(leadsKey);
      const salesBucket = ensureDepotBucket(salesKey);

      if (leadsBucket) {
        leadsBucket.leads += toNumber(row.leads);
      }
      if (salesBucket) {
        salesBucket.payins += toNumber(row.payins);
        salesBucket.sales += toNumber(row.sales);
      }
    });
    rows = Array.from(grouped.values());
  } else if (resolvedMode === "commanders") {
    rawRows.forEach((row) => {
      const agentId = String(row.agent_id ?? "");
      const agent = row.agents ?? agentsMap.get(agentId) ?? {};
      const companyId = agent.company_id ?? agent.companyId ?? "";
      const key = companyId ? String(companyId) : "";
      if (!key) return;
      const company = companiesMap.get(key);
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          name: company?.name ?? "Unknown Commander",
          photoUrl: normalizePhotoUrl(company),
          leads: 0,
          payins: 0,
          sales: 0,
          points: 0,
        });
      }
      const item = grouped.get(key);
      item.leads += toNumber(row.leads);
      item.payins += toNumber(row.payins);
      item.sales += toNumber(row.sales);
    });
    rows = Array.from(grouped.values());
  } else if (resolvedMode === "companies") {
    rawRows.forEach((row) => {
      const agentId = String(row.agent_id ?? "");
      const agent = row.agents ?? agentsMap.get(agentId) ?? {};
      const platoonId = agent.platoon_id ?? agent.platoonId ?? "";
      const key = platoonId ? String(platoonId) : "";
      if (!key) return;
      const platoon = platoonsMap.get(key);
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          name: platoon?.name ?? "Unknown Company",
          photoUrl: normalizePhotoUrl(platoon),
          leads: 0,
          payins: 0,
          sales: 0,
          points: 0,
        });
      }
      const item = grouped.get(key);
      item.leads += toNumber(row.leads);
      item.payins += toNumber(row.payins);
      item.sales += toNumber(row.sales);
    });
    rows = Array.from(grouped.values());
  }

  const totals = rows.reduce(
    (acc, row) => {
      acc.totalLeads += toNumber(row.leads);
      acc.totalSales += toNumber(row.sales);
      return acc;
    },
    { totalLeads: 0, totalSales: 0 }
  );

  const kpis = {
    leadersCount: (agents ?? []).length,
    depotsCount: (depots ?? []).length,
    companiesCount: (companies ?? []).length,
    totalLeads: totals.totalLeads,
    totalSales: totals.totalSales,
  };

  return { kpis, rows };
}
