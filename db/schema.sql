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

-- feat/reports-analytics ----------------------------------------------------

CREATE TABLE IF NOT EXISTS financial_records (
    record_id INT AUTO_INCREMENT PRIMARY KEY,
    record_type ENUM('Income', 'Expense') NOT NULL,
    category VARCHAR(60) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    record_date DATE NOT NULL,
    description VARCHAR(255) NULL,
    cattle_id INT NULL,
    recorded_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cattle_id) REFERENCES cattle(cattle_id) ON DELETE SET NULL,
    FOREIGN KEY (recorded_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_financial_date (record_date),
    INDEX idx_financial_type_category (record_type, category)
);

CREATE TABLE IF NOT EXISTS reports (
    report_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    report_type VARCHAR(30) NOT NULL,
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    generated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (generated_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_reports_created (created_at)
);
