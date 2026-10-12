"use client";

/**
 * One submitted template, opened from the Your templates table.
 *
 * The question a broker has in front of this list is "what does this one
 * actually say?", and the table could not answer it — the wording was in the
 * response all along and nothing rendered it. So the first thing here is the
 * message with the example values filled in, the way the customer will read it;
 * the raw `{{1}}` version and the variable table are underneath for whoever is
 * debugging a rejection.
 *
 * Read-only except for one button: a template Meta refused, or one that never
 * left as a draft, can be sent for review from here. That endpoint existed and
 * had no caller, which made a rejected row in this table a dead end.
 */

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { failureText } from "@/lib/api";
import {
  fillTemplate,
  formatStamp,
  needsAction,
  statusChip,
  statusLabel,
  submitTemplate,
  templateVariables,
  type OrganizationTemplate,
} from "@/lib/whatsappTemplates";

export default function TemplateDetailModal({
  template,
  onClose,
  onSubmitted,
}: {
  template: OrganizationTemplate | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!template) return null;

  const variables = templateVariables(
    template.body,
    template.variable_labels || {},
    template.sample_values || {},
  );
  const preview = fillTemplate(
    template.body,
    template.sample_values || {},
    template.variable_labels || {},
  );

  const stamps: Array<{ label: string; value: string }> = [
    { label: "Submitted", value: formatStamp(template.submitted_at) },
    { label: "Approved", value: formatStamp(template.approved_at) },
    { label: "Last checked with Meta", value: formatStamp(template.synced_at) },
  ];

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      await submitTemplate(template.id);
      onSubmitted();
    } catch (err) {
      setError(failureText(err, "Could not send this template to Meta."));
    } finally {
      setBusy(false);
    }
  };

  return (
    // The scroll lives on the inner div, not on the modal box: the close button
    // is positioned against the box, and a long template would scroll it away.
    <Modal isOpen onClose={onClose} className="m-4 max-w-2xl">
      <div className="max-h-[85vh] overflow-y-auto p-5 lg:p-6">
        <div className="pr-12 sm:pr-16">
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-base text-gray-800 dark:text-white/90">
              {template.meta_template_name}
            </code>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">
              {template.language}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">
              {template.category}
            </span>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusChip(
                template.status,
              )}`}
            >
              {statusLabel(template.status)}
            </span>
          </div>
        </div>

        {template.rejection_reason ? (
          <p className="mt-4 rounded-xl bg-error-50 px-3 py-2.5 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-500">
            Meta said: {template.rejection_reason}
          </p>
        ) : null}

        <section className="mt-5">
          <h4 className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            What the customer reads
          </h4>
          <p className="mt-2 whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-success-50 px-3.5 py-3 text-sm leading-relaxed text-gray-800 dark:bg-success-500/10 dark:text-gray-100">
            {preview}
          </p>
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            With the example values below. Real sends put the customer&apos;s own details in
            the same places.
          </p>
        </section>

        <section className="mt-5">
          <h4 className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            The wording Meta reviews
          </h4>
          <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-700 dark:bg-white/[0.04] dark:text-gray-300">
            {template.body}
          </pre>
        </section>

        {variables.length ? (
          <section className="mt-5">
            <h4 className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Variables
            </h4>
            <table className="mt-2 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <th className="py-1.5 pr-4 font-medium">Placeholder</th>
                  <th className="py-1.5 pr-4 font-medium">Stands for</th>
                  <th className="py-1.5 font-medium">Example shown to Meta</th>
                </tr>
              </thead>
              <tbody>
                {variables.map((variable) => (
                  <tr
                    key={variable.token}
                    className="border-b border-gray-100 last:border-0 dark:border-gray-800/60"
                  >
                    <td className="py-1.5 pr-4">
                      <code className="text-gray-800 dark:text-white/90">{`{{${variable.token}}}`}</code>
                    </td>
                    <td className="py-1.5 pr-4 text-gray-600 dark:text-gray-300">
                      {variable.label}
                    </td>
                    <td className="py-1.5 text-gray-600 dark:text-gray-300">
                      {variable.sample || <span className="text-error-500">missing</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              Meta reviews the filled-in example, so a placeholder with no example is a
              common reason for a rejection.
            </p>
          </section>
        ) : (
          <p className="mt-5 text-xs text-gray-500 dark:text-gray-400">
            No variables — this template sends the same words every time.
          </p>
        )}

        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          {stamps.map((stamp) => (
            <div
              key={stamp.label}
              className="rounded-xl border border-gray-200 px-3 py-2 dark:border-gray-800"
            >
              <dt className="text-xs text-gray-500 dark:text-gray-400">{stamp.label}</dt>
              <dd className="mt-0.5 text-sm text-gray-700 dark:text-gray-200">{stamp.value}</dd>
            </div>
          ))}
        </dl>

        {template.meta_template_id ? (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Meta template ID <code>{template.meta_template_id}</code> — quote this if you
            ask your Meta representative about it.
          </p>
        ) : null}

        {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}

        {needsAction(template.status) ? (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void send()}
              className="h-10 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send to Meta for review"}
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              A submission cannot be withdrawn, and the wording goes exactly as it reads
              above.
            </span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
