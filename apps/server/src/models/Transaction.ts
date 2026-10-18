import mongoose, { Schema, Document, Types } from 'mongoose';

// ─── Double-Entry Financial Ledger ────────────────────────
export type TransactionKind = 'TRADE' | 'GRID_IMPORT' | 'GRID_EXPORT' | 'DEPOSIT';

export interface ITransaction extends Document {
  _id: Types.ObjectId;
  tradeId: Types.ObjectId | null;
  kind: TransactionKind;
  nodeId: Types.ObjectId | null; // House involved in a grid import/export
  kwh: number;                   // Energy for grid import/export transactions
  amount: number;                // ₹ for grid import/export (report convenience; postings are the source of truth)
  description: string;
  createdAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    tradeId: { type: Schema.Types.ObjectId, ref: 'Trade', default: null },
    kind: { type: String, enum: ['TRADE', 'GRID_IMPORT', 'GRID_EXPORT', 'DEPOSIT'], default: 'DEPOSIT' },
    nodeId: { type: Schema.Types.ObjectId, ref: 'GridNode', default: null },
    kwh: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    description: { type: String, required: true },
  },
  { timestamps: true }
);

// Unique index ONLY when tradeId is an ObjectId (allows multiple nulls for system deposits/adjustments)
TransactionSchema.index(
  { tradeId: 1 },
  { unique: true, partialFilterExpression: { tradeId: { $type: 'objectId' } } }
);
TransactionSchema.index({ nodeId: 1, kind: 1 });

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
