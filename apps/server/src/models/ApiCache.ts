import mongoose, { Schema, Document, Types } from 'mongoose';

// ─── API Data Cache ───────────────────────────────────────
export interface IApiCache extends Document {
  _id: Types.ObjectId;
  provider: string;
  endpoint: string;
  responseJson: string;
  fetchedAt: Date;
  expiresAt: Date;
}

const ApiCacheSchema = new Schema<IApiCache>(
  {
    provider: { type: String, required: true },
    endpoint: { type: String, required: true },
    responseJson: { type: String, required: true },
    fetchedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false }
);

ApiCacheSchema.index({ provider: 1, endpoint: 1 }, { unique: true });
ApiCacheSchema.index({ expiresAt: 1 });

export const ApiCache = mongoose.model<IApiCache>('ApiCache', ApiCacheSchema);
