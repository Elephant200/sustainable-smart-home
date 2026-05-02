/**
 * Pure deterministic house-load model. Mirrors client-generators.ts.
 */

const HOURLY_BASE_LOAD = [
  0.8, 0.7, 0.6, 0.6, 0.7, 1.2,
  2.1, 3.2, 3.8, 2.9, 2.2, 2.0,
  2.1, 2.3, 2.2, 2.1, 2.0, 2.8,
  4.2, 4.8, 4.1, 3.2, 2.1, 1.4,
];

export function getBaseLoad(hour: number): number {
  return HOURLY_BASE_LOAD[hour] ?? 1.0;
}

export function getSeasonalFactor(date: Date): number {
  const month = date.getMonth() + 1;
  const factors: Record<number, number> = {
    1: 1.4, 2: 1.3, 3: 1.1, 4: 0.9, 5: 0.8, 6: 1.2,
    7: 1.5, 8: 1.5, 9: 1.2, 10: 0.9, 11: 1.1, 12: 1.3,
  };
  return factors[month] ?? 1.0;
}

export function getDayOfWeekFactor(date: Date): number {
  const d = date.getDay();
  return d === 0 || d === 6 ? 1.2 : 1.0;
}

function getApplianceLoad(date: Date): number {
  const hour = date.getHours();
  const seed = date.getTime() / (1000 * 60 * 60);
  let prob = 0.1;
  if (hour >= 7 && hour <= 9) prob = 0.3;
  if (hour >= 18 && hour <= 21) prob = 0.4;
  if (hour >= 22 && hour <= 23) prob = 0.2;
  const random = (Math.sin(seed * 1.17) + 1) / 2;
  if (random >= prob) return 0;
  const loads = [0.5, 0.8, 2.5, 1.2, 0.3, 1.8, 0.4];
  const idx = Math.floor(((Math.sin(seed * 2.31) + 1) / 2) * loads.length);
  return loads[Math.min(idx, loads.length - 1)] ?? 0;
}

export function computeHouseLoadInstant(date: Date): number {
  const baseLoad = getBaseLoad(date.getHours());
  const seasonal = getSeasonalFactor(date);
  const dow = getDayOfWeekFactor(date);
  const appliance = getApplianceLoad(date);
  const seed = date.getTime() / (1000 * 60 * 60);
  const variation = 0.9 + ((Math.sin(seed * 2.17) + 1) / 2) * 0.2;
  return Math.max(0.2, baseLoad * seasonal * dow * variation + appliance);
}
