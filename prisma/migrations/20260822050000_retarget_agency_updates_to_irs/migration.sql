-- Retarget agency updates from USCIS to IRS (product correction).

ALTER TABLE "AgencyUpdate" ALTER COLUMN "sourceAgency" SET DEFAULT 'IRS';

-- Migrate settings keys uscis.* → irs.*
INSERT INTO "Setting" ("key", "value", "type", "group", "label", "description", "updatedAt")
SELECT
  replace(key, 'uscis.', 'irs.'),
  CASE
    WHEN key = 'uscis.feed_url' THEN ''
    WHEN key = 'uscis.alerts_url' THEN 'https://www.irs.gov/newsroom/news-releases-for-current-month'
    WHEN key = 'uscis.agency_label' THEN 'IRS'
    ELSE value
  END,
  type,
  'irs',
  replace(replace(label, 'USCIS', 'IRS'), 'uscis', 'irs'),
  replace(replace(description, 'USCIS', 'IRS'), 'uscis', 'irs'),
  CURRENT_TIMESTAMP
FROM "Setting"
WHERE key LIKE 'uscis.%'
ON CONFLICT ("key") DO UPDATE
SET "value" = EXCLUDED."value",
    "group" = 'irs',
    "label" = EXCLUDED."label",
    "description" = EXCLUDED."description",
    "updatedAt" = CURRENT_TIMESTAMP;

DELETE FROM "Setting" WHERE key LIKE 'uscis.%';

INSERT INTO "Setting" ("key", "value", "type", "group", "label", "description", "updatedAt")
VALUES
  ('irs.feed_url', '', 'text', 'irs', 'IRS news RSS URL (optional)', 'Optional RSS URL. Leave empty to scrape the IRS newsroom HTML page.', CURRENT_TIMESTAMP),
  ('irs.alerts_url', 'https://www.irs.gov/newsroom/news-releases-for-current-month', 'text', 'irs', 'IRS newsroom URL', 'HTML newsroom page used to pull the latest IRS news releases.', CURRENT_TIMESTAMP),
  ('irs.sync_enabled', 'true', 'boolean', 'irs', 'Auto-sync IRS updates', 'When enabled, the maintenance cron pulls the latest IRS news.', CURRENT_TIMESTAMP),
  ('irs.homepage_count', '3', 'number', 'irs', 'Homepage updates count', 'How many latest IRS updates to show on the public homepage.', CURRENT_TIMESTAMP),
  ('irs.agency_label', 'IRS', 'text', 'irs', 'Agency label', 'Shown on the homepage and updates pages.', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE
SET "group" = 'irs',
    "label" = EXCLUDED."label",
    "description" = EXCLUDED."description";

-- Drop the mistaken USCIS seed/demo rows; live IRS sync (or IRS seed) replaces them.
DELETE FROM "CaseUpdateImpact"
WHERE "updateId" IN (SELECT "id" FROM "AgencyUpdate" WHERE "sourceAgency" = 'USCIS' OR "externalId" LIKE 'seed:%' OR "slug" LIKE 'uscis-%');
DELETE FROM "AgencyUpdate" WHERE "sourceAgency" = 'USCIS' OR "externalId" LIKE 'seed:%' OR "slug" LIKE 'uscis-%';

UPDATE "FeatureDef"
SET "name" = 'Personalized IRS update impact on your case'
WHERE "key" = 'updates.case_impact';
