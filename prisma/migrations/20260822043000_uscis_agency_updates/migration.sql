-- Official agency updates (USCIS news) + per-case impact analyses for paid plans.

CREATE TABLE "AgencyUpdate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "sourceUrl" TEXT NOT NULL DEFAULT '',
    "sourceAgency" TEXT NOT NULL DEFAULT 'USCIS',
    "externalId" TEXT NOT NULL DEFAULT '',
    "tagsJson" TEXT NOT NULL DEFAULT '[]',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyUpdate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgencyUpdate_slug_key" ON "AgencyUpdate"("slug");
CREATE UNIQUE INDEX "AgencyUpdate_sourceAgency_externalId_key" ON "AgencyUpdate"("sourceAgency", "externalId");
CREATE INDEX "AgencyUpdate_isPublished_publishedAt_idx" ON "AgencyUpdate"("isPublished", "publishedAt");

CREATE TABLE "CaseUpdateImpact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "updateId" TEXT NOT NULL,
    "relevance" TEXT NOT NULL DEFAULT 'unknown',
    "summary" TEXT NOT NULL DEFAULT '',
    "analysisJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseUpdateImpact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CaseUpdateImpact_userId_caseId_updateId_key" ON "CaseUpdateImpact"("userId", "caseId", "updateId");
CREATE INDEX "CaseUpdateImpact_userId_updateId_idx" ON "CaseUpdateImpact"("userId", "updateId");

ALTER TABLE "CaseUpdateImpact" ADD CONSTRAINT "CaseUpdateImpact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaseUpdateImpact" ADD CONSTRAINT "CaseUpdateImpact_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaseUpdateImpact" ADD CONSTRAINT "CaseUpdateImpact_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "AgencyUpdate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Setting" ("key", "value", "type", "group", "label", "description", "updatedAt")
VALUES
  ('uscis.feed_url', 'https://www.uscis.gov/news/rss-feed/34819', 'text', 'uscis', 'USCIS news RSS URL', 'Official USCIS RSS feed used to pull the latest news and alerts.', CURRENT_TIMESTAMP),
  ('uscis.alerts_url', 'https://www.uscis.gov/newsroom/alerts', 'text', 'uscis', 'USCIS alerts page URL', 'HTML fallback page when the RSS feed is unreachable.', CURRENT_TIMESTAMP),
  ('uscis.sync_enabled', 'true', 'boolean', 'uscis', 'Auto-sync USCIS updates', 'When enabled, the maintenance cron pulls the latest USCIS news.', CURRENT_TIMESTAMP),
  ('uscis.homepage_count', '3', 'number', 'uscis', 'Homepage updates count', 'How many latest USCIS updates to show on the public homepage.', CURRENT_TIMESTAMP),
  ('uscis.agency_label', 'USCIS', 'text', 'uscis', 'Agency label', 'Shown on the homepage and updates pages.', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
