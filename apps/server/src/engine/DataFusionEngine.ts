import type { DataMode, MeterReadingData, DataSource, LiveWeatherData } from '@gridpulse/shared';
import { FINANCE } from '@gridpulse/shared';
import { SolarModel } from './SolarModel';
import { ConsumptionModel } from './ConsumptionModel';
import { BatteryModel } from './BatteryModel';
import { WeatherEngine } from './WeatherEngine';
import { OpenMeteoService } from '../realtime/OpenMeteoService';
import { CarbonIntensityService } from '../realtime/CarbonIntensityService';
import { DatasetLoader } from '../data/DatasetLoader';
import { getHourFraction, addNoise, roundTo } from '../utils/math';

interface NodeConfig {
  id: string;
  name: string;
  solarCapacityKw: number;
  batteryCapacityKwh: number;
  batteryChargeKwh: number;
  baseLoadKw: number;
  datasetProfileId: string;
}

/**
 * Data Fusion Engine — the core innovation of GridPulse.
 * Merges all 3 data layers (Dataset, Real-Time API, Simulation)
 * to produce the most realistic meter readings possible.
 */
export class DataFusionEngine {
  private openMeteo: OpenMeteoService;
  private carbonService: CarbonIntensityService;
  private datasetLoader: DatasetLoader;
  private weatherEngine: WeatherEngine;
  private batteryStates: Map<string, number> = new Map();

  constructor() {
    this.openMeteo = new OpenMeteoService();
    this.carbonService = new CarbonIntensityService();
    this.datasetLoader = new DatasetLoader();
    this.weatherEngine = new WeatherEngine();
  }

  async initialize(nodes: NodeConfig[]): Promise<void> {
    // Load dataset profiles
    const nodeNames = nodes.map(n => n.name);
    await this.datasetLoader.loadAll(nodeNames);

    // Initialize battery states
    for (const node of nodes) {
      this.batteryStates.set(node.id, node.batteryChargeKwh);
    }

    // Pre-warm API caches
    try {
      await this.openMeteo.getCurrent();
      await this.carbonService.getCurrent();
    } catch (e) {
      console.warn('⚠️  API pre-warm failed (will use fallbacks)');
    }

    console.log('🔋 DataFusionEngine initialized');
  }

  /**
   * Compute a meter reading for a specific node at a given virtual time.
   */
  async computeReading(
    node: NodeConfig,
    virtualTime: Date,
    mode: DataMode,
    tickDurationHours: number
  ): Promise<MeterReadingData> {
    const hour = getHourFraction(virtualTime);
    let generationKw: number;
    let consumptionKw: number;
    let dataSource: DataSource;
    let weatherFactor = 1.0;
    let cloudCoverPct: number | undefined;
    let solarRadiation: number | undefined;
    let temperatureC: number | undefined;
    let co2Intensity: number | undefined;

    // Get simulated weather events factor
    const simSolarFactor = this.weatherEngine.getSolarFactor();
    const simConsumptionFactor = this.weatherEngine.getConsumptionFactor();

    if (mode === 'LIVE') {
      // ── HYBRID MODE: Dataset baseline + Live API modifiers ──
      const apiData = await this.openMeteo.getCurrent();
      co2Intensity = await this.carbonService.getCurrent();

      // Get dataset baseline
      const datasetReading = this.datasetLoader.getReading(node.datasetProfileId, hour);

      if (apiData) {
        // Scale baseline with live weather
        const weatherMod = this.openMeteo.getWeatherModifier(apiData);
        const tempMod = this.openMeteo.getTemperatureModifier(apiData);

        generationKw = datasetReading.generationKw * weatherMod * simSolarFactor;
        consumptionKw = datasetReading.consumptionKw * tempMod * simConsumptionFactor;
        weatherFactor = weatherMod * simSolarFactor;
        cloudCoverPct = apiData.cloudCoverPct;
        solarRadiation = apiData.solarRadiationWm2;
        temperatureC = apiData.temperatureC;
        dataSource = 'HYBRID';
      } else {
        // API down → fall back to dataset only
        generationKw = datasetReading.generationKw * simSolarFactor;
        consumptionKw = datasetReading.consumptionKw * simConsumptionFactor;
        weatherFactor = simSolarFactor;
        dataSource = 'DATASET';
      }
    } else if (mode === 'REPLAY') {
      // ── DATASET REPLAY: Pure CSV data + sim events ──
      const datasetReading = this.datasetLoader.getReading(node.datasetProfileId, hour);
      generationKw = datasetReading.generationKw * simSolarFactor;
      consumptionKw = datasetReading.consumptionKw * simConsumptionFactor;
      weatherFactor = simSolarFactor;
      co2Intensity = FINANCE.CO2_GRID_DEFAULT;
      dataSource = 'DATASET';
    } else {
      // ── DEMO MODE: Pure mathematical simulation ──
      generationKw = SolarModel.compute(virtualTime, node.solarCapacityKw, simSolarFactor);
      consumptionKw = ConsumptionModel.compute(virtualTime, node.baseLoadKw, simConsumptionFactor);
      weatherFactor = simSolarFactor;
      co2Intensity = FINANCE.CO2_GRID_DEFAULT;
      dataSource = 'SIMULATION';
    }

    // Add individual node noise
    generationKw = Math.max(0, addNoise(generationKw, 0.03));
    consumptionKw = Math.max(0.1, addNoise(consumptionKw, 0.05));

    // Net energy
    const rawNetEnergy = generationKw - consumptionKw;

    // Battery model
    const currentBattery = this.batteryStates.get(node.id) || node.batteryChargeKwh;
    const batteryResult = BatteryModel.update(
      rawNetEnergy,
      currentBattery,
      node.batteryCapacityKwh,
      tickDurationHours
    );
    this.batteryStates.set(node.id, batteryResult.newChargeKwh);

    return {
      nodeId: node.id,
      simulationTime: virtualTime.toISOString(),
      generationKw: roundTo(generationKw, 3),
      consumptionKw: roundTo(consumptionKw, 3),
      netEnergyKw: roundTo(batteryResult.adjustedNetKw, 3),
      batteryKwh: roundTo(batteryResult.newChargeKwh, 2),
      dataSource,
      weatherFactor: roundTo(weatherFactor, 3),
      cloudCoverPct,
      solarRadiation,
      temperatureC,
      co2Intensity,
    };
  }

  /**
   * Process weather tick (random events + check API).
   */
  tickWeather(virtualTime: Date) {
    return this.weatherEngine.tick(virtualTime);
  }

  triggerWeatherEvent(type: string, virtualTime: Date) {
    return this.weatherEngine.triggerEvent(type, virtualTime);
  }

  getActiveWeatherEvents() {
    return this.weatherEngine.getActiveEvents();
  }

  async getLiveWeather(): Promise<LiveWeatherData | null> {
    return this.openMeteo.getCurrent();
  }

  async getCO2Intensity(): Promise<number> {
    return this.carbonService.getCurrent();
  }

  getBatteryLevel(nodeId: string): number {
    return this.batteryStates.get(nodeId) || 0;
  }

  /**
   * Update the location for live weather API calls.
   */
  setLocation(latitude: number, longitude: number): void {
    this.openMeteo = new OpenMeteoService(latitude, longitude);
    console.log(`📍 Weather location updated to (${latitude}, ${longitude})`);
  }
}
