-- DropForeignKey
ALTER TABLE `aiinteraction` DROP FOREIGN KEY `AiInteraction_reviewedById_fkey`;

-- DropForeignKey
ALTER TABLE `assessmentattempt` DROP FOREIGN KEY `AssessmentAttempt_userId_fkey`;

-- DropForeignKey
ALTER TABLE `assessmentblueprint` DROP FOREIGN KEY `AssessmentBlueprint_trainingId_fkey`;

-- DropForeignKey
ALTER TABLE `learningobjective` DROP FOREIGN KEY `LearningObjective_topicId_fkey`;

-- DropForeignKey
ALTER TABLE `question` DROP FOREIGN KEY `Question_equivalentGroupId_fkey`;

-- DropForeignKey
ALTER TABLE `question` DROP FOREIGN KEY `Question_learningObjectiveId_fkey`;

-- DropForeignKey
ALTER TABLE `question` DROP FOREIGN KEY `Question_reviewedById_fkey`;

-- DropIndex
DROP INDEX `AiInteraction_reviewedById_idx` ON `aiinteraction`;

-- DropIndex
DROP INDEX `Question_equivalentGroupId_idx` ON `question`;

-- DropIndex
DROP INDEX `Question_learningObjectiveId_fkey` ON `question`;

-- DropIndex
DROP INDEX `Question_reviewedById_idx` ON `question`;

-- AlterTable
ALTER TABLE `aiinteraction` DROP COLUMN `reviewedById`;

-- AlterTable
ALTER TABLE `assessmentattempt` MODIFY `userId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `question` DROP COLUMN `equivalentGroupId`,
    DROP COLUMN `learningObjectiveId`,
    DROP COLUMN `reviewedById`;

-- DropTable
DROP TABLE `assessmentblueprint`;

-- DropTable
DROP TABLE `equivalentquestiongroup`;

-- DropTable
DROP TABLE `learningobjective`;

-- CreateIndex
CREATE UNIQUE INDEX `AssessmentAttempt_assessmentId_userId_key` ON `AssessmentAttempt`(`assessmentId`, `userId`);

-- AddForeignKey
ALTER TABLE `AssessmentAttempt` ADD CONSTRAINT `AssessmentAttempt_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

