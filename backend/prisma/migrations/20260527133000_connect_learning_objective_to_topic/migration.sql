-- AlterTable
ALTER TABLE `LearningObjective` ADD COLUMN `topicId` INTEGER NULL;

-- Backfill learning objectives that are already used by questions.
UPDATE `LearningObjective` AS `lo`
INNER JOIN (
    SELECT `learningObjectiveId`, MIN(`topicId`) AS `topicId`
    FROM `Question`
    WHERE `learningObjectiveId` IS NOT NULL
    GROUP BY `learningObjectiveId`
) AS `questionTopics`
ON `lo`.`id` = `questionTopics`.`learningObjectiveId`
SET `lo`.`topicId` = `questionTopics`.`topicId`
WHERE `lo`.`topicId` IS NULL;

-- Backfill remaining learning objectives with a demo/default topic.
SET @fallbackTopicId := (
    SELECT `id`
    FROM `Topic`
    WHERE `name` = 'UML'
    ORDER BY `id`
    LIMIT 1
);

SET @fallbackTopicId := COALESCE(
    @fallbackTopicId,
    (
        SELECT `id`
        FROM `Topic`
        ORDER BY `id`
        LIMIT 1
    )
);

UPDATE `LearningObjective`
SET `topicId` = @fallbackTopicId
WHERE `topicId` IS NULL;

-- Make the relationship required after backfill.
ALTER TABLE `LearningObjective` MODIFY `topicId` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `LearningObjective` ADD CONSTRAINT `LearningObjective_topicId_fkey` FOREIGN KEY (`topicId`) REFERENCES `Topic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
