-- AlterEnum
ALTER TYPE "PickupStatus" ADD VALUE 'rejected';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'collector';

-- AlterTable
ALTER TABLE "pickups" ADD COLUMN     "assigned_at" TIMESTAMP(3),
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "waste_quantity" DOUBLE PRECISION;
