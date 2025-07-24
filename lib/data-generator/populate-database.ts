import { createClient } from '@/lib/supabase/server';
import { generateHistoricalSolarData, saveHistoricalSolarData } from './solar-data';
import { generateHistoricalHouseLoad, saveHouseLoadData } from './house-load';

/**
 * Fetch existing solar array devices and their configurations for a user
 */
async function getExistingSolarArrays(userId: string) {
  const supabase = await createClient();
  
  const { data: solarDevices, error } = await supabase
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
    .eq('is_active', true);
  console.log('solarDevices', solarDevices);
  
  if (error) {
    console.error('Error fetching solar devices:', error);
    return [];
  }
  
  const validSolarArrays = solarDevices?.filter(device => {
    // Handle the case where solar_config might be incorrectly typed as an array
    const solarConfig = Array.isArray(device.solar_config) 
      ? device.solar_config[0] 
      : device.solar_config;
    
    return solarConfig && 
      typeof solarConfig === 'object' &&
      'panel_count' in solarConfig &&
      'output_per_panel_kw' in solarConfig &&
      solarConfig.panel_count > 0 &&
      solarConfig.output_per_panel_kw > 0;
  }) || [];
  
  console.log(`Found ${validSolarArrays.length} configured solar arrays for user`);
  return validSolarArrays;
}

/**
 * Check if user has a house device for load tracking
 */
async function hasHouseDevice(userId: string) {
  const supabase = await createClient();
  
  const { data: houseDevice } = await supabase
    .from('devices')
    .select('id, name')
    .eq('user_id', userId)
    .eq('type', 'house')
    .eq('is_active', true)
    .single();
  
  return !!houseDevice;
}

/**
 * Find the most recent timestamp for a user's data and return the next hour to start from
 */
async function getNextDataTimestamp(userId: string, tableName: 'power_generation' | 'house_load'): Promise<Date> {
  const supabase = await createClient();
  
  // Get the most recent timestamp for this user
  const { data: latestData } = await supabase
    .from(tableName)
    .select('timestamp')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();
  
  if (latestData) {
    // Start from the next hour after the latest data
    const lastTimestamp = new Date(latestData.timestamp);
    const nextHour = new Date(lastTimestamp.getTime() + 60 * 60 * 1000);
    console.log(`Found existing data, latest: ${lastTimestamp.toISOString()}, next start: ${nextHour.toISOString()}`);
    return nextHour;
  } else {
    // No existing data, start from one year ago (rounded to hour)
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    oneYearAgo.setMinutes(0, 0, 0);
    console.log(`No existing data found, starting from one year ago: ${oneYearAgo.toISOString()}`);
    return oneYearAgo;
  }
}

/**
 * Generate and save historical data for all time ranges
 */
async function generateTimeSeriesData(userId: string, forceFullHistory: boolean = false) {
  console.log('Checking for most recent data and generating only newer data...');
  
  // Round to current hour (but don't go backwards in time)
  const now = new Date();
  const endDate = new Date(now);
  endDate.setMinutes(0, 0, 0); // Set to start of current hour
  
  // If we're past the halfway point of the hour, include the next hour
  if (now.getMinutes() >= 30) {
    endDate.setHours(endDate.getHours() + 1);
  }
  
  console.log(`Data generation will run up to: ${endDate.toISOString()}`);
  
  try {
    // Get existing solar arrays
    const solarArrays = await getExistingSolarArrays(userId);
    
    if (solarArrays.length > 0) {
      // Find where to start solar data generation
      console.log('Finding most recent solar generation data...');
      let solarStartDate = await getNextDataTimestamp(userId, 'power_generation');
      
      // If forcing full history, start from one year ago regardless
      if (forceFullHistory) {
        const oneYearAgo = new Date(endDate);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        oneYearAgo.setMinutes(0, 0, 0);
        solarStartDate = oneYearAgo;
        console.log('Forcing full history generation...');
      }
      
      if (solarStartDate <= endDate) {
        const hoursToGenerate = Math.ceil((endDate.getTime() - solarStartDate.getTime()) / (60 * 60 * 1000));
        console.log(`Generating solar data from ${solarStartDate.toISOString()} to ${endDate.toISOString()}`);
        console.log(`This will generate approximately ${hoursToGenerate} hours of data for ${solarArrays.length} solar arrays`);
        
        const solarData = await generateHistoricalSolarData(userId, solarStartDate, endDate);
        if (solarData.length > 0) {
          console.log(`Generated ${solarData.length} solar data points, now saving to database...`);
          await saveHistoricalSolarData(userId, solarData);
          console.log(`Successfully saved ${solarData.length} new solar generation data points`);
        } else {
          console.log('No solar data was generated - check device configuration');
        }
      } else {
        console.log('Solar data is already up to date');
      }
    } else {
      console.log('No configured solar arrays found for this user');
    }
    
    // Check if user has a house device before generating house load data
    const hasHouse = await hasHouseDevice(userId);
    
    if (hasHouse) {
      // Find where to start house load data generation
      console.log('Finding most recent house load data...');
      let houseLoadStartDate = await getNextDataTimestamp(userId, 'house_load');
      
      // If forcing full history, start from one year ago regardless
      if (forceFullHistory) {
        const oneYearAgo = new Date(endDate);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        oneYearAgo.setMinutes(0, 0, 0);
        houseLoadStartDate = oneYearAgo;
      }
      
      if (houseLoadStartDate <= endDate) {
        const hoursToGenerate = Math.ceil((endDate.getTime() - houseLoadStartDate.getTime()) / (60 * 60 * 1000));
        console.log(`Generating house load data from ${houseLoadStartDate.toISOString()} to ${endDate.toISOString()}`);
        console.log(`This will generate approximately ${hoursToGenerate} hours of data`);
        
        const houseLoadData = generateHistoricalHouseLoad(houseLoadStartDate, endDate);
        if (houseLoadData.length > 0) {
          console.log(`Generated ${houseLoadData.length} house load data points, now saving to database...`);
          await saveHouseLoadData(userId, houseLoadData);
          console.log(`Successfully saved ${houseLoadData.length} new house load data points`);
        } else {
          console.log('No house load data was generated');
        }
      } else {
        console.log('House load data is already up to date');
      }
    } else {
      console.log('No house device found for this user - skipping house load data generation');
    }
    
  } catch (error) {
    console.error('Error generating time series data:', error);
    throw error;
  }
}

/**
 * Main function to populate database for a user
 */
export async function populateUserData(userId: string, forceFullHistory: boolean = false) {
  try {
    console.log(`Starting smart database population for user: ${userId}`);
    if (forceFullHistory) {
      console.log('Force mode enabled - will regenerate full year of historical data');
    } else {
      console.log('Will only add missing data points for existing devices...');
    }
    
    // Check what devices the user has configured
    const solarArrays = await getExistingSolarArrays(userId);
    const hasHouse = await hasHouseDevice(userId);
    
    if (solarArrays.length === 0 && !hasHouse) {
      console.log('No devices found for this user. Please configure devices first in the settings.');
      return { 
        success: false, 
        message: 'No devices configured. Please add devices in settings before populating data.' 
      };
    }
    
    console.log(`Found ${solarArrays.length} solar arrays and ${hasHouse ? 'a' : 'no'} house device configured`);
    
    // Generate time series data for existing devices only
    await generateTimeSeriesData(userId, forceFullHistory);
    
    console.log('Smart database population completed successfully');
    const message = forceFullHistory 
      ? 'Database populated successfully (full historical data regenerated)' 
      : 'Database populated successfully (only new data added)';
    return { success: true, message };
    
  } catch (error) {
    console.error('Error populating database:', error);
    throw error;
  }
}

/**
 * Clear existing data for a user (useful for re-populating)
 */
export async function clearUserData(userId: string) {
  const supabase = await createClient();
  
  try {
    console.log(`Clearing existing data for user: ${userId}`);
    
    // Delete time series data only, not device configurations
    await supabase.from('power_generation').delete().eq('user_id', userId);
    await supabase.from('house_load').delete().eq('user_id', userId);
    
    console.log('User time series data cleared successfully');
    return { success: true, message: 'User time series data cleared' };
    
  } catch (error) {
    console.error('Error clearing user data:', error);
    throw error;
  }
} 