-- Rename BusinessStatus values (PENDING→PENDING_VERIFICATION, APPROVED→VERIFIED).
-- Expand the enum first so existing rows can be remapped, then the narrowing
-- MODIFY below sets the final value set.
ALTER TABLE `Business` MODIFY `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'PENDING_VERIFICATION', 'VERIFIED') NOT NULL DEFAULT 'PENDING';
UPDATE `Business` SET `status` = 'PENDING_VERIFICATION' WHERE `status` = 'PENDING';
UPDATE `Business` SET `status` = 'VERIFIED' WHERE `status` = 'APPROVED';

-- AlterTable
ALTER TABLE `Attendance` ADD COLUMN `shareContactWithHostBusiness` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Business` ADD COLUMN `businessTosAcceptedAt` DATETIME(3) NULL,
    ADD COLUMN `category` VARCHAR(191) NOT NULL DEFAULT 'other',
    ADD COLUMN `coverUrl` VARCHAR(191) NULL,
    ADD COLUMN `defaultVenueId` VARCHAR(191) NULL,
    ADD COLUMN `iceNumber` VARCHAR(191) NULL,
    ADD COLUMN `legalName` VARCHAR(191) NULL,
    ADD COLUMN `logoUrl` VARCHAR(191) NULL,
    ADD COLUMN `rcNumber` VARCHAR(191) NULL,
    ADD COLUMN `verifiedAt` DATETIME(3) NULL,
    ADD COLUMN `website` VARCHAR(191) NULL,
    MODIFY `status` ENUM('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'PENDING_VERIFICATION';

-- AlterTable
ALTER TABLE `Event` ADD COLUMN `venueId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `BusinessMember` (
    `id` VARCHAR(191) NOT NULL,
    `businessId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'MANAGER', 'STAFF') NOT NULL DEFAULT 'STAFF',
    `invitedEmail` VARCHAR(191) NULL,
    `status` ENUM('INVITED', 'ACTIVE') NOT NULL DEFAULT 'INVITED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BusinessMember_businessId_userId_idx`(`businessId`, `userId`),
    INDEX `BusinessMember_userId_idx`(`userId`),
    UNIQUE INDEX `BusinessMember_businessId_userId_key`(`businessId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessVerification` (
    `id` VARCHAR(191) NOT NULL,
    `businessId` VARCHAR(191) NOT NULL,
    `rcNumber` VARCHAR(191) NULL,
    `iceNumber` VARCHAR(191) NULL,
    `documentUrls` JSON NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reviewedById` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BusinessVerification_status_idx`(`status`),
    INDEX `BusinessVerification_businessId_idx`(`businessId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Venue` (
    `id` VARCHAR(191) NOT NULL,
    `businessId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'other',
    `description` TEXT NULL,
    `address` VARCHAR(191) NOT NULL,
    `lat` DOUBLE NOT NULL,
    `lng` DOUBLE NOT NULL,
    `photos` JSON NULL,
    `amenities` JSON NULL,
    `hours` JSON NULL,
    `phone` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `status` ENUM('LISTED', 'CLAIMED', 'VERIFIED') NOT NULL DEFAULT 'LISTED',
    `avgRating` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    `reviewCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Venue_slug_key`(`slug`),
    INDEX `Venue_slug_idx`(`slug`),
    INDEX `Venue_businessId_idx`(`businessId`),
    INDEX `Venue_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VenueClaim` (
    `id` VARCHAR(191) NOT NULL,
    `venueId` VARCHAR(191) NOT NULL,
    `businessId` VARCHAR(191) NOT NULL,
    `evidence` JSON NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reviewedById` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VenueClaim_status_idx`(`status`),
    INDEX `VenueClaim_venueId_idx`(`venueId`),
    INDEX `VenueClaim_businessId_idx`(`businessId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VenueReview` (
    `id` VARCHAR(191) NOT NULL,
    `venueId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `rating` INTEGER NOT NULL,
    `text` TEXT NULL,
    `status` ENUM('VISIBLE', 'FLAGGED', 'REMOVED') NOT NULL DEFAULT 'VISIBLE',
    `attendedEventId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VenueReview_venueId_status_idx`(`venueId`, `status`),
    UNIQUE INDEX `VenueReview_venueId_userId_key`(`venueId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Event_venueId_idx` ON `Event`(`venueId`);

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_venueId_fkey` FOREIGN KEY (`venueId`) REFERENCES `Venue`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessMember` ADD CONSTRAINT `BusinessMember_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessMember` ADD CONSTRAINT `BusinessMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessVerification` ADD CONSTRAINT `BusinessVerification_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Venue` ADD CONSTRAINT `Venue_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VenueClaim` ADD CONSTRAINT `VenueClaim_venueId_fkey` FOREIGN KEY (`venueId`) REFERENCES `Venue`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VenueClaim` ADD CONSTRAINT `VenueClaim_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VenueReview` ADD CONSTRAINT `VenueReview_venueId_fkey` FOREIGN KEY (`venueId`) REFERENCES `Venue`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VenueReview` ADD CONSTRAINT `VenueReview_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

