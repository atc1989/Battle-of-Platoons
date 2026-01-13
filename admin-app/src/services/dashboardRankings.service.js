import { listAgents } from "./agents.service";
import { listCompanies } from "./companies.service";
import { listDepots } from "./depots.service";

function normalizeMode(mode) {
  const key = String(mode || "").toLowerCase();
  if (key === "depots") return "depots";
  if (key === "companies") return "companies";
  return "leaders";
}

function normalizePhotoUrl(item) {
  return item?.photoURL ?? item?.photo_url ?? "";
}

export async function getDashboardRankings({ mode } = {}) {
  const resolvedMode = normalizeMode(mode);
  const [agents, depots, companies] = await Promise.all([
    listAgents(),
    listDepots(),
    listCompanies(),
  ]);

  let rows = [];

  if (resolvedMode === "leaders") {
    rows = (agents ?? []).map((agent) => ({
      id: agent.id,
      name: agent.name ?? "Unknown Leader",
      photoUrl: normalizePhotoUrl(agent),
      leads: 0,
      payins: 0,
      sales: 0,
      points: 0,
    }));
  } else if (resolvedMode === "depots") {
    rows = (depots ?? []).map((depot) => ({
      id: depot.id,
      name: depot.name ?? "Unknown Depot",
      photoUrl: normalizePhotoUrl(depot),
      leads: 0,
      payins: 0,
      sales: 0,
      points: 0,
    }));
  } else if (resolvedMode === "companies") {
    rows = (companies ?? []).map((company) => ({
      id: company.id,
      name: company.name ?? "Unknown Company",
      photoUrl: normalizePhotoUrl(company),
      leads: 0,
      payins: 0,
      sales: 0,
      points: 0,
    }));
  }

  const kpis = {
    leadersCount: (agents ?? []).length,
    depotsCount: (depots ?? []).length,
    companiesCount: (companies ?? []).length,
    totalLeads: 0,
    totalSales: 0,
  };

  return { kpis, rows };
}
