import * as XLSX from "xlsx";
import { listAgents } from "./agents.service";
import { supabase } from "./supabase";

const HEADER_ALIASES = {
  agent_id: ["agent_id", "agentid", "agent", "agent id"],
  leader_name: ["leader", "leader_name", "platoon_leader", "platoon leader", "name"],
  date: ["date"],
  leads: ["leads"],
  payins: ["payins", "pay ins", "pay_in", "pay in"],
  sales: ["sales"],
};

const REQUIRED_FIELDS = ["date", "leads", "payins", "sales"];

function normalizeHeaderName(header = "") {
  return header
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function findHeaderKey(normalizedHeader) {
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(normalizedHeader)) return key;
  }
  return null;
}

function normalizeName(name = "") {
  return name
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, "")
    .replace(/\s+/g, " ");
}

function parseDateValue(value, errors) {
  if (value === null || value === undefined || value === "") {
    errors.push("Missing Date");
    return { date: "", original: value };
  }

  if (value instanceof Date) {
    return { date: value.toISOString().slice(0, 10), original: value }; // already a Date
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
      return { date: date.toISOString().slice(0, 10), original: value };
    }
  }

  const str = value.toString().trim();
  const dateObj = new Date(str);
  if (!Number.isNaN(dateObj.getTime())) {
    return { date: dateObj.toISOString().slice(0, 10), original: value };
  }

  errors.push("Invalid Date");
  return { date: "", original: value };
}

function parseNumber(value, field, errors) {
  if (value === null || value === undefined || value === "") return 0;
  const num = Number(value);
  if (Number.isFinite(num)) return num;
  errors.push(`Invalid number for ${field}`);
  return 0;
}

async function buildAgentLookups() {
  const agents = await listAgents();
  const byId = new Map();
  const byName = new Map();

  agents.forEach(agent => {
    byId.set(agent.id, agent);
    const normName = normalizeName(agent.name);
    if (!byName.has(normName)) byName.set(normName, []);
    byName.get(normName).push(agent);
  });

  return { byId, byName };
}

function resolveAgent(agentIdInput, leaderNameInput, lookups, errors) {
  const agentId = agentIdInput?.toString().trim();
  const leaderName = leaderNameInput?.toString().trim();

  if (agentId) {
    if (lookups.byId.has(agentId)) {
      return agentId;
    }
    errors.push("agent_id not found");
    return "";
  }

  if (leaderName) {
    const normName = normalizeName(leaderName);
    const matches = lookups.byName.get(normName) ?? [];
    if (matches.length === 1) return matches[0].id;
    if (matches.length > 1) {
      errors.push("Ambiguous leader name: matches multiple agents. Use agent_id.");
      return "";
    }
    errors.push("Leader name not found");
    return "";
  }

  errors.push("Missing agent_id or leader_name");
  return "";
}

export async function parseRawDataWorkbook(file) {
  if (!file) throw new Error("File is required");

  const lookups = await buildAgentLookups();
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });

  const sheetName = workbook.SheetNames.includes("Daily Data")
    ? "Daily Data"
    : workbook.SheetNames[0];

  if (!sheetName) throw new Error("No sheets found in workbook");

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
  if (!rawRows.length) throw new Error("Sheet is empty");

  const headersRaw = rawRows[0];
  const headerMap = {};
  headersRaw.forEach((header, idx) => {
    const norm = normalizeHeaderName(header);
    const key = findHeaderKey(norm);
    if (key && !(key in headerMap)) headerMap[key] = idx;
  });

  const missingRequired = REQUIRED_FIELDS.filter(f => headerMap[f] === undefined);
  if (missingRequired.length) {
    throw new Error(`Missing required columns: ${missingRequired.join(", ")}`);
  }

  const rows = rawRows.slice(1).map((rawRow, idx) => {
    const errors = [];

    const dateCell = rawRow[headerMap.date];
    const { date: date_real, original: originalDate } = parseDateValue(dateCell, errors);

    const leads = parseNumber(rawRow[headerMap.leads], "Leads", errors);
    const payins = parseNumber(rawRow[headerMap.payins], "Payins", errors);
    const sales = parseNumber(rawRow[headerMap.sales], "Sales", errors);

    const agent_id_input = headerMap.agent_id !== undefined ? rawRow[headerMap.agent_id] : "";
    const leader_name_input = headerMap.leader_name !== undefined ? rawRow[headerMap.leader_name] : "";

    const resolved_agent_id = resolveAgent(agent_id_input, leader_name_input, lookups, errors);

    return {
      sourceRowIndex: idx + 2, // +2 to account for header row and 1-indexing
      date_real,
      date_original: originalDate,
      agent_id_input: agent_id_input?.toString().trim() ?? "",
      leader_name_input: leader_name_input?.toString().trim() ?? "",
      resolved_agent_id,
      leads,
      payins,
      sales,
      status: errors.length ? "invalid" : "valid",
      errors,
    };
  });

  return {
    rows,
    meta: { sheetName, totalRows: rows.length },
  };
}

export async function saveRawDataRows(validRows, onProgress = () => {}) {
  const batchSize = 200;
  let upsertedCount = 0;
  const errors = [];
  const now = new Date().toISOString();

  for (let i = 0; i < validRows.length; i += batchSize) {
    const batch = validRows.slice(i, i + batchSize).map(row => ({
      id: `${row.date_real}_${row.resolved_agent_id}`,
      agent_id: row.resolved_agent_id,
      leads: row.leads,
      payins: row.payins,
      sales: row.sales,
      date_real: row.date_real,
      date: { source: "xlsx", original: row.date_original ?? row.date_real },
      createdAt: { iso: now },
      updatedAt: { iso: now },
    }));

    const { data, error } = await supabase.from("raw_data").upsert(batch, { onConflict: "id" }).select();
    if (error) {
      errors.push(error.message || "Unknown database error");
    } else {
      upsertedCount += data?.length ?? 0;
    }

    onProgress(Math.min(i + batch.length, validRows.length), validRows.length);
  }

  return { upsertedCount, errors };
}
