-- feat/vet-health: clinical history per cow, and vet appointments.
-- Idempotent, like the other migrations.

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
