-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'BUSINESS');

-- CreateEnum
CREATE TYPE "CreativeType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "ParseStatus" AS ENUM ('SUCCESS', 'ERROR');

-- CreateEnum
CREATE TYPE "AiGenerationMode" AS ENUM ('SIMILAR_STYLE', 'DIFFERENT_ANGLE', 'GEO_ADAPT', 'TEXT_VARIATION');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "downloads_this_month" INTEGER NOT NULL DEFAULT 0,
    "downloads_reset_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verticals" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "verticals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ads" (
    "id" UUID NOT NULL,
    "fb_ad_id" TEXT NOT NULL,
    "advertiser_name" TEXT,
    "advertiser_id" TEXT,
    "ad_text" TEXT,
    "landing_url" TEXT,
    "countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "vertical_id" UUID,
    "started_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "days_active" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "text_hash" TEXT,
    "saves_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_creatives" (
    "id" UUID NOT NULL,
    "ad_id" UUID NOT NULL,
    "type" "CreativeType" NOT NULL,
    "original_url" TEXT,
    "b2_key" TEXT,
    "thumbnail_b2_key" TEXT,
    "phash" TEXT,
    "file_size_bytes" INTEGER,
    "is_downloaded" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_creatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_items" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "ad_id" UUID NOT NULL,
    "note" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_keywords" (
    "id" UUID NOT NULL,
    "keyword" TEXT NOT NULL,
    "vertical_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_parsed_at" TIMESTAMP(3),

    CONSTRAINT "search_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parse_logs" (
    "id" UUID NOT NULL,
    "keyword_id" UUID NOT NULL,
    "status" "ParseStatus" NOT NULL,
    "ads_found" INTEGER NOT NULL DEFAULT 0,
    "ads_new" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parse_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_generations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source_creative_id" UUID NOT NULL,
    "mode" "AiGenerationMode" NOT NULL,
    "prompt_used" TEXT,
    "b2_key" TEXT,
    "cost_usd" DECIMAL(10,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "month" DATE NOT NULL,
    "generations_used" INTEGER NOT NULL DEFAULT 0,
    "generations_limit" INTEGER NOT NULL,
    "total_cost_usd" DECIMAL(10,4) NOT NULL DEFAULT 0,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verticals_slug_key" ON "verticals"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ads_fb_ad_id_key" ON "ads"("fb_ad_id");

-- CreateIndex
CREATE INDEX "ads_vertical_id_days_active_idx" ON "ads"("vertical_id", "days_active" DESC);

-- CreateIndex
CREATE INDEX "ads_is_active_created_at_idx" ON "ads"("is_active", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ads_days_active_idx" ON "ads"("days_active" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "project_items_project_id_ad_id_key" ON "project_items"("project_id", "ad_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_user_id_month_key" ON "ai_usage"("user_id", "month");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_vertical_id_fkey" FOREIGN KEY ("vertical_id") REFERENCES "verticals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_creatives" ADD CONSTRAINT "ad_creatives_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_items" ADD CONSTRAINT "project_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_items" ADD CONSTRAINT "project_items_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_keywords" ADD CONSTRAINT "search_keywords_vertical_id_fkey" FOREIGN KEY ("vertical_id") REFERENCES "verticals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parse_logs" ADD CONSTRAINT "parse_logs_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "search_keywords"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_source_creative_id_fkey" FOREIGN KEY ("source_creative_id") REFERENCES "ad_creatives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
