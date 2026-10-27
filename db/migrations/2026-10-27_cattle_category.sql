-- Add cattle.category (Calf/Heifer/Cow, Bull for males) alongside gender.
-- Idempotent, like the other migrations: a database created from the current
-- schema.sql already has the column, so it is only added when missing.
-- When the column is added, existing females under a year old become Calf and
-- other females become Cow; males always become Bull.

SET @has_category := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cattle' AND COLUMN_NAME = 'category'
);

SET @add_category := IF(@has_category = 0,
    'ALTER TABLE cattle ADD COLUMN category ENUM(''Calf'', ''Heifer'', ''Cow'', ''Bull'') NULL DEFAULT ''Cow'' AFTER gender, ADD INDEX idx_cattle_category (category)',
    'DO 0');
PREPARE stmt FROM @add_category;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE cattle MODIFY category ENUM('Calf', 'Heifer', 'Cow', 'Bull') NULL DEFAULT 'Cow';

UPDATE cattle SET category = CASE
    WHEN date_of_birth IS NOT NULL AND date_of_birth > DATE_SUB(CURDATE(), INTERVAL 1 YEAR) THEN 'Calf'
    ELSE 'Cow'
END
WHERE gender = 'Female' AND @has_category = 0;

UPDATE cattle SET category = 'Bull' WHERE gender = 'Male';
