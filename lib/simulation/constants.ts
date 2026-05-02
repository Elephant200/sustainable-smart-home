/**
 * Shared deterministic tunables for the smart-home simulation.
 * Everything UI-visible that's not derived from a live timeseries lives here
 * so the dashboards never embed magic numbers in JSX.
 */

export const OFF_PEAK_START_HOUR = 22;
export const OFF_PEAK_END_HOUR = 6;

export const RESERVE_FRACTION = 0.15;

export const ROUND_TRIP_EFFICIENCY_PCT = 96.2;
export const STORAGE_EFFICIENCY_PCT = 96;

export const BATTERY_COOLING_TEMP_THRESHOLD_F = 74;

export const PRIORITY_MODE_LABEL = "Solar First";

function fmtHourLabel(h: number): string {
  const am = h < 12 ? "AM" : "PM";
  const hh = h % 12 || 12;
  return `${hh} ${am}`;
}

export function offPeakWindowLabel(): string {
  return `${fmtHourLabel(OFF_PEAK_START_HOUR)} – ${fmtHourLabel(OFF_PEAK_END_HOUR)}`;
}

export function offPeakStartLabel(): string {
  return `${fmtHourLabel(OFF_PEAK_START_HOUR).replace(" ", ":00 ")}`;
}

export function fmtClock12h(timeHHmm: string): string {
  const [hStr, mStr] = String(timeHHmm).split(":");
  const h = Number(hStr) || 0;
  const m = Number(mStr) || 0;
  const am = h < 12 ? "AM" : "PM";
  const hh = h % 12 || 12;
  return `${hh}:${m.toString().padStart(2, "0")} ${am}`;
}

export function healthLabel(pct: number): string {
  if (pct >= 95) return "Excellent condition";
  if (pct >= 85) return "Good condition";
  if (pct >= 70) return "Fair condition";
  return "Service recommended";
}

export function backupModeLabel(availableKwh: number, criticalLoadKw: number): string {
  const hours = criticalLoadKw > 0 ? availableKwh / criticalLoadKw : 0;
  if (hours >= 4) return "Ready";
  if (hours >= 1) return "Limited";
  return "Insufficient";
}
