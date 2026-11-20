-- Authentication hardening.
-- 1. users.status gains 'pending': self-registered accounts wait for an admin
--    to approve them (and confirm their role) before they can sign in.
-- 2. users.token_version: every token carries the version it was issued with.
--    Raising it (password reset) signs that user out everywhere at once.
-- Idempotent, like the other migrations.

ALTER TABLE users MODIFY status ENUM('pending', 'active', 'inactive') DEFAULT 'active';

SET @has_tv := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'token_version'
);
SET @add_tv := IF(@has_tv = 0,
    'ALTER TABLE users ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER status',
    'DO 0');
PREPARE stmt FROM @add_tv;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
