"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { failureText } from "@/lib/api";
import {
  getRequiredTemplates,
  statusChip,
  statusLabel,
  submitStarter,
  type RequiredTemplate,
} from "@/lib/whatsappTemplates";

type Props = {
  /** Bumped by the page when a sync or a submission changes something. */
  refreshKey?: number;
  onChanged?: () => void;
  /** Hide the heading when this sits inside another card. */
  bare?: boolean;
};

/**
 * The templates EstateFlow's own automations need, each with its real status.
 *
 * The point of this panel is that a status is never shown on its own. "Awaiting Meta
 * review" next to *Daily digest*, with the sentence saying the digest is skipped until
 * it clears, is something a broker can act on — `PENDING` in a table is not.
 *
 * The list, the feature names and the consequences all come from the server, which
 * builds them from the constants the senders use. Nothing here is a hard-coded guess
 * about which template powers what.
 */
export default function RequiredTemplatesPanel({ refreshKey = 0, onChanged, bare }: Props) {
  const [rows, setRows] = useState<RequiredTemplate[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setRows(await getRequiredTemplates());
      setError("");
    } catch (err) {
      setError(failureText(err, "Could not read the template statuses."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const submit = async (row: RequiredTemplate) => {
    if (!row.catalog_template_id) return;
    setBusy(row.name);
    setError("");
    try {
      await submitStarter(row.catalog_template_id);
      setNotice(
        `${row.name} sent to Meta for review. Approval usually takes a few minutes, sometimes a day.`,
      );
      await load();
      onChanged?.();
    } catch (err) {
      setError(failureText(err, `Could not submit ${row.name}.`));
    } finally {
      setBusy("");
    }
  };

  const blocked = rows.filter((row) => !row.approved);
  const waiting = rows.filter((row) => row.pending);

  return (
    <section
      className={
        bare
          ? ""
          : "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6"
      }
    >
      {bare ? null : (
        <>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            What your automations need
          </h3>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
            These messages go out before the customer has written to you that day, so
            WhatsApp only carries them on a template Meta has approved. Until then the
            automation is skipped — not sent as plain text.
          </p>
        </>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Checking statuses…</p>
      ) : null}
      {!loading && !blocked.length ? (
        <p className="mt-4 rounded-xl bg-success-50 px-3 py-2.5 text-sm text-success-700 dark:bg-success-500/15 dark:text-success-500">
          All {rows.length} templates approved. Every automation can message customers
          and your team.
        </p>
      ) : null}
      {!loading && blocked.length ? (
        <p className="mt-4 rounded-xl bg-warning-50 px-3 py-2.5 text-sm text-warning-700 dark:bg-warning-500/15 dark:text-warning-500">
          {blocked.length} of {rows.length} not approved yet
          {waiting.length ? `, ${waiting.length} waiting on Meta` : ""}. The features below
          are affected.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-success-600">{notice}</p> : null}

      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <li
            key={`${row.name}-${row.language}`}
            className="rounded-xl border border-gray-200 p-3.5 dark:border-gray-800"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                  {row.feature}
                </p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  <code>{row.name}</code> · {row.language}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusChip(
                    row.status,
                  )}`}
                >
                  {statusLabel(row.status)}
                </span>
                {row.status === "NOT_SUBMITTED" && row.catalog_template_id ? (
                  <button
                    type="button"
                    disabled={busy === row.name}
                    onClick={() => void submit(row)}
                    className="h-8 rounded-lg bg-brand-500 px-3 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                  >
                    {busy === row.name ? "Submitting…" : "Submit to Meta"}
                  </button>
                ) : null}
                <Link
                  href={row.settings_path}
                  className="text-xs text-brand-500 underline underline-offset-2"
                >
                  Settings
                </Link>
              </div>
            </div>

            {!row.approved ? (
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">{row.blocks}</p>
            ) : null}
            {row.rejection_reason ? (
              <p className="mt-2 rounded-lg bg-error-50 px-2.5 py-2 text-xs text-error-600 dark:bg-error-500/10 dark:text-error-500">
                Meta said: {row.rejection_reason}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
