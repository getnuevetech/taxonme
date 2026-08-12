"use client";

import { ActionForm, SubmitButton } from "./action-form";
import { consultantUpdateProfileAction } from "@/actions/consultant";
import { Field, inputClass } from "./ui";

export function ConsultantProfileForm({
  user,
  languages,
  website,
}: {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    bio: string;
    avatarPath: string;
  };
  languages: string;
  website: string;
}) {
  return (
    <ActionForm action={consultantUpdateProfileAction} successMessage="Profile saved.">
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          {user.avatarPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/api/avatar" alt="Profile" className="h-16 w-16 rounded-full object-cover ring-2 ring-indigo-100" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-700">
              {user.firstName?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
            </div>
          )}
          <Field label="Profile picture" hint="Shown to clients you're matched with.">
            <input type="file" name="avatar" accept="image/*" className="text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:text-indigo-700" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name"><input name="firstName" defaultValue={user.firstName} required className={inputClass} /></Field>
          <Field label="Last name"><input name="lastName" defaultValue={user.lastName} required className={inputClass} /></Field>
        </div>
        <Field label="Email"><input value={user.email} disabled className={`${inputClass} bg-slate-50 text-slate-400`} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone number"><input name="phone" defaultValue={user.phone} className={inputClass} /></Field>
          <Field label="Website (optional)"><input name="website" defaultValue={website} placeholder="https://…" className={inputClass} /></Field>
        </div>
        <Field label="Address"><input name="address" defaultValue={user.address} placeholder="Street, City, ST ZIP" className={inputClass} /></Field>
        <Field label="Languages spoken" hint="Comma-separated, e.g. English, Spanish">
          <input name="languages" defaultValue={languages} className={inputClass} />
        </Field>
        <Field label="Professional bio" hint="Clients see this when you're proposed as their consultant.">
          <textarea name="bio" defaultValue={user.bio} rows={4} className={inputClass} />
        </Field>
        <SubmitButton>Save profile</SubmitButton>
      </div>
    </ActionForm>
  );
}
