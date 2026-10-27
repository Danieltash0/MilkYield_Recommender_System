-- feat/recommender: the extra factors the milk yield recommender uses, plus
-- where it stores its judgements. Idempotent, like the other migrations:
-- columns are only added when missing (a database created from the current
-- schema.sql already has them) and tables use CREATE TABLE IF NOT EXISTS.

-- Lactation details on the cow. NULL = not recorded; conception_date NULL = not pregnant.
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cattle' AND COLUMN_NAME = 'last_calving_date');
SET @ddl := IF(@has = 0, 'ALTER TABLE cattle ADD COLUMN last_calving_date DATE NULL AFTER date_of_birth', 'DO 0');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cattle' AND COLUMN_NAME = 'parity');
SET @ddl := IF(@has = 0, 'ALTER TABLE cattle ADD COLUMN parity TINYINT UNSIGNED NULL AFTER last_calving_date', 'DO 0');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cattle' AND COLUMN_NAME = 'conception_date');
SET @ddl := IF(@has = 0, 'ALTER TABLE cattle ADD COLUMN conception_date DATE NULL AFTER parity', 'DO 0');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cattle' AND COLUMN_NAME = 'prev_lactation_yield_l');
SET @ddl := IF(@has = 0, 'ALTER TABLE cattle ADD COLUMN prev_lactation_yield_l DECIMAL(8,1) NULL AFTER conception_date', 'DO 0');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Concentrate (and optional forage) fed per cow per day
CREATE TABLE IF NOT EXISTS feed_records (
    feed_id INT AUTO_INCREMENT PRIMARY KEY,
    cattle_id INT NOT NULL,
    fed_on DATE NOT NULL,
    concentrate_kg DECIMAL(5,2) NOT NULL DEFAULT 0,
    forage_kg DECIMAL(6,2) NULL,
    notes VARCHAR(255) NULL,
    recorded_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cattle_id) REFERENCES cattle(cattle_id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(user_id) ON DELETE SET NULL,
    UNIQUE KEY uq_feed_day (cattle_id, fed_on),
    INDEX idx_feed_date (fed_on)
);

-- Cold-start yields per breed, in litres per DAY (split per session in code)
CREATE TABLE IF NOT EXISTS breed_yield_baselines (
    baseline_id INT AUTO_INCREMENT PRIMARY KEY,
    breed VARCHAR(100) NOT NULL,
    avg_daily_yield DECIMAL(5,2) NOT NULL,
    source VARCHAR(255) NULL,
    UNIQUE KEY uq_baseline_breed (breed)
);

-- PLACEHOLDER values: replace each with a cited FAO figure before relying on them.
-- 'Other' is the fallback for breeds with no row of their own.
INSERT IGNORE INTO breed_yield_baselines (breed, avg_daily_yield, source) VALUES
('Holstein-Friesian', 18.00, 'placeholder - replace with cited FAO value'),
('Friesian',          18.00, 'placeholder - replace with cited FAO value'),
('Ayrshire',          14.00, 'placeholder - replace with cited FAO value'),
('Guernsey',          12.00, 'placeholder - replace with cited FAO value'),
('Jersey',            11.00, 'placeholder - replace with cited FAO value'),
('Crossbreed',        10.00, 'placeholder - replace with cited FAO value'),
('Zebu',               3.00, 'placeholder - replace with cited FAO value'),
('Other',             10.00, 'placeholder - replace with cited FAO value');

-- One judgement per milking record: what the recommender expected and how the
-- actual reading compared. Re-evaluating a record replaces its row.
CREATE TABLE IF NOT EXISTS milk_yield_predictions (
    prediction_id INT AUTO_INCREMENT PRIMARY KEY,
    cattle_id INT NOT NULL,
    record_id INT NOT NULL,
    milking_date DATE NOT NULL,
    session ENUM('Morning', 'Afternoon', 'Evening') NOT NULL,
    expected_litres DECIMAL(6,2) NOT NULL,
    actual_litres DECIMAL(6,2) NULL,
    ratio DECIMAL(6,3) NULL,
    method VARCHAR(30) NOT NULL,
    status ENUM('normal', 'low', 'high', 'suppressed') NOT NULL DEFAULT 'normal',
    reason VARCHAR(100) NULL,
    message TEXT NULL,
    model_source VARCHAR(20) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cattle_id) REFERENCES cattle(cattle_id) ON DELETE CASCADE,
    FOREIGN KEY (record_id) REFERENCES milking_records(record_id) ON DELETE CASCADE,
    UNIQUE KEY uq_prediction_record (record_id),
    INDEX idx_predictions_cattle (cattle_id, milking_date),
    INDEX idx_predictions_status (status, milking_date)
);
