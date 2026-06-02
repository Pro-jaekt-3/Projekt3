-- Normalize existing provider values before changing the column to an enum.
UPDATE `AiModel`
SET `provider` = CASE
    WHEN LOWER(`provider`) = 'ollama' THEN 'OLLAMA'
    WHEN LOWER(`provider`) = 'openai' THEN 'OPENAI'
    WHEN LOWER(`provider`) = 'deepseek' THEN 'DEEPSEEK'
    ELSE 'OTHER'
END;

-- AlterTable
ALTER TABLE `AiModel` MODIFY `provider` ENUM('OLLAMA', 'OPENAI', 'DEEPSEEK', 'OTHER') NOT NULL;
