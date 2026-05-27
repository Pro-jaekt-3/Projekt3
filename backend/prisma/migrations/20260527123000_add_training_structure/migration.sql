-- CreateTable
CREATE TABLE `Training` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `Topic` ADD COLUMN `trainingId` INTEGER NULL;

-- Backfill existing topics with a default training.
INSERT INTO `Training` (`title`, `description`, `createdAt`, `updatedAt`)
VALUES ('Osnove informatike', 'Demo izobraževanje za MVP testne podatke', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

UPDATE `Topic`
SET `trainingId` = (
    SELECT `id`
    FROM `Training`
    WHERE `title` = 'Osnove informatike'
    ORDER BY `id`
    LIMIT 1
)
WHERE `trainingId` IS NULL;

-- Make the relationship required after backfill.
ALTER TABLE `Topic` MODIFY `trainingId` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `Topic` ADD CONSTRAINT `Topic_trainingId_fkey` FOREIGN KEY (`trainingId`) REFERENCES `Training`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
