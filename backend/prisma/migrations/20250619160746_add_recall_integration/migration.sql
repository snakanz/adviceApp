/*
  Warnings:

  - The primary key for the `ActionItem` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `assignee` on the `ActionItem` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `ActionItem` table. All the data in the column will be lost.
  - The `id` column on the `ActionItem` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Meeting` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `calendarEventId` on the `Meeting` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `Meeting` table. All the data in the column will be lost.
  - You are about to drop the column `recallJobId` on the `Meeting` table. All the data in the column will be lost.
  - You are about to drop the column `time` on the `Meeting` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Meeting` table. All the data in the column will be lost.
  - The `id` column on the `Meeting` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Recording` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `fileUrl` on the `Recording` table. All the data in the column will be lost.
  - The `id` column on the `Recording` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `content` to the `ActionItem` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `meetingId` on the `ActionItem` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `endTime` to the `Meeting` table without a default value. This is not possible if the table is not empty.
  - Added the required column `googleEventId` to the `Meeting` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startTime` to the `Meeting` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Recording` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `Recording` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `meetingId` on the `Recording` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "ActionItem" DROP CONSTRAINT "ActionItem_meetingId_fkey";

-- DropForeignKey
ALTER TABLE "Recording" DROP CONSTRAINT "Recording_meetingId_fkey";

-- AlterTable
ALTER TABLE "ActionItem" DROP CONSTRAINT "ActionItem_pkey",
DROP COLUMN "assignee",
DROP COLUMN "description",
ADD COLUMN     "assignedTo" TEXT,
ADD COLUMN     "content" TEXT NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "meetingId",
ADD COLUMN     "meetingId" INTEGER NOT NULL,
ADD CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Meeting" DROP CONSTRAINT "Meeting_pkey",
DROP COLUMN "calendarEventId",
DROP COLUMN "date",
DROP COLUMN "recallJobId",
DROP COLUMN "time",
DROP COLUMN "type",
ADD COLUMN     "endTime" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "googleEventId" TEXT NOT NULL,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "recallBotId" TEXT,
ADD COLUMN     "startTime" TIMESTAMP(3) NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ALTER COLUMN "status" DROP DEFAULT,
ADD CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Recording" DROP CONSTRAINT "Recording_pkey",
DROP COLUMN "fileUrl",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "url" TEXT NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "meetingId",
ADD COLUMN     "meetingId" INTEGER NOT NULL,
ADD CONSTRAINT "Recording_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "ActionItem_meetingId_idx" ON "ActionItem"("meetingId");

-- CreateIndex
CREATE INDEX "Meeting_userId_idx" ON "Meeting"("userId");

-- CreateIndex
CREATE INDEX "Meeting_googleEventId_idx" ON "Meeting"("googleEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Recording_meetingId_key" ON "Recording"("meetingId");

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
