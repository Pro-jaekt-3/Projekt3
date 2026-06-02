-- CreateTable
CREATE TABLE `AiModel` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `provider` VARCHAR(191) NOT NULL,
    `modelName` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NULL,
    `baseUrl` VARCHAR(191) NULL,
    `isLocal` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AiModel_provider_modelName_key`(`provider`, `modelName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiInteraction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `aiModelId` INTEGER NOT NULL,
    `requestedById` INTEGER NOT NULL,
    `action` ENUM('GENERATE_QUESTION', 'EDIT_QUESTION', 'GENERATE_EQUIVALENT_QUESTION', 'CHECK_EQUIVALENCE', 'CHECK_QUESTION_QUALITY', 'REVIEW_TEST', 'GENERATE_SYNTHETIC_DATA') NOT NULL,
    `prompt` LONGTEXT NOT NULL,
    `resultText` LONGTEXT NULL,
    `resultJson` JSON NULL,
    `sourceQuestionId` INTEGER NULL,
    `generatedQuestionId` INTEGER NULL,
    `reviewStatus` ENUM('PENDING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reviewedById` INTEGER NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AiInteraction_aiModelId_idx`(`aiModelId`),
    INDEX `AiInteraction_requestedById_idx`(`requestedById`),
    INDEX `AiInteraction_reviewedById_idx`(`reviewedById`),
    INDEX `AiInteraction_sourceQuestionId_idx`(`sourceQuestionId`),
    INDEX `AiInteraction_generatedQuestionId_idx`(`generatedQuestionId`),
    INDEX `AiInteraction_action_idx`(`action`),
    INDEX `AiInteraction_reviewStatus_idx`(`reviewStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AiInteraction` ADD CONSTRAINT `AiInteraction_aiModelId_fkey` FOREIGN KEY (`aiModelId`) REFERENCES `AiModel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiInteraction` ADD CONSTRAINT `AiInteraction_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiInteraction` ADD CONSTRAINT `AiInteraction_sourceQuestionId_fkey` FOREIGN KEY (`sourceQuestionId`) REFERENCES `Question`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiInteraction` ADD CONSTRAINT `AiInteraction_generatedQuestionId_fkey` FOREIGN KEY (`generatedQuestionId`) REFERENCES `Question`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiInteraction` ADD CONSTRAINT `AiInteraction_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
