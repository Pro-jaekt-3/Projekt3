-- AlterTable
ALTER TABLE `User` ADD COLUMN `externalAuthId` VARCHAR(191) NULL,
    ADD COLUMN `role` ENUM('ADMIN', 'INSTRUCTOR', 'PARTICIPANT') NOT NULL DEFAULT 'PARTICIPANT';

-- CreateIndex
CREATE UNIQUE INDEX `User_externalAuthId_key` ON `User`(`externalAuthId`);
