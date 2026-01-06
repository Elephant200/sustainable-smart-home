"use client";

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  DeviceConfig, 
  generateAggregatedSolarData, 
  generateHouseLoadData,
  SolarDataPoint,
  HouseLoadDataPoint 
} from '@/lib/data-generator/client-generators';

export function useUserDevices() {
  const [devices, setDevices] = useState<DeviceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const supabase = createClient();
        
        // Get the current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('No user found, setting empty devices');
          setDevices([]);
          return;
        }

        console.log('Fetching devices for user:', user.id);

        // Fetch user devices with their configurations
        const { data: devicesData, error: devicesError } = await supabase
          .from('devices')
          .select(`
            id,
            name,
            type,
            is_active,
            solar_config (
              panel_count,
              output_per_panel_kw
            )
          `)
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (devicesError) {
          throw devicesError;
        }

        console.log('Raw devices data:', devicesData);

        // Transform the data to match our DeviceConfig interface
        const transformedDevices: DeviceConfig[] = (devicesData || []).map(device => ({
          id: device.id,
          name: device.name,
          type: device.type,
          is_active: device.is_active,
          solar_config: Array.isArray(device.solar_config) 
            ? device.solar_config[0] 
            : device.solar_config || undefined
        }));

        console.log('Transformed devices:', transformedDevices);
        setDevices(transformedDevices);
      } catch (err) {
        console.error('Error fetching user devices:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch devices');
      } finally {
        setLoading(false);
      }
    };

    fetchDevices();
  }, []);

  const solarArrays = useMemo(() => 
    devices.filter(device => device.type === 'solar_array' && device.solar_config),
    [devices]
  );

  const hasHouseDevice = useMemo(() => 
    devices.some(device => device.type === 'house'),
    [devices]
  );

  return {
    devices,
    solarArrays,
    hasHouseDevice,
    loading,
    error,
    refetch: () => window.location.reload() // Simple refetch
  };
}

export function useSolarData(timeRange: string) {
  const { solarArrays, loading: devicesLoading } = useUserDevices();
  const [data, setData] = useState<SolarDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (devicesLoading) return;

    const generateData = () => {
      setLoading(true);
      
      const now = new Date();
      let startDate: Date;
      
      switch (timeRange) {
        case "24h":
          startDate = new Date(now.getTime() - 25 * 60 * 60 * 1000);
          break;
        case "7d":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "3m":
          startDate = new Date(now.getTime() - 3 * 30 * 24 * 60 * 60 * 1000);
          break;
        case "1y":
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 25 * 60 * 60 * 1000);
      }

      // Round startDate to the hour
      startDate.setMinutes(0, 0, 0);
      
      // If no solar arrays configured, use default demo data
      const devicesToUse = solarArrays.length > 0 ? solarArrays : [{
        id: 'demo-solar',
        name: 'Demo Solar Array',
        type: 'solar_array' as const,
        is_active: true,
        solar_config: {
          panel_count: 12,
          output_per_panel_kw: 0.4
        }
      }];
      
      console.log('Generating solar data with devices:', devicesToUse);
      console.log('Time range:', timeRange, 'Start:', startDate, 'End:', now);
      
      // Generate the data
      const generatedData = generateAggregatedSolarData(
        startDate,
        now,
        devicesToUse,
        37.7749 // Los Angeles latitude (default)
      );

      console.log('Generated solar data:', generatedData);
      setData(generatedData);
      setLoading(false);
    };

    generateData();
  }, [timeRange, solarArrays, devicesLoading]);

  return { data, loading };
}

export function useHouseLoadData(timeRange: string) {
  const { hasHouseDevice, loading: devicesLoading } = useUserDevices();
  const [data, setData] = useState<HouseLoadDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (devicesLoading) return;

    const generateData = () => {
      setLoading(true);
      
      const now = new Date();
      let startDate: Date;
      
      switch (timeRange) {
        case "24h":
          startDate = new Date(now.getTime() - 25 * 60 * 60 * 1000);
          break;
        case "7d":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "3m":
          startDate = new Date(now.getTime() - 3 * 30 * 24 * 60 * 60 * 1000);
          break;
        case "1y":
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 25 * 60 * 60 * 1000);
      }

      // Round startDate to the hour
      startDate.setMinutes(0, 0, 0);
      
      // Always generate house load data (demo data if no house device configured)
      const generatedData = generateHouseLoadData(
        startDate,
        now,
        true // Always generate house load data
      );

      setData(generatedData);
      setLoading(false);
    };

    generateData();
  }, [timeRange, hasHouseDevice, devicesLoading]);

  return { data, loading };
} 