import mongoose, { Schema, Document, Types } from 'mongoose';

// ─── Weather Events ───────────────────────────────────────
export interface IWeatherEvent extends Document {
  _id: Types.ObjectId;
  type: string;
  description: string;
  source: 'LIVE_API' | 'DATASET' | 'SIMULATION' | 'HYBRID';
  impactFactor: number;
  startTime: Date;
  durationMs: number;
  createdAt: Date;
}

const WeatherEventSchema = new Schema<IWeatherEvent>(
  {
    type: { type: String, required: true },
    description: { type: String, required: true },
    source: {
      type: String,
      enum: ['LIVE_API', 'DATASET', 'SIMULATION', 'HYBRID'],
      required: true,
    },
    impactFactor: { type: Number, required: true },
    startTime: { type: Date, required: true },
    durationMs: { type: Number, required: true },
  },
  { timestamps: true }
);

WeatherEventSchema.index({ startTime: -1 });

export const WeatherEvent = mongoose.model<IWeatherEvent>('WeatherEvent', WeatherEventSchema);
