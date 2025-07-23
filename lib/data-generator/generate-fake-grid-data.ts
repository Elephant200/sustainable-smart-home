// Script to generate fake grid data for testing
// Based on the sample data pattern provided by the user

const samplePattern = [
  { hour: 19, intensity: 118 },
  { hour: 20, intensity: 126 },
  { hour: 21, intensity: 130 },
  { hour: 22, intensity: 138 },
  { hour: 23, intensity: 144 },
  { hour: 0, intensity: 152 },
  { hour: 1, intensity: 185 },
  { hour: 2, intensity: 218 },
  { hour: 3, intensity: 230 },
  { hour: 4, intensity: 237 },
  { hour: 5, intensity: 258 },
  { hour: 6, intensity: 273 },
  { hour: 7, intensity: 284 },
  { hour: 8, intensity: 292 },
  { hour: 9, intensity: 282 },
  { hour: 10, intensity: 281 },
  { hour: 11, intensity: 286 },
  { hour: 12, intensity: 284 },
  { hour: 13, intensity: 255 },
  { hour: 14, intensity: 161 },
  { hour: 15, intensity: 116 },
  { hour: 16, intensity: 110 },
  { hour: 17, intensity: 109 },
  { hour: 18, intensity: 118 }, // Adding hour 18 to complete 24 hours
]

function generateRandomId(): string {
  return crypto.randomUUID()
}

function addRandomVariation(baseIntensity: number, maxVariation: number = 10): number {
  const variation = (Math.random() - 0.5) * 2 * maxVariation
  return Math.max(50, Math.round(baseIntensity + variation)) // Minimum of 50 to keep realistic
}

function generateFakeGridData(daysBack: number = 365, zone: string = "US-CAL-CISO") {
  const data = []
  const now = new Date()
  
  // Start from 365 days ago
  const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
  
  for (let day = 0; day < daysBack; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const currentDate = new Date(startDate)
      currentDate.setDate(currentDate.getDate() + day)
      currentDate.setHours(hour, 0, 0, 0)
      
      // Find the base intensity for this hour from our pattern
      const patternEntry = samplePattern.find(p => p.hour === hour)
      const baseIntensity = patternEntry ? patternEntry.intensity : 150 // Default fallback
      
      // Add some daily variation (weekends tend to be lower, weekdays higher)
      const dayOfWeek = currentDate.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const weekendMultiplier = isWeekend ? 0.85 : 1.0
      
      // Add seasonal variation (winter higher, summer lower due to more solar)
      const month = currentDate.getMonth()
      const seasonalMultiplier = 1.0 + 0.2 * Math.sin((month - 5) * Math.PI / 6) // Peak in winter months
      
      // Calculate final intensity with variations
      const adjustedIntensity = baseIntensity * weekendMultiplier * seasonalMultiplier
      const finalIntensity = addRandomVariation(adjustedIntensity, 15)
      
      const record = {
        id: generateRandomId(),
        timestamp: currentDate.toISOString(),
        grid_carbon_intensity: finalIntensity,
        zone: zone,
        updated_at: new Date().toISOString()
      }
      
      data.push(record)
    }
  }
  
  return data
}

// Function to generate data and save to JSON file
export function generateAndSaveTestData(daysBack: number = 365) {
  const data = generateFakeGridData(daysBack)
  return data
}

// Function to get recent data (for API endpoint)
export function getRecentFakeData(hoursBack: number = 24) {
  const now = new Date()
  const cutoffDate = new Date(now.getTime() - hoursBack * 60 * 60 * 1000)
  
  const data = []
  for (let hour = 0; hour < hoursBack; hour++) {
    const currentDate = new Date(cutoffDate.getTime() + hour * 60 * 60 * 1000)
    const hourOfDay = currentDate.getHours()
    
    const patternEntry = samplePattern.find(p => p.hour === hourOfDay)
    const baseIntensity = patternEntry ? patternEntry.intensity : 150
    
    const record = {
      id: generateRandomId(),
      timestamp: currentDate.toISOString(),
      grid_carbon_intensity: addRandomVariation(baseIntensity, 8),
      zone: "US-CAL-CISO",
      updated_at: new Date().toISOString()
    }
    
    data.push(record)
  }
  
  return data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

// Example usage:
if (require.main === module) {
  console.log("Generating fake grid data...")
  const testData = generateAndSaveTestData(365)
  console.log(`Generated ${testData.length} records`)
  console.log("Sample records:")
  console.log(testData.slice(0, 3))
} 