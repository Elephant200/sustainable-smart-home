/**
 * Aggregations and derived KPIs from solved-flow histories.
 */

import { SolvedFlows } from './flows';
import { ROUND_TRIP_EFFICIENCY_PCT, STORAGE_EFFICIENCY_PCT } from './constants';

export interface MonthlyTotals {
  month: string;
  monthLabel: string;
  solar_mwh: number;
  consumption_mwh: number;
  savings_usd: number;
  carbon_reduced_tons: number;
}

const KWH_TO_USD = 0.18;
const KG_CO2_PER_KWH_GRID = 0.4;
const TONS_PER_KG = 0.001;

export function aggregateMonthly(flows: SolvedFlows[]): MonthlyTotals[] {
  const monthLabels = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const buckets = new Map<
    string,
    {
      solar: number;
      consumption: number;
      gridImport: number;
      gridExport: number;
      monthIdx: number;
    }
  >();
  for (const f of flows) {
    const y = f.timestamp.getFullYear();
    const m = f.timestamp.getMonth();
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    if (!buckets.has(key))
      buckets.set(key, {
        solar: 0,
        consumption: 0,
        gridImport: 0,
        gridExport: 0,
        monthIdx: m,
      });
    const b = buckets.get(key)!;
    b.solar += f.solar_kw;
    b.consumption += f.house_kw + f.ev_kw;
    if (f.grid_kw > 0) b.gridImport += f.grid_kw;
    else b.gridExport += -f.grid_kw;
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, b]) => {
      const offsetKwh = Math.max(0, b.solar - b.gridExport);
      const savings = offsetKwh * KWH_TO_USD + b.gridExport * KWH_TO_USD * 0.5;
      const carbon = offsetKwh * KG_CO2_PER_KWH_GRID * TONS_PER_KG;
      return {
        month: key,
        monthLabel: monthLabels[b.monthIdx] ?? key,
        solar_mwh: Math.round((b.solar / 1000) * 100) / 100,
        consumption_mwh: Math.round((b.consumption / 1000) * 100) / 100,
        savings_usd: Math.round(savings),
        carbon_reduced_tons: Math.round(carbon * 100) / 100,
      };
    });
}

export interface CostSavingsCategory {
  category: string;
  amount_usd: number;
  percentage: number;
}

export function computeCostSavings(flows: SolvedFlows[]): CostSavingsCategory[] {
  let solarOffsetKwh = 0;
  let exportKwh = 0;
  let batteryDischargeKwh = 0;
  let evChargeKwh = 0;
  for (const f of flows) {
    const exported = f.grid_kw < 0 ? -f.grid_kw : 0;
    const selfUsed = Math.max(0, f.solar_kw - exported);
    solarOffsetKwh += selfUsed;
    exportKwh += exported;
    if (f.battery_power_kw < 0) batteryDischargeKwh += -f.battery_power_kw;
    evChargeKwh += f.ev_kw;
  }

  const solarSavings = solarOffsetKwh * KWH_TO_USD;
  const peakShavingSavings = batteryDischargeKwh * KWH_TO_USD * 0.6;
  const exportRevenue = exportKwh * KWH_TO_USD * 0.5;
  const evSmartCharging = evChargeKwh * KWH_TO_USD * 0.18;
  const loadOptimization = (solarOffsetKwh + batteryDischargeKwh) * 0.04;
  const gridServices = exportKwh * 0.06;

  const categories: CostSavingsCategory[] = [
    { category: 'Solar Generation', amount_usd: solarSavings, percentage: 0 },
    { category: 'Peak Shaving', amount_usd: peakShavingSavings, percentage: 0 },
    { category: 'Time-of-Use', amount_usd: exportRevenue, percentage: 0 },
    { category: 'EV Smart Charging', amount_usd: evSmartCharging, percentage: 0 },
    { category: 'Load Optimization', amount_usd: loadOptimization, percentage: 0 },
    { category: 'Grid Services', amount_usd: gridServices, percentage: 0 },
  ].map((c) => ({ ...c, amount_usd: Math.round(c.amount_usd) }));

  const total = categories.reduce((s, c) => s + c.amount_usd, 0);
  return categories.map((c) => ({
    ...c,
    percentage: total > 0 ? Math.round((c.amount_usd / total) * 1000) / 10 : 0,
  }));
}

export interface AnalyticsSummary {
  solar_today_kwh: number;
  solar_current_kw: number;
  solar_month_mwh: number;
  monthly_savings_usd: number;
  annual_savings_usd: number;
  carbon_reduced_tons_month: number;
  carbon_reduced_tons_year: number;
  grid_independence_pct: number;
  daily_savings_usd: number;
  battery_stored_kwh: number;
  battery_month_mwh: number;
  ev_month_mwh: number;
  house_month_mwh: number;
  ytd_solar_mwh: number;
  ytd_savings_usd: number;
  ytd_carbon_tons: number;
  uptime_pct: number;
  prev_month_savings_usd: number;
  month_over_month_savings_pct: number;
  battery_round_trip_efficiency_pct: number;
  storage_efficiency_pct: number;
  battery_health_pct: number | null;
  system_health_pct: number;
}

export interface SystemHealthInputs {
  batteryHealthPct?: number | null;
  panelOptimalRatio?: number | null;
  activeWarningRatio?: number | null;
}

export function summarizeAnalytics(
  todayFlows: SolvedFlows[],
  monthFlows: SolvedFlows[],
  yearFlows: SolvedFlows[],
  currentFlow: SolvedFlows,
  batteryCapacityKwh: number = 0,
  prevMonthFlows: SolvedFlows[] = [],
  systemHealth: SystemHealthInputs = {}
): AnalyticsSummary {
  const solarToday = todayFlows.reduce((s, f) => s + f.solar_kw, 0);
  const todayCost = computeCostSavings(todayFlows).reduce(
    (s, c) => s + c.amount_usd,
    0
  );
  const monthCost = computeCostSavings(monthFlows).reduce(
    (s, c) => s + c.amount_usd,
    0
  );
  const yearCost = computeCostSavings(yearFlows).reduce(
    (s, c) => s + c.amount_usd,
    0
  );

  const monthConsumption = monthFlows.reduce(
    (s, f) => s + f.house_kw + f.ev_kw,
    0
  );
  const monthGridImport = monthFlows.reduce(
    (s, f) => s + Math.max(0, f.grid_kw),
    0
  );
  const independence =
    monthConsumption > 0
      ? Math.max(0, Math.min(100, (1 - monthGridImport / monthConsumption) * 100))
      : 0;

  const monthSolar = monthFlows.reduce((s, f) => s + f.solar_kw, 0);
  const monthExport = monthFlows.reduce(
    (s, f) => s + Math.max(0, -f.grid_kw),
    0
  );
  const monthOffset = Math.max(0, monthSolar - monthExport);
  const monthCarbon = monthOffset * KG_CO2_PER_KWH_GRID * TONS_PER_KG;

  const yearSolar = yearFlows.reduce((s, f) => s + f.solar_kw, 0);
  const yearExport = yearFlows.reduce(
    (s, f) => s + Math.max(0, -f.grid_kw),
    0
  );
  const yearOffset = Math.max(0, yearSolar - yearExport);
  const yearCarbon = yearOffset * KG_CO2_PER_KWH_GRID * TONS_PER_KG;

  const monthBatteryCharge = monthFlows.reduce(
    (s, f) => s + Math.max(0, f.battery_power_kw),
    0
  );
  const monthEv = monthFlows.reduce((s, f) => s + f.ev_kw, 0);
  const monthHouse = monthFlows.reduce((s, f) => s + f.house_kw, 0);

  const prevMonthCost = prevMonthFlows.length
    ? computeCostSavings(prevMonthFlows).reduce((s, c) => s + c.amount_usd, 0)
    : 0;
  const monthOverMonthPct = prevMonthCost > 0
    ? Math.round(((monthCost - prevMonthCost) / prevMonthCost) * 1000) / 10
    : 0;

  const warningRatio = systemHealth.activeWarningRatio ?? 0;
  const uptime = Math.round(Math.max(80, 100 - warningRatio * 20));

  // Composite system health weights only the components the user actually has
  // installed so a no-solar or no-battery site doesn't get an artificially
  // inflated 100% from defaulted-in components. Weights are renormalized.
  const haveBattery = systemHealth.batteryHealthPct != null;
  const havePanels = systemHealth.panelOptimalRatio != null;
  const W_BATT = 0.5;
  const W_PANEL = 0.3;
  const W_UPTIME = 0.2;
  let weightedSum = uptime * W_UPTIME;
  let totalWeight = W_UPTIME;
  if (haveBattery) {
    weightedSum += (systemHealth.batteryHealthPct as number) * W_BATT;
    totalWeight += W_BATT;
  }
  if (havePanels) {
    weightedSum += (systemHealth.panelOptimalRatio as number) * 100 * W_PANEL;
    totalWeight += W_PANEL;
  }
  const systemHealthPct = Math.round(weightedSum / totalWeight);

  return {
    solar_today_kwh: Math.round(solarToday * 10) / 10,
    solar_current_kw: Math.round(currentFlow.solar_kw * 100) / 100,
    solar_month_mwh: Math.round((monthSolar / 1000) * 10) / 10,
    monthly_savings_usd: Math.round(monthCost),
    annual_savings_usd: Math.round(monthCost * 12),
    carbon_reduced_tons_month: Math.round(monthCarbon * 10) / 10,
    carbon_reduced_tons_year: Math.round(monthCarbon * 12 * 10) / 10,
    grid_independence_pct: Math.round(independence),
    daily_savings_usd: Math.round(todayCost * 100) / 100,
    battery_stored_kwh:
      Math.round(((currentFlow.battery_soc_percent / 100) * batteryCapacityKwh) * 10) / 10,
    battery_month_mwh: Math.round((monthBatteryCharge / 1000) * 10) / 10,
    ev_month_mwh: Math.round((monthEv / 1000) * 10) / 10,
    house_month_mwh: Math.round((monthHouse / 1000) * 10) / 10,
    ytd_solar_mwh: Math.round((yearSolar / 1000) * 10) / 10,
    ytd_savings_usd: Math.round(yearCost),
    ytd_carbon_tons: Math.round(yearCarbon * 10) / 10,
    uptime_pct: uptime,
    prev_month_savings_usd: Math.round(prevMonthCost),
    month_over_month_savings_pct: monthOverMonthPct,
    battery_round_trip_efficiency_pct: ROUND_TRIP_EFFICIENCY_PCT,
    storage_efficiency_pct: STORAGE_EFFICIENCY_PCT,
    battery_health_pct:
      systemHealth.batteryHealthPct != null
        ? Math.round(systemHealth.batteryHealthPct)
        : null,
    system_health_pct: systemHealthPct,
  };
}
