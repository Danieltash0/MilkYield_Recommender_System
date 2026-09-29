-- feat/qr-identification: one scannable code per animal.
-- The code is a random token (not the tag number), so a label cannot be
-- guessed from the ear tag and a lost label can be reissued.
-- Idempotent, like the other migrations.

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
