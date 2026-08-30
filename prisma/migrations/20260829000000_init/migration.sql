-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'leader',
    "leaderId" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "sendHour" INTEGER NOT NULL DEFAULT 7,
    "lastSeenAt" TIMESTAMP(3),
    "invitedAt" TIMESTAMP(3),
    "onboardedAt" TIMESTAMP(3),
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "statusRank" INTEGER NOT NULL DEFAULT 1,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "intervalDays" INTEGER NOT NULL DEFAULT 14,
    "lastContactAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "remindersPaused" BOOLEAN NOT NULL DEFAULT false,
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "airtableRecordId" TEXT,
    "airtableSyncedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'manual',
    "importBatchId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'note',
    "fromRank" INTEGER,
    "toRank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "happenedOn" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'coffee',
    "place" TEXT,
    "minutes" INTEGER,
    "body" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "state" TEXT NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "happenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "via" TEXT NOT NULL DEFAULT 'logged',

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dueOn" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "channel" TEXT NOT NULL DEFAULT 'email',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'followup',
    "body" TEXT NOT NULL,
    "href" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncEvent" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "direction" TEXT NOT NULL,
    "personId" TEXT,
    "fromValue" TEXT,
    "toValue" TEXT,
    "result" TEXT NOT NULL,
    "detail" TEXT,

    CONSTRAINT "SyncEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AirtableConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "token" TEXT,
    "baseId" TEXT,
    "tableName" TEXT,
    "viewName" TEXT,
    "tendIdField" TEXT NOT NULL DEFAULT 'Tend ID',
    "statusField" TEXT NOT NULL DEFAULT 'Status',
    "mapping" TEXT NOT NULL DEFAULT '{}',
    "defaultOwnerId" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AirtableConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderDefaults" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "defaultIntervalDays" INTEGER NOT NULL DEFAULT 14,
    "sendHour" INTEGER NOT NULL DEFAULT 7,
    "digest" BOOLEAN NOT NULL DEFAULT true,
    "skipSunday" BOOLEAN NOT NULL DEFAULT true,
    "repeatDays" INTEGER NOT NULL DEFAULT 7,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "fromName" TEXT NOT NULL DEFAULT 'Tend',
    "fromAddress" TEXT NOT NULL DEFAULT 'reminders@example.com',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderDefaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneAt" TIMESTAMP(3),

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_leaderId_idx" ON "User"("leaderId");

-- CreateIndex
CREATE INDEX "Person_ownerId_idx" ON "Person"("ownerId");

-- CreateIndex
CREATE INDEX "Person_airtableRecordId_idx" ON "Person"("airtableRecordId");

-- CreateIndex
CREATE INDEX "Note_personId_createdAt_idx" ON "Note"("personId", "createdAt");

-- CreateIndex
CREATE INDEX "Meeting_personId_happenedOn_idx" ON "Meeting"("personId", "happenedOn");

-- CreateIndex
CREATE INDEX "Attendance_personId_idx" ON "Attendance"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_personId_serviceDate_key" ON "Attendance"("personId", "serviceDate");

-- CreateIndex
CREATE INDEX "Contact_personId_happenedAt_idx" ON "Contact"("personId", "happenedAt");

-- CreateIndex
CREATE INDEX "Reminder_userId_dueOn_idx" ON "Reminder"("userId", "dueOn");

-- CreateIndex
CREATE INDEX "Reminder_personId_idx" ON "Reminder"("personId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SyncEvent_at_idx" ON "SyncEvent"("at");

-- CreateIndex
CREATE INDEX "ImportBatch_userId_createdAt_idx" ON "ImportBatch"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncEvent" ADD CONSTRAINT "SyncEvent_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AirtableConfig" ADD CONSTRAINT "AirtableConfig_defaultOwnerId_fkey" FOREIGN KEY ("defaultOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

