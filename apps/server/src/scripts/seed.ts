import { connectDB, disconnectDB } from '../config/database';
import { GridNode, Wallet, Order, Trade, Transaction, Posting, MeterReading, WeatherEvent, ApiCache, User, AuditLog } from '../models';
import bcrypt from 'bcryptjs';
import { HOUSE_CONFIGS, FINANCE } from '@gridpulse/shared';
import mongoose from 'mongoose';

export async function seedDatabase(options: { clearExisting?: boolean } = { clearExisting: true }) {
  console.log('🌱 Seeding GridPulse database...\n');

  await connectDB();

  if (options.clearExisting) {
    // Clear existing data (order matters for referential sanity)
    await Posting.deleteMany({});
    await Transaction.deleteMany({});
    await Trade.deleteMany({});
    await Order.deleteMany({});
    await MeterReading.deleteMany({});
    await WeatherEvent.deleteMany({});
    await ApiCache.deleteMany({});
    await Wallet.deleteMany({});
    await GridNode.deleteMany({});
    await User.deleteMany({}); // Users point at node IDs that are about to change
  await AuditLog.deleteMany({}); // Entries reference users that were just deleted

    // Reset collection indexes to prevent stale constraint violations
    await Transaction.collection.dropIndexes().catch(() => {});
    await Transaction.syncIndexes();
    await Wallet.collection.dropIndexes().catch(() => {});
    await Wallet.syncIndexes();
  }

  // Ensure Grid operator (MSEDCL) system wallet exists
  const existingGridWallet = await Wallet.findOne({ systemAccount: 'GRID' });
  if (!existingGridWallet) {
    await Wallet.create({ systemAccount: 'GRID' });
  }

  console.log('  ✓ Database state prepared and indexes synchronized');

  // Create 8 Grid Nodes + Wallets
  let firstNodeId: mongoose.Types.ObjectId | null = null;
  for (const config of HOUSE_CONFIGS) {
    const node = await GridNode.create({
      name: config.name,
      emoji: config.emoji,
      solarCapacityKw: config.solarCapacity,
      batteryCapacityKwh: config.batteryCapacity,
      batteryChargeKwh: config.batteryCapacity * 0.5, // Start at 50%
      baseLoadKw: config.baseLoad,
      datasetProfileId: config.name.toLowerCase(),
      posX: config.posX,
      posY: config.posY,
    });

    firstNodeId ??= node._id;

    // Create wallet for each node
    const wallet = await Wallet.create({
      nodeId: node._id,
    });

    // Seed initial balance via a "System Deposit" posting
    // In double-entry: we credit the wallet (money in)
    const tx = await Transaction.create({
      kind: 'DEPOSIT',
      description: `Initial deposit for ${config.name}`,
    });

    await Posting.create({
      amount: mongoose.Types.Decimal128.fromString(FINANCE.INITIAL_WALLET_BALANCE.toFixed(4)),
      type: 'CREDIT',
      walletId: wallet._id,
      transactionId: tx._id,
    });

    console.log(`  ✓ Created node: ${config.emoji} ${config.name} (solar: ${config.solarCapacity}kW, battery: ${config.batteryCapacity}kWh, balance: ₹${FINANCE.INITIAL_WALLET_BALANCE})`);
  }

  // Accounts (credentials come from .env with fallback defaults for demo/testing)
  const accounts = [
    {
      email: process.env.ADMIN_EMAIL || 'admin@gridpulse.test',
      password: process.env.ADMIN_PASSWORD || 'admin-dev-password',
      name: 'Admin',
      role: 'admin',
      nodeId: null,
    },
    {
      email: process.env.DEMO_USER_EMAIL || 'owner@gridpulse.test',
      password: process.env.DEMO_USER_PASSWORD || 'owner-dev-password',
      name: 'Demo Owner',
      role: 'user',
      nodeId: firstNodeId,
    },
  ];

  for (const a of accounts) {
    await User.create({
      email: a.email.toLowerCase(),
      passwordHash: await bcrypt.hash(a.password, 10),
      name: a.name,
      role: a.role,
      nodeId: a.nodeId,
    });
    console.log(`  ✓ Created ${a.role} account: ${a.email}`);
  }

  console.log('\n✅ Seeded 8 grid nodes with wallets and initial balances');
  console.log('🚀 GridPulse database is ready!\n');
}

// If executed directly from CLI (e.g. pnpm db:seed)
if (require.main === module || (process.argv[1] && process.argv[1].endsWith('seed.ts'))) {
  seedDatabase({ clearExisting: true })
    .catch((e) => {
      console.error('❌ Seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await disconnectDB();
    });
}
