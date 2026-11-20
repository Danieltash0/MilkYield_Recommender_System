-- Accounts no longer wait for admin approval: take 'pending' back out of
-- users.status (added by 2026-11-17_auth_hardening.sql). Any account still
-- pending becomes active first. token_version stays.

UPDATE users SET status = 'active' WHERE status = 'pending';
ALTER TABLE users MODIFY status ENUM('active', 'inactive') DEFAULT 'active';
