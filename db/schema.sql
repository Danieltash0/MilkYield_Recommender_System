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

-- feat/vet-health -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS health_records (
    record_id INT AUTO_INCREMENT PRIMARY KEY,
    cattle_id INT NOT NULL,
    vet_id INT NULL,
    record_date DATE NOT NULL,
    record_type ENUM('Checkup', 'Treatment', 'Vaccination', 'Illness', 'Injury', 'Other') DEFAULT 'Checkup',
    diagnosis VARCHAR(255) NULL,
    treatment TEXT NULL,
    medication VARCHAR(255) NULL,
    health_status ENUM('Excellent', 'Good', 'Fair', 'Poor') NULL,
    next_checkup DATE NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cattle_id) REFERENCES cattle(cattle_id) ON DELETE CASCADE,
    FOREIGN KEY (vet_id) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_health_records_cattle (cattle_id, record_date),
    INDEX idx_health_records_type (record_type)
);

CREATE TABLE IF NOT EXISTS health_appointments (
    appointment_id INT AUTO_INCREMENT PRIMARY KEY,
    cattle_id INT NOT NULL,
    vet_id INT NULL,
    scheduled_by INT NULL,
    appointment_date DATETIME NOT NULL,
    reason VARCHAR(255) NOT NULL,
    status ENUM('Scheduled', 'Completed', 'Cancelled') DEFAULT 'Scheduled',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cattle_id) REFERENCES cattle(cattle_id) ON DELETE CASCADE,
    FOREIGN KEY (vet_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (scheduled_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_appointments_date (appointment_date),
    INDEX idx_appointments_status (status),
    INDEX idx_appointments_vet (vet_id)
);
