-- ===================================================
-- DATABASE BIBLIOTECH (LIBRARY SYSTEM)
-- Cocok untuk XAMPP (MySQL / MariaDB & phpMyAdmin)
-- ===================================================

CREATE DATABASE IF NOT EXISTS `bibliotech_db`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `bibliotech_db`;

-- ---------------------------------------------------
-- 1. TABEL BUKU (Katalog Buku Perpustakaan)
-- ---------------------------------------------------
CREATE TABLE IF NOT EXISTS `books` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(500) NOT NULL,
  `author` VARCHAR(500) NOT NULL,
<<<<<<< HEAD
  `classification` VARCHAR(50) DEFAULT '813',
  `category` VARCHAR(100) DEFAULT 'Novel',
  `shelf_location` VARCHAR(100) DEFAULT 'Lemari 3, Rak 1',
=======
  `classification` VARCHAR(20) DEFAULT '000',
  `category` VARCHAR(100) DEFAULT 'Koleksi Umum',
  `shelf_location` VARCHAR(255) DEFAULT 'Rak Koleksi Utama',
>>>>>>> d8a935a1542f332fdb77a5846deeedc7ff10698e
  `stock` INT DEFAULT 1,
  `rating` DECIMAL(3,1) DEFAULT 4.5,
  `rating_count` INT DEFAULT 5,
  `read_count` INT DEFAULT 12,
  `cover_url` VARCHAR(500) DEFAULT NULL,
  `isbn` VARCHAR(100) DEFAULT NULL,
  `catalog_id` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------
-- 1.1 TABEL ULASAN & RATING BUKU (Book Ratings)
-- ---------------------------------------------------
CREATE TABLE IF NOT EXISTS `book_ratings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `book_id` INT NOT NULL,
  `rating` INT NOT NULL,
  `review_text` TEXT NULL,
  `table_no` VARCHAR(100) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_book` (`book_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------
-- 2. TABEL ORDERS (Pesanan Pinjam Buku via Meja/QR)
-- ---------------------------------------------------
CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ticket_code` VARCHAR(50) NOT NULL,
  `book_title` TEXT NOT NULL,
  `table_no` VARCHAR(100) NOT NULL,
  `status` ENUM('pending', 'searching', 'ready', 'completed', 'cancelled') DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------
-- 3. TABEL STATUS MEJA & REAL-TIME OCCUPANCY
-- ---------------------------------------------------
CREATE TABLE IF NOT EXISTS `library_tables` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `table_number` VARCHAR(50) NOT NULL UNIQUE,
  `zone` VARCHAR(100) NOT NULL DEFAULT 'Zona Baca Utama',
  `capacity` INT DEFAULT 4,
  `status` ENUM('available', 'occupied', 'reserved', 'maintenance') DEFAULT 'available',
  `current_user_name` VARCHAR(255) NULL,
  `occupied_at` DATETIME NULL,
  `expected_checkout` DATETIME NULL,
  `session_token` VARCHAR(100) NULL,
  `pos_x` INT DEFAULT 0,
  `pos_y` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------
-- 3.1 TABEL RESERVASI MEJA (Table Booking)
-- ---------------------------------------------------
CREATE TABLE IF NOT EXISTS `table_bookings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `table_number` VARCHAR(50) NOT NULL,
  `booking_date` DATE NOT NULL,
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `status` ENUM('booked', 'occupied', 'completed', 'cancelled') DEFAULT 'booked',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------
-- 4. TABEL BARANG HILANG & TEMUAN (Lost & Found)
-- ---------------------------------------------------
CREATE TABLE IF NOT EXISTS `lost_found` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `item_name` VARCHAR(500) NOT NULL,
  `type` ENUM('found', 'lost') NOT NULL DEFAULT 'found',
  `location` VARCHAR(500) NOT NULL,
  `description` TEXT NULL,
  `report_date` DATE NOT NULL,
  `status` VARCHAR(50) DEFAULT 'unclaimed',
  `claimed_by` VARCHAR(255) NULL,
  `claimed_at` DATETIME NULL,
  `proof_photo` LONGTEXT NULL,
  `staff_notes` VARCHAR(500) NULL,
  `contact` VARCHAR(100) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================================
-- DATA AWAL (SEED DATA CONTOH)
-- ===================================================

-- Data Awal Status Meja Perpustakaan (library_tables)
INSERT INTO `library_tables` (`table_number`, `zone`, `capacity`, `status`, `pos_x`, `pos_y`) VALUES
('Meja 01', 'Zona Baca Utama', 4, 'available', 1, 1),
('Meja 02', 'Zona Baca Utama', 4, 'occupied', 1, 2),
('Meja 03', 'Zona Baca Utama', 4, 'available', 1, 3),
('Meja 04', 'Zona Baca Utama', 4, 'occupied', 1, 4),
('Meja 05', 'Zona Baca Utama', 4, 'available', 2, 1),
('Meja 06', 'Zona Baca Utama', 4, 'available', 2, 2),
('Meja 07', 'Zona Komputer & Riset', 2, 'occupied', 2, 3),
('Meja 08', 'Zona Komputer & Riset', 2, 'available', 2, 4),
('Meja 09', 'Zona Komputer & Riset', 2, 'available', 3, 1),
('Meja 10', 'Zona Komputer & Riset', 2, 'occupied', 3, 2),
('Meja 11', 'Zona Baca Tenang', 4, 'available', 3, 3),
('Meja 12', 'Zona Baca Tenang', 4, 'occupied', 3, 4),
('Meja 13', 'Zona Baca Tenang', 4, 'available', 4, 1),
('Meja 14', 'Zona Baca Tenang', 4, 'available', 4, 2),
('Meja 15', 'Bilik Diskusi', 6, 'reserved', 4, 3),
('Meja 16', 'Bilik Diskusi', 6, 'available', 4, 4)
ON DUPLICATE KEY UPDATE `table_number` = VALUES(`table_number`);

-- Data Awal Pesanan Buku (Orders)
INSERT INTO `orders` (`ticket_code`, `book_title`, `table_no`, `status`) VALUES
('TKT-1001', 'The Design of Everyday Things', 'Meja 5', 'pending'),
('TKT-1002', 'Clean Code', 'Meja 12', 'searching'),
('TKT-1003', 'Atomic Habits', 'Meja 3', 'ready');

-- Data Awal Reservasi Meja
INSERT INTO `table_bookings` (`table_number`, `booking_date`, `start_time`, `end_time`, `status`) VALUES
('T-3', CURDATE(), '09:00:00', '11:00:00', 'booked'),
('T-7', CURDATE(), '13:00:00', '15:00:00', 'occupied');

-- Data Awal Lost & Found
INSERT INTO `lost_found` (`item_name`, `type`, `location`, `report_date`, `contact`, `status`) VALUES
('Payung Biru Lipat', 'found', 'Ruang Baca A', CURDATE(), 'Staf Meja Depan', 'unclaimed'),
('Mouse Wireless Logitech', 'lost', 'Lab Komputer', CURDATE(), '081234567890', 'unclaimed'),
('Kartu Tanda Mahasiswa', 'found', 'Pintu Masuk Utama', CURDATE(), 'Satpam Lobby', 'claimed');