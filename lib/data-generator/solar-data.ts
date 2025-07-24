import { createClient } from '@/lib/supabase/server';

// TypeScript interfaces for Supabase query results
interface SolarConfigData {
  panel_count: number;
  output_per_panel_kw: number;
}

interface DeviceWithSolarConfig {
  id: string;
  name: string;
  solar_config: SolarConfigData | null; // Single config, not array
}

export interface SolarDataPoint {
  timestamp: Date;
  device_id: string;
  panel_count: number;
  output_per_panel_kw: number;
  total_generation_kw: number;
  generation_per_panel_kw: number;
  weather_factor: number; // 0.1 to 1.0 (cloudy to sunny)
  efficiency_factor: number; // 0.85 to 0.95 (panel efficiency)
}

export interface HistoricalSolarData {
  device_id: string;
  timestamp: Date;
  energy_kwh: number;
}

/**
 * Solar irradiance model based on time of day and season
 * Returns a value between 0 and 1 representing solar potential
 */
function getSolarIrradiance(date: Date, latitude: number = 37.7749): number {
  const hour = date.getHours() + date.getMinutes() / 60;
  // Note: new Date(year, 0, 0) gives Dec 31 of previous year, so dayOfYear starts at 1 for Jan 1
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  
  // Solar declination angle (seasonal variation)
  const declination = 23.45 * Math.sin((360 * (284 + dayOfYear) / 365) * Math.PI / 180);
  
  // Solar elevation angle calculation
  const hourAngle = 15 * (hour - 12); // degrees from solar noon
  const elevation = Math.asin(
    Math.sin(declination * Math.PI / 180) * Math.sin(latitude * Math.PI / 180) +
    Math.cos(declination * Math.PI / 180) * Math.cos(latitude * Math.PI / 180) * Math.cos(hourAngle * Math.PI / 180)
  ) * 180 / Math.PI;
  
  // Convert elevation to irradiance (0-1 scale)
  if (elevation <= 0) return 0; // No sun below horizon
  
  // Peak irradiance occurs when sun is directly overhead (90 degrees)
  const maxIrradiance = 1.0;
  const irradiance = maxIrradiance * Math.sin(elevation * Math.PI / 180);
  
  // Add some atmospheric absorption
  const elevationRad = elevation * Math.PI / 180;
  const sinElevation = Math.sin(elevationRad);
  
  // Avoid division by zero when sun is at horizon
  const atmosphericFactor = sinElevation > 0.01 ? Math.pow(0.7, 1 / sinElevation) : 0;
  
  return Math.max(0, Math.min(1, irradiance * atmosphericFactor));
}

/**
 * Generate weather factor to simulate cloudy/sunny conditions
 * Returns value between 0.1 (very cloudy) and 1.0 (clear sky)
 */
function generateWeatherFactor(timestamp: Date, seed?: number): number {
  // Use timestamp as seed for consistent "weather" patterns
  const dateSeed = seed || (timestamp.getTime() / (1000 * 60 * 60 * 24));
  
  // Create some weather persistence (cloudy days tend to stay cloudy)
  const weatherNoise = Math.sin(dateSeed * 0.1) * 0.3 + Math.cos(dateSeed * 0.05) * 0.2;
  const randomFactor = (Math.sin(dateSeed * 1.7) + 1) / 2; // 0-1
  
  // Base weather factor with some randomness
  const weatherFactor = 0.7 + weatherNoise + (randomFactor * 0.3);
  
  // Clamp between 0.1 and 1.0
  return Math.max(0.1, Math.min(1.0, weatherFactor));
}

/**
 * Generate panel efficiency factor (accounts for temperature, dust, aging)
 * Returns value between 0.85 and 0.95
 */
function generateEfficiencyFactor(timestamp: Date): number {
  const hour = timestamp.getHours();
  
  // Efficiency decreases slightly during hot afternoon hours
  let tempFactor = 1.0;
  if (hour >= 11 && hour <= 16) {
    tempFactor = 0.95 - ((hour - 11) / 20); // slight decrease during hot hours
  }
  
  // Add small random variation for dust, aging, etc.
  const randomVariation = (Math.random() - 0.5) * 0.02; // ±1%
  
  const efficiency = 0.9 + (tempFactor * 0.05) + randomVariation;
  return Math.max(0.85, Math.min(0.95, efficiency));
}

/**
 * Generate live solar data for all user's solar arrays
 */
export async function generateLiveSolarData(userId: string): Promise<SolarDataPoint[]> {
  try {
    const supabase = await createClient();
    
    // Get user's solar arrays with proper typing
    const { data: devices, error } = await supabase
      .from('devices')
      .select(`
        id,
        name,
        solar_config (
          panel_count,
          output_per_panel_kw
        )
      `)
      .eq('user_id', userId)
      .eq('type', 'solar_array')
      .eq('is_active', true) as { data: DeviceWithSolarConfig[] | null, error: Error | null };
    
      console.log('devices', devices);

    if (error) {
      console.error('Error fetching solar devices:', error);
      return [];
    }

    if (!devices || devices.length === 0) {
      console.log('No solar devices found');
      return [];
    }

    const now = new Date();
    const solarData: SolarDataPoint[] = [];

    for (const device of devices) {
      // Since there's only one solar config per device, treat it as a single object
      if (!device.solar_config) {
        console.log(`No solar config found for device ${device.id}`);
        continue;
      }

      const config = device.solar_config;
      const irradiance = getSolarIrradiance(now);
      const weatherFactor = generateWeatherFactor(now);
      const efficiencyFactor = generateEfficiencyFactor(now);

      // Calculate generation per panel
      const maxOutputPerPanel = config.output_per_panel_kw;
      const currentOutputPerPanel = maxOutputPerPanel * irradiance * weatherFactor * efficiencyFactor;
      
      // Total array output
      const totalOutput = currentOutputPerPanel * config.panel_count;

      solarData.push({
        timestamp: now,
        device_id: device.id,
        panel_count: config.panel_count,
        output_per_panel_kw: config.output_per_panel_kw,
        total_generation_kw: totalOutput,
        generation_per_panel_kw: currentOutputPerPanel,
        weather_factor: weatherFactor,
        efficiency_factor: efficiencyFactor
      });
    }

    return solarData;
  } catch (error) {
    console.error('Error generating live solar data:', error);
    return [];
  }
}

/**
 * Generate historical solar data for a date range (always 1hr resolution)
 */
export async function generateHistoricalSolarData(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<HistoricalSolarData[]> {
  try {
    const supabase = await createClient();
    
    // Get user's solar arrays with proper typing
    const { data: devices, error } = await supabase
      .from('devices')
      .select(`
        id,
        name,
        solar_config (
          panel_count,
          output_per_panel_kw
        )
      `)
      .eq('user_id', userId)
      .eq('type', 'solar_array')
      .eq('is_active', true) as { data: DeviceWithSolarConfig[] | null, error: Error | null };

    if (error) {
      console.error('Error fetching solar devices:', error);
      return [];
    }

    if (!devices || devices.length === 0) {
      return [];
    }

    const historicalData: HistoricalSolarData[] = [];
    
    // Round start and end dates to exact hours
    const roundedStartDate = new Date(startDate);
    roundedStartDate.setMinutes(0, 0, 0);
    
    const roundedEndDate = new Date(endDate);
    roundedEndDate.setMinutes(0, 0, 0);
    
    // Always use 1hr resolution - generate hourly data
    const oneHourMs = 60 * 60 * 1000;

    // Generate data points for each device across the time range
    for (const device of devices) {
      // Since there's only one solar config per device, treat it as a single object
      if (!device.solar_config) {
        console.log(`No solar config found for device ${device.id}`);
        continue;
      }

      const config = device.solar_config;
      
      for (let timestamp = new Date(roundedStartDate); timestamp <= roundedEndDate; timestamp = new Date(timestamp.getTime() + oneHourMs)) {
        const irradiance = getSolarIrradiance(timestamp);
        const weatherFactor = generateWeatherFactor(timestamp, device.id.charCodeAt(0));
        const efficiencyFactor = generateEfficiencyFactor(timestamp);
        
        const maxOutputPerPanel = config.output_per_panel_kw;
        const currentOutputPerPanel = maxOutputPerPanel * irradiance * weatherFactor * efficiencyFactor;
        const totalOutputKw = currentOutputPerPanel * config.panel_count;
        
        // Convert power (kW) to energy (kWh) for this hour
        const energyKwh = totalOutputKw;

        historicalData.push({
          device_id: device.id,
          timestamp: new Date(timestamp),
          energy_kwh: Math.max(0, energyKwh)
        });
      }
    }

    return historicalData;
  } catch (error) {
    console.error('Error generating historical solar data:', error);
    return [];
  }
}

/**
 * Utility function to save historical solar data to database
 */
export async function saveHistoricalSolarData(
  userId: string,
  data: HistoricalSolarData[]
): Promise<void> {
  try {
    const supabase = await createClient();
    
    // Convert to power_generation table format
    const powerGenerationRecords = data.map(point => ({
      user_id: userId,
      device_id: point.device_id,
      energy_kwh: point.energy_kwh,
      timestamp: point.timestamp.toISOString() // Includes timezone, Postgres will convert to UTC
    }));

    // Insert in batches to avoid overwhelming the database
    const batchSize = 100;
    for (let i = 0; i < powerGenerationRecords.length; i += batchSize) {
      const batch = powerGenerationRecords.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('power_generation')
        .insert(batch);
        
      if (error) {
        console.error('Error inserting solar generation data batch:', error);
        throw error;
      }
    }
  } catch (error) {
    console.error('Error saving historical solar data:', error);
    throw error;
  }
}

/**
 * Save live solar data to database
 */
export async function saveLiveSolarData(
  userId: string,
  data: SolarDataPoint[]
): Promise<void> {
  try {
    const supabase = await createClient();
  
  const powerGenerationRecords = data.map(point => ({
    user_id: userId,
    device_id: point.device_id,
    energy_kwh: point.total_generation_kw, // kW * 1hr = kWh (since resolution is 1 hour)
    timestamp: point.timestamp.toISOString() // Includes timezone, Postgres will convert to UTC
  }));

  if (powerGenerationRecords.length > 0) {
    const { error } = await supabase
      .from('power_generation')
      .insert(powerGenerationRecords);
      
    if (error) {
      console.error('Error inserting live solar generation data:', error);
      throw error;
    }
  }
  } catch (error) {
    console.error('Error saving live solar data:', error);
    throw error;
  }
}

/**
 * Generate and save a full week of historical solar data
 */
export async function generateWeekOfSolarData(userId: string): Promise<void> {
  try {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (7 * 24 * 60 * 60 * 1000)); // 1 week ago
    
    const historicalData = await generateHistoricalSolarData(userId, startDate, endDate);
    await saveHistoricalSolarData(userId, historicalData);
    
    console.log(`Generated ${historicalData.length} solar generation data points for user ${userId}`);
  } catch (error) {
    console.error('Error generating week of solar data:', error);
    throw error;
  }
} 
generateWeekOfSolarData('df7510ba-a2d5-4ead-a35a-9f25bf2132f8');