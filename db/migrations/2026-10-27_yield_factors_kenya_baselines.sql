-- feat/recommender: replace the placeholder breed baselines with cited figures
-- scaled to Kenyan smallholder levels (L/day). The FarmKenya averages describe
-- well-managed zero-grazing farms, so exotic breeds get 35% of them and
-- Sahiwal 55%; field-measured figures are used as they are. These are the
-- figures the yield models were trained with (recommender/notebooks).
--
-- Only rows still marked as placeholders are changed, so baselines edited by
-- hand are kept. Re-running is a no-op.
INSERT INTO breed_yield_baselines (breed, avg_daily_yield, source) VALUES
('Holstein-Friesian', 15.75, 'FarmKenya/Standard Media 2020: 45 L/day well-managed x 0.35 for Kenyan smallholder farms'),
('Friesian',          15.75, 'FarmKenya/Standard Media 2020: 45 L/day well-managed x 0.35 for Kenyan smallholder farms'),
('Ayrshire',          10.50, 'FarmKenya/Standard Media 2020: 30 L/day well-managed x 0.35 for Kenyan smallholder farms'),
('Guernsey',           8.75, 'FarmKenya/Standard Media 2020: 25 L/day well-managed x 0.35 for Kenyan smallholder farms'),
('Jersey',             7.00, 'FarmKenya/Standard Media 2020: 20 L/day well-managed x 0.35 for Kenyan smallholder farms'),
('Sahiwal',            5.50, 'FarmKenya 2020: 10 L/day x 0.55; ILRI AGTR commercial herds average ~5.4 L/day'),
('Boran',              4.50, 'ILRI AGTR (Muguga and Ngong herd records)'),
('Zebu',               1.60, 'Cambridge Animal Genetic Resources, SEAZ on-farm characterization, SE Kenya (2011)'),
('Crossbreed',         8.00, 'USDA FAS GAIN Kenya Dairy 2024 (7.6 L/day); Ajak et al. 2020, Nyeri (10.7 L/day)'),
('Other',              8.00, 'USDA FAS GAIN Kenya Dairy 2024 (7.6 L/day); Ajak et al. 2020, Nyeri (10.7 L/day)') AS incoming
ON DUPLICATE KEY UPDATE
    -- avg_daily_yield first: the source check must still see the old source
    avg_daily_yield = IF(breed_yield_baselines.source LIKE 'placeholder%', incoming.avg_daily_yield, breed_yield_baselines.avg_daily_yield),
    source = IF(breed_yield_baselines.source LIKE 'placeholder%', incoming.source, breed_yield_baselines.source);
