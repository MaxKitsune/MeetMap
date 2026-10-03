-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "detectionMinDays" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "detectionRadiusKm" DOUBLE PRECISION NOT NULL DEFAULT 50,
ADD COLUMN     "homePlaceId" TEXT;

-- AlterTable
ALTER TABLE "Memory" ADD COLUMN     "tripId" TEXT;

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "capturedAt" TIMESTAMP(3),
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'upload',
ADD COLUMN     "sourceAssetId" TEXT,
ADD COLUMN     "sourcePeople" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tripId" TEXT;

-- CreateTable
CREATE TABLE "HolidayPeriod" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "startAt" DATE NOT NULL,
    "endAt" DATE NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6d8d81',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HolidayPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "startAt" DATE NOT NULL,
    "endAt" DATE NOT NULL,
    "holidayPeriodId" TEXT,
    "placeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelLeg" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "tripId" TEXT,
    "holidayPeriodId" TEXT,
    "fromPlaceId" TEXT NOT NULL,
    "toPlaceId" TEXT NOT NULL,
    "departureAt" DATE NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'car',
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "distanceSource" TEXT NOT NULL DEFAULT 'airline',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelLeg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PersonToTrip" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PersonToTrip_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "HolidayPeriod_ownerId_startAt_idx" ON "HolidayPeriod"("ownerId", "startAt");

-- CreateIndex
CREATE INDEX "Trip_ownerId_startAt_idx" ON "Trip"("ownerId", "startAt");

-- CreateIndex
CREATE INDEX "Trip_ownerId_holidayPeriodId_idx" ON "Trip"("ownerId", "holidayPeriodId");

-- CreateIndex
CREATE INDEX "TravelLeg_ownerId_departureAt_idx" ON "TravelLeg"("ownerId", "departureAt");

-- CreateIndex
CREATE INDEX "TravelLeg_ownerId_tripId_idx" ON "TravelLeg"("ownerId", "tripId");

-- CreateIndex
CREATE INDEX "TravelLeg_ownerId_holidayPeriodId_idx" ON "TravelLeg"("ownerId", "holidayPeriodId");

-- CreateIndex
CREATE INDEX "_PersonToTrip_B_index" ON "_PersonToTrip"("B");

-- CreateIndex
CREATE INDEX "Memory_ownerId_tripId_idx" ON "Memory"("ownerId", "tripId");

-- CreateIndex
CREATE INDEX "Attachment_ownerId_tripId_idx" ON "Attachment"("ownerId", "tripId");

-- CreateIndex
CREATE INDEX "Attachment_ownerId_capturedAt_idx" ON "Attachment"("ownerId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_ownerId_source_sourceAssetId_key" ON "Attachment"("ownerId", "source", "sourceAssetId");

-- AddForeignKey
ALTER TABLE "AppSettings" ADD CONSTRAINT "AppSettings_homePlaceId_fkey" FOREIGN KEY ("homePlaceId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayPeriod" ADD CONSTRAINT "HolidayPeriod_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_holidayPeriodId_fkey" FOREIGN KEY ("holidayPeriodId") REFERENCES "HolidayPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelLeg" ADD CONSTRAINT "TravelLeg_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelLeg" ADD CONSTRAINT "TravelLeg_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelLeg" ADD CONSTRAINT "TravelLeg_holidayPeriodId_fkey" FOREIGN KEY ("holidayPeriodId") REFERENCES "HolidayPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelLeg" ADD CONSTRAINT "TravelLeg_fromPlaceId_fkey" FOREIGN KEY ("fromPlaceId") REFERENCES "Place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelLeg" ADD CONSTRAINT "TravelLeg_toPlaceId_fkey" FOREIGN KEY ("toPlaceId") REFERENCES "Place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PersonToTrip" ADD CONSTRAINT "_PersonToTrip_A_fkey" FOREIGN KEY ("A") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PersonToTrip" ADD CONSTRAINT "_PersonToTrip_B_fkey" FOREIGN KEY ("B") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

