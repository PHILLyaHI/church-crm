-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "birthday" TIMESTAMP(3),
ADD COLUMN     "followUpDates" TIMESTAMP(3)[] DEFAULT ARRAY[]::TIMESTAMP(3)[];

