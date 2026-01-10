import { supabase, supabaseConfigured } from "./supabase";
import { getLeaderboard } from "./leaderboard.service";

function toYMD(input) {
  if (!input) return "";
  if (typeof input === "string") return input;
  const yyyy = input.getFullYear();
  const mm = String(input.getMonth() + 1).padStart(2, "0");
  const dd = String(input.getDate()).padStart(2, "0");
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

function normalizeViewKey(input) {
  const key = String(input || "").toLowerCase();
  if (key === "companies") return "companies";
  if (key === "depots") return "depots";
  return "leaders";
}

export async function getDashboardSummary({
  dateFrom = null,
  dateTo = null,
  battleType = "leaders",
} = {}) {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }

  const today = new Date();
  const startDate = toYMD(dateFrom || startOfMonth(today));
  const endDate = toYMD(dateTo || today);
  const viewKey = normalizeViewKey(battleType);
  const weekKey = toIsoWeekKey(endDate);

  const countsPromise = Promise.all([
    supabase.from("agents").select("id", { count: "exact", head: true }),
    supabase.from("companies").select("id", { count: "exact", head: true }),
    supabase.from("depots").select("id", { count: "exact", head: true }),
  ]);

  const leaderboardPromise = getLeaderboard({
    startDate,
    endDate,
    groupBy: viewKey,
    battleType: viewKey,
    weekKey,
  });

  const [[leadersRes, companiesRes, depotsRes], leaderboard] = await Promise.all([
    countsPromise,
    leaderboardPromise,
  ]);

  if (leadersRes.error) throw leadersRes.error;
  if (companiesRes.error) throw companiesRes.error;
  if (depotsRes.error) throw depotsRes.error;

  const rows = leaderboard?.rows || [];
  const metrics = leaderboard?.metrics || { totalLeads: 0, totalSales: 0 };

  return {
    kpis: {
      leadersCount: leadersRes.count ?? 0,
      companiesCount: companiesRes.count ?? 0,
      depotsCount: depotsRes.count ?? 0,
      totalLeads: metrics.totalLeads ?? 0,
      totalSales: metrics.totalSales ?? 0,
    },
    podium: rows.slice(0, 3),
    rows: rows.slice(3),
  };
}
