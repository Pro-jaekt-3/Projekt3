-- AlterTable
ALTER TABLE `User`
  ADD COLUMN `firebaseUid` VARCHAR(191) NULL,
  MODIFY `name` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_firebaseUid_key` ON `User`(`firebaseUid`);
