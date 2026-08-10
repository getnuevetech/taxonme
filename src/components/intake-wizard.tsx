"use client";

import { useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { startIntakeAction } from "@/actions/case";

const STEPS = [
  { title: "What happened?", subtitle: "Tell us your tax story in your own words. No jargon needed." },
  { title: "What's your goal?", subtitle: "What would a great outcome look like for you?" },
  { title: "Any documents?", subtitle: "Optional — but the more you share, the sharper your results." },
];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-60"
    >
      {pending ? "Analyzing your situation…" : "Analyze my situation →"}
    </button>
  );
}

export function IntakeWizard() {
  const [step, setStep] = useState(0);
  const [situation, setSituation] = useState("");
  const [goal, setGoal] = useState("");
  const [fileCount, setFileCount] = useState(0);
  const [state, formAction] = useActionState(startIntakeAction, null);

  const canNext = step === 0 ? situation.trim().length >= 20 : step === 1 ? goal.trim().length >= 5 : true;

  return (
    <form action={formAction} className="mx-auto max-w-2xl">
      {/* Progress like a game level bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs font-medium text-slate-500">
          <span>Step {step + 1} of {STEPS.length}</span>
          <span>{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">{STEPS[step].title}</h2>
        <p className="mt-1 text-sm text-slate-500">{STEPS[step].subtitle}</p>

        {state?.error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        )}

        {/* All inputs stay mounted so values submit together at the end. */}
        <div className={step === 0 ? "mt-6" : "hidden"}>
          <textarea
            name="situation"
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            rows={7}
            placeholder={'For example: "I got a letter from the IRS saying I owe $2,800 for 2024, but I already got a smaller refund than I expected and I don\'t understand why…"'}
            className="w-full rounded-xl border border-slate-300 p-4 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          <p className="mt-2 text-xs text-slate-400">
            {situation.trim().length < 20 ? `Keep going — a few sentences helps a lot (${situation.trim().length}/20 characters minimum)` : "Great, that's enough to work with. Add as much detail as you like."}
          </p>
        </div>

        <div className={step === 1 ? "mt-6" : "hidden"}>
          <textarea
            name="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={4}
            placeholder={'For example: "Find out where the rest of my refund went, and set up a payment plan I can afford."'}
            className="w-full rounded-xl border border-slate-300 p-4 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {["Understand an IRS letter", "Find my missing refund", "Set up a payment plan", "Reduce penalties", "Fix an old tax year"].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGoal((prev) => (prev ? `${prev} ${g}.` : `${g}.`))}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:border-indigo-400 hover:text-indigo-600"
              >
                + {g}
              </button>
            ))}
          </div>
        </div>

        <div className={step === 2 ? "mt-6" : "hidden"}>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-10 text-center hover:border-indigo-400">
            <span className="text-base font-medium text-slate-700">
              {fileCount > 0 ? `${fileCount} file${fileCount > 1 ? "s" : ""} ready to upload` : "Tap to add photos or files"}
            </span>
            <span className="mt-1 text-xs text-slate-500">IRS notices, W-2, 1099, tax returns, transcripts — PDF or photos</span>
            <input
              type="file"
              name="documents"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.heic,.txt,.csv,image/*,application/pdf"
              className="hidden"
              onChange={(e) => setFileCount(e.target.files?.length ?? 0)}
            />
          </label>
          <p className="mt-2 text-xs text-slate-400">
            You can skip this and add documents later. Everything is stored privately and you can delete files anytime.
          </p>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className={`text-sm font-medium text-slate-500 hover:text-slate-800 ${step === 0 ? "invisible" : ""}`}
          >
            ← Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setStep((s) => s + 1)}
              className="rounded-xl bg-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-40"
            >
              Continue →
            </button>
          ) : (
            <Submit />
          )}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-slate-400">
        No account needed to see your first results. We&apos;ll keep your answers safe and attach them to your account if you register.
      </p>
    </form>
  );
}
