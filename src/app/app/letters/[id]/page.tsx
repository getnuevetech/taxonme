import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { EditLetterForm } from "@/components/letter-forms";

export default async function LetterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const letter = await db.responseLetter.findFirst({ where: { id, userId: user.id } });
  if (!letter) notFound();

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Edit your letter"
        subtitle="Review every word. You are the sender — mail it when you're confident it's right."
      />
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <EditLetterForm letter={{ id: letter.id, title: letter.title, body: letter.body, status: letter.status }} />
      </div>
    </div>
  );
}
