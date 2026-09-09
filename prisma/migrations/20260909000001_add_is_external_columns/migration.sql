-- AlterTable
ALTER TABLE "videos" ADD COLUMN "is_external" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "resources" ADD COLUMN "is_external" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "resources" ALTER COLUMN "file_size" DROP NOT NULL;
