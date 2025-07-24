import { generateWeekOfSolarData, generateLiveSolarData } from './solar-data';
import { generateWeekOfHouseLoadData, generateCurrentHouseLoad } from './house-load';

export interface CurrentSystemData {
  solar: Awaited<ReturnType<typeof generateLiveSolarData>>;
  houseLoad: ReturnType<typeof generateCurrentHouseLoad>;
  timestamp: Date;
}

/**
 * Generate a complete week of both solar and house load data for a user
 */
export async function generateCompleteWeekOfData(userId: string): Promise<void> {
  console.log(`Generating complete week of data for user ${userId}...`);
  
  try {
    // Generate solar data
    await generateWeekOfSolarData(userId);
    
    // Generate house load data
    await generateWeekOfHouseLoadData(userId);
    
    console.log(`✅ Successfully generated complete week of data for user ${userId}`);
  } catch (error) {
    console.error(`❌ Error generating data for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Generate current system data (solar + house load) for real-time display
 */
export async function generateCurrentSystemData(userId: string): Promise<CurrentSystemData> {
  try {
    const [solar, houseLoad] = await Promise.all([
      generateLiveSolarData(userId),
      Promise.resolve(generateCurrentHouseLoad())
    ]);
    
    return {
      solar,
      houseLoad,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('Error generating current system data:', error);
    // Return empty data rather than throwing
    return {
      solar: [],
      houseLoad: generateCurrentHouseLoad(),
      timestamp: new Date()
    };
  }
}

/**
 * Calculate system metrics from current data
 */
export function calculateSystemMetrics(data: CurrentSystemData) {
  // Note: For 1-hour resolution, kW * 1hr = kWh, so both values represent energy over 1 hour
  const totalSolarGeneration = data.solar.reduce((sum, device) => sum + device.total_generation_kw, 0); // kW (treated as kWh for 1hr)
  const currentHouseLoad = data.houseLoad.energy_kwh; // kWh
  
  // Calculate energy flow (both values are effectively kWh for 1-hour period)
  const netGeneration = totalSolarGeneration - currentHouseLoad;
  const isExporting = netGeneration > 0;
  const isImporting = netGeneration < 0;
  
  return {
    totalSolarGeneration,
    currentHouseLoad,
    netGeneration: Math.abs(netGeneration),
    isExporting,
    isImporting,
    energyFlow: isExporting ? 'export' : isImporting ? 'import' : 'balanced',
    solarUtilization: totalSolarGeneration > 0 ? Math.min(1, currentHouseLoad / totalSolarGeneration) : 0,
    timestamp: data.timestamp
  };
} 