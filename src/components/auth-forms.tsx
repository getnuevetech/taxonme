"use client";

import Link from "next/link";
import { ActionForm, SubmitButton } from "./action-form";
import { loginAction, registerAction } from "@/actions/auth";
import { inputClass } from "./ui";

export function LoginForm() {
  return (
    <ActionForm action={loginAction}>
      <div className="space-y-4">
        <input name="email" type="email" required placeholder="Email address" className={inputClass} />
        <input name="password" type="password" required placeholder="Password" className={inputClass} />
        <SubmitButton className="w-full py-2.5">Sign in</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function RegisterForm({
  asConsultant,
  agreementSlug,
  agreementTitle,
}: {
  asConsultant: boolean;
  agreementSlug: string;
  agreementTitle: string;
}) {
  return (
    <ActionForm action={registerAction}>
      {asConsultant && <input type="hidden" name="asConsultant" value="1" />}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <input name="firstName" required placeholder="First name" className={inputClass} />
          <input name="lastName" required placeholder="Last name" className={inputClass} />
        </div>
        <input name="email" type="email" required placeholder="Email address (required)" className={inputClass} />
        <input name="phone" type="tel" placeholder="Mobile number (optional)" className={inputClass} />
        <input name="password" type="password" required placeholder="Password (8+ characters)" className={inputClass} />
        <label className="flex items-start gap-2 text-sm text-slate-600">
          <input type="checkbox" name="agree" required className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600" />
          <span>
            I have read and agree to the{" "}
            {agreementSlug ? (
              <Link href={`/p/${agreementSlug}`} target="_blank" className="font-medium text-indigo-600 underline">
                {agreementTitle}
              </Link>
            ) : (
              agreementTitle
            )}
          </span>
        </label>
        <SubmitButton className="w-full py-2.5">
          {asConsultant ? "Create consultant account" : "Create my account"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
