-- CreateTable
CREATE TABLE "OpponentAlias" (
    "id" TEXT NOT NULL,
    "myName" TEXT NOT NULL,
    "listingName" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpponentAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpponentAlias_myName_key" ON "OpponentAlias"("myName");
