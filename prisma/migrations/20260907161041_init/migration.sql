-- CreateTable
CREATE TABLE "UploadedActivity" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "trackName" TEXT,
    "isoWeekStart" TEXT NOT NULL,
    "startTime" TIMESTAMP(3),
    "distanceMeters" DOUBLE PRECISION NOT NULL,
    "movingSeconds" INTEGER NOT NULL,
    "elevationGainMeters" DOUBLE PRECISION NOT NULL,
    "isWorkout" BOOLEAN NOT NULL DEFAULT false,
    "workoutMiles" DOUBLE PRECISION,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadedActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanEntry" (
    "id" TEXT NOT NULL,
    "isoWeekStart" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "slot" TEXT NOT NULL,
    "off" BOOLEAN NOT NULL DEFAULT false,
    "miles" DOUBLE PRECISION,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReflection" (
    "isoWeekStart" TEXT NOT NULL,
    "eating" INTEGER NOT NULL,
    "sleep" INTEGER NOT NULL,
    "schoolStress" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyReflection_pkey" PRIMARY KEY ("isoWeekStart")
);

-- CreateTable
CREATE TABLE "RampAck" (
    "isoWeekStart" TEXT NOT NULL,
    "reason" TEXT,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RampAck_pkey" PRIMARY KEY ("isoWeekStart")
);

-- CreateTable
CREATE TABLE "SeasonConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "nationalsDate" TEXT NOT NULL,
    "seasonStartDate" TEXT NOT NULL,
    "seasonEndDate" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UploadedActivity_isoWeekStart_idx" ON "UploadedActivity"("isoWeekStart");

-- CreateIndex
CREATE UNIQUE INDEX "PlanEntry_isoWeekStart_day_slot_key" ON "PlanEntry"("isoWeekStart", "day", "slot");
