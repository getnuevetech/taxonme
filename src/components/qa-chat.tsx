"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { askQuestionAction } from "@/actions/user";
import { AssistantMessageText } from "@/components/assistant-reply";
import { STARTER_PROMPTS } from "@/lib/conversation/starter-prompts";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
    >
      {pending ? "Thinking…" : "Ask"}
    </button>
  );
}

export function QaChat({
  threadId,
  messages,
  suggestions = [...STARTER_PROMPTS],
  showRegisterCta = false,
  showUpgradeCta = false,
  showConsultantCta = false,
  focusLabel,
  interpretedQuestion,
  defaultQuestion = "",
  showPromoteCta = false,
  promoteSituationHref = "/app/cases/new",
  promoteCaseHref = "/app/cases/new",
}: {
  threadId: string;
  messages: { id: string; role: string; content: string }[];
  suggestions?: string[];
  showRegisterCta?: boolean;
  showUpgradeCta?: boolean;
  showConsultantCta?: boolean;
  focusLabel?: string;
  interpretedQuestion?: string;
  defaultQuestion?: string;
  showPromoteCta?: boolean;
  promoteSituationHref?: string;
  promoteCaseHref?: string;
}) {
  const [state, formAction] = useActionState(askQuestionAction, null);
  const [draft, setDraft] = useState(defaultQuestion);
  const formRef = useRef<HTMLFormElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const registerHref = threadId
    ? `/register?next=${encodeURIComponent(`/app/qa/${threadId}`)}`
    : "/register";
  const loginHref = threadId
    ? `/login?next=${encodeURIComponent(`/app/qa/${threadId}`)}`
    : "/login";
  const showGuestKeep =
    Boolean(threadId) && showRegisterCta && messages.some((m) => m.role === "assistant");
  const starterList = suggestions.length ? suggestions : [...STARTER_PROMPTS];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    if (state?.ok) {
      formRef.current?.reset();
      setDraft("");
    }
  }, [messages.length, state]);

  useEffect(() => {
    if (defaultQuestion) setDraft(defaultQuestion);
  }, [defaultQuestion]);

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      {(focusLabel || interpretedQuestion) && (
        <div className="border-b border-slate-100 bg-slate-50/90 px-5 py-3">
          {focusLabel ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
              Working on: {focusLabel}
            </p>
          ) : null}
          {interpretedQuestion ? (
            <p className="mt-1 text-sm text-slate-600">{interpretedQuestion}</p>
          ) : null}
        </div>
      )}

      <div className="max-h-[55vh] min-h-[200px] space-y-4 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="py-6 text-center text-sm text-slate-500">
            <p className="font-medium text-slate-600">Try one of these:</p>
            <div className="mt-3 flex flex-col items-center gap-2">
              {starterList.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setDraft(suggestion)}
                  className="max-w-xl rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50/50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "user" ? "bg-indigo-600 text-white whitespace-pre-wrap" : "bg-slate-100 text-slate-800"
              }`}
            >
              {m.role === "assistant" ? <AssistantMessageText content={m.content} /> : m.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {(showRegisterCta || showUpgradeCta || showConsultantCta || showGuestKeep || showPromoteCta) && (
        <div className="space-y-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
          {showPromoteCta && messages.some((m) => m.role === "assistant") && (
            <p>
              Ready to go further?{" "}
              <Link href={promoteSituationHref} className="font-semibold text-teal-700 underline">
                Continue with my situation
              </Link>
              {" · "}
              <Link href={promoteCaseHref} className="font-semibold text-teal-700 underline">
                Track this government case
              </Link>
            </p>
          )}
          {showGuestKeep && (
            <p>
              Want to keep this conversation?{" "}
              <Link href={registerHref} className="font-semibold text-teal-700 underline">
                Create a free account
              </Link>{" "}
              or{" "}
              <Link href={loginHref} className="font-semibold text-teal-700 underline">
                sign in
              </Link>{" "}
              — we will bring you right back here.
            </p>
          )}
          {showRegisterCta && !showGuestKeep && (
            <p>
              <Link href={registerHref} className="font-semibold text-teal-700 underline">
                Create a free account
              </Link>{" "}
              to save this thread and continue later.
            </p>
          )}
          {showUpgradeCta && (
            <p>
              Need form wizards or a Prep Plan?{" "}
              <Link href="/app/billing?upgrade=plus" className="font-semibold text-teal-700 underline">
                Upgrade to Plus
              </Link>
              .
            </p>
          )}
          {showConsultantCta && (
            <p>
              Prefer a human CPA/EA?{" "}
              <Link href="/app/consultants" className="font-semibold text-teal-700 underline">
                Browse matched tax professionals
              </Link>
              .
            </p>
          )}
        </div>
      )}

      <form ref={formRef} action={formAction} className="border-t border-slate-200 p-4">
        {state?.error && (
          <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}
        <input type="hidden" name="threadId" value={threadId} />
        <div className="flex gap-2">
          <input
            name="question"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about your notice, deadline, payment options, or documents…"
            autoComplete="off"
            className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          <Submit />
        </div>
      </form>
    </div>
  );
}
