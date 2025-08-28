-- CreateEnum
CREATE TYPE "TagCode" AS ENUM ('FAMILY', 'CLOSE_FRIEND', 'FRIEND', 'LOVE_INTEREST', 'RELATIONSHIP', 'ACQUAINTANCE', 'ENCOUNTER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "code" "TagCode" NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "age" INTEGER,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "location_name" TEXT,
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "met_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "platform" TEXT,
    "context_url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaryEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "content" TEXT NOT NULL,
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "location_name" TEXT,
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiaryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaryAttachment" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiaryAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonTag" (
    "personId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonTag_pkey" PRIMARY KEY ("personId","tagId")
);

-- CreateTable
CREATE TABLE "DiaryEntryPerson" (
    "diaryEntryId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiaryEntryPerson_pkey" PRIMARY KEY ("diaryEntryId","personId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_code_key" ON "Tag"("code");

-- CreateIndex
CREATE INDEX "Person_userId_idx" ON "Person"("userId");

-- CreateIndex
CREATE INDEX "Person_met_at_idx" ON "Person"("met_at");

-- CreateIndex
CREATE INDEX "Person_lat_lng_idx" ON "Person"("lat", "lng");

-- CreateIndex
CREATE INDEX "DiaryEntry_createdAt_idx" ON "DiaryEntry"("createdAt");

-- CreateIndex
CREATE INDEX "DiaryEntry_start_at_idx" ON "DiaryEntry"("start_at");

-- CreateIndex
CREATE INDEX "DiaryAttachment_entryId_createdAt_idx" ON "DiaryAttachment"("entryId", "createdAt");

-- CreateIndex
CREATE INDEX "PersonTag_tagId_idx" ON "PersonTag"("tagId");

-- CreateIndex
CREATE INDEX "DiaryEntryPerson_personId_idx" ON "DiaryEntryPerson"("personId");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryAttachment" ADD CONSTRAINT "DiaryAttachment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "DiaryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonTag" ADD CONSTRAINT "PersonTag_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonTag" ADD CONSTRAINT "PersonTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryEntryPerson" ADD CONSTRAINT "DiaryEntryPerson_diaryEntryId_fkey" FOREIGN KEY ("diaryEntryId") REFERENCES "DiaryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryEntryPerson" ADD CONSTRAINT "DiaryEntryPerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
