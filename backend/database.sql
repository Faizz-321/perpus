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
  `title` VARCHAR(255) NOT NULL,
  `author` VARCHAR(255) NOT NULL,
  `classification` VARCHAR(20) DEFAULT '813',
  `category` VARCHAR(100) DEFAULT 'Novel',
  `shelf_location` VARCHAR(100) DEFAULT 'Lemari 3, Rak 1',
  `stock` INT DEFAULT 1,
  `cover_url` VARCHAR(500) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------
-- 2. TABEL ORDERS (Pesanan Pinjam Buku via Meja/QR)
-- ---------------------------------------------------
CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ticket_code` VARCHAR(30) NOT NULL,
  `book_title` VARCHAR(255) NOT NULL,
  `table_no` VARCHAR(50) NOT NULL,
  `status` ENUM('pending', 'searching', 'ready', 'completed', 'cancelled') DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------
-- 3. TABEL RESERVASI MEJA (Table Booking)
-- ---------------------------------------------------
CREATE TABLE IF NOT EXISTS `table_bookings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `table_number` VARCHAR(50) NOT NULL,
  `booking_date` DATE NOT NULL,
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `status` ENUM('booked', 'occupied', 'completed', 'cancelled') DEFAULT 'booked',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------
-- 4. TABEL BARANG HILANG & TEMUAN (Lost & Found)
-- ---------------------------------------------------
CREATE TABLE IF NOT EXISTS `lost_found` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `item_name` VARCHAR(255) NOT NULL,
  `type` ENUM('found', 'lost') NOT NULL,
  `location` VARCHAR(255) NOT NULL,
  `report_date` DATE NOT NULL,
  `contact` VARCHAR(100) DEFAULT NULL,
  `status` ENUM('open', 'claimed', 'closed') DEFAULT 'open',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ===================================================
-- DATA AWAL (SEED DATA UNTUK TESTING)
-- ===================================================

-- Data Awal Buku
INSERT INTO `books` (`title`, `author`, `category`, `stock`) VALUES
('The Design of Everyday Things', 'Don Norman', 'Design', 3),
('Clean Code', 'Robert C. Martin', 'Programming', 2),
('Sapiens: A Brief History', 'Yuval Noah Harari', 'History', 4),
('Atomic Habits', 'James Clear', 'Self Improvement', 5),
('Refactoring', 'Martin Fowler', 'Programming', 2),
('Thinking, Fast and Slow', 'Daniel Kahneman', 'Psychology', 3);

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
('Payung Biru Lipat', 'found', 'Ruang Baca A', CURDATE(), 'Staf Meja Depan', 'open'),
('Mouse Wireless Logitech', 'lost', 'Lab Komputer', CURDATE(), '081234567890', 'open'),
('Kartu Tanda Mahasiswa', 'found', 'Pintu Masuk Utama', CURDATE(), 'Satpam Lobby', 'claimed');
