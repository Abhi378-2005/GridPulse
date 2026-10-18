import mongoose, { Schema, Document, Types } from 'mongoose';

// ─── Financial Wallets ────────────────────────────────────
// A wallet belongs either to a grid node (a house) or to a system account.
// The 'GRID' system account represents the utility (MSEDCL): it receives grid
// import payments and wheeling charges, and pays for exported solar.
export interface IWallet extends Document {
  _id: Types.ObjectId;
  nodeId?: Types.ObjectId | null;
  systemAccount?: 'GRID' | null;
  createdAt: Date;
}

const WalletSchema = new Schema<IWallet>(
  {
    nodeId: { type: Schema.Types.ObjectId, ref: 'GridNode', default: undefined },
    systemAccount: { type: String, enum: ['GRID'], default: undefined },
  },
  { timestamps: true }
);

WalletSchema.index({ nodeId: 1 }, { unique: true, partialFilterExpression: { nodeId: { $type: 'objectId' } } });
WalletSchema.index({ systemAccount: 1 }, { unique: true, partialFilterExpression: { systemAccount: { $type: 'string' } } });

export const Wallet = mongoose.model<IWallet>('Wallet', WalletSchema);
