"use client";

import { ActionForm, SubmitButton } from "../action-form";
import { saveAiProviderAction } from "@/actions/admin";
import { Field, inputClass } from "../ui";
import { AI_KINDS } from "@/lib/constants";

type Provider = {
  id: string;
  name: string;
  kind: string;
  baseUrl: string;
  hasKey: boolean;
  model: string;
  maxTokens: number;
  temperature: number;
  supportsVision: boolean;
  supportsStructuredOutput: boolean;
  isEnabled: boolean;
  notes: string;
  dataRetentionProfile: string;
  regionProfile: string;
  costTier: string;
  timeoutMs: number;
  maxContextTokens: number;
} | null;

export function AiProviderForm({ provider }: { provider: Provider }) {
  return (
    <ActionForm action={saveAiProviderAction} successMessage="Provider saved.">
      {provider && <input type="hidden" name="id" value={provider.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Display name">
          <input name="name" defaultValue={provider?.name} required placeholder="e.g. OpenAI GPT-5.6 Sol" className={inputClass} />
        </Field>
        <Field label="API type">
          <select name="kind" defaultValue={provider?.kind ?? "openai_compatible"} className={inputClass}>
            {AI_KINDS.map((k) => (
              <option key={k.key} value={k.key}>{k.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Base URL" hint="Leave empty for the vendor default.">
          <input name="baseUrl" defaultValue={provider?.baseUrl} placeholder="https://api.openai.com/v1" className={inputClass} />
        </Field>
        <Field label="Model">
          <input name="model" defaultValue={provider?.model} required placeholder="e.g. gpt-5.6-sol, claude-sonnet-5, gemini-3.1-pro-preview" className={inputClass} />
        </Field>
        <Field label="API key" hint={provider?.hasKey ? "A key is stored. Enter a new value to replace it." : "Paste the provider's API key."}>
          <input name="apiKey" type="password" defaultValue={provider?.hasKey ? "••••••••••••" : ""} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Max tokens">
            <input name="maxTokens" type="number" defaultValue={provider?.maxTokens ?? 4096} className={inputClass} />
          </Field>
          <Field label="Temperature">
            <input name="temperature" type="number" step="0.1" min="0" max="2" defaultValue={provider?.temperature ?? 0.2} className={inputClass} />
          </Field>
        </div>
        <Field label="Timeout (ms)">
          <input name="timeoutMs" type="number" min="5000" max="180000" defaultValue={provider?.timeoutMs ?? 90000} className={inputClass} />
        </Field>
        <Field label="Max context tokens">
          <input name="maxContextTokens" type="number" min="0" defaultValue={provider?.maxContextTokens ?? 0} className={inputClass} />
        </Field>
        <Field label="Cost tier">
          <select name="costTier" defaultValue={provider?.costTier ?? "medium"} className={inputClass}>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </Field>
        <Field label="Data retention profile">
          <input name="dataRetentionProfile" defaultValue={provider?.dataRetentionProfile ?? "unreviewed"} placeholder="approved_taxpayer_data" className={inputClass} />
        </Field>
        <Field label="Region profile">
          <input name="regionProfile" defaultValue={provider?.regionProfile ?? "unreviewed"} placeholder="approved_us" className={inputClass} />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="isEnabled" defaultChecked={provider?.isEnabled ?? true} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
          Enabled
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="supportsVision" defaultChecked={provider?.supportsVision} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
          Supports vision / PDF understanding
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="supportsStructuredOutput" defaultChecked={provider?.supportsStructuredOutput} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
          Supports structured output
        </label>
      </div>
      <div className="mt-3">
        <Field label="Notes">
          <input name="notes" defaultValue={provider?.notes} placeholder="Internal notes about this provider" className={inputClass} />
        </Field>
      </div>
      <div className="mt-4">
        <SubmitButton>{provider ? "Save provider" : "Add provider"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
