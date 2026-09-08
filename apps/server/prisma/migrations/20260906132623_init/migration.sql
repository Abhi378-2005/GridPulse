-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('LIVE_API', 'DATASET', 'SIMULATION', 'HYBRID');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('BID', 'ASK');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('OPEN', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PostingType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateTable
CREATE TABLE "GridNode" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '🏠',
    "solarCapacityKw" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "batteryCapacityKwh" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "batteryChargeKwh" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "baseLoadKw" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "datasetProfileId" TEXT NOT NULL DEFAULT 'default',
    "latitude" DOUBLE PRECISION NOT NULL DEFAULT 18.52,
    "longitude" DOUBLE PRECISION NOT NULL DEFAULT 73.85,
    "posX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "posY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GridNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeterReading" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "simulationTime" TIMESTAMP(3) NOT NULL,
    "generationKw" DOUBLE PRECISION NOT NULL,
    "consumptionKw" DOUBLE PRECISION NOT NULL,
    "netEnergyKw" DOUBLE PRECISION NOT NULL,
    "batteryKwh" DOUBLE PRECISION NOT NULL,
    "dataSource" "DataSource" NOT NULL DEFAULT 'SIMULATION',
    "weatherFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "cloudCoverPct" DOUBLE PRECISION,
    "solarRadiation" DOUBLE PRECISION,
    "temperatureC" DOUBLE PRECISION,
    "co2Intensity" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeterReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "side" "OrderSide" NOT NULL,
    "pricePerKwh" DECIMAL(10,4) NOT NULL,
    "quantityKwh" DECIMAL(10,4) NOT NULL,
    "filledKwh" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "status" "OrderStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "bidOrderId" TEXT NOT NULL,
    "askOrderId" TEXT NOT NULL,
    "buyerNodeId" TEXT NOT NULL,
    "sellerNodeId" TEXT NOT NULL,
    "clearingPrice" DECIMAL(10,4) NOT NULL,
    "quantityKwh" DECIMAL(10,4) NOT NULL,
    "totalCost" DECIMAL(10,4) NOT NULL,
    "co2AvoidedKg" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Posting" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(10,4) NOT NULL,
    "type" "PostingType" NOT NULL,
    "walletId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Posting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source" "DataSource" NOT NULL,
    "impactFactor" DOUBLE PRECISION NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeatherEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiCache" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "responseJson" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GridNode_name_key" ON "GridNode"("name");

-- CreateIndex
CREATE INDEX "MeterReading_nodeId_simulationTime_idx" ON "MeterReading"("nodeId", "simulationTime");

-- CreateIndex
CREATE INDEX "MeterReading_simulationTime_idx" ON "MeterReading"("simulationTime");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_nodeId_key" ON "Wallet"("nodeId");

-- CreateIndex
CREATE INDEX "Wallet_nodeId_idx" ON "Wallet"("nodeId");

-- CreateIndex
CREATE INDEX "Order_side_status_pricePerKwh_idx" ON "Order"("side", "status", "pricePerKwh");

-- CreateIndex
CREATE INDEX "Order_nodeId_idx" ON "Order"("nodeId");

-- CreateIndex
CREATE INDEX "Trade_buyerNodeId_idx" ON "Trade"("buyerNodeId");

-- CreateIndex
CREATE INDEX "Trade_sellerNodeId_idx" ON "Trade"("sellerNodeId");

-- CreateIndex
CREATE INDEX "Trade_createdAt_idx" ON "Trade"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_tradeId_key" ON "Transaction"("tradeId");

-- CreateIndex
CREATE INDEX "Posting_walletId_idx" ON "Posting"("walletId");

-- CreateIndex
CREATE INDEX "Posting_transactionId_idx" ON "Posting"("transactionId");

-- CreateIndex
CREATE INDEX "WeatherEvent_startTime_idx" ON "WeatherEvent"("startTime");

-- CreateIndex
CREATE INDEX "ApiCache_expiresAt_idx" ON "ApiCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiCache_provider_endpoint_key" ON "ApiCache"("provider", "endpoint");

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "GridNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "GridNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "GridNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_bidOrderId_fkey" FOREIGN KEY ("bidOrderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_askOrderId_fkey" FOREIGN KEY ("askOrderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_buyerNodeId_fkey" FOREIGN KEY ("buyerNodeId") REFERENCES "GridNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_sellerNodeId_fkey" FOREIGN KEY ("sellerNodeId") REFERENCES "GridNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Posting" ADD CONSTRAINT "Posting_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Posting" ADD CONSTRAINT "Posting_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
