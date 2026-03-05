-- AlterTable
ALTER TABLE "ads" ADD COLUMN     "link_description" TEXT,
ADD COLUMN     "link_title" TEXT,
ADD COLUMN     "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[];
