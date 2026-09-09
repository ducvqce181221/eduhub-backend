-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('VIDEO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "AssetSource" AS ENUM ('R2_UPLOAD', 'EXTERNAL_URL');

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL,
ADD COLUMN "google_id" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "uploader_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "file_url" VARCHAR(500) NOT NULL,
    "file_type" VARCHAR(50) NOT NULL,
    "file_size" INTEGER,
    "duration_seconds" INTEGER,
    "content_hash" VARCHAR(64),
    "source" "AssetSource" NOT NULL DEFAULT 'R2_UPLOAD',
    "media_type" "MediaType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "videos" ADD COLUMN "asset_id" UUID;

-- AlterTable
ALTER TABLE "resources" ADD COLUMN "asset_id" UUID;

-- CreateTable
CREATE TABLE "banners" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "image_url" VARCHAR(500) NOT NULL,
    "link_url" VARCHAR(500),
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_assets_uploader_id_media_type_idx" ON "media_assets"("uploader_id", "media_type");

-- CreateIndex
CREATE INDEX "media_assets_content_hash_idx" ON "media_assets"("content_hash");

-- CreateIndex
CREATE INDEX "videos_asset_id_idx" ON "videos"("asset_id");

-- CreateIndex
CREATE INDEX "resources_asset_id_idx" ON "resources"("asset_id");

-- CreateIndex
CREATE INDEX "banners_is_active_order_idx" ON "banners"("is_active", "order");

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
