"use client";

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createAdapter } from '@/lib/adapters/factory';
import { DeviceRecord, ProviderType } from '@/lib/adapters/types';
import {
  DeviceConfig,
  SolarDataPoint,
  HouseLoadDataPoint,
} from '@/lib/data-generator/client-generators';

function timeRangeToStartDate(timeRange: string): Date {
  const now = new Date();
  switch (timeRange) {
    case '24h':  return new Date(now.getTime() - 25 * 60 * 60 * 1000);
    case '7d':   return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '3m':   return new Date(now.getTime() - 3 * 30 * 24 * 60 * 60 * 1000);
    case '1y':   return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default:     return new Date(now.getTime() - 25 * 60 * 60 * 1000);
  }
}

export function useUserDevices() {
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        setLoading(true);
        setError(null);

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setDevices([]);
          return;
        }

        const { data: devicesData, error: devicesError } = await supabase
          .from('devices')
          .select(`
            id,
            name,
            type,
            is_active,
            provider_type,
            connection_config,
            solar_config (
              panel_count,
              output_per_panel_kw
            )
          `)
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (devicesError) throw devicesError;

        const transformed: DeviceRecord[] = (devicesData || []).map((device) => ({
          id: device.id,
          user_id: user.id,
          name: device.name,
          type: device.type,
          is_active: device.is_active,
          provider_type: (device.provider_type ?? 'simulated') as ProviderType,
          connection_config: (device.connection_config ?? {}) as Record<string, unknown>,
          solar_config: Array.isArray(device.solar_config)
            ? device.solar_config[0]
            : device.solar_config || undefined,
        }));

        setDevices(transformed);
      } catch (err) {
        console.error('Error fetching user devices:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch devices');
      } finally {
        setLoading(false);
      }
    };

    fetchDevices();
  }, []);

  const solarArrays = useMemo(
    () => devices.filter((d) => d.type === 'solar_array' && d.solar_config),
    [devices]
  );

  const hasHouseDevice = useMemo(
    () => devices.some((d) => d.type === 'house'),
    [devices]
  );

  const legacyDeviceConfigs: DeviceConfig[] = useMemo(
    () =>
      devices.map((d) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        is_active: d.is_active,
        solar_config: d.solar_config,
      })),
    [devices]
  );

  return {
    devices,
    solarArrays,
    hasHouseDevice,
    loading,
    error,
    legacyDeviceConfigs,
    refetch: () => window.location.reload(),
  };
}

export function useSolarData(timeRange: string) {
  const { solarArrays, loading: devicesLoading } = useUserDevices();
  const [data, setData] = useState<SolarDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (devicesLoading) return;

    const generateData = async () => {
      setLoading(true);

      const now = new Date();
      const startDate = timeRangeToStartDate(timeRange);
      startDate.setMinutes(0, 0, 0);

      const devicesToUse: DeviceRecord[] =
        solarArrays.length > 0
          ? solarArrays
          : [
              {
                id: 'demo-solar',
                user_id: '',
                name: 'Demo Solar Array',
                type: 'solar_array',
                is_active: true,
                provider_type: 'simulated',
                connection_config: {},
                solar_config: { panel_count: 12, output_per_panel_kw: 0.4 },
              },
            ];

      const allPoints: SolarDataPoint[] = [];

      for (const device of devicesToUse) {
        const adapter = createAdapter(device);
        const history = await adapter.getHistory({
          metric: 'solar',
          startDate,
          endDate: now,
        });

        for (const pt of history) {
          const existing = allPoints.find(
            (p) => p.timestamp === pt.timestamp.toISOString()
          );
          if (existing) {
            existing.total_generation_kwh += pt.value;
          } else {
            allPoints.push({
              timestamp: pt.timestamp.toISOString(),
              total_generation_kwh: pt.value,
            });
          }
        }
      }

      allPoints.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      setData(allPoints);
      setLoading(false);
    };

    generateData();
  }, [timeRange, solarArrays, devicesLoading]);

  return { data, loading };
}

export function useHouseLoadData(timeRange: string) {
  const { devices, hasHouseDevice, loading: devicesLoading } = useUserDevices();
  const [data, setData] = useState<HouseLoadDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (devicesLoading) return;

    const generateData = async () => {
      setLoading(true);

      const now = new Date();
      const startDate = timeRangeToStartDate(timeRange);
      startDate.setMinutes(0, 0, 0);

      const houseDevice: DeviceRecord = devices.find(
        (d) => d.type === 'house'
      ) ?? {
        id: 'demo-house',
        user_id: '',
        name: 'Demo House',
        type: 'house',
        is_active: true,
        provider_type: 'simulated',
        connection_config: {},
      };

      const adapter = createAdapter(houseDevice);
      const history = await adapter.getHistory({
        metric: 'house_load',
        startDate,
        endDate: now,
      });

      const points: HouseLoadDataPoint[] = history.map((pt) => ({
        timestamp: pt.timestamp.toISOString(),
        energy_kwh: pt.value,
      }));

      setData(points);
      setLoading(false);
    };

    generateData();
  }, [timeRange, hasHouseDevice, devices, devicesLoading]);

  return { data, loading };
}
