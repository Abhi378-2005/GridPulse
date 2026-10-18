import mongoose, { Schema, Document, Types } from 'mongoose';

// ─── Orders (Bids & Asks) ─────────────────────────────────
export interface IOrder extends Document {
  _id: Types.ObjectId;
  nodeId: Types.ObjectId;
  side: 'BID' | 'ASK';
  pricePerKwh: Types.Decimal128;
  quantityKwh: Types.Decimal128;
  filledKwh: Types.Decimal128;
  status: 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED';
  source: 'AUTO' | 'MANUAL';
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    nodeId: { type: Schema.Types.ObjectId, ref: 'GridNode', required: true },
    side: { type: String, enum: ['BID', 'ASK'], required: true },
    pricePerKwh: { type: Schema.Types.Decimal128, required: true },
    quantityKwh: { type: Schema.Types.Decimal128, required: true },
    filledKwh: { type: Schema.Types.Decimal128, default: mongoose.Types.Decimal128.fromString('0') },
    status: {
      type: String,
      enum: ['OPEN', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED'],
      default: 'OPEN',
    },
    source: { type: String, enum: ['AUTO', 'MANUAL'], default: 'AUTO' },
  },
  { timestamps: true }
);

OrderSchema.index({ side: 1, status: 1, pricePerKwh: 1 });
OrderSchema.index({ nodeId: 1 });

export const Order = mongoose.model<IOrder>('Order', OrderSchema);
