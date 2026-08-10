import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody, Badge, EmptyState } from "@/components/ui";
import { deleteDocumentAction } from "@/actions/documents";
import { VaultUpload } from "@/components/vault-upload";
import { DOC_KINDS } from "@/lib/constants";

export const metadata = { title: "Document vault" };

export default async function DocumentsPage() {
  const user = await requireUser();
  const docs = await db.document.findMany({
    where: { userId: user.id, deletedAt: null, docKind: { not: "avatar" } },
    orderBy: { uploadedAt: "desc" },
    include: { case: { select: { title: true, id: true } } },
  });

  const kindName = (k: string) => DOC_KINDS.find((d) => d.key === k)?.name ?? k;

  return (
    <div>
      <PageHeader
        title="Document vault"
        subtitle="Your private, secure storage. Only you (and consultants you approve) can see these."
      />
      <Card className="mb-6">
        <CardBody>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Add documents</h2>
          <VaultUpload />
        </CardBody>
      </Card>

      {docs.length === 0 ? (
        <EmptyState title="Your vault is empty" body="Upload W-2s, 1099s, returns, notices, and transcripts. You can delete anything at any time." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Type</th>
                <th className="hidden px-4 py-3 sm:table-cell">Case</th>
                <th className="hidden px-4 py-3 sm:table-cell">Uploaded</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {docs.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3">
                    <Link href={`/api/files/${d.id}`} target="_blank" className="font-medium text-indigo-600 underline">
                      {d.fileName}
                    </Link>
                    <p className="text-xs text-slate-400">{(d.sizeBytes / 1024).toFixed(0)} KB</p>
                  </td>
                  <td className="px-4 py-3"><Badge>{kindName(d.docKind)}</Badge></td>
                  <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">
                    {d.case ? <Link href={`/app/cases/${d.case.id}`} className="underline">{d.case.title.slice(0, 30)}</Link> : "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">{d.uploadedAt.toLocaleDateString("en-US")}</td>
                  <td className="px-4 py-3 text-right">
                    <form action={deleteDocumentAction.bind(null, d.id)}>
                      <button className="text-xs font-medium text-red-500 hover:text-red-700">Delete</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
