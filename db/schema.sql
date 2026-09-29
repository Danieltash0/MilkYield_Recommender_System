-- DairyDan database schema
-- Add CREATE TABLE statements here as each module is built.
-- Keep this file as the single source of truth; track incremental changes
-- as dated files under db/migrations/.

CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role ENUM('manager', 'vet', 'worker', 'admin') NOT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- feat/cattle-management ----------------------------------------------------

CREATE TABLE IF NOT EXISTS cattle (
    cattle_id INT AUTO_INCREMENT PRIMARY KEY,
    tag_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100),
    breed VARCHAR(100),
    health ENUM('Excellent', 'Good', 'Fair', 'Poor') DEFAULT 'Good',
    gender ENUM('Female', 'Male') DEFAULT 'Female',
    date_of_birth DATE NULL,
    notes TEXT NULL,
    added_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (added_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_cattle_health (health),
    INDEX idx_cattle_gender (gender)
);

CREATE TABLE IF NOT EXISTS activity_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_activity_logs_user_id (user_id),
    INDEX idx_activity_logs_action (action)
);

-- feat/qr-identification ---------------------------------------------------

CREATE TABLE IF NOT EXISTS qr_codes (
    qr_id INT AUTO_INCREMENT PRIMARY KEY,
    cattle_id INT NOT NULL,
    code VARCHAR(32) NOT NULL,
    created_by INT NULL,
    scan_count INT NOT NULL DEFAULT 0,
    last_scanned_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cattle_id) REFERENCES cattle(cattle_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
    UNIQUE KEY uq_qr_cattle (cattle_id),
    UNIQUE KEY uq_qr_code (code)
);
