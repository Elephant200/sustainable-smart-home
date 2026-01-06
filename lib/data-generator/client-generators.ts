// Client-side data generation utilities
// Extracted from solar-data.ts and house-load.ts for use in React components

export interface SolarDataPoint {
  timestamp: string;
  total_generation_kwh: number;
  device_id?: string;
  panel_count?: number;
  output_per_panel_kw?: number;
  weather_factor?: number;
  efficiency_factor?: number;
}

export interface HouseLoadDataPoint {
  timestamp: string;
  energy_kwh: number;
  base_load_kwh?: number;
  appliance_load_kwh?: number;
  seasonal_factor?: number;
  activity_factor?: number;
}

export interface DeviceConfig {
  id: string;
  name: string;
  type: 'solar_array' | 'battery' | 'ev' | 'grid' | 'house';
  is_active: boolean;
  solar_config?: {
    panel_count: number;
    output_per_panel_kw: number;
  };
}

/**
 * Solar irradiance model based on time of day and season
 * Returns a value between 0 and 1 representing solar potential
 */
function getSolarIrradiance(date: Date, latitude: number = 37.7749): number {
  const hour = date.getHours() + date.getMinutes() / 60;
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
  
  // Add atmospheric absorption
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
  const randomSeed = timestamp.getTime() / (1000 * 60 * 60 * 24);
  const randomVariation = (Math.sin(randomSeed * 3.14) + 1) / 2; // 0-1
  const dustFactor = 0.9 + (randomVariation * 0.05); // 0.9 to 0.95
  
  return Math.max(0.85, Math.min(0.95, tempFactor * dustFactor));
}

/**
 * Generate solar data for a single hour
 */
function generateSolarDataPoint(
  timestamp: Date, 
  solarArrays: DeviceConfig[],
  latitude: number = 37.7749
): SolarDataPoint[] {
  const irradiance = getSolarIrradiance(timestamp, latitude);
  const weatherFactor = generateWeatherFactor(timestamp);
  const efficiencyFactor = generateEfficiencyFactor(timestamp);
  
  return solarArrays.map(device => {
    if (!device.solar_config) return null;
    
    const { panel_count, output_per_panel_kw } = device.solar_config;
    const generationPerPanel = irradiance * weatherFactor * efficiencyFactor * output_per_panel_kw;
    const totalGeneration = generationPerPanel * panel_count;
    
    return {
      timestamp: timestamp.toISOString(),
      total_generation_kwh: Math.round(totalGeneration * 1000) / 1000, // Round to 3 decimal places
      device_id: device.id,
      panel_count,
      output_per_panel_kw,
      weather_factor: weatherFactor,
      efficiency_factor: efficiencyFactor
    };
  }).filter(Boolean) as SolarDataPoint[];
}

/**
 * Base load pattern throughout the day (in kW)
 * Represents typical household consumption patterns
 */
function getBaseLoadPattern(hour: number): number {
  // Typical household load curve (kW)
  const hourlyPattern = [
    0.8, 0.7, 0.6, 0.6, 0.7, 1.2, // 00:00 - 05:00 (night/early morning)
    2.1, 3.2, 3.8, 2.9, 2.2, 2.0, // 06:00 - 11:00 (morning peak)
    2.1, 2.3, 2.2, 2.1, 2.0, 2.8, // 12:00 - 17:00 (afternoon)
    4.2, 4.8, 4.1, 3.2, 2.1, 1.4  // 18:00 - 23:00 (evening peak)
  ];
  
  return hourlyPattern[hour] || 1.0;
}

/**
 * Seasonal adjustment factor
 */
function getSeasonalFactor(date: Date): number {
  const month = date.getMonth() + 1; // 1-12
  
  const seasonalFactors = {
    1: 1.4,   // January - winter heating
    2: 1.3,   // February
    3: 1.1,   // March
    4: 0.9,   // April
    5: 0.8,   // May
    6: 1.2,   // June - AC starts
    7: 1.5,   // July - peak summer AC
    8: 1.5,   // August - peak summer AC
    9: 1.2,   // September - AC still on
    10: 0.9,  // October
    11: 1.1,  // November
    12: 1.3   // December - winter heating
  };
  
  return seasonalFactors[month as keyof typeof seasonalFactors] || 1.0;
}

/**
 * Day of week adjustment
 */
function getDayOfWeekFactor(date: Date): number {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Weekend factor (people home more)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return 1.2; // 20% higher on weekends
  }
  
  return 1.0; // Normal weekday consumption
}

/**
 * Generate random appliance usage spikes
 */
function generateApplianceLoad(timestamp: Date, seed?: number): number {
  const hour = timestamp.getHours();
  const dateSeed = seed || (timestamp.getTime() / (1000 * 60 * 60));
  
  // Appliances more likely during certain hours
  let applianceProbability = 0.1; // Base 10% chance per hour
  
  if (hour >= 7 && hour <= 9) applianceProbability = 0.3; // Morning routine
  if (hour >= 18 && hour <= 21) applianceProbability = 0.4; // Evening routine
  if (hour >= 22 && hour <= 23) applianceProbability = 0.2; // Late evening
  
  // Use deterministic "random" based on timestamp
  const random = (Math.sin(dateSeed * 1.17) + 1) / 2; // 0-1
  
  if (random < applianceProbability) {
    // Various appliance loads (kWh for 1 hour)
    const applianceLoads = [
      0.5,  // Dishwasher
      0.8,  // Washing machine
      2.5,  // Electric dryer
      1.2,  // Microwave (extended use)
      0.3,  // Coffee maker
      1.8,  // Electric oven
      0.4   // Vacuum cleaner
    ];
    
    const applianceIndex = Math.floor((Math.sin(dateSeed * 2.31) + 1) / 2 * applianceLoads.length);
    return applianceLoads[Math.min(applianceIndex, applianceLoads.length - 1)] || 0;
  }
  
  return 0;
}

/**
 * Generate house load data for a single hour
 */
function generateHouseLoadDataPoint(timestamp: Date): HouseLoadDataPoint {
  const hour = timestamp.getHours();
  const baseLoad = getBaseLoadPattern(hour);
  const seasonalFactor = getSeasonalFactor(timestamp);
  const dayOfWeekFactor = getDayOfWeekFactor(timestamp);
  const applianceLoad = generateApplianceLoad(timestamp);
  
  // Add small random variation (±10%) to base load
  const randomSeed = timestamp.getTime() / (1000 * 60 * 60);
  const randomVariation = 0.9 + ((Math.sin(randomSeed * 2.17) + 1) / 2) * 0.2; // 0.9 to 1.1
  
  const adjustedBaseLoad = baseLoad * seasonalFactor * dayOfWeekFactor * randomVariation;
  const totalEnergyKwh = adjustedBaseLoad + applianceLoad;
  
  return {
    timestamp: timestamp.toISOString(),
    energy_kwh: Math.round(totalEnergyKwh * 1000) / 1000, // Round to 3 decimal places
    base_load_kwh: Math.round(adjustedBaseLoad * 1000) / 1000,
    appliance_load_kwh: Math.round(applianceLoad * 1000) / 1000,
    seasonal_factor: seasonalFactor,
    activity_factor: dayOfWeekFactor
  };
}

/**
 * Generate solar data for a time range
 */
export function generateSolarData(
  startDate: Date,
  endDate: Date,
  solarArrays: DeviceConfig[],
  latitude: number = 37.7749
): SolarDataPoint[] {
  const data: SolarDataPoint[] = [];
  const activeSolarArrays = solarArrays.filter(device => 
    device.type === 'solar_array' && 
    device.is_active && 
    device.solar_config
  );
  
  if (activeSolarArrays.length === 0) {
    return data;
  }
  
  const currentTime = new Date(startDate);
  
  while (currentTime <= endDate) {
    const hourlyData = generateSolarDataPoint(currentTime, activeSolarArrays, latitude);
    data.push(...hourlyData);
    currentTime.setHours(currentTime.getHours() + 1);
  }
  
  return data;
}

/**
 * Generate house load data for a time range
 */
export function generateHouseLoadData(
  startDate: Date,
  endDate: Date,
  hasHouseDevice: boolean = true
): HouseLoadDataPoint[] {
  const data: HouseLoadDataPoint[] = [];
  
  if (!hasHouseDevice) {
    return data;
  }
  
  const currentTime = new Date(startDate);
  
  while (currentTime <= endDate) {
    const hourlyData = generateHouseLoadDataPoint(currentTime);
    data.push(hourlyData);
    currentTime.setHours(currentTime.getHours() + 1);
  }
  
  return data;
}

/**
 * Generate aggregated solar data (sum all devices)
 */
export function generateAggregatedSolarData(
  startDate: Date,
  endDate: Date,
  solarArrays: DeviceConfig[],
  latitude: number = 37.7749
): SolarDataPoint[] {
  const rawData = generateSolarData(startDate, endDate, solarArrays, latitude);
  
  // Group by timestamp and sum the generation
  const aggregated: { [key: string]: SolarDataPoint } = {};
  
  rawData.forEach(item => {
    if (!aggregated[item.timestamp]) {
      aggregated[item.timestamp] = {
        timestamp: item.timestamp,
        total_generation_kwh: 0
      };
    }
    aggregated[item.timestamp].total_generation_kwh += item.total_generation_kwh;
  });
  
  return Object.values(aggregated).sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
} 