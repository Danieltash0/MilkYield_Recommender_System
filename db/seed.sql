-- Seed data for local development.
-- Keep enough milking history per cow (3+ records) to exercise the
-- recommender's moving-average path, not just the cold-start fallback.
--
-- Safe to re-run: unique email / tag_number keys make INSERT IGNORE skip duplicates.

-- Default admin. Login: admin@dairydan.com / Admin@123  (bcrypt hash below; change after first login)
INSERT IGNORE INTO users (name, email, password_hash, role) VALUES
('Admin User', 'admin@dairydan.com', '$2b$10$/8ZWCgRUFe4IPd6.Ah9G1OmX2BK5ShmWgf353ihUDzjtoQEv4lX5G', 'admin');

-- Sample herd
INSERT IGNORE INTO cattle (tag_number, name, breed, health, gender, date_of_birth, notes, added_by) VALUES
('CT001', 'Bessie', 'Holstein-Friesian', 'Good',      'Female', '2020-03-15', 'Friendly, good milk producer',  (SELECT user_id FROM users WHERE email = 'admin@dairydan.com')),
('CT002', 'Daisy',  'Jersey',            'Excellent', 'Female', '2019-07-22', 'High butterfat content',        (SELECT user_id FROM users WHERE email = 'admin@dairydan.com')),
('CT003', 'Molly',  'Ayrshire',          'Fair',      'Female', '2021-01-10', 'Young heifer, growing well',    (SELECT user_id FROM users WHERE email = 'admin@dairydan.com')),
('CT004', 'Rosie',  'Guernsey',          'Good',      'Female', '2018-11-02', 'Calm temperament',              (SELECT user_id FROM users WHERE email = 'admin@dairydan.com')),
('CT005', 'Duke',   'Friesian',          'Good',      'Male',   '2020-05-30', 'Breeding bull',                 (SELECT user_id FROM users WHERE email = 'admin@dairydan.com'));

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
