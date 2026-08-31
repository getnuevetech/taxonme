import Link from "next/link";
import { guardAdminPage } from "@/lib/admin-guard";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, CardBody, PageHeader } from "@/components/ui";
import {
  clearExperiencePatternStaleAction,
  invalidateExperiencePatternsForAuthorityAction,
  markExperiencePatternStaleAction,
  promoteExperiencePatternAction,
  recordExperiencePatternFeedbackAction,
} from "@/actions/experience-registry";
import {
  countRegistryByLevel,
  isPromotionLevel,
  listRegistryEntries,
  PROMOTION_LABELS,
  PROMOTION_LEVELS,
  type PromotionLevel,
} from "@/lib/experience/registry";

export const metadata = { title: "Pattern Registry" };

export default async function AdminExperiencePage({
  searchParams,
}: {
  searchParams?: Promise<{ level?: string }>;
}) {
  await guardAdminPage("admin.experience");
  const levelParam = (await searchParams)?.level;
  const level: PromotionLevel | "all" =
    levelParam != null && isPromotionLevel(Number(levelParam))
      ? (Number(levelParam) as PromotionLevel)
      : "all";
  const [entries, counts] = await Promise.all([
    listRegistryEntries({ level, limit: 100 }),
    countRegistryByLevel(),
  ]);

  return (
    <div>
      <PageHeader
        title="Pattern Registry"
        subtitle="Review de-identified experience. Only L4 Production patterns can enter Experience Search; current authority always controls."
      />
      <Card className="mb-5">
        <CardBody>
          <p className="text-sm font-semibold">Authority invalidation</p>
          <p className="mb-2 text-xs text-slate-500">
            Mark production patterns stale when an IRS, state DOR, or Tax
            Court authority key changes.
          </p>
          <ActionForm
            action={invalidateExperiencePatternsForAuthorityAction}
            className="flex flex-wrap gap-2"
          >
            <input
              name="authority_key"
              required
              placeholder="irs_collection_process"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <SubmitButton>Invalidate linked patterns</SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>

      <div className="mb-5 flex flex-wrap gap-2">
        <Link
          href="/admin/experience?level=all"
          className="rounded-lg bg-white px-3 py-1.5 text-sm"
        >
          All ({Object.values(counts).reduce((sum, count) => sum + count, 0)})
        </Link>
        {PROMOTION_LEVELS.map((item) => (
          <Link
            key={item}
            href={`/admin/experience?level=${item}`}
            className="rounded-lg bg-white px-3 py-1.5 text-sm"
          >
            {item} · {PROMOTION_LABELS[item]} ({counts[item]})
          </Link>
        ))}
      </div>

      <div className="space-y-3">
        {entries.length === 0 ? (
          <Card>
            <CardBody className="text-sm text-slate-500">
              No de-identified patterns at this level.
            </CardBody>
          </Card>
        ) : null}
        {entries.map((entry) => (
          <Card key={entry.id}>
            <CardBody className="space-y-3">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold">{entry.decisionTarget}</p>
                  <p className="text-xs text-slate-500">
                    {entry.workspace} · {entry.anon.origin ?? "turn"}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Badge>
                    {entry.promotionLevel} ·{" "}
                    {PROMOTION_LABELS[entry.promotionLevel]}
                  </Badge>
                  {entry.staleAt ? <Badge color="red">stale</Badge> : null}
                  <Badge>
                    Help {entry.helpCount} · Harm {entry.harmCount}
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-slate-700">
                Decision-changing:{" "}
                {entry.anon.decision_changing_facts.join(", ") || "—"}
              </p>
              <p className="text-sm text-slate-700">
                Deferred: {entry.anon.facts_discarded.join(", ") || "—"}
              </p>
              <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                <span className="text-xs">Set level:</span>
                {PROMOTION_LEVELS.map((toLevel) => (
                  <ActionForm
                    key={toLevel}
                    action={promoteExperiencePatternAction}
                  >
                    <input
                      type="hidden"
                      name="observationId"
                      value={entry.id}
                    />
                    <input
                      type="hidden"
                      name="toLevel"
                      value={toLevel}
                    />
                    <SubmitButton>{toLevel}</SubmitButton>
                  </ActionForm>
                ))}
                {(["help", "harm"] as const).map((verdict) => (
                  <ActionForm
                    key={verdict}
                    action={recordExperiencePatternFeedbackAction}
                  >
                    <input
                      type="hidden"
                      name="observationId"
                      value={entry.id}
                    />
                    <input type="hidden" name="verdict" value={verdict} />
                    <SubmitButton>
                      {verdict === "help" ? "Help" : "Harm"}
                    </SubmitButton>
                  </ActionForm>
                ))}
                <ActionForm
                  action={
                    entry.staleAt
                      ? clearExperiencePatternStaleAction
                      : markExperiencePatternStaleAction
                  }
                >
                  <input
                    type="hidden"
                    name="observationId"
                    value={entry.id}
                  />
                  <input
                    type="hidden"
                    name="reason_key"
                    value="admin_marked_stale"
                  />
                  <SubmitButton>
                    {entry.staleAt ? "Clear stale" : "Mark stale"}
                  </SubmitButton>
                </ActionForm>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
