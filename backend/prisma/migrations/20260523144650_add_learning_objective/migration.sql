-- AlterTable
ALTER TABLE `question` ADD COLUMN `learningObjectiveId` INTEGER NULL;

-- CreateTable
CREATE TABLE `LearningObjective` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Question` ADD CONSTRAINT `Question_learningObjectiveId_fkey` FOREIGN KEY (`learningObjectiveId`) REFERENCES `LearningObjective`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
