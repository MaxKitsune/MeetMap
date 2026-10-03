-- CreateTable
CREATE TABLE "Anticipation" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Anticipation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Anticipation_ownerId_date_idx" ON "Anticipation"("ownerId", "date");

-- AddForeignKey
ALTER TABLE "Anticipation" ADD CONSTRAINT "Anticipation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

