-- CreateTable
CREATE TABLE `EquivalentQuestionGroup` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `Question` ADD COLUMN `equivalentGroupId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Question_equivalentGroupId_idx` ON `Question`(`equivalentGroupId`);

-- AddForeignKey
ALTER TABLE `Question` ADD CONSTRAINT `Question_equivalentGroupId_fkey` FOREIGN KEY (`equivalentGroupId`) REFERENCES `EquivalentQuestionGroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
