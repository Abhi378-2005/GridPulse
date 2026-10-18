import mongoose, { Schema, Document, Types } from 'mongoose';

// ─── Energy Meter Readings ────────────────────────────────
export interface IMeterReading extends Document {
  _id: Types.ObjectId;
  nodeId: Types.ObjectId;
  simulationTime: Date;
  generationKw: number;
  consumptionKw: number;
  netEnergyKw: number;
  batteryKwh: number;
  dataSource: 'LIVE_API' | 'DATASET' | 'SIMULATION' | 'HYBRID';
  weatherFactor: number;
  cloudCoverPct?: number;
  solarRadiation?: number;
  temperatureC?: number;
  co2Intensity?: number;
  createdAt: Date;
}

const MeterReadingSchema = new Schema<IMeterReading>(
  {
    nodeId: { type: Schema.Types.ObjectId, ref: 'GridNode', required: true },
    simulationTime: { type: Date, required: true },
    generationKw: { type: Number, required: true },
    consumptionKw: { type: Number, required: true },
    netEnergyKw: { type: Number, required: true },
    batteryKwh: { type: Number, required: true },
    dataSource: {
      type: String,
      enum: ['LIVE_API', 'DATASET', 'SIMULATION', 'HYBRID'],
      default: 'SIMULATION',
    },
    weatherFactor: { type: Number, default: 1.0 },
    cloudCoverPct: { type: Number },
    solarRadiation: { type: Number },
    temperatureC: { type: Number },
    co2Intensity: { type: Number },
  },
  { timestamps: true }
);

MeterReadingSchema.index({ nodeId: 1, simulationTime: -1 });
MeterReadingSchema.index({ simulationTime: -1 });

export const MeterReading = mongoose.model<IMeterReading>('MeterReading', MeterReadingSchema);
