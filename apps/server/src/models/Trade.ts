import mongoose, { Schema, Document, Types } from 'mongoose';

// ─── Executed Trades ──────────────────────────────────────
export interface ITrade extends Document {
  _id: Types.ObjectId;
  bidOrderId: Types.ObjectId;
  askOrderId: Types.ObjectId;
  buyerNodeId: Types.ObjectId;
  sellerNodeId: Types.ObjectId;
  clearingPrice: Types.Decimal128;
  quantityKwh: Types.Decimal128;
  totalCost: Types.Decimal128;
  co2AvoidedKg: Types.Decimal128;
  createdAt: Date;
}

const TradeSchema = new Schema<ITrade>(
  {
    bidOrderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    askOrderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    buyerNodeId: { type: Schema.Types.ObjectId, ref: 'GridNode', required: true },
    sellerNodeId: { type: Schema.Types.ObjectId, ref: 'GridNode', required: true },
    clearingPrice: { type: Schema.Types.Decimal128, required: true },
    quantityKwh: { type: Schema.Types.Decimal128, required: true },
    totalCost: { type: Schema.Types.Decimal128, required: true },
    co2AvoidedKg: { type: Schema.Types.Decimal128, default: mongoose.Types.Decimal128.fromString('0') },
  },
  { timestamps: true }
);

TradeSchema.index({ buyerNodeId: 1 });
TradeSchema.index({ sellerNodeId: 1 });
TradeSchema.index({ createdAt: -1 });

export const Trade = mongoose.model<ITrade>('Trade', TradeSchema);
