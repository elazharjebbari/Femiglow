-- 0053_priority_cities.sql
-- Set initial priority positions for the 13 most-popular delivery cities.
-- Position > 0 means the city appears at the top of the autocomplete
-- (query empty). Position = 0 means alphabetical order (default).

UPDATE delivery_cities SET position =  1, updated_at = NOW() WHERE slug = 'casablanca';
UPDATE delivery_cities SET position =  2, updated_at = NOW() WHERE slug = 'marrakech';
UPDATE delivery_cities SET position =  3, updated_at = NOW() WHERE slug = 'tanger';
UPDATE delivery_cities SET position =  4, updated_at = NOW() WHERE slug = 'agadir';
UPDATE delivery_cities SET position =  5, updated_at = NOW() WHERE slug = 'kenitra';
UPDATE delivery_cities SET position =  6, updated_at = NOW() WHERE slug = 'fes';
UPDATE delivery_cities SET position =  7, updated_at = NOW() WHERE slug = 'meknes';
UPDATE delivery_cities SET position =  8, updated_at = NOW() WHERE slug = 'tetouan';
UPDATE delivery_cities SET position =  9, updated_at = NOW() WHERE slug = 'dar-bouaza';
UPDATE delivery_cities SET position = 10, updated_at = NOW() WHERE slug = 'mohammedia';
UPDATE delivery_cities SET position = 11, updated_at = NOW() WHERE slug = 'el-jadida';
UPDATE delivery_cities SET position = 12, updated_at = NOW() WHERE slug = 'bouskoura-ville-verte';
UPDATE delivery_cities SET position = 13, updated_at = NOW() WHERE slug = 'oujda';