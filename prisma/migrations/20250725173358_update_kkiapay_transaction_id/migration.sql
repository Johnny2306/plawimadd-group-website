/*
  Warnings:

  - You are about to drop the column `kakapayTransactionId` on the `orders` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `orders` DROP COLUMN `kakapayTransactionId`,
    ADD COLUMN `kkiapayTransactionId` VARCHAR(255) NULL;
