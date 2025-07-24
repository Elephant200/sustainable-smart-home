import { createClient } from '@/lib/supabase/server';

export interface HouseLoadDataPoint {
  timestamp: Date;
  energy_kwh: number;
  base_load_kwh: number;
  appliance_load_kwh: number;
  seasonal_factor: number;
  activity_factor: number;
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
 * Higher in summer (AC) and winter (heating)
 */
function getSeasonalFactor(date: Date): number {
  const month = date.getMonth() + 1; // 1-12
  
  // Seasonal multipliers (higher for summer AC and winter heating)
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
 * Higher on weekends when people are home more
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
 * Simulates dishwasher, washing machine, dryer, etc.
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
 * Generate realistic house load for a specific timestamp
 */
function generateHouseLoadForTimestamp(timestamp: Date, seed?: number): number {
  const hour = timestamp.getHours();
  
  // Get base load pattern for this hour
  const baseLoad = getBaseLoadPattern(hour);
  
  // Apply seasonal adjustments
  const seasonalFactor = getSeasonalFactor(timestamp);
  
  // Apply day-of-week adjustments
  const dayOfWeekFactor = getDayOfWeekFactor(timestamp);
  
  // Add random appliance usage
  const applianceLoad = generateApplianceLoad(timestamp, seed);
  
  // Add small random variation (±10%)
  const randomVariation = ((Math.sin((timestamp.getTime() / 1000) * 0.001) + 1) / 2 - 0.5) * 0.2;
  
  // Calculate total load
  const totalLoad = (baseLoad * seasonalFactor * dayOfWeekFactor * (1 + randomVariation)) + applianceLoad;
  
  return Math.max(0.2, totalLoad); // Minimum 0.2 kW (always some base consumption)
}

/**
 * Generate current house load data
 */
export function generateCurrentHouseLoad(): HouseLoadDataPoint {
  const now = new Date();
  const energyKwh = generateHouseLoadForTimestamp(now);
  
  return {
    timestamp: now,
    energy_kwh: energyKwh,
    base_load_kwh: getBaseLoadPattern(now.getHours()),
    appliance_load_kwh: generateApplianceLoad(now),
    seasonal_factor: getSeasonalFactor(now),
    activity_factor: getDayOfWeekFactor(now)
  };
}

/**
 * Generate historical house load data for a date range (always 1hr resolution)
 */
export function generateHistoricalHouseLoad(
  startDate: Date,
  endDate: Date
): HouseLoadDataPoint[] {
  const historicalData: HouseLoadDataPoint[] = [];
  
  // Round start and end dates to exact hours
  const roundedStartDate = new Date(startDate);
  roundedStartDate.setMinutes(0, 0, 0);
  
  const roundedEndDate = new Date(endDate);
  roundedEndDate.setMinutes(0, 0, 0);
  
  // Always use 1hr resolution - generate hourly data
  const oneHourMs = 60 * 60 * 1000;
  
  for (let timestamp = new Date(roundedStartDate); timestamp <= roundedEndDate; timestamp = new Date(timestamp.getTime() + oneHourMs)) {
    const hourlyLoad = generateHouseLoadForTimestamp(timestamp, timestamp.getTime());
    const baseLoad = getBaseLoadPattern(timestamp.getHours());
    const applianceLoad = generateApplianceLoad(timestamp, timestamp.getTime());
    
    historicalData.push({
      timestamp: new Date(timestamp),
      energy_kwh: hourlyLoad,
      base_load_kwh: baseLoad,
      appliance_load_kwh: applianceLoad,
      seasonal_factor: getSeasonalFactor(timestamp),
      activity_factor: getDayOfWeekFactor(timestamp)
    });
  }
  
  return historicalData;
}

/**
 * Save house load data to database
 */
export async function saveHouseLoadData(
  userId: string,
  data: HouseLoadDataPoint[]
): Promise<void> {
  try {
    const supabase = await createClient();
  
  // Convert to house_load table format
  const houseLoadRecords = data.map(point => ({
    user_id: userId,
    energy_kwh: point.energy_kwh,
    timestamp: point.timestamp.toISOString(), // Includes timezone, Postgres will convert to UTC
    resolution: '1hr', // Always 1hr resolution
    hypothetical_co2_g: point.energy_kwh * 400 // Assume 400g CO2/kWh for grid electricity
  }));
  
  // Insert in batches
  const batchSize = 100;
  for (let i = 0; i < houseLoadRecords.length; i += batchSize) {
    const batch = houseLoadRecords.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('house_load')
      .insert(batch);
      
    if (error) {
      console.error('Error inserting house load data batch:', error);
      throw error;
    }
  }
  } catch (error) {
    console.error('Error saving house load data:', error);
    throw error;
  }
}

/**
 * Generate and save a full week of historical house load data
 */
export async function generateWeekOfHouseLoadData(userId: string): Promise<void> {
  try {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (7 * 24 * 60 * 60 * 1000)); // 7 days ago
    
    const historicalData = generateHistoricalHouseLoad(startDate, endDate);
    await saveHouseLoadData(userId, historicalData);
    
    console.log(`Generated ${historicalData.length} house load data points for user ${userId}`);
  } catch (error) {
    console.error('Error generating week of house load data:', error);
    throw error;
  }
}

/**
 * Generate house load forecast for future optimization
 */
export function generateHouseLoadForecast(
  startDate: Date,
  hours: number = 24
): HouseLoadDataPoint[] {
  const endDate = new Date(startDate.getTime() + (hours * 60 * 60 * 1000));
  return generateHistoricalHouseLoad(startDate, endDate);
}

/**
 * Get typical consumption for a specific hour across multiple days (for averaging)
 */
export function getTypicalConsumptionForHour(
  hour: number,
  dayType: 'weekday' | 'weekend' = 'weekday',
  season: 'spring' | 'summer' | 'fall' | 'winter' = 'spring'
): number {
  const baseLoad = getBaseLoadPattern(hour);
  
  // Season mapping
  const seasonFactors = {
    spring: 0.9,
    summer: 1.5,
    fall: 1.0,
    winter: 1.4
  };
  
  const dayFactors = {
    weekday: 1.0,
    weekend: 1.2
  };
  
  return baseLoad * seasonFactors[season] * dayFactors[dayType];
} 