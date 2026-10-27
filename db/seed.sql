-- Seed data for local development.
-- Keep enough milking history per cow (3+ records) to exercise the
-- recommender's moving-average path, not just the cold-start fallback.
--
-- Safe to re-run: unique email / tag_number keys make INSERT IGNORE skip duplicates.

-- Default admin. Login: admin@dairydan.com / Admin@123  (bcrypt hash below; change after first login)
INSERT IGNORE INTO users (name, email, password_hash, role) VALUES
('Admin User', 'admin@dairydan.com', '$2b$10$/8ZWCgRUFe4IPd6.Ah9G1OmX2BK5ShmWgf353ihUDzjtoQEv4lX5G', 'admin');

-- Test accounts, one or more per role. All share the password Dairy@123
-- (credentials listed in db/testusers.txt). For local development only.
INSERT IGNORE INTO users (name, email, password_hash, role) VALUES
('Grace Wanjiru', 'manager@dairydan.com', '$2a$10$642fMxVQtbEYz5FPfbGFU.cxLgij5V2KuI77SfZcl8eMi5s9eQx9O', 'manager'),
('Brian Otieno', 'vet1@dairydan.com', '$2a$10$.DRvdqVHveAyHrFIxyPX6ODnAEmX0jZhXxe5VgOU/DkJAoy2DcUVC', 'vet'),
('Faith Chebet', 'vet2@dairydan.com', '$2a$10$qCUO8MasSKbC6DQfKRcZa.ZCNEx2jyN.X/cN0SaXpAk5M1ah2wxfi', 'vet'),
('John Kamau', 'worker1@dairydan.com', '$2a$10$MMtBiGp2.LWbIYty6MmM0ug9vdffJGPYJ2AiBt3XHkAKqCCPelIs.', 'worker'),
('Mercy Akinyi', 'worker2@dairydan.com', '$2a$10$j2/Dz7EW1VIUBq9rm4yB0uadPawFZonqCUeZY7sgG0yQaGh/GN0Bi', 'worker'),
('Peter Mutua', 'worker3@dairydan.com', '$2a$10$5I3tSF//Zz0fY2Hm80SHvuNorfHKaWXkFwPkJ0/1yGny2PnX8EZH6', 'worker');

-- Sample herd
INSERT IGNORE INTO cattle (tag_number, name, breed, health, gender, category, date_of_birth, notes, added_by) VALUES
('CT001', 'Bessie', 'Holstein-Friesian', 'Good',      'Female', 'Cow',    '2020-03-15', 'Friendly, good milk producer',  (SELECT user_id FROM users WHERE email = 'admin@dairydan.com')),
('CT002', 'Daisy',  'Jersey',            'Excellent', 'Female', 'Cow',    '2019-07-22', 'High butterfat content',        (SELECT user_id FROM users WHERE email = 'admin@dairydan.com')),
('CT003', 'Molly',  'Ayrshire',          'Fair',      'Female', 'Heifer', '2021-01-10', 'Young heifer, growing well',    (SELECT user_id FROM users WHERE email = 'admin@dairydan.com')),
('CT004', 'Rosie',  'Guernsey',          'Good',      'Female', 'Cow',    '2018-11-02', 'Calm temperament',              (SELECT user_id FROM users WHERE email = 'admin@dairydan.com')),
('CT005', 'Duke',   'Friesian',          'Good',      'Male',   'Bull',   '2020-05-30', 'Breeding bull',                 (SELECT user_id FROM users WHERE email = 'admin@dairydan.com'));

-- Sample tasks (assigned by the admin; reassign once workers have signed up).
-- Guarded by title so re-running the seed does not duplicate them.
INSERT INTO tasks (title, description, assigned_by, cattle_id, priority, status, due_date, checklist)
SELECT * FROM (
  SELECT 'Morning milking round' AS title, 'Milk all lactating cows and log the yields' AS description,
         (SELECT user_id FROM users WHERE email = 'admin@dairydan.com') AS assigned_by, NULL AS cattle_id,
         'High' AS priority, 'Pending' AS status, CURDATE() AS due_date,
         JSON_ARRAY(JSON_OBJECT('text', 'Clean milking equipment', 'done', false),
                    JSON_OBJECT('text', 'Milk all cows', 'done', false),
                    JSON_OBJECT('text', 'Record yields', 'done', false)) AS checklist
  UNION ALL
  SELECT 'Check on Molly', 'Health rated Fair: watch appetite and temperament',
         (SELECT user_id FROM users WHERE email = 'admin@dairydan.com'),
         (SELECT cattle_id FROM cattle WHERE tag_number = 'CT003'),
         'Medium', 'Pending', CURDATE() + INTERVAL 1 DAY, NULL
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.title = seed.title);


-- Sample milking history: 7 days x 2 sessions for each cow, so every cow has
-- enough records for the recommender's 7-session moving average.
-- Molly's most recent morning is deliberately low (~70% of normal) to give the
-- anomaly flag something to catch. Dates are relative to today, and the
-- (cattle, date, session) unique key makes INSERT IGNORE skip existing rows.
INSERT IGNORE INTO milking_records (cattle_id, recorded_by, milking_date, session, quantity, fat_percentage)
SELECT c.cattle_id,
       (SELECT user_id FROM users WHERE email = 'admin@dairydan.com'),
       CURDATE() - INTERVAL d.n DAY,
       s.session,
       ROUND(b.base * s.share * IF(b.tag = 'CT003' AND d.n = 0 AND s.session = 'Morning', 0.7, 1) + (d.n % 3) * 0.3, 2),
       b.fat
FROM cattle c
JOIN (SELECT 'CT001' AS tag, 26 AS base, 3.6 AS fat UNION ALL
      SELECT 'CT002', 18, 4.9 UNION ALL
      SELECT 'CT003', 14, 3.9 UNION ALL
      SELECT 'CT004', 20, 4.5) b ON b.tag = c.tag_number
CROSS JOIN (SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
            UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) d
CROSS JOIN (SELECT 'Morning' AS session, 0.55 AS share UNION ALL SELECT 'Evening', 0.45) s;


-- Sample health history and an upcoming check for Molly (rated Fair).
-- Guarded so re-running the seed does not duplicate them.
INSERT INTO health_records (cattle_id, vet_id, record_date, record_type, diagnosis, treatment, medication, health_status, next_checkup, notes)
SELECT c.cattle_id, NULL, CURDATE() - INTERVAL 3 DAY, 'Illness', 'Mild mastitis (front left quarter)',
       'Strip affected quarter, intramammary antibiotic', 'Cloxacillin', 'Fair', CURDATE() + INTERVAL 4 DAY,
       'Discard milk from treated quarter during withdrawal period'
FROM cattle c
WHERE c.tag_number = 'CT003'
  AND NOT EXISTS (SELECT 1 FROM health_records h WHERE h.cattle_id = c.cattle_id AND h.diagnosis = 'Mild mastitis (front left quarter)');

INSERT INTO health_records (cattle_id, vet_id, record_date, record_type, diagnosis, treatment, health_status, notes)
SELECT c.cattle_id, NULL, CURDATE() - INTERVAL 30 DAY, 'Vaccination', 'Routine vaccination', 'FMD booster', 'Good', NULL
FROM cattle c
WHERE c.tag_number IN ('CT001', 'CT002', 'CT004')
  AND NOT EXISTS (SELECT 1 FROM health_records h WHERE h.cattle_id = c.cattle_id AND h.diagnosis = 'Routine vaccination');

INSERT INTO health_appointments (cattle_id, scheduled_by, appointment_date, reason, status)
SELECT c.cattle_id, (SELECT user_id FROM users WHERE email = 'admin@dairydan.com'),
       TIMESTAMP(CURDATE() + INTERVAL 4 DAY, '09:00:00'), 'Mastitis follow-up', 'Scheduled'
FROM cattle c
WHERE c.tag_number = 'CT003'
  AND NOT EXISTS (SELECT 1 FROM health_appointments a WHERE a.cattle_id = c.cattle_id AND a.reason = 'Mastitis follow-up');


-- QR codes for the sample herd: 12 random URL-safe characters each (same
-- format the API generates). INSERT IGNORE keeps any code already issued.
INSERT IGNORE INTO qr_codes (cattle_id, code, created_by)
SELECT c.cattle_id,
       REPLACE(REPLACE(TO_BASE64(RANDOM_BYTES(9)), '+', '-'), '/', '_'),
       (SELECT user_id FROM users WHERE email = 'admin@dairydan.com')
FROM cattle c
WHERE c.tag_number IN ('CT001', 'CT002', 'CT003', 'CT004', 'CT005');


-- Sample finances over the last ~2 months (amounts in KES).
-- Guarded by description so re-running the seed does not duplicate them.
INSERT INTO financial_records (record_type, category, amount, record_date, description, recorded_by)
SELECT s.record_type, s.category, s.amount, s.record_date, s.description,
       (SELECT user_id FROM users WHERE email = 'admin@dairydan.com')
FROM (
  SELECT 'Income' AS record_type, 'Milk sales' AS category, 48600.00 AS amount, CURDATE() - INTERVAL 45 DAY AS record_date, 'Co-op milk payment (seed 1)' AS description
  UNION ALL SELECT 'Income', 'Milk sales', 51250.00, CURDATE() - INTERVAL 15 DAY, 'Co-op milk payment (seed 2)'
  UNION ALL SELECT 'Income', 'Cattle sales', 65000.00, CURDATE() - INTERVAL 30 DAY, 'Sold bull calf (seed)'
  UNION ALL SELECT 'Expense', 'Feed', 18400.00, CURDATE() - INTERVAL 40 DAY, 'Dairy meal, 20 bags (seed 1)'
  UNION ALL SELECT 'Expense', 'Feed', 19100.00, CURDATE() - INTERVAL 10 DAY, 'Dairy meal, 20 bags (seed 2)'
  UNION ALL SELECT 'Expense', 'Veterinary', 3500.00, CURDATE() - INTERVAL 3 DAY, 'Mastitis treatment (seed)'
  UNION ALL SELECT 'Expense', 'Labour', 24000.00, CURDATE() - INTERVAL 28 DAY, 'Farm hands wages (seed)'
  UNION ALL SELECT 'Expense', 'Utilities', 2750.00, CURDATE() - INTERVAL 20 DAY, 'Water and electricity (seed)'
) AS s
WHERE NOT EXISTS (SELECT 1 FROM financial_records f WHERE f.description = s.description);


-- Recommender: breed baselines (litres per day), cited figures scaled to
-- Kenyan smallholder levels. INSERT IGNORE keeps any edited row.
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

-- Lactation details for the sample cows, relative to today. COALESCE only
-- fills values that are still empty, so re-running never overwrites edits.
UPDATE cattle SET
    last_calving_date = COALESCE(last_calving_date, CURDATE() - INTERVAL 120 DAY),
    parity = COALESCE(parity, 3),
    prev_lactation_yield_l = COALESCE(prev_lactation_yield_l, 6200)
WHERE tag_number = 'CT001';

UPDATE cattle SET
    last_calving_date = COALESCE(last_calving_date, CURDATE() - INTERVAL 150 DAY),
    parity = COALESCE(parity, 4),
    prev_lactation_yield_l = COALESCE(prev_lactation_yield_l, 4300)
WHERE tag_number = 'CT002';

UPDATE cattle SET
    last_calving_date = COALESCE(last_calving_date, CURDATE() - INTERVAL 60 DAY),
    parity = COALESCE(parity, 1)
WHERE tag_number = 'CT003';

UPDATE cattle SET
    last_calving_date = COALESCE(last_calving_date, CURDATE() - INTERVAL 200 DAY),
    parity = COALESCE(parity, 5),
    prev_lactation_yield_l = COALESCE(prev_lactation_yield_l, 4800),
    conception_date = COALESCE(conception_date, CURDATE() - INTERVAL 70 DAY)
WHERE tag_number = 'CT004';

-- 7 days of concentrate feed for the sample cows. The (cattle, day) unique
-- key makes INSERT IGNORE skip days already recorded.
INSERT IGNORE INTO feed_records (cattle_id, fed_on, concentrate_kg, recorded_by)
SELECT c.cattle_id, CURDATE() - INTERVAL d.n DAY, f.kg,
       (SELECT user_id FROM users WHERE email = 'admin@dairydan.com')
FROM cattle c
JOIN (SELECT 'CT001' AS tag, 6.0 AS kg UNION ALL
      SELECT 'CT002', 4.5 UNION ALL
      SELECT 'CT003', 3.5 UNION ALL
      SELECT 'CT004', 5.0) f ON f.tag = c.tag_number
CROSS JOIN (SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
            UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) d;
