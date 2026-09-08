import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

interface DatasetRow {
  hour: number;
  generationKw: number;
  consumptionKw: number;
}

/**
 * Loads household energy profiles from CSV files.
 * Falls back to generating synthetic profiles if CSV files not found.
 */
export class DatasetLoader {
  private profiles: Map<string, DatasetRow[]> = new Map();
  private dataDir: string;

  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data', 'profiles');
  }

  /**
   * Load all CSV profiles on startup.
   * If CSVs don't exist, generates synthetic profiles.
   */
  async loadAll(nodeNames: string[]): Promise<void> {
    for (const name of nodeNames) {
      const csvPath = path.join(this.dataDir, `${name.toLowerCase()}.csv`);

      if (fs.existsSync(csvPath)) {
        this.loadFromCSV(name.toLowerCase(), csvPath);
      } else {
        this.generateSyntheticProfile(name.toLowerCase());
      }
    }

    console.log(`📊 Loaded ${this.profiles.size} energy profiles`);
  }

  /**
   * Get generation and consumption for a given node at a given hour.
   * Uses linear interpolation between data points.
   */
  getReading(profileId: string, hourFraction: number): { generationKw: number; consumptionKw: number } {
    const profile = this.profiles.get(profileId);
    if (!profile || profile.length === 0) {
      return { generationKw: 0, consumptionKw: 1.5 };
    }

    // Find surrounding data points
    const hour = hourFraction % 24;
    const lowerIdx = Math.floor(hour) % profile.length;
    const upperIdx = (lowerIdx + 1) % profile.length;
    const fraction = hour - Math.floor(hour);

    const lower = profile[lowerIdx];
    const upper = profile[upperIdx];

    return {
      generationKw: lower.generationKw + (upper.generationKw - lower.generationKw) * fraction,
      consumptionKw: lower.consumptionKw + (upper.consumptionKw - lower.consumptionKw) * fraction,
    };
  }

  hasProfile(profileId: string): boolean {
    return this.profiles.has(profileId);
  }

  private loadFromCSV(profileId: string, csvPath: string): void {
    try {
      const content = fs.readFileSync(csvPath, 'utf-8');
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        cast: true,
      });

      const profile: DatasetRow[] = records.map((row: any) => ({
        hour: parseFloat(row.hour || row.Hour || row.time || 0),
        generationKw: parseFloat(row.generation || row.Generation || row.solar || row.gen_kw || 0),
        consumptionKw: parseFloat(row.consumption || row.Consumption || row.load || row.con_kw || 1.5),
      }));

      this.profiles.set(profileId, profile);
      console.log(`  ✓ Loaded CSV profile: ${profileId} (${profile.length} data points)`);
    } catch (error) {
      console.warn(`  ⚠️ Failed to load CSV for ${profileId}, using synthetic`);
      this.generateSyntheticProfile(profileId);
    }
  }

  /**
   * Generate a synthetic 24-hour profile using realistic mathematical models.
   * Each profile has slightly different characteristics.
   */
  private generateSyntheticProfile(profileId: string): void {
    const profile: DatasetRow[] = [];
    
    // Add variation per profile based on name hash
    const hash = profileId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const solarVariation = 0.7 + (hash % 30) / 50;   // 0.7–1.3
    const consumeVariation = 0.8 + (hash % 20) / 50;  // 0.8–1.2
    const peakShift = (hash % 5) / 10 - 0.25;          // ±0.25 hours

    for (let hour = 0; hour < 24; hour++) {
      // Solar: bell curve
      let gen = 0;
      if (hour >= 6 && hour <= 20) {
        gen = 5.0 * Math.exp(-0.5 * Math.pow((hour - 12 + peakShift) / 3, 2)) * solarVariation;
      }

      // Consumption: double peak
      const morning = 2.0 * Math.exp(-0.5 * Math.pow((hour - 8) / 1.5, 2));
      const evening = 3.0 * Math.exp(-0.5 * Math.pow((hour - 19) / 2, 2));
      const nightReduction = (hour >= 23 || hour <= 5) ? 0.4 : 1.0;
      const con = (1.5 + morning + evening) * nightReduction * consumeVariation;

      profile.push({
        hour,
        generationKw: Math.round(gen * 100) / 100,
        consumptionKw: Math.round(con * 100) / 100,
      });
    }

    this.profiles.set(profileId, profile);
    console.log(`  ✓ Generated synthetic profile: ${profileId}`);
  }
}
