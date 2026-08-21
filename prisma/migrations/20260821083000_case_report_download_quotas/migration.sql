-- Case report downloads are allocated by plan (Free 1 / Plus 3 / Pro 7).
-- Extra downloads are a one-time charge; the fee lives in App settings.

ALTER TABLE "PaymentTransaction" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'subscription';
CREATE INDEX "PaymentTransaction_userId_kind_status_idx" ON "PaymentTransaction"("userId", "kind", "status");

CREATE TABLE "CaseReportDownload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'included',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseReportDownload_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CaseReportDownload_userId_caseId_key" ON "CaseReportDownload"("userId", "caseId");
CREATE INDEX "CaseReportDownload_userId_idx" ON "CaseReportDownload"("userId");

ALTER TABLE "CaseReportDownload" ADD CONSTRAINT "CaseReportDownload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaseReportDownload" ADD CONSTRAINT "CaseReportDownload_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Setting" ("key", "value", "type", "group", "label", "description", "updatedAt")
VALUES (
  'billing.case_report_extra_cents',
  '499',
  'number',
  'billing',
  'Extra case report download fee (cents)',
  'Charged for each extra case report download after the plan allowance is used. Example: 499 = $4.99.',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO UPDATE
SET "type" = 'number',
    "group" = 'billing',
    "label" = EXCLUDED."label",
    "description" = EXCLUDED."description";

-- Product default allowances. Admin can still change them from the feature matrix afterwards.
INSERT INTO "PlanFeature" ("id", "planId", "featureKey", "enabled", "limitValue")
SELECT 'pf_report_' || p."key", p."id", 'case.report', true,
  CASE p."key"
    WHEN 'free' THEN 1
    WHEN 'plus' THEN 3
    WHEN 'pro' THEN 7
    ELSE 7
  END
FROM "SubscriptionPlan" p
WHERE p."key" IN ('free', 'plus', 'pro')
ON CONFLICT ("planId", "featureKey") DO UPDATE
SET "enabled" = true,
    "limitValue" = EXCLUDED."limitValue";

INSERT INTO "PlanFeature" ("id", "planId", "featureKey", "enabled", "limitValue")
SELECT 'pf_report_partner', p."id", 'case.report', true, 7
FROM "SubscriptionPlan" p
WHERE p."key" = 'partner'
ON CONFLICT ("planId", "featureKey") DO NOTHING;
