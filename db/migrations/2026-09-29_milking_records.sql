-- feat/milking-records: one row per cow per milking session.
-- Idempotent, like the other migrations.

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
