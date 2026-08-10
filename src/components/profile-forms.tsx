"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "./action-form";
import { updateProfileAction } from "@/actions/user";
import { deleteAccountAction } from "@/actions/auth";
import { Field, inputClass } from "./ui";

export function ProfileForm({
  user,
}: {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    idNumber: string;
    bio: string;
    avatarPath: string;
  };
}) {
  return (
    <ActionForm action={updateProfileAction} successMessage="Profile saved.">
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-indigo-100 text-xl font-bold text-indigo-700">
            {user.firstName?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
          </div>
          <Field label="Profile picture">
            <input type="file" name="avatar" accept="image/*" className="text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:text-indigo-700" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name"><input name="firstName" defaultValue={user.firstName} required className={inputClass} /></Field>
          <Field label="Last name"><input name="lastName" defaultValue={user.lastName} required className={inputClass} /></Field>
        </div>
        <Field label="Email"><input value={user.email} disabled className={`${inputClass} bg-slate-50 text-slate-400`} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mobile number"><input name="phone" defaultValue={user.phone} className={inputClass} /></Field>
          <Field label="ID number (optional)"><input name="idNumber" defaultValue={user.idNumber} className={inputClass} /></Field>
        </div>
        <Field label="Address"><input name="address" defaultValue={user.address} className={inputClass} /></Field>
        <Field label="About you" hint="A short bio helps a consultant understand your situation faster.">
          <textarea name="bio" defaultValue={user.bio} rows={3} className={inputClass} />
        </Field>
        <SubmitButton>Save profile</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DeleteAccount() {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        Delete my account…
      </button>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <form action={deleteAccountAction}>
        <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
          Yes, permanently delete everything
        </button>
      </form>
      <button onClick={() => setConfirming(false)} className="text-sm text-slate-500 hover:text-slate-800">
        Cancel
      </button>
    </div>
  );
}
