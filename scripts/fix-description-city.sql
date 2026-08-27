-- One-off fix: buildDescription() in scripts/lib/osm-seed.ts hardcoded
-- ", Johannesburg." on every listing's description regardless of what
-- city its area was actually in, until this was caught during a live
-- check on Durban Central listings. This corrects every already-inserted
-- OSM-sourced business's description text; new inserts already use the
-- fixed version. Safe to run more than once (idempotent per row: replaces
-- the exact ", Johannesburg." suffix, which won't match twice).

UPDATE businesses SET description = REPLACE(description, ', Johannesburg.', ', Pretoria.')
  WHERE "externalId" LIKE 'osm:%' AND location->>'area' IN ('Hatfield, Pretoria', 'Pretoria Central');

UPDATE businesses SET description = REPLACE(description, ', Johannesburg.', ', Cape Town.')
  WHERE "externalId" LIKE 'osm:%' AND location->>'area' IN ('Cape Town CBD', 'Khayelitsha');

UPDATE businesses SET description = REPLACE(description, ', Johannesburg.', ', Durban.')
  WHERE "externalId" LIKE 'osm:%' AND location->>'area' IN ('Durban Central', 'Umlazi');

UPDATE businesses SET description = REPLACE(description, ', Johannesburg.', ', Gqeberha.')
  WHERE "externalId" LIKE 'osm:%' AND location->>'area' = 'Gqeberha Central';

UPDATE businesses SET description = REPLACE(description, ', Johannesburg.', ', Bloemfontein.')
  WHERE "externalId" LIKE 'osm:%' AND location->>'area' = 'Bloemfontein Central';

UPDATE businesses SET description = REPLACE(description, ', Johannesburg.', ', Polokwane.')
  WHERE "externalId" LIKE 'osm:%' AND location->>'area' = 'Polokwane Central';

-- These three areas ARE their own city (areaName === cityName in the fixed
-- code), so the correct text has no city suffix at all — just drop it.
UPDATE businesses SET description = REPLACE(description, ', Johannesburg.', '.')
  WHERE "externalId" LIKE 'osm:%' AND location->>'area' IN ('Stellenbosch', 'Mbombela', 'East London');
