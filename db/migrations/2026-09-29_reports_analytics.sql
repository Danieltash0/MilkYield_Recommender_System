-- feat/reports-analytics: farm income/expenses, and a log of generated reports.
-- A report row stores only its parameters; the figures are rebuilt from live
-- data whenever it is opened, so reports never drift from the records.
-- Idempotent, like the other migrations.

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
