import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody } from "@/components/ui";
import { ProfileForm, DeleteAccount } from "@/components/profile-forms";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <div className="max-w-2xl">
      <PageHeader title="Your profile" subtitle="Just the basics — we never ask for sensitive information here." />
      <Card>
        <CardBody>
          <ProfileForm
            user={{
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              phone: user.phone,
              address: user.address,
              idNumber: user.idNumber,
              bio: user.bio,
              avatarPath: user.avatarPath,
            }}
          />
        </CardBody>
      </Card>
      <Card className="mt-6 border-red-200">
        <CardBody>
          <h2 className="font-semibold text-red-700">Delete my account</h2>
          <p className="mt-1 text-sm text-slate-500">
            This permanently removes your profile, cases, documents, letters, and conversations. There is no undo.
          </p>
          <div className="mt-3">
            <DeleteAccount />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
