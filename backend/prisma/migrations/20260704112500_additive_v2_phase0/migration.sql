-- FAZA 0 — ADDITIVE-ONLY migracija (schema-v2 predpriprava).
-- Nič DROP, nič destruktivnega. Star ostane, novo se doda ob njem.
-- updatedAt stolpci na obstoječih tabelah: dodani z začasnim DEFAULT CURRENT_TIMESTAMP(3)
-- (da obstoječe vrstice dobijo vrednost), nato DEFAULT odstranjen z MODIFY, da se
-- končna definicija ujema s Prisma @updatedAt (brez drifta).

-- AlterTable
ALTER TABLE `assessment` ADD COLUMN `pairedAssessmentId` INTEGER NULL;

-- AlterTable
ALTER TABLE `participantanswer` ADD COLUMN `gradedAt` DATETIME(3) NULL,
    ADD COLUMN `gradedById` INTEGER NULL,
    MODIFY `answerText` TEXT NULL;

-- AlterTable
ALTER TABLE `question` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `equivalenceGroupId` INTEGER NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `description` TEXT NOT NULL;
ALTER TABLE `question` MODIFY `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `topic` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
ALTER TABLE `topic` MODIFY `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `training` ADD COLUMN `enrollmentToken` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
ALTER TABLE `user` MODIFY `updatedAt` DATETIME(3) NOT NULL;

-- CreateTable
CREATE TABLE `UserTraining` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `trainingId` INTEGER NOT NULL,
    `role` ENUM('INSTRUCTOR', 'PARTICIPANT') NOT NULL,
    `enrolledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserTraining_trainingId_role_idx`(`trainingId`, `role`),
    UNIQUE INDEX `UserTraining_userId_trainingId_key`(`userId`, `trainingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EquivalenceGroup` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `trainingId` INTEGER NOT NULL,
    `title` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EquivalenceGroup_trainingId_idx`(`trainingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Assessment_pairedAssessmentId_key` ON `Assessment`(`pairedAssessmentId`);

-- CreateIndex
CREATE INDEX `Assessment_status_trainingId_idx` ON `Assessment`(`status`, `trainingId`);

-- CreateIndex
CREATE INDEX `ParticipantAnswer_gradedById_idx` ON `ParticipantAnswer`(`gradedById`);

-- CreateIndex
CREATE INDEX `Question_equivalenceGroupId_idx` ON `Question`(`equivalenceGroupId`);

-- CreateIndex
CREATE INDEX `Question_status_topicId_idx` ON `Question`(`status`, `topicId`);

-- CreateIndex
CREATE UNIQUE INDEX `Training_enrollmentToken_key` ON `Training`(`enrollmentToken`);

-- AddForeignKey
ALTER TABLE `UserTraining` ADD CONSTRAINT `UserTraining_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserTraining` ADD CONSTRAINT `UserTraining_trainingId_fkey` FOREIGN KEY (`trainingId`) REFERENCES `Training`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Question` ADD CONSTRAINT `Question_equivalenceGroupId_fkey` FOREIGN KEY (`equivalenceGroupId`) REFERENCES `EquivalenceGroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EquivalenceGroup` ADD CONSTRAINT `EquivalenceGroup_trainingId_fkey` FOREIGN KEY (`trainingId`) REFERENCES `Training`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Assessment` ADD CONSTRAINT `Assessment_pairedAssessmentId_fkey` FOREIGN KEY (`pairedAssessmentId`) REFERENCES `Assessment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParticipantAnswer` ADD CONSTRAINT `ParticipantAnswer_gradedById_fkey` FOREIGN KEY (`gradedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
