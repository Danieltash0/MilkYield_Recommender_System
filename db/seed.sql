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
