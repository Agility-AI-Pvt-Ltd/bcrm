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
import TemplateDetailModal from "./TemplateDetailModal";

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
  const [language, setLanguage] = useState("all");
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState<OrganizationTemplate | null>(null);

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
      // The modal holds a copy of one row, so a reload has to hand it the new
      // one — otherwise submitting from in there leaves a stale status on screen.
      setOpen((current) =>
        current ? loadedMine.find((row) => row.id === current.id) ?? null : null,
      );
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

  /** One set at a time: each submission is its own Graph call and review. */
  const submitAll = async (entries: CatalogTemplate[]) => {
    const key = libraryGroupKey(entries[0]);
    setBusy(key);
    setError("");
    const failed: string[] = [];
    for (const entry of entries) {
      try {
        await submitStarter(entry.id);
      } catch (err) {
        failed.push(`${entry.name} (${languageLabel(entry.language)}): ${failureText(err, "failed")}`);
      }
    }
    setBusy("");
    if (failed.length) setError(`Not submitted: ${failed.join("; ")}`);
    const done = entries.length - failed.length;
    if (done) setNotice(`${done} template${done === 1 ? "" : "s"} sent to Meta for review.`);
    refresh();
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
          Everything submitted from this account, newest review state first. Open one to
          read the message it sends.
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
                  <th className="py-2 font-medium">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {mine.map((row) => (
                  <tr
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${row.meta_template_name}`}
                    onClick={() => setOpen(row)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setOpen(row);
                      }
                    }}
                    className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-50 dark:border-gray-800/60 dark:hover:bg-white/[0.04] dark:focus-visible:bg-white/[0.04]"
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
                    <td className="py-2.5 text-right">
                      <span className="text-xs text-brand-500 underline underline-offset-2">
                        View
                      </span>
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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                Template library
              </h3>
              <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
                Ready-made templates you have not submitted yet, already shaped the way Meta
                expects, with example values filled in. Choose the ones you want and submit
                them for review from your own WhatsApp account. The wording cannot be edited
                here, because a miscategorised template is a policy matter for your account.
              </p>
            </div>
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-xs dark:bg-white/[0.06]" role="group" aria-label="Language">
              {[
                ["all", "All languages"],
                ["en_US", "English"],
                ["hi", "Hindi"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={language === value}
                  onClick={() => setLanguage(value)}
                  className={`rounded-md px-2.5 py-1 font-medium ${language === value ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {libraryGroups(unused, language).map((group) => (
            <div key={group.key} className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">{group.title}</h4>
                  <p className="mt-0.5 max-w-3xl text-xs text-gray-500 dark:text-gray-400">{group.blurb}</p>
                </div>
                {group.entries.length > 1 ? (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void submitAll(group.entries)}
                    className="h-9 rounded-lg border border-brand-500 px-3 text-xs font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
                  >
                    {busy === group.key ? "Submitting…" : `Submit all ${group.entries.length}`}
                  </button>
                ) : null}
              </div>
              <ul className="mt-3 grid gap-3 lg:grid-cols-2">
                {group.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-col rounded-xl border border-gray-200 p-3.5 dark:border-gray-800"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <code className="text-sm text-gray-800 dark:text-white/90">{entry.name}</code>
                      <span className="flex gap-1.5">
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                          {languageLabel(entry.language)}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">
                          {entry.category}
                        </span>
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {entry.description}
                    </p>
                    <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-2.5 text-xs text-gray-700 dark:bg-white/[0.04] dark:text-gray-300">
                      {entry.body}
                    </pre>
                    {Object.keys(entry.sample_values ?? {}).length ? (
                      <p className="mt-1.5 text-[11px] text-gray-400">
                        {Object.entries(entry.sample_values)
                          .map(([number, sample]) => `{{${number}}} ${entry.variable_labels?.[number] ?? ""}: ${sample}`)
                          .join(" · ")}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => void submit(entry)}
                      className="mt-3 h-9 self-start rounded-lg bg-brand-500 px-3 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                    >
                      {busy === entry.id ? "Submitting…" : "Submit to Meta"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}

      <TemplateDetailModal
        template={open}
        onClose={() => setOpen(null)}
        onSubmitted={() => {
          setNotice(`${open?.meta_template_name ?? "Template"} sent to Meta for review.`);
          refresh();
        }}
      />
    </div>
  );
}

const LANGUAGE_NAMES: Record<string, string> = { en_US: "English", en: "English", hi: "Hindi" };

function languageLabel(code: string): string {
  return LANGUAGE_NAMES[code] ?? code;
}

/** Which set of the library a starter belongs to, from its name. */
function libraryGroupKey(entry: CatalogTemplate): string {
  if (entry.name.startsWith("followup_touch_")) return "followup";
  if (entry.name === "daily_digest" || entry.name === "ai_call_scheduled") return "team";
  return "customers";
}

const LIBRARY_GROUPS: Array<{ key: string; title: string; blurb: string }> = [
  {
    key: "followup",
    title: "5-touch follow-up",
    blurb:
      "Sent automatically on days 1, 3, 7, 10 and 14 to a lead who messaged and went quiet, in Hindi or English. Submit both languages so every customer gets their own; each one ends with “Reply STOP”.",
  },
  {
    key: "customers",
    title: "Messages to customers",
    blurb: "Visit reminders, feedback, new matches and updates for people who enquired.",
  },
  {
    key: "team",
    title: "Messages to your team",
    blurb: "Go to your agents' own WhatsApp numbers, not to customers.",
  },
];

function libraryGroups(entries: CatalogTemplate[], language: string) {
  const shown = entries.filter((entry) => language === "all" || entry.language === language);
  return LIBRARY_GROUPS.map((group) => ({
    ...group,
    entries: shown
      .filter((entry) => libraryGroupKey(entry) === group.key)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
  })).filter((group) => group.entries.length);
}
