'use client';

import { useEffect, useState } from 'react';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useFetch<T>(url: string): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    fetch(url, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<T>;
      })
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled)
          setState({
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Request failed',
          });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}

export interface SnapshotResponse {
  timestamp: string;
  flows: {
    solar_kw: number;
    house_kw: number;
    ev_kw: number;
    battery_power_kw: number;
    battery_soc_percent: number;
    grid_kw: number;
    edges: { source: string; target: string; power_kw: number }[];
  };
  devices: {
    solar: { count: number; current_kw: number };
    battery: {
      id: string;
      name: string;
      capacity_kwh: number;
      soc_percent: number;
      soc_kwh: number;
      power_kw: number;
      max_flow_kw: number;
    } | null;
    ev: {
      id: string;
      name: string;
      soc_percent: number;
      charge_rate_kw: number;
      plugged_in: boolean;
      range_miles: number;
      max_range_miles: number;
    }[];
    house: { current_kw: number };
  };
  counts: { solar: number; battery: number; ev: number };
}

export interface FlowsResponse {
  range: string;
  points: {
    timestamp: string;
    solar_kw: number;
    house_kw: number;
    ev_kw: number;
    battery_kw: number;
    battery_soc_percent: number;
    grid_kw: number;
  }[];
}

export interface AnalyticsResponse {
  summary: {
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
  };
  monthly: {
    month: string;
    monthLabel: string;
    solar_mwh: number;
    consumption_mwh: number;
    savings_usd: number;
    carbon_reduced_tons: number;
  }[];
  costSavings: {
    category: string;
    amount_usd: number;
    percentage: number;
  }[];
}

export interface AlertsResponse {
  alerts: {
    id: string;
    type: 'success' | 'warning' | 'info' | 'error';
    category: string;
    title: string;
    message: string;
    iconKey: string;
    priority: 'low' | 'medium' | 'high';
    status: 'active' | 'resolved';
    ts: string;
    ageLabel: string;
  }[];
}

export interface SolarPanelsResponse {
  arrays: {
    id: string;
    name: string;
    panel_count: number;
    output_per_panel_kw: number;
    rated_kw: number;
    current_kw: number;
    efficiency_pct: number;
    weather_factor: number;
    panels: {
      panel_id: number;
      production_kw: number;
      efficiency_pct: number;
      status: 'optimal' | 'good' | 'maintenance';
    }[];
  }[];
  summary: AnalyticsResponse['summary'];
}

export interface BatteryResponse {
  battery: {
    id: string;
    name: string;
    capacity_kwh: number;
    max_flow_kw: number;
    soc_percent: number;
    soc_kwh: number;
    power_kw: number;
    hours_to_full: number;
    health_pct: number;
    charged_today_kwh: number;
    discharged_today_kwh: number;
  } | null;
  modules: {
    id: number;
    charge_pct: number;
    capacity_kwh: number;
    health_pct: number;
    temperature_f: number;
    power_kw: number;
    status: 'charging' | 'discharging' | 'idle';
  }[];
  history: { timestamp: string; soc_percent: number; power_kw: number }[];
}

export interface EvResponse {
  vehicles: {
    id: string;
    name: string;
    battery_capacity_kwh: number;
    target_charge_pct: number;
    battery_level_pct: number;
    range_mi: number;
    max_range_mi: number;
    charging_status: 'charging' | 'completed' | 'disconnected';
    plugged_in: boolean;
    charge_rate_kw: number;
    time_to_full_label: string;
    last_charged_label: string;
    efficiency: string;
    departure_time: string;
  }[];
  history: { time: string; total_kw: number; per_vehicle: Record<string, number> }[];
  summary: {
    current_total_kw: number;
    charging_count: number;
    energy_today_kwh: number;
    cost_savings_usd: number;
    clean_energy_pct: number;
    month_energy_mwh: number;
  };
}

export const useSnapshot = () => useFetch<SnapshotResponse>('/api/energy/snapshot');
export const useFlows = (range = '24h') =>
  useFetch<FlowsResponse>(`/api/energy/flows?range=${encodeURIComponent(range)}`);
export const useAnalytics = () => useFetch<AnalyticsResponse>('/api/energy/analytics');
export const useAlerts = () => useFetch<AlertsResponse>('/api/energy/alerts');
export const useSolarPanels = () =>
  useFetch<SolarPanelsResponse>('/api/energy/solar/panels');
export const useBattery = () => useFetch<BatteryResponse>('/api/energy/battery');
export const useEv = () => useFetch<EvResponse>('/api/energy/ev');
