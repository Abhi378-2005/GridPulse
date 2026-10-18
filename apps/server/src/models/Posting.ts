import mongoose, { Schema, Document, Types } from 'mongoose';

// ─── Ledger Postings (Debits & Credits) ───────────────────
export interface IPosting extends Document {
  _id: Types.ObjectId;
  amount: Types.Decimal128;
  type: 'DEBIT' | 'CREDIT';
  walletId: Types.ObjectId;
  transactionId: Types.ObjectId;
  createdAt: Date;
}

const PostingSchema = new Schema<IPosting>(
  {
    amount: { type: Schema.Types.Decimal128, required: true },
    type: { type: String, enum: ['DEBIT', 'CREDIT'], required: true },
    walletId: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true },
    transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction', required: true },
  },
  { timestamps: true }
);

PostingSchema.index({ walletId: 1 });
PostingSchema.index({ transactionId: 1 });

export const Posting = mongoose.model<IPosting>('Posting', PostingSchema);
