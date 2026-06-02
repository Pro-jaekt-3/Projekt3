-- DropForeignKey
ALTER TABLE `AssessmentAttempt` DROP FOREIGN KEY `AssessmentAttempt_userId_fkey`;

-- AlterTable
ALTER TABLE `AssessmentAttempt` MODIFY `userId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `AssessmentAttempt` ADD CONSTRAINT `AssessmentAttempt_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
