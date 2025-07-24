# Data Generators

This directory contains comprehensive fake data generators for simulating realistic energy data in the sustainable smart home system.

## Overview

The data generators create realistic patterns for:
- **Solar Generation**: Based on time of day, season, weather, and panel efficiency
- **House Load**: Based on typical household consumption patterns, appliances, and seasonal variations

## Components

### Solar Data Generator (`solar-data.ts`)

**Features:**
- ☀️ **Realistic solar irradiance** based on sun angle and season
- 🌤️ **Weather simulation** (cloudy vs sunny days)
- 🔧 **Panel efficiency factors** (temperature, dust, aging)
- 📊 **Per-panel and total array output**
- 📈 **Historical and live data generation**

**Key Functions:**
- `generateLiveSolarData(userId)` - Current solar output for all user's arrays
- `saveLiveSolarData(userId, data)` - Save live solar data to database
- `generateHistoricalSolarData(userId, startDate, endDate)` - Historical data range
- `saveHistoricalSolarData(userId, data)` - Save historical data to database
- `generateWeekOfSolarData(userId)` - Generate and save a week of data

### House Load Generator (`house-load.ts`)

**Features:**
- 🏠 **Realistic consumption patterns** (morning/evening peaks, night lows)
- 📅 **Day-of-week variations** (weekends vs weekdays)
- 🌡️ **Seasonal adjustments** (AC in summer, heating in winter)
- 🔌 **Appliance usage spikes** (dishwasher, dryer, etc.)
- 📊 **Hourly resolution** (always 1hr for simplicity)

**Key Functions:**
- `generateCurrentHouseLoad()` - Current house consumption
- `generateHistoricalHouseLoad(startDate, endDate)` - Historical consumption
- `generateWeekOfHouseLoadData(userId)` - Generate and save a week of data

### Utilities (`utils.ts`)

**Convenience Functions:**
- `generateCompleteWeekOfData(userId)` - Generate both solar and house load data
- `generateCurrentSystemData(userId)` - Get current system snapshot
- `calculateSystemMetrics(data)` - Calculate energy flow and utilization

## Usage Examples

### Generate Test Data for Development

```typescript
import { generateCompleteWeekOfData } from '@/lib/data-generator';

// Generate a week of realistic data for testing
await generateCompleteWeekOfData('user-uuid-here');
```

### Get Current System Status

```typescript
import { generateCurrentSystemData, calculateSystemMetrics } from '@/lib/data-generator';

// Get current solar + house load data
const currentData = await generateCurrentSystemData('user-uuid-here');
const metrics = calculateSystemMetrics(currentData);

console.log(`Solar: ${metrics.totalSolarGeneration.toFixed(2)} kW`);
console.log(`House: ${metrics.currentHouseLoad.toFixed(2)} kW`);
console.log(`Status: ${metrics.energyFlow}`);
```

### Generate Custom Historical Data

```typescript
import { generateHistoricalSolarData, generateHistoricalHouseLoad } from '@/lib/data-generator';

const startDate = new Date('2024-01-01');
const endDate = new Date('2024-01-31');

// Generate January solar data (always 1hr resolution)
const solarData = await generateHistoricalSolarData('user-id', startDate, endDate);

// Generate January house load data (always 1hr resolution)
const houseData = generateHistoricalHouseLoad(startDate, endDate);
```

## Data Patterns

### Solar Generation
- **Peak generation**: 10am - 2pm (depends on panel orientation)
- **Seasonal variation**: Higher in summer, lower in winter
- **Weather effects**: 10-100% of clear-sky potential
- **Efficiency**: 85-95% of rated capacity

### House Load
- **Morning peak**: 6-9am (2-4 kW)
- **Evening peak**: 6-9pm (4-5 kW) 
- **Night baseline**: 0.6-0.8 kW
- **Seasonal**: +50% in summer (AC), +40% in winter (heating)
- **Weekend factor**: +20% consumption when home more

## Database Integration

The generators automatically save data to the appropriate database tables:
- **Solar generation** → `power_generation` table (dedicated generation tracking)
- **House load** → `house_load` table (consumption tracking)
- **Energy transfers** → `energy_flows` table (device-to-device transfers)
- **Batched inserts** to handle large datasets efficiently

### Schema Design
- `power_generation`: Tracks renewable energy generation with environmental factors
- `house_load`: Tracks household energy consumption 
- `energy_flows`: Tracks energy transfers between devices (batteries, grid, etc.)

## Next Steps

This data will be used with grid carbon intensity data to create the **optimal battery charging algorithm** that:
1. Analyzes solar generation forecasts
2. Predicts house load patterns  
3. Considers grid carbon intensity
4. Determines optimal battery charge/discharge times
5. Minimizes carbon footprint and costs 