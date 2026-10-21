import mongoose, { Schema, Document, Types } from 'mongoose';

// ─── Admin Audit Log ──────────────────────────────────────
// One row per admin action: who did what, to what, and when.
export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  actorId: Types.ObjectId;
  actorEmail: string;
  action: string;   // e.g. 'sim.pause', 'user.role'
  target: string;   // Human-readable subject, e.g. a user's email
  details: Record<string, unknown>;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorEmail: { type: String, required: true },
    action: { type: String, required: true },
    target: { type: String, default: '' },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
