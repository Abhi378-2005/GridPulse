-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_tradeId_fkey";

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "tradeId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
