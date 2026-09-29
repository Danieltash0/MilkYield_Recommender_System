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

-- QR codes for the sample herd: 12 random URL-safe characters each (same
-- format the API generates). INSERT IGNORE keeps any code already issued.
INSERT IGNORE INTO qr_codes (cattle_id, code, created_by)
SELECT c.cattle_id,
       REPLACE(REPLACE(TO_BASE64(RANDOM_BYTES(9)), '+', '-'), '/', '_'),
       (SELECT user_id FROM users WHERE email = 'admin@dairydan.com')
FROM cattle c
WHERE c.tag_number IN ('CT001', 'CT002', 'CT003', 'CT004', 'CT005');
