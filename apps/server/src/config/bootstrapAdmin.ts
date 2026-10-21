import bcrypt from 'bcryptjs';
import { User } from '../models';

/**
 * Make sure the admin named in ADMIN_EMAIL / ADMIN_PASSWORD exists.
 * Runs on every start, so a fresh deployment (no seed script) still gets an admin.
 * - Missing account: created with that password.
 * - Existing account: promoted to admin if needed; its password is never overwritten.
 */
export async function bootstrapAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log('ℹ️  ADMIN_EMAIL / ADMIN_PASSWORD not set, skipping admin bootstrap');
    return;
  }

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      await existing.save();
      console.log(`🔑 Promoted ${email} to admin`);
    }
    return;
  }

  if (password.length < 8) {
    console.warn('⚠️  ADMIN_PASSWORD must be at least 8 characters, admin not created');
    return;
  }

  await User.create({
    email,
    passwordHash: await bcrypt.hash(password, 10),
    name: 'Admin',
    role: 'admin',
    nodeId: null,
  });
  console.log(`🔑 Created admin account ${email}`);
}
