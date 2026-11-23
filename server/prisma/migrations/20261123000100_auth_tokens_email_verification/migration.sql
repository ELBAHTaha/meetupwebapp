-- Phase 1: password reset + email verification.

-- AlterTable
ALTER TABLE `User` ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL,
    ADD COLUMN `locale` VARCHAR(5) NULL;

-- Backfill: every account that exists before email verification ships is
-- treated as verified, so no current user gets locked out of hosting/joining.
UPDATE `User` SET `emailVerifiedAt` = `createdAt` WHERE `emailVerifiedAt` IS NULL;

-- CreateTable
CREATE TABLE `AuthToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('PASSWORD_RESET', 'EMAIL_VERIFY') NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AuthToken_tokenHash_key`(`tokenHash`),
    INDEX `AuthToken_userId_type_idx`(`userId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AuthToken` ADD CONSTRAINT `AuthToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
