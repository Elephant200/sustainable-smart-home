/**
 * Derive alert events from current snapshot + recent history.
 */

import { SolvedFlows } from './flows';
import { SolarArrayInstant } from './solar';

export type AlertType = 'success' | 'warning' | 'info' | 'error';
export type AlertCategory =
  | 'EV Charging'
  | 'Solar'
  | 'Battery'
  | 'Cost Savings'
  | 'System'
  | 'Weather'
  | 'Maintenance';

export interface AlertEvent {
  id: string;
  type: AlertType;
  category: AlertCategory;
  title: string;
  message: string;
  iconKey:
    | 'sun'
    | 'battery'
    | 'car'
    | 'zap'
    | 'cloud'
    | 'dollar'
    | 'trending'
    | 'shield';
  priority: 'low' | 'medium' | 'high';
  status: 'active' | 'resolved';
  ts: string;
  ageLabel: string;
}

function ageLabel(now: Date, then: Date): string {
  const diffMs = now.getTime() - then.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export interface AlertInput {
  now: Date;
  current: SolvedFlows;
  todayFlows: SolvedFlows[];
  solarPanelInstant?: SolarArrayInstant;
  batteryHealthPct: number;
  evCount: number;
}

export function deriveAlerts(input: AlertInput): AlertEvent[] {
  const { now, current, todayFlows, solarPanelInstant, batteryHealthPct, evCount } = input;
  const events: AlertEvent[] = [];

  const peakSolarToday = todayFlows.reduce(
    (max, f) =>
      f.solar_kw > max.value ? { value: f.solar_kw, t: f.timestamp } : max,
    { value: 0, t: now }
  );
  const dailySolarTotal = todayFlows.reduce((s, f) => s + f.solar_kw, 0);

  if (peakSolarToday.value > 0.5) {
    events.push({
      id: 'peak-solar',
      type: 'success',
      category: 'Solar',
      title: 'Peak Solar Generation Today',
      message: `Solar peaked at ${peakSolarToday.value.toFixed(2)} kW. Today's total: ${dailySolarTotal.toFixed(1)} kWh.`,
      iconKey: 'sun',
      priority: 'low',
      status: 'resolved',
      ts: peakSolarToday.t.toISOString(),
      ageLabel: ageLabel(now, peakSolarToday.t),
    });
  }

  if (current.battery_power_kw > 0.2) {
    events.push({
      id: 'battery-charging',
      type: 'info',
      category: 'Battery',
      title: 'Battery Charging from Solar',
      message: `Battery charging at ${current.battery_power_kw.toFixed(2)} kW. Current SOC: ${current.battery_soc_percent.toFixed(0)}%.`,
      iconKey: 'battery',
      priority: 'low',
      status: 'active',
      ts: now.toISOString(),
      ageLabel: 'just now',
    });
  } else if (current.battery_power_kw < -0.2) {
    const overnightDischarge = todayFlows
      .filter((f) => f.battery_power_kw < -0.1 && f.timestamp.getHours() < 6)
      .reduce((s, f) => s + -f.battery_power_kw, 0);
    if (overnightDischarge > 0) {
      events.push({
        id: 'battery-overnight',
        type: 'success',
        category: 'Battery',
        title: 'Battery Discharge Cycle',
        message: `Battery provided ${overnightDischarge.toFixed(1)} kWh overnight at high efficiency.`,
        iconKey: 'battery',
        priority: 'low',
        status: 'resolved',
        ts: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
        ageLabel: ageLabel(now, new Date(now.getTime() - 6 * 60 * 60 * 1000)),
      });
    }
  }

  if (current.ev_kw > 0.5 && evCount > 0) {
    events.push({
      id: 'ev-charging',
      type: 'info',
      category: 'EV Charging',
      title: 'EV Charging Active',
      message: `${evCount} vehicle(s) currently drawing ${current.ev_kw.toFixed(2)} kW combined.`,
      iconKey: 'car',
      priority: 'medium',
      status: 'active',
      ts: now.toISOString(),
      ageLabel: 'just now',
    });
  }

  const solarSavings =
    Math.max(
      0,
      dailySolarTotal -
        todayFlows.reduce((s, f) => s + Math.max(0, -f.grid_kw), 0)
    ) * 0.18;
  if (solarSavings > 5) {
    events.push({
      id: 'daily-savings',
      type: 'success',
      category: 'Cost Savings',
      title: 'Daily Savings Earned',
      message: `Energy savings today: $${solarSavings.toFixed(2)} from solar self-consumption.`,
      iconKey: 'dollar',
      priority: 'low',
      status: 'resolved',
      ts: now.toISOString(),
      ageLabel: 'today',
    });
  }

  if (evCount > 0) {
    events.push({
      id: 'smart-charging',
      type: 'info',
      category: 'System',
      title: 'Smart Charging Active',
      message: 'EV charging scheduled for off-peak hours (10 PM – 6 AM).',
      iconKey: 'zap',
      priority: 'low',
      status: 'resolved',
      ts: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
      ageLabel: ageLabel(now, new Date(now.getTime() - 4 * 60 * 60 * 1000)),
    });
  }

  if (solarPanelInstant && solarPanelInstant.per_panel.length > 0) {
    const avgEff =
      solarPanelInstant.per_panel.reduce((s, p) => s + p.efficiency_pct, 0) /
      solarPanelInstant.per_panel.length;
    const worst = solarPanelInstant.per_panel.reduce(
      (w, p) => (p.efficiency_pct < w.efficiency_pct ? p : w),
      solarPanelInstant.per_panel[0]
    );
    if (worst && avgEff - worst.efficiency_pct > 8) {
      events.push({
        id: 'panel-low',
        type: 'warning',
        category: 'Maintenance',
        title: 'Solar Panel Cleaning Recommended',
        message: `Panel #${worst.panel_index + 1} efficiency at ${worst.efficiency_pct}% (avg ${avgEff.toFixed(0)}%). Consider cleaning.`,
        iconKey: 'sun',
        priority: 'medium',
        status: 'active',
        ts: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        ageLabel: '2 days ago',
      });
    }
  }

  if (
    peakSolarToday.value > 0 &&
    current.solar_kw > 0 &&
    current.solar_kw < peakSolarToday.value * 0.5
  ) {
    events.push({
      id: 'partly-cloudy',
      type: 'warning',
      category: 'Weather',
      title: 'Reduced Solar Output',
      message: 'Cloud cover or low sun angle is reducing solar generation. Battery is compensating.',
      iconKey: 'cloud',
      priority: 'low',
      status: 'active',
      ts: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      ageLabel: '30 minutes ago',
    });
  }

  if (batteryHealthPct < 95) {
    events.push({
      id: 'battery-health',
      type: 'warning',
      category: 'Battery',
      title: 'Battery Health Notice',
      message: `Battery health at ${batteryHealthPct}%. Schedule a routine inspection.`,
      iconKey: 'battery',
      priority: 'medium',
      status: 'active',
      ts: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      ageLabel: '1 day ago',
    });
  }

  const todaySelfPct = (() => {
    const consumed = todayFlows.reduce((s, f) => s + f.house_kw + f.ev_kw, 0);
    const imported = todayFlows.reduce(
      (s, f) => s + Math.max(0, f.grid_kw),
      0
    );
    return consumed > 0 ? (1 - imported / consumed) * 100 : 0;
  })();
  if (todaySelfPct >= 70) {
    events.push({
      id: 'grid-milestone',
      type: 'info',
      category: 'System',
      title: 'Grid Independence Milestone',
      message: `Achieved ${todaySelfPct.toFixed(0)}% self-sufficiency today. On track for 80% target.`,
      iconKey: 'trending',
      priority: 'medium',
      status: 'resolved',
      ts: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
      ageLabel: ageLabel(now, new Date(now.getTime() - 12 * 60 * 60 * 1000)),
    });
  }

  return events.sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()
  );
}
