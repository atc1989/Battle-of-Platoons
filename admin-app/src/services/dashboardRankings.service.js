import { listAgents } from "./agents.service";
import { listCompanies } from "./companies.service";
import { listDepots } from "./depots.service";
import { supabase } from "./supabase";

function normalizeMode(mode) {
  const key = String(mode || "").toLowerCase();
  if (key === "depots") return "depots";
  if (key === "companies") return "companies";
  return "leaders";
}

function normalizePhotoUrl(item) {
  return item?.photoURL ?? item?.photo_url ?? "";
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export async function getDashboardRankings({ mode, dateFrom, dateTo } = {}) {
  const resolvedMode = normalizeMode(mode);
  const [agents, depots, companies, rawResult] = await Promise.all([
    listAgents(),
    listDepots(),
    listCompanies(),
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
        date,
        approved,
        voided,
        agents:agents (
          id,
          name,
          photo_url,
          photoURL,
          depot_id,
          company_id
        )
      `
      ),
  ]);

  if (rawResult?.error) throw rawResult.error;

  const agentsMap = new Map((agents ?? []).map((agent) => [String(agent.id), agent]));
  const depotsMap = new Map((depots ?? []).map((depot) => [String(depot.id), depot]));
  const companiesMap = new Map((companies ?? []).map((company) => [String(company.id), company]));
  const rawRows = rawResult?.data ?? [];

  const grouped = new Map();
  let rows = [];

  if (resolvedMode === "leaders") {
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
    rawRows.forEach((row) => {
      const agentId = String(row.agent_id ?? "");
      const agent = row.agents ?? agentsMap.get(agentId) ?? {};
      const depotId = agent.depot_id ?? agent.depotId ?? "";
      const key = depotId ? String(depotId) : "";
      if (!key) return;
      const depot = depotsMap.get(key);
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          name: depot?.name ?? "Unknown Depot",
          photoUrl: normalizePhotoUrl(depot),
          leads: 0,
          payins: 0,
          sales: 0,
          points: 0,
        });
      }
      const item = grouped.get(key);
      item.leads += toNumber(row.leads);
      item.sales += toNumber(row.sales);
    });
    rows = Array.from(grouped.values());
  } else if (resolvedMode === "companies") {
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
          name: company?.name ?? "Unknown Company",
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
  }

  const kpis = {
    leadersCount: (agents ?? []).length,
    depotsCount: (depots ?? []).length,
    companiesCount: (companies ?? []).length,
    totalLeads: rows.reduce((sum, row) => sum + toNumber(row.leads), 0),
    totalSales: rows.reduce((sum, row) => sum + toNumber(row.sales), 0),
  };

  return { kpis, rows };
}
