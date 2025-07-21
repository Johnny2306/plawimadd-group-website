/*
  Warnings:

  - Added the required column `country` to the `addresses` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `addresses` ADD COLUMN `country` VARCHAR(100) NOT NULL,
    ADD COLUMN `street` VARCHAR(255) NULL;
