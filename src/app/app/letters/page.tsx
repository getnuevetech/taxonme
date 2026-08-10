import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody, Badge, EmptyState, ButtonLink } from "@/components/ui";

export const metadata = { title: "Response letters" };

export default async function LettersPage() {
  const user = await requireUser();
  const letters = await db.responseLetter.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Response letters"
        subtitle="Professional drafts you can edit, print, and mail yourself."
        actions={<ButtonLink href="/app/letters/new">New letter →</ButtonLink>}
      />
      {letters.length === 0 ? (
        <EmptyState
          title="No letters yet"
          body="Generate a response to an IRS notice, then fine-tune every word before sending."
          action={<ButtonLink href="/app/letters/new">Draft your first letter</ButtonLink>}
        />
      ) : (
        <div className="space-y-3">
          {letters.map((l) => (
            <Link key={l.id} href={`/app/letters/${l.id}`} className="block">
              <Card className="transition hover:border-indigo-300">
                <CardBody className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{l.title}</p>
                    <p className="text-xs text-slate-500">Updated {l.updatedAt.toLocaleDateString("en-US")}</p>
                  </div>
                  <Badge color={l.status === "final" ? "green" : "slate"}>{l.status}</Badge>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
