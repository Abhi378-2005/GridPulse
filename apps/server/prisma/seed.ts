import { PrismaClient } from '@prisma/client';
import { HOUSE_CONFIGS, FINANCE } from '@gridpulse/shared';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding GridPulse database...\n');

  // Clear existing data
  await prisma.posting.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.order.deleteMany();
  await prisma.meterReading.deleteMany();
  await prisma.weatherEvent.deleteMany();
  await prisma.apiCache.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.gridNode.deleteMany();

  console.log('  ✓ Cleared existing data');

  // Create 8 Grid Nodes + Wallets
  for (const config of HOUSE_CONFIGS) {
    const node = await prisma.gridNode.create({
      data: {
        name: config.name,
        emoji: config.emoji,
        solarCapacityKw: config.solarCapacity,
        batteryCapacityKwh: config.batteryCapacity,
        batteryChargeKwh: config.batteryCapacity * 0.5, // Start at 50%
        baseLoadKw: config.baseLoad,
        datasetProfileId: config.name.toLowerCase(),
        posX: config.posX,
        posY: config.posY,
      },
    });

    // Create wallet for each node
    const wallet = await prisma.wallet.create({
      data: {
        nodeId: node.id,
      },
    });

    // Seed initial balance via a "System Deposit" posting
    // In double-entry: we credit the wallet (money in) and debit a system account
    // For simplicity, we just create an initial credit posting with a system transaction
    // Note: In production, you'd have a proper system/escrow account
    // Here we create a standalone initial deposit
    const tx = await prisma.transaction.create({
      data: {
        description: `Initial deposit for ${config.name}`,
        postings: {
          create: {
            amount: FINANCE.INITIAL_WALLET_BALANCE,
            type: 'CREDIT',
            walletId: wallet.id,
          },
        },
      },
    });

    console.log(`  ✓ Created node: ${config.emoji} ${config.name} (solar: ${config.solarCapacity}kW, battery: ${config.batteryCapacity}kWh, balance: $${FINANCE.INITIAL_WALLET_BALANCE})`);
  }

  console.log('\n✅ Seeded 8 grid nodes with wallets and initial balances');
  console.log('🚀 GridPulse database is ready!\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
