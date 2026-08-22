"use client";

import { ActionForm, SubmitButton } from "./action-form";
import { analyzeUpdateImpactAction } from "@/actions/updates";

export function AnalyzeUpdateImpactForm({ updateId, caseId }: { updateId: string; caseId: string }) {
  return (
    <ActionForm action={analyzeUpdateImpactAction} successMessage="Impact analysis refreshed.">
      <input type="hidden" name="updateId" value={updateId} />
      <input type="hidden" name="caseId" value={caseId} />
      <SubmitButton className="!bg-white !px-3 !py-1.5 !text-xs !font-semibold !text-slate-700 !shadow-none ring-1 ring-slate-300 hover:!bg-slate-50">
        Refresh analysis
      </SubmitButton>
    </ActionForm>
  );
}
