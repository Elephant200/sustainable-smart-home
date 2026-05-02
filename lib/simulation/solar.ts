/**
 * Pure deterministic solar physics. Re-exposes the same model used by
 * client-generators so server code can compute single-instant power values.
 */

export interface SolarArrayConfig {
  id: string;
  panel_count: number;
  output_per_panel_kw: number;
}

export interface SolarPanelInstant {
  panel_index: number;
  output_kw: number;
  efficiency_pct: number;
}

export interface SolarArrayInstant {
  device_id: string;
  total_output_kw: number;
  irradiance: number;
  weather_factor: number;
  efficiency_factor: number;
  per_panel: SolarPanelInstant[];
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function getSolarIrradiance(date: Date, latitude = 37.7749): number {
  const hour = date.getHours() + date.getMinutes() / 60;
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  const declination =
    23.45 * Math.sin(((360 * (284 + dayOfYear)) / 365) * Math.PI / 180);
  const hourAngle = 15 * (hour - 12);
  const elevation =
    (Math.asin(
      Math.sin((declination * Math.PI) / 180) *
        Math.sin((latitude * Math.PI) / 180) +
        Math.cos((declination * Math.PI) / 180) *
          Math.cos((latitude * Math.PI) / 180) *
          Math.cos((hourAngle * Math.PI) / 180)
    ) *
      180) /
    Math.PI;
  if (elevation <= 0) return 0;
  const irr = Math.sin((elevation * Math.PI) / 180);
  const sinE = Math.sin((elevation * Math.PI) / 180);
  const atmos = sinE > 0.01 ? Math.pow(0.7, 1 / sinE) : 0;
  return Math.max(0, Math.min(1, irr * atmos));
}

export function getWeatherFactor(date: Date): number {
  const seed = date.getTime() / (1000 * 60 * 60 * 24);
  const noise = Math.sin(seed * 0.1) * 0.3 + Math.cos(seed * 0.05) * 0.2;
  const random = (Math.sin(seed * 1.7) + 1) / 2;
  return Math.max(0.1, Math.min(1.0, 0.7 + noise + random * 0.3));
}

export function getEfficiencyFactor(date: Date): number {
  const hour = date.getHours();
  let tempFactor = 1.0;
  if (hour >= 11 && hour <= 16) {
    tempFactor = 0.95 - (hour - 11) / 20;
  }
  const seed = date.getTime() / (1000 * 60 * 60 * 24);
  const random = (Math.sin(seed * 3.14) + 1) / 2;
  const dustFactor = 0.9 + random * 0.05;
  return Math.max(0.85, Math.min(0.95, tempFactor * dustFactor));
}

/**
 * Compute total kW output for a single solar array at a given instant,
 * with deterministic per-panel variation.
 */
export function computeSolarArrayInstant(
  config: SolarArrayConfig,
  date: Date
): SolarArrayInstant {
  const irradiance = getSolarIrradiance(date);
  const weather = getWeatherFactor(date);
  const efficiency = getEfficiencyFactor(date);
  const baseOutputPerPanel =
    config.output_per_panel_kw * irradiance * weather * efficiency;

  const perPanel: SolarPanelInstant[] = [];
  for (let i = 0; i < config.panel_count; i++) {
    const panelSeed =
      (config.id.charCodeAt(0) || 1) * (i + 1) +
      date.getHours() * (i + 7);
    const variation = 0.92 + seededRandom(panelSeed) * 0.16;
    const output = baseOutputPerPanel * variation;
    const ratedOutput = config.output_per_panel_kw;
    const effPct =
      ratedOutput > 0
        ? Math.min(100, Math.max(0, (output / ratedOutput) * 100))
        : 0;
    perPanel.push({
      panel_index: i,
      output_kw: Math.max(0, output),
      efficiency_pct: Math.round(effPct),
    });
  }

  const total = perPanel.reduce((s, p) => s + p.output_kw, 0);

  return {
    device_id: config.id,
    total_output_kw: total,
    irradiance,
    weather_factor: weather,
    efficiency_factor: efficiency,
    per_panel: perPanel,
  };
}

export function computeTotalSolarInstant(
  configs: SolarArrayConfig[],
  date: Date
): number {
  let total = 0;
  for (const cfg of configs) {
    const irradiance = getSolarIrradiance(date);
    const weather = getWeatherFactor(date);
    const efficiency = getEfficiencyFactor(date);
    total +=
      cfg.panel_count * cfg.output_per_panel_kw * irradiance * weather * efficiency;
  }
  return total;
}
