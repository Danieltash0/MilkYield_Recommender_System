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
