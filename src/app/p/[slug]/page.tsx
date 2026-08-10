import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SiteHeader, SiteFooter } from "@/components/site-nav";

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await db.contentPage.findFirst({ where: { slug, isPublished: true } });
  if (!page) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <h1 className="text-3xl font-extrabold text-slate-900">{page.title}</h1>
        <p className="mt-1 text-xs text-slate-400">
          Version {page.version} · Updated {page.updatedAt.toLocaleDateString("en-US")}
        </p>
        <div className="prose-simple mt-6 whitespace-pre-wrap text-slate-700">{page.body}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
