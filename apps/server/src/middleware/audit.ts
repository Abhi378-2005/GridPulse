import mongoose from 'mongoose';
import { AuditLog } from '../models';

/**
 * Record an admin action. Never throws and never blocks the request:
 * a failed audit write must not stop an admin from doing their job.
 */
export function recordAudit(
  actor: { userId: string; email: string },
  action: string,
  target: string = '',
  details: Record<string, unknown> = {}
): void {
  if (!mongoose.Types.ObjectId.isValid(actor.userId)) return;
  AuditLog.create({
    actorId: new mongoose.Types.ObjectId(actor.userId),
    actorEmail: actor.email,
    action,
    target,
    details,
  }).catch(err => console.error('Failed to write audit log:', err));
}
