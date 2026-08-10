"use client";

import { ActionForm, SubmitButton } from "./action-form";
import { uploadDocumentAction } from "@/actions/documents";
import { DOC_KINDS } from "@/lib/constants";
import { inputClass } from "./ui";

export function VaultUpload() {
  return (
    <ActionForm action={uploadDocumentAction} successMessage="Uploaded to your vault.">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="files"
          multiple
          required
          className="text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
        />
        <select name="docKind" className={`${inputClass} !w-auto`}>
          {DOC_KINDS.map((k) => (
            <option key={k.key} value={k.key}>{k.name}</option>
          ))}
        </select>
        <SubmitButton>Upload</SubmitButton>
      </div>
    </ActionForm>
  );
}
