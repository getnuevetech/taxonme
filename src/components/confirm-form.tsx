"use client";

import type { ReactNode } from "react";

// A form wrapper that requires explicit confirmation before submitting —
// used for destructive actions like deleting accounts.
export function ConfirmForm({
  action,
  message,
  children,
  className = "",
}: {
  action: (formData: FormData) => void | Promise<void>;
  message: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
