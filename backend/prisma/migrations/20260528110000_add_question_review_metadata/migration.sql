-- AlterTable
ALTER TABLE `Question`
    ADD COLUMN `status` ENUM('DRAFT', 'NEEDS_REVIEW', 'APPROVED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN `createdById` INTEGER NULL,
    ADD COLUMN `reviewedById` INTEGER NULL,
    ADD COLUMN `reviewedAt` DATETIME(3) NULL;

-- Prefer the demo instructor as the creator for existing questions.
SET @questionCreatorId := (
    SELECT `id`
    FROM `User`
    WHERE `email` = 'instructor@example.com'
    ORDER BY `id`
    LIMIT 1
);

-- Fall back to any existing user.
SET @questionCreatorId := COALESCE(
    @questionCreatorId,
    (
        SELECT `id`
        FROM `User`
        ORDER BY `id`
        LIMIT 1
    )
);

-- If the database has questions but no users, create a safe fallback user.
INSERT INTO `User` (`email`, `name`, `externalAuthId`, `role`)
SELECT 'system-instructor@example.com', 'System Instructor', 'system-instructor-auth-id', 'INSTRUCTOR'
WHERE @questionCreatorId IS NULL;

SET @questionCreatorId := COALESCE(
    @questionCreatorId,
    (
        SELECT `id`
        FROM `User`
        WHERE `email` = 'system-instructor@example.com'
        ORDER BY `id`
        LIMIT 1
    )
);

-- Backfill all existing questions before making createdById required.
UPDATE `Question`
SET `createdById` = @questionCreatorId
WHERE `createdById` IS NULL;

ALTER TABLE `Question` MODIFY `createdById` INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX `Question_createdById_idx` ON `Question`(`createdById`);
CREATE INDEX `Question_reviewedById_idx` ON `Question`(`reviewedById`);

-- AddForeignKey
ALTER TABLE `Question` ADD CONSTRAINT `Question_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Question` ADD CONSTRAINT `Question_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
