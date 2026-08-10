import { PageHeader, Card, CardBody } from "@/components/ui";
import { getSetting } from "@/lib/settings";

export const metadata = { title: "Your IRS online account" };

export default async function IrsAccountPage() {
  const irsUrl = await getSetting("irs.account_url", "https://www.irs.gov/your-account");
  const steps = [
    { title: "Go to the IRS website", body: "Open the official IRS individual account page. Only ever use irs.gov — never a link from an email." },
    { title: "Verify your identity with ID.me", body: "The IRS uses ID.me for identity checks. You'll need a photo ID and a phone. It takes about 10 minutes." },
    { title: "Explore your account", body: "You'll see your balance, payment history, tax records, and any notices the IRS has sent you." },
    { title: "Download your transcripts", body: "Grab your Account Transcript for each tax year in question — it shows every transaction the IRS has recorded." },
    { title: "Upload transcripts here", body: "Add them to your document vault. Transcripts let us verify amounts precisely instead of estimating." },
  ];

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Set up your IRS online account"
        subtitle="Your IRS account is the single best source of truth about your taxes — and it's free."
      />
      <Card className="mb-6">
        <CardBody>
          <p className="text-sm leading-relaxed text-slate-600">
            With an IRS individual online account, you can see exactly what the IRS sees: your balance, your payment history,
            your transcripts, and digital copies of many notices. Uploading your transcripts here means our analysis works
            with confirmed IRS records instead of estimates — which resolves most &ldquo;verification required&rdquo; flags.
          </p>
          <a
            href={irsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Open the official IRS account page ↗
          </a>
        </CardBody>
      </Card>
      <div className="space-y-3">
        {steps.map((s, i) => (
          <Card key={i}>
            <CardBody className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-slate-900">{s.title}</p>
                <p className="mt-0.5 text-sm text-slate-600">{s.body}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
