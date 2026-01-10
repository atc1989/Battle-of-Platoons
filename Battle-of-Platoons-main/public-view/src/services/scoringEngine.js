export function computeMetricScore(actual, divisor, maxPoints) {
  const actualValue = Number(actual);
  const divisorValue = Number(divisor);
  const maxPointsValue = Number(maxPoints);

  if (!Number.isFinite(actualValue) || !Number.isFinite(divisorValue) || !Number.isFinite(maxPointsValue)) {
    return 0;
  }

  if (divisorValue <= 0 || actualValue <= 0) return 0;

  const score = (actualValue / divisorValue) * maxPointsValue;
  return Math.min(score, maxPointsValue);
}

export function computeTotalScore(battleType, totals, config) {
  const normalizedBattleType = String(battleType || "").toLowerCase();
  const metricsConfig = Array.isArray(config?.metrics ?? config) ? config?.metrics ?? config : [];
  const totalsMap = totals || {};

  let total = 0;

  for (const metric of metricsConfig) {
    const key = (metric?.key ?? metric?.metric ?? metric?.name ?? "").toString().toLowerCase();
    if (!key) continue;
    if (normalizedBattleType === "depots" && key === "payins") continue;

    const actual = totalsMap[key] ?? 0;
    const divisor = metric?.divisor ?? metric?.division ?? 0;
    const maxPoints = metric?.maxPoints ?? metric?.max_points ?? metric?.points ?? 0;

    total += computeMetricScore(actual, divisor, maxPoints);
  }

  return total;
}
