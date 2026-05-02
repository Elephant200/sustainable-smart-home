/**
 * Pure deterministic EV charging model. Implements smart charging:
 *  - Off-peak overnight charging window (default 22:00..06:00 next day)
 *  - Daytime opportunistic charging from solar surplus (handled by flows)
 *  - Departure-time aware: target SOC must be reached before departure_time
 */

export interface EvDeviceConfig {
  id: string;
  battery_capacity_kwh: number;
  target_charge: number; // 0..1 fraction
  charger_power_kw: number;
  departure_time: string; // "HH:MM:SS+TZ" or "HH:MM"
}

export function isOvernightWindow(date: Date): boolean {
  const h = date.getHours();
  return h >= 22 || h < 6;
}

function parseDepartureHour(departure: string): number {
  const m = /^(\d{1,2})/.exec(departure ?? '');
  return m ? Math.min(23, Math.max(0, parseInt(m[1], 10))) : 7;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Computes deterministic SOC% for an EV at any timestamp.
 * Algorithm:
 *  - At 22:00 the EV starts at a deterministic 18..40% SOC for that day
 *  - Charges at charger_power_kw until target_charge × capacity reached
 *  - Holds target SOC until departure_time
 *  - Then SOC decays linearly until 22:00 (return + drive)
 */
export function computeEvSocPercent(
  cfg: EvDeviceConfig,
  date: Date
): number {
  const hour = date.getHours() + date.getMinutes() / 60;
  const departureHour = parseDepartureHour(cfg.departure_time);

  const targetSoc = cfg.target_charge * 100;
  const capacity = cfg.battery_capacity_kwh;
  const power = cfg.charger_power_kw;

  const dayKey =
    date.getFullYear() * 10000 +
    (date.getMonth() + 1) * 100 +
    date.getDate() +
    (cfg.id.charCodeAt(0) || 1);
  const startSocPct = 18 + seededRandom(dayKey) * 22;
  const startSocKwh = (startSocPct / 100) * capacity;
  const targetSocKwh = (targetSoc / 100) * capacity;
  const energyToAdd = Math.max(0, targetSocKwh - startSocKwh);
  const hoursToFull = power > 0 ? energyToAdd / power : 0;

  let chargeStartHour = 22;
  if (hour < 22) {
    chargeStartHour = -2;
  }
  const hoursIntoCycle = hour - chargeStartHour;

  if (hoursIntoCycle <= 0) {
    return startSocPct;
  }

  if (hoursIntoCycle <= hoursToFull) {
    const energy = startSocKwh + hoursIntoCycle * power;
    return Math.min(targetSoc, (energy / capacity) * 100);
  }

  if (hour < departureHour) {
    return targetSoc;
  }

  const drivingDuration = Math.max(1, 22 - departureHour);
  const dailyUsageKwh = Math.max(0, (cfg.target_charge - 0.25) * capacity);
  const usageRate = dailyUsageKwh / drivingDuration;
  const hoursDriving = hour - departureHour;
  const energy = targetSocKwh - hoursDriving * usageRate;
  return Math.max(20, (energy / capacity) * 100);
}

/**
 * Power being drawn by EV at a given instant (kW).
 */
export function computeEvChargeRateKw(
  cfg: EvDeviceConfig,
  date: Date,
  solarSurplusKw = 0
): number {
  const soc = computeEvSocPercent(cfg, date);
  const targetPct = cfg.target_charge * 100;

  if (soc >= targetPct - 0.5) {
    if (solarSurplusKw > 0.5 && !isOvernightWindow(date)) {
      return Math.min(cfg.charger_power_kw, solarSurplusKw);
    }
    return 0;
  }

  if (isOvernightWindow(date)) {
    return cfg.charger_power_kw;
  }

  if (solarSurplusKw > 0.5) {
    return Math.min(cfg.charger_power_kw, solarSurplusKw);
  }

  return 0;
}

export function isPluggedIn(cfg: EvDeviceConfig, date: Date): boolean {
  const hour = date.getHours();
  const departureHour = parseDepartureHour(cfg.departure_time);
  return hour < departureHour || hour >= 17;
}

/**
 * Default model assumption for EV efficiency in the simulator. Real provider
 * adapters can override by computing actual efficiency from odometer + energy
 * history. Centralizing this constant means UI/route code never embeds the
 * number directly.
 */
export const EV_EFFICIENCY_MI_PER_KWH = 4.0;

export function estimateRangeMiles(
  socPct: number,
  capacityKwh: number,
  efficiencyMiPerKwh: number = EV_EFFICIENCY_MI_PER_KWH
): number {
  return Math.round((socPct / 100) * capacityKwh * efficiencyMiPerKwh);
}

export function timeToFull(
  socPct: number,
  cfg: EvDeviceConfig
): { hours: number; label: string } {
  const targetPct = cfg.target_charge * 100;
  if (socPct >= targetPct - 0.5)
    return { hours: 0, label: '0:00' };
  const remainingKwh = ((targetPct - socPct) / 100) * cfg.battery_capacity_kwh;
  const hrs = cfg.charger_power_kw > 0 ? remainingKwh / cfg.charger_power_kw : 0;
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  return { hours: hrs, label: `${h}:${String(m).padStart(2, '0')}` };
}
