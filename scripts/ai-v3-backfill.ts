import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const cases = await db.case.findMany({
    include: {
      issues: true,
      pathSteps: true,
      presentations: true,
      analysisVersions: true,
    },
  });
  let created = 0;
  for (const c of cases) {
    if (c.analysisVersions.length > 0) continue;
    const version = await db.caseAnalysisVersion.create({
      data: {
        caseId: c.id,
        version: 1,
        status: c.status === "analyzed" || c.status === "consultant_recommended" ? "approved" : "needs_verification",
        trigger: "backfill",
        issueIdsJson: JSON.stringify(c.issues.map((i) => i.id)),
        pathStepIdsJson: JSON.stringify(c.pathSteps.map((s) => s.id)),
        snapshotJson: JSON.stringify({
          backfilled: true,
          status: c.status,
          readiness: c.readinessScore,
          conflicts: c.conflictsJson,
          issues: c.issues,
          path_steps: c.pathSteps,
        }),
        approvedAt: c.status === "analyzed" || c.status === "consultant_recommended" ? new Date() : null,
      },
    });
    if (c.presentations.length === 0 && c.issues.length > 0) {
      await db.casePresentation.create({
        data: {
          caseId: c.id,
          analysisVersionId: version.id,
          schemaVersion: "legacy-backfill",
          presentationJson: JSON.stringify({
            finding_card: {
              category: c.issues[0].issueType,
              headline: c.issues[0].title,
              status: c.issues[0].evidenceStatus,
              priority: c.issues[0].priority,
              summary: c.issues[0].description,
            },
            what_we_found: c.issues.map((i) => i.conclusion || i.description).filter(Boolean),
          }),
        },
      });
    }
    created++;
  }
  console.log(`Backfilled ${created} case analysis version(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
