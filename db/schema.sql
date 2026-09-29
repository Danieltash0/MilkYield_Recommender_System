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

-- feat/tasks-management -----------------------------------------------------

CREATE TABLE IF NOT EXISTS tasks (
    task_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT NULL,
    assigned_to INT NULL,
    assigned_by INT NULL,
    cattle_id INT NULL,
    priority ENUM('Low', 'Medium', 'High') DEFAULT 'Medium',
    status ENUM('Pending', 'In Progress', 'Completed') DEFAULT 'Pending',
    due_date DATE NULL,
    checklist JSON NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_by) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (cattle_id) REFERENCES cattle(cattle_id) ON DELETE SET NULL,
    INDEX idx_tasks_assigned_to (assigned_to),
    INDEX idx_tasks_status (status),
    INDEX idx_tasks_due_date (due_date)
);


-- feat/milking-records ------------------------------------------------------

CREATE TABLE IF NOT EXISTS milking_records (
    record_id INT AUTO_INCREMENT PRIMARY KEY,
    cattle_id INT NOT NULL,
    recorded_by INT NULL,
    milking_date DATE NOT NULL,
    session ENUM('Morning', 'Afternoon', 'Evening') NOT NULL,
    quantity DECIMAL(6,2) NOT NULL,
    fat_percentage DECIMAL(4,2) NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cattle_id) REFERENCES cattle(cattle_id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(user_id) ON DELETE SET NULL,
    UNIQUE KEY uq_milking_session (cattle_id, milking_date, session),
    INDEX idx_milking_date (milking_date)
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
