import mongoose, { Schema, Document, Types } from 'mongoose';

// ─── Grid Nodes (Virtual Houses) ──────────────────────────
export interface IGridNode extends Document {
  _id: Types.ObjectId;
  name: string;
  emoji: string;
  solarCapacityKw: number;
  batteryCapacityKwh: number;
  batteryChargeKwh: number;
  baseLoadKw: number;
  datasetProfileId: string;
  latitude: number;
  longitude: number;
  posX: number;
  posY: number;
  createdAt: Date;
}

const GridNodeSchema = new Schema<IGridNode>(
  {
    name: { type: String, required: true, unique: true },
    emoji: { type: String, default: '🏠' },
    solarCapacityKw: { type: Number, default: 5.0 },
    batteryCapacityKwh: { type: Number, default: 10.0 },
    batteryChargeKwh: { type: Number, default: 5.0 },
    baseLoadKw: { type: Number, default: 1.5 },
    datasetProfileId: { type: String, default: 'default' },
    latitude: { type: Number, default: 18.52 },
    longitude: { type: Number, default: 73.85 },
    posX: { type: Number, default: 0 },
    posY: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const GridNode = mongoose.model<IGridNode>('GridNode', GridNodeSchema);
