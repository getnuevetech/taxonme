import "server-only";
import type { User, ConsultantProfile } from "@prisma/client";

// The essential consultant profile: every item is required for a complete
// profile, but none blocks registration — consultants finish it at their pace.
export type CompletenessItem = { key: string; label: string; done: boolean; href: string };

export function consultantCompleteness(
  user: Pick<User, "firstName" | "lastName" | "phone" | "address" | "bio" | "avatarPath">,
  profile: ConsultantProfile | null,
): { items: CompletenessItem[]; pct: number } {
  const specialties: string[] = (() => {
    try {
      const p = JSON.parse(profile?.specialties || "[]");
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  })();

  const items: CompletenessItem[] = [
    { key: "photo", label: "Profile picture", done: Boolean(user.avatarPath), href: "/consultant/profile" },
    { key: "name", label: "Full name", done: Boolean(user.firstName && user.lastName), href: "/consultant/profile" },
    { key: "phone", label: "Phone number", done: Boolean(user.phone), href: "/consultant/profile" },
    { key: "address", label: "Address", done: Boolean(user.address), href: "/consultant/profile" },
    { key: "bio", label: "Professional bio", done: Boolean(user.bio), href: "/consultant/profile" },
    { key: "languages", label: "Languages spoken", done: Boolean(profile?.languages), href: "/consultant/profile" },
    { key: "credential", label: "Credential type & number", done: Boolean(profile && profile.credentialNumber), href: "/consultant/onboarding" },
    { key: "ptin", label: "PTIN", done: Boolean(profile?.ptin), href: "/consultant/onboarding" },
    { key: "proof", label: "License / credential proof", done: Boolean(profile?.proofDocumentPath), href: "/consultant/onboarding" },
    { key: "specialties", label: "Specialties", done: specialties.length > 0, href: "/consultant/onboarding" },
    { key: "states", label: "States served", done: Boolean(profile?.statesServed), href: "/consultant/onboarding" },
    { key: "experience", label: "Years of experience", done: Boolean(profile && profile.yearsExperience > 0), href: "/consultant/onboarding" },
  ];
  const pct = Math.round((items.filter((i) => i.done).length / items.length) * 100);
  return { items, pct };
}
