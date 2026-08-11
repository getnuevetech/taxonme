import { PageHeader } from "@/components/ui";
import { NewTicketForm } from "@/components/ticket-forms";

export const metadata = { title: "New support ticket" };

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; subject?: string }>;
}) {
  const { category, subject } = await searchParams;
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Create a support ticket"
        subtitle="Tell us what's going on. Tickets are routed to the right team and you'll be notified of every reply."
      />
      <NewTicketForm
        defaultCategory={category === "tech_support" ? "tech_support" : "customer_service"}
        defaultSubject={subject ?? ""}
        fromChatbot={Boolean(category || subject)}
      />
    </div>
  );
}
