-- Phase 4: manual (offline-paid) upgrades replace Paddle. Additive only — the
-- Paddle columns (paddleCustomerId, paddleSubscriptionId, paddleEventId) stay.

-- AlterTable
ALTER TABLE `User` ADD COLUMN `planReminderSentAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Event` ADD COLUMN `awaitingPayment` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Sponsorship` ADD COLUMN `reminderSentAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `SubscriptionEvent` ADD COLUMN `adminId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `UpgradeRequest` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `businessId` VARCHAR(191) NULL,
    `product` ENUM('PRO_HOST', 'SPONSORSHIP_STARTER', 'SPONSORSHIP_BRONZE', 'SPONSORSHIP_SILVER', 'PINNED_ACTIVITY') NOT NULL,
    `venueId` VARCHAR(191) NULL,
    `eventId` VARCHAR(191) NULL,
    `billingInterval` ENUM('MONTHLY', 'QUARTERLY', 'ANNUAL') NULL,
    `amountCents` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `reference` VARCHAR(16) NOT NULL,
    `note` TEXT NULL,
    `adminNote` TEXT NULL,
    `grantedUntil` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `decidedAt` DATETIME(3) NULL,
    `decidedById` VARCHAR(191) NULL,

    UNIQUE INDEX `UpgradeRequest_reference_key`(`reference`),
    INDEX `UpgradeRequest_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `UpgradeRequest_userId_idx`(`userId`),
    INDEX `UpgradeRequest_businessId_idx`(`businessId`),
    INDEX `UpgradeRequest_eventId_idx`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UpgradeRequest` ADD CONSTRAINT `UpgradeRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UpgradeRequest` ADD CONSTRAINT `UpgradeRequest_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UpgradeRequest` ADD CONSTRAINT `UpgradeRequest_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UpgradeRequest` ADD CONSTRAINT `UpgradeRequest_decidedById_fkey` FOREIGN KEY (`decidedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

