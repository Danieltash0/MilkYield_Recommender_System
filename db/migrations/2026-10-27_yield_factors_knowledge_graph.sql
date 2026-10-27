-- feat/recommender: the cold-start knowledge graph. Each row is an edge from a
-- condition on the cow (an attribute inside a range) to a yield multiplier,
-- with where the figure comes from. A cow with little milking history gets
-- breed baseline x every multiplier whose condition it meets.
--
-- attribute names the value it tests: days_in_milk, parity, days_pregnant,
-- concentrate_kg, health_active or age_months. min_value is inclusive and
-- max_value exclusive; NULL means unbounded. label is shown to farm workers.
--
-- INSERT IGNORE keeps rows edited by hand. Re-running is a no-op.
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
