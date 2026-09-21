/**
 * Generate realistic 24-hour residential energy profiles as CSVs.
 * Based on typical UK/European residential load curves with realistic solar PV output.
 * 
 * Run: npx tsx apps/server/src/data/generateProfiles.ts
 */
import * as fs from 'fs';
import * as path from 'path';

interface HouseProfile {
  name: string;
  description: string;
  solarPeakKw: number;      // Peak solar output (depends on panel size)
  baseLoadKw: number;        // Minimum constant draw (fridge, standby, etc.)
  morningPeakKw: number;     // Additional morning peak (shower, breakfast)
  eveningPeakKw: number;     // Additional evening peak (cooking, TV, lights)
  overnightLoadKw: number;   // Reduced overnight load
  hasEV: boolean;            // Electric vehicle charging (late night)
  hasHeatPump: boolean;      // Heat pump (daytime boost in winter)
}

const PROFILES: HouseProfile[] = [
  {
    name: 'alpha',
    description: 'Young family — moderate solar, high evening use, EV charger',
    solarPeakKw: 7.5,
    baseLoadKw: 0.8,
    morningPeakKw: 2.2,
    eveningPeakKw: 4.5,
    overnightLoadKw: 0.5,
    hasEV: true,
    hasHeatPump: false,
  },
  {
    name: 'beta',
    description: 'Retired couple — smaller solar, low consumption, steady profile',
    solarPeakKw: 5.0,
    baseLoadKw: 0.5,
    morningPeakKw: 1.2,
    eveningPeakKw: 2.0,
    overnightLoadKw: 0.3,
    hasEV: false,
    hasHeatPump: false,
  },
  {
    name: 'gamma',
    description: 'Tech household — large solar array, home office, heat pump',
    solarPeakKw: 10.0,
    baseLoadKw: 1.2,
    morningPeakKw: 2.5,
    eveningPeakKw: 3.8,
    overnightLoadKw: 0.7,
    hasEV: false,
    hasHeatPump: true,
  },
  {
    name: 'delta',
    description: 'Student flat-share — small solar, erratic usage, high evening',
    solarPeakKw: 3.5,
    baseLoadKw: 0.6,
    morningPeakKw: 1.0,
    eveningPeakKw: 4.0,
    overnightLoadKw: 0.8,
    hasEV: false,
    hasHeatPump: false,
  },
  {
    name: 'epsilon',
    description: 'Small business — high daytime load, large solar, minimal night',
    solarPeakKw: 8.5,
    baseLoadKw: 1.5,
    morningPeakKw: 3.5,
    eveningPeakKw: 1.5,
    overnightLoadKw: 0.3,
    hasEV: false,
    hasHeatPump: true,
  },
  {
    name: 'zeta',
    description: 'Eco-home — huge solar, battery-focused, very low base load',
    solarPeakKw: 11.0,
    baseLoadKw: 0.4,
    morningPeakKw: 1.5,
    eveningPeakKw: 2.5,
    overnightLoadKw: 0.2,
    hasEV: true,
    hasHeatPump: false,
  },
  {
    name: 'eta',
    description: 'Single occupant — modest solar, low and steady consumption',
    solarPeakKw: 4.5,
    baseLoadKw: 0.4,
    morningPeakKw: 0.8,
    eveningPeakKw: 1.5,
    overnightLoadKw: 0.3,
    hasEV: false,
    hasHeatPump: false,
  },
  {
    name: 'theta',
    description: 'Large family — medium solar, high all-day consumption',
    solarPeakKw: 6.5,
    baseLoadKw: 1.0,
    morningPeakKw: 3.0,
    eveningPeakKw: 5.0,
    overnightLoadKw: 0.6,
    hasEV: true,
    hasHeatPump: false,
  },
];

function gaussian(x: number, mean: number, sigma: number, amplitude: number): number {
  return amplitude * Math.exp(-0.5 * Math.pow((x - mean) / sigma, 2));
}

function addNoise(value: number, sigmaPct: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return value + value * sigmaPct * z;
}

function generateHourlyData(profile: HouseProfile): string[] {
  const rows: string[] = ['hour,generation,consumption'];
  
  // Generate data at 15-minute resolution (96 points) for realism
  for (let i = 0; i < 96; i++) {
    const hour = i / 4; // 0, 0.25, 0.5, ... 23.75
    
    // ─── Solar Generation ───
    let gen = 0;
    if (hour >= 5.5 && hour <= 20.5) {
      // Main bell curve peaking at 12:30
      gen = gaussian(hour, 12.5, 3.2, profile.solarPeakKw);
      // Add a slight morning ramp dip (clouds often clear by 10am)
      if (hour < 9) {
        gen *= 0.85;
      }
      // Afternoon can be slightly hazy
      if (hour > 15 && hour < 18) {
        gen *= 0.92;
      }
    }
    gen = Math.max(0, addNoise(gen, 0.06));

    // ─── Consumption ───
    let con = profile.baseLoadKw;
    
    // Morning peak: 6:30-9:30 (showers, breakfast, school run)
    con += gaussian(hour, 7.5, 1.2, profile.morningPeakKw);
    
    // Lunch bump (small): 12:00-13:30
    con += gaussian(hour, 12.5, 0.8, profile.baseLoadKw * 0.5);
    
    // Evening peak: 17:00-22:00 (cooking, entertainment, heating)
    con += gaussian(hour, 19, 1.8, profile.eveningPeakKw);
    
    // Night reduction
    if (hour >= 23 || hour <= 5) {
      con = profile.overnightLoadKw;
      // EV charging: 1am-5am
      if (profile.hasEV && hour >= 1 && hour <= 5) {
        con += gaussian(hour, 3, 1.5, 3.0); // ~3kW charger
      }
    }
    
    // Heat pump: adds ~1.5kW during 8am-4pm
    if (profile.hasHeatPump && hour >= 8 && hour <= 16) {
      con += gaussian(hour, 12, 3, 1.5);
    }

    // Add realistic noise (±8%)
    con = Math.max(0.1, addNoise(con, 0.08));

    rows.push(`${hour.toFixed(2)},${gen.toFixed(3)},${con.toFixed(3)}`);
  }

  return rows;
}

// ─── Main ───
const outDir = path.join(__dirname, 'profiles');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log('📊 Generating residential energy profiles...\n');

for (const profile of PROFILES) {
  const rows = generateHourlyData(profile);
  const csvPath = path.join(outDir, `${profile.name}.csv`);
  fs.writeFileSync(csvPath, rows.join('\n'), 'utf-8');
  console.log(`  ✓ ${profile.name}.csv — ${profile.description}`);
  console.log(`    Solar: ${profile.solarPeakKw}kW peak | Base: ${profile.baseLoadKw}kW | Evening: ${profile.eveningPeakKw}kW`);
  console.log(`    Features: ${profile.hasEV ? 'EV Charger' : ''}${profile.hasHeatPump ? ' Heat Pump' : ''}\n`);
}

console.log(`\n✅ Generated ${PROFILES.length} CSV profiles in ${outDir}`);
