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
    category ENUM('Calf', 'Heifer', 'Cow', 'Bull') NULL DEFAULT 'Cow',
    date_of_birth DATE NULL,
    last_calving_date DATE NULL,
    parity TINYINT UNSIGNED NULL,
    conception_date DATE NULL,
    prev_lactation_yield_l DECIMAL(8,1) NULL,
    notes TEXT NULL,
    added_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (added_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_cattle_health (health),
    INDEX idx_cattle_gender (gender),
    INDEX idx_cattle_category (category)
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


-- feat/admin-management ----------------------------------------------------

CREATE TABLE IF NOT EXISTS settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value VARCHAR(255) NULL,
    updated_by INT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL
);


-- feat/recommender ----------------------------------------------------------

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

-- Litres per DAY; the recommender divides by MILKINGS_PER_DAY
CREATE TABLE IF NOT EXISTS breed_yield_baselines (
    baseline_id INT AUTO_INCREMENT PRIMARY KEY,
    breed VARCHAR(100) NOT NULL,
    avg_daily_yield DECIMAL(5,2) NOT NULL,
    source VARCHAR(255) NULL,
    UNIQUE KEY uq_baseline_breed (breed)
);

-- Reference data the cold-start fallback needs, so it lives here as well as in
-- seed.sql. Cited figures scaled to Kenyan smallholder levels, in L/day.
INSERT IGNORE INTO breed_yield_baselines (breed, avg_daily_yield, source) VALUES
('Holstein-Friesian', 15.75, 'FarmKenya/Standard Media 2020: 45 L/day well-managed x 0.35 for Kenyan smallholder farms'),
('Friesian',          15.75, 'FarmKenya/Standard Media 2020: 45 L/day well-managed x 0.35 for Kenyan smallholder farms'),
('Ayrshire',          10.50, 'FarmKenya/Standard Media 2020: 30 L/day well-managed x 0.35 for Kenyan smallholder farms'),
('Guernsey',           8.75, 'FarmKenya/Standard Media 2020: 25 L/day well-managed x 0.35 for Kenyan smallholder farms'),
('Jersey',             7.00, 'FarmKenya/Standard Media 2020: 20 L/day well-managed x 0.35 for Kenyan smallholder farms'),
('Sahiwal',            5.50, 'FarmKenya 2020: 10 L/day x 0.55; ILRI AGTR commercial herds average ~5.4 L/day'),
('Boran',              4.50, 'ILRI AGTR (Muguga and Ngong herd records)'),
('Zebu',               1.60, 'Cambridge Animal Genetic Resources, SEAZ on-farm characterization, SE Kenya (2011)'),
('Crossbreed',         8.00, 'USDA FAS GAIN Kenya Dairy 2024 (7.6 L/day); Ajak et al. 2020, Nyeri (10.7 L/day)'),
('Other',              8.00, 'USDA FAS GAIN Kenya Dairy 2024 (7.6 L/day); Ajak et al. 2020, Nyeri (10.7 L/day)');

-- Cold-start knowledge graph: conditions on a cow and the yield multiplier
-- each implies. See db/migrations/2026-10-27_yield_factors_knowledge_graph.sql.
CREATE TABLE IF NOT EXISTS yield_factors (
    factor_id INT AUTO_INCREMENT PRIMARY KEY,
    factor_key VARCHAR(50) NOT NULL,
    attribute VARCHAR(30) NOT NULL,
    min_value DECIMAL(8,2) NULL,
    max_value DECIMAL(8,2) NULL,
    multiplier DECIMAL(4,2) NOT NULL,
    label VARCHAR(100) NOT NULL,
    source VARCHAR(255) NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    UNIQUE KEY uq_yield_factor_key (factor_key)
);

INSERT IGNORE INTO yield_factors (factor_key, attribute, min_value, max_value, multiplier, label, source) VALUES
('stage_fresh',       'days_in_milk',     0,   15, 0.99, 'just calved',                    'Wood (1967) lactation curve, as used for the synthetic training herd'),
('stage_rising',      'days_in_milk',    15,   45, 1.22, 'rising towards peak lactation',  'Wood (1967) lactation curve, as used for the synthetic training herd'),
('stage_peak',        'days_in_milk',    45,  100, 1.23, 'peak lactation',                 'Wood (1967) lactation curve, as used for the synthetic training herd'),
('stage_mid',         'days_in_milk',   100,  200, 1.05, 'mid lactation',                  'Wood (1967) lactation curve, as used for the synthetic training herd'),
('stage_late',        'days_in_milk',   200,  305, 0.77, 'late lactation',                 'Wood (1967) lactation curve, as used for the synthetic training herd'),
('stage_extended',    'days_in_milk',   305, NULL, 0.65, 'extended lactation',             'Wood (1967) lactation curve, as used for the synthetic training herd'),
('parity_first',      'parity',           1,    2, 0.80, 'first lactation',                'First-lactation cows give about 80% of mature yield (mature-equivalent convention)'),
('parity_second',     'parity',           2,    3, 0.93, 'second lactation',               'Second-lactation cows give about 93% of mature yield (mature-equivalent convention)'),
('pregnancy_mid',     'days_pregnant',  120,  180, 0.94, 'pregnancy past four months',     'Yield falls about 0.2% a day after day 120 of pregnancy, as in the synthetic training herd'),
('pregnancy_late',    'days_pregnant',  180,  240, 0.82, 'late pregnancy',                 'Yield falls about 0.2% a day after day 120 of pregnancy, as in the synthetic training herd'),
('pregnancy_dry',     'days_pregnant',  240, NULL, 0.72, 'close to drying off',            'Yield falls about 0.2% a day after day 120 of pregnancy, as in the synthetic training herd'),
('feed_low',          'concentrate_kg',   0,    1, 0.93, 'little concentrate fed',         'About 5% yield per kg of concentrate around 2 kg/day, as in the synthetic training herd'),
('feed_high',         'concentrate_kg',   3,    5, 1.10, 'extra concentrate fed',          'About 5% yield per kg of concentrate around 2 kg/day, as in the synthetic training herd'),
('feed_very_high',    'concentrate_kg',   5, NULL, 1.20, 'heavy concentrate feeding',      'About 5% yield per kg of concentrate around 2 kg/day, as in the synthetic training herd'),
('health_recent',     'health_active',    1, NULL, 0.85, 'illness or treatment this week', 'Sick days give 75% and the following week 90%, as in the synthetic training herd'),
('age_old',           'age_months',     120, NULL, 0.94, 'older cow',                      'Yield falls about 0.2% a month after 90 months of age, as in the synthetic training herd');

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
