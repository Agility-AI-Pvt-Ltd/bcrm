"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { failureText } from "@/lib/api";
import {
  formatStamp,
  getMyTemplates,
  getTemplateCatalog,
  getTemplateSummary,
  statusChip,
  statusLabel,
  submitStarter,
  syncTemplates,
  type CatalogTemplate,
  type OrganizationTemplate,
  type TemplateSummary,
} from "@/lib/whatsappTemplates";
import RequiredTemplatesPanel from "./RequiredTemplatesPanel";

/**
 * One screen that answers "which of my templates are approved, and which are pending?"
 *
 * Read top to bottom: the counts, then the templates EstateFlow's own automations need
 * (where a status is really a feature being on or off), then everything this agency has
 * submitted, then the starters it has not used yet.
 *
 * The statuses come from our mirror of Meta's catalogue, kept current by the
 * `message_template_status_update` webhook. **Check with Meta** reconciles it by hand,
 * which is the thing to press when something has sat on "Awaiting Meta review" longer
 * than it should.
 */
export default function TemplatesPage() {
  const [summary, setSummary] = useState<TemplateSummary | null>(null);
  const [mine, setMine] = useState<OrganizationTemplate[]>([]);
  const [catalog, setCatalog] = useState<CatalogTemplate[]>([]);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const [loadedSummary, loadedMine, loadedCatalog] = await Promise.all([
        getTemplateSummary(),
        getMyTemplates(),
        getTemplateCatalog(),
      ]);
      setSummary(loadedSummary);
      setMine(loadedMine);
      setCatalog(loadedCatalog);
      setError("");
    } catch (err) {
      setError(failureText(err, "Could not load your WhatsApp templates."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const refresh = () => {
    setVersion((value) => value + 1);
    void load();
  };

  const sync = async () => {
    setSyncing(true);
    setError("");
    try {
      const result = await syncTemplates();
      setNotice(
        result.changed
          ? `Checked ${result.checked} templates with Meta — ${result.changed} changed.`
          : `Checked ${result.checked} templates with Meta. Nothing has changed yet.`,
      );
      refresh();
    } catch (err) {
      setError(failureText(err, "Could not reach Meta to check the statuses."));
    } finally {
      setSyncing(false);
    }
  };

  const submit = async (entry: CatalogTemplate) => {
    setBusy(entry.id);
    setError("");
    try {
      await submitStarter(entry.id);
      setNotice(`${entry.name} sent to Meta for review.`);
      refresh();
    } catch (err) {
      setError(failureText(err, `Could not submit ${entry.name}.`));
    } finally {
      setBusy("");
    }
  };

  const unused = catalog.filter((entry) => !entry.submission_status && entry.is_active);

  const tiles: Array<{ label: string; value: number; tone: string }> = summary
    ? [
        { label: "Approved", value: summary.approved, tone: "text-success-600" },
        { label: "Awaiting Meta", value: summary.pending, tone: "text-warning-600" },
        { label: "Rejected", value: summary.rejected, tone: "text-error-500" },
        {
          label: "Drafts",
          value: summary.draft,
          tone: "text-gray-700 dark:text-gray-200",
        },
      ]
    : [];

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              WhatsApp templates
            </h3>
            <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
              Meta reviews every message you send first. Approved templates can go to
              anyone; a pending one can go to nobody. This page shows where each of yours
              stands and which features are waiting on them.
            </p>
          </div>
          <button
            type="button"
            disabled={syncing}
            onClick={() => void sync()}
            className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.04]"
          >
            {syncing ? "Checking…" : "Check with Meta"}
          </button>
        </div>

        {summary && !summary.whatsapp_connected ? (
          <p className="mt-4 rounded-xl bg-warning-50 px-3 py-2.5 text-sm text-warning-700 dark:bg-warning-500/15 dark:text-warning-500">
            WhatsApp is not connected, so nothing can be submitted or sent yet. Connect it
            on{" "}
            <Link href="/profile/api-management" className="underline">
              API management
            </Link>
            .
          </p>
        ) : null}

        {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}
        {notice ? <p className="mt-3 text-sm text-success-600">{notice}</p> : null}

        {summary ? (
          <dl className="mt-4 grid gap-3 sm:grid-cols-4">
            {tiles.map((tile) => (
              <div
                key={tile.label}
                className="rounded-xl border border-gray-200 px-3 py-2.5 dark:border-gray-800"
              >
                <dt className="text-xs text-gray-500 dark:text-gray-400">{tile.label}</dt>
                <dd className={`mt-0.5 text-xl font-semibold ${tile.tone}`}>{tile.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Statuses arrive from Meta by webhook. “Check with Meta” re-reads them, which is
          worth doing if something has sat on “Awaiting Meta review” longer than a day.
        </p>
      </section>

      <RequiredTemplatesPanel refreshKey={version} onChanged={() => void load()} />

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Your templates
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Everything submitted from this account, newest review state first.
        </p>

        {mine.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <th className="py-2 pr-4 font-medium">Template</th>
                  <th className="py-2 pr-4 font-medium">Category</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Submitted</th>
                  <th className="py-2 pr-4 font-medium">Approved</th>
                </tr>
              </thead>
              <tbody>
                {mine.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-100 last:border-0 dark:border-gray-800/60"
                  >
                    <td className="py-2.5 pr-4">
                      <code className="text-gray-800 dark:text-white/90">
                        {row.meta_template_name}
                      </code>
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                        {row.language}
                      </span>
                      {row.rejection_reason ? (
                        <span className="mt-1 block text-xs text-error-500">
                          Meta said: {row.rejection_reason}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                      {row.category}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusChip(
                          row.status,
                        )}`}
                      >
                        {statusLabel(row.status)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                      {formatStamp(row.submitted_at)}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                      {formatStamp(row.approved_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Nothing submitted yet. Start with the templates your automations need, above.
          </p>
        )}
      </section>

      {unused.length ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Ready-made templates you have not used
          </h3>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
            Pre-written and already shaped the way Meta expects, with example values
            filled in. Submitting sends it for review as it is — the wording cannot be
            edited here, because a miscategorised template is a policy matter for your
            account.
          </p>
          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {unused.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col rounded-xl border border-gray-200 p-3.5 dark:border-gray-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <code className="text-sm text-gray-800 dark:text-white/90">{entry.name}</code>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">
                    {entry.category}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {entry.description}
                </p>
                <pre className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-2.5 text-xs text-gray-700 dark:bg-white/[0.04] dark:text-gray-300">
                  {entry.body}
                </pre>
                <button
                  type="button"
                  disabled={busy === entry.id}
                  onClick={() => void submit(entry)}
                  className="mt-3 h-9 self-start rounded-lg bg-brand-500 px-3 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  {busy === entry.id ? "Submitting…" : "Submit to Meta"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
