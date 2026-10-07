"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircleIcon,
  CopyIcon,
  GroupIcon,
  PaperPlaneIcon,
  ShootingStarIcon,
} from "@/icons";
import { failureText } from "@/lib/api";
import {
  fetchAudiences,
  fetchCampaignStats,
  fetchRecentCampaigns,
  generateCampaign,
  launchCampaign,
  parseContacts,
  SENDABLE_CHANNELS,
  type Audience,
  type CampaignStats,
  type Channel,
  type LaunchResult,
  type RecentCampaign,
  type Tone,
} from "@/lib/campaigns";

const TONES: Tone[] = ["Professional", "Friendly", "Luxury", "Urgent"];
const CHANNELS: Channel[] = ["WhatsApp", "SMS", "Email"];

const STATUS_TONE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300",
  queued: "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400",
  running: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400",
  paused: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
  completed: "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300",
  failed: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400",
};

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white/90">{value}</p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{detail}</p>
    </div>
  );
}

export default function CampaignWorkspace() {
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [recent, setRecent] = useState<RecentCampaign[]>([]);
  const [audiences, setAudiences] = useState<Audience[]>([]);

  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState<Tone>("Professional");
  const [channel, setChannel] = useState<Channel>("WhatsApp");
  const [message, setMessage] = useState("");
  const [source, setSource] = useState<"ai" | "template" | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const [audienceMode, setAudienceMode] = useState<"existing" | "paste">("paste");
  const [datasetId, setDatasetId] = useState("");
  const [contactSource, setContactSource] = useState("");
  const [templateName, setTemplateName] = useState("");

  const [generating, setGenerating] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState<LaunchResult | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const contacts = useMemo(() => parseContacts(contactSource), [contactSource]);
  const canSend = SENDABLE_CHANNELS.includes(channel);

  const load = useCallback(async () => {
    try {
      const [nextStats, nextRecent, nextAudiences] = await Promise.all([
        fetchCampaignStats(),
        fetchRecentCampaigns(),
        fetchAudiences(),
      ]);
      setStats(nextStats);
      setRecent(nextRecent);
      setAudiences(nextAudiences);
    } catch (err) {
      setError(failureText(err, "Could not load your campaigns."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onGenerate = async () => {
    if (prompt.trim().length < 10) {
      setError("Describe the property or campaign in a sentence or two first.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const result = await generateCampaign({
        brief: prompt,
        tone,
        channel,
        name: name.trim() || null,
        dataset_id: audienceMode === "existing" && datasetId ? datasetId : null,
        current_message: message.trim() || null,
      });
      setMessage(result.message);
      setSource(result.source);
      setWarnings(result.warnings);
      if (!name.trim()) setName(result.name);
      setNotice(
        result.source === "ai"
          ? "Draft written for you. Edit it before launching."
          : "Drafted from a template — no AI model is configured, so tone was not applied.",
      );
    } catch (err) {
      setError(failureText(err, "Could not generate the message."));
    } finally {
      setGenerating(false);
    }
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please export your Excel or Google Sheet as a CSV file.");
      event.target.value = "";
      return;
    }
    setContactSource(await file.text());
    setAudienceMode("paste");
    setNotice(`${file.name} imported. Check the detected contacts before launching.`);
  };

  const copyMessage = async () => {
    if (!message) return;
    await navigator.clipboard.writeText(message);
    setNotice("Campaign message copied.");
  };

  const audienceReady =
    audienceMode === "existing" ? Boolean(datasetId) : contacts.length > 0;

  const onLaunch = async () => {
    setLaunching(true);
    setError("");
    try {
      const result = await launchCampaign({
        name: name.trim() || "Untitled campaign",
        brief: prompt,
        message,
        tone,
        channel,
        dataset_id: audienceMode === "existing" ? datasetId : null,
        audience:
          audienceMode === "paste"
            ? { contacts, name: `${name.trim() || "Campaign"} audience` }
            : undefined,
        template_name: templateName.trim() || null,
      });
      setLaunched(result);
      setNotice(result.message);
      await load();
    } catch (err) {
      setError(failureText(err, "Could not create the campaign."));
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-brand-500">Campaign studio</p>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white/90">
            Turn property details into conversations
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            Write the brief, pick who it goes to, and the studio creates a real
            campaign. You review and start it in Outreach.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Contacts"
          value={stats ? stats.total_contacts.toLocaleString("en-IN") : "—"}
          detail="In your CRM"
        />
        <StatCard
          label="Active campaigns"
          value={stats ? String(stats.active_campaigns) : "—"}
          detail="Queued, running or paused"
        />
        <StatCard
          label="Reply rate"
          value={
            stats?.reply_rate === null || stats === null
              ? "—"
              : `${stats.reply_rate.toFixed(1)}%`
          }
          detail={
            stats === null
              ? "Loading"
              : stats.messages_sent === 0
                ? "No messages sent yet"
                : `${stats.replies.toLocaleString("en-IN")} replies from ${stats.messages_sent.toLocaleString("en-IN")} sent`
          }
        />
      </div>

      {error ? (
        <p className="rounded-xl bg-error-50 px-4 py-3 text-sm text-error-600 dark:bg-error-500/10">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-12 rounded-2xl border border-gray-200 bg-white p-5 lg:col-span-7 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
              <ShootingStarIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white/90">
                Generate campaign message
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Include location, property type, price, amenities, and your goal.
              </p>
            </div>
          </div>

          <label className="mb-4 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Campaign name
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Whitefield 3BHK launch"
              className="mt-2 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
            />
          </label>

          <label
            htmlFor="campaign-prompt"
            className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Campaign brief
          </label>
          <textarea
            id="campaign-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Example: Promote a new 3BHK apartment in Whitefield starting at ₹1.2 Cr, with clubhouse and metro access. Invite buyers to book a weekend site visit."
            className="h-32 w-full resize-none rounded-xl border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:text-white/90"
          />

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Tone
              <select
                value={tone}
                onChange={(event) => setTone(event.target.value as Tone)}
                className="mt-2 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                {TONES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Channel
              <select
                value={channel}
                onChange={(event) => setChannel(event.target.value as Channel)}
                className="mt-2 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                {CHANNELS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                    {SENDABLE_CHANNELS.includes(item) ? "" : " — draft only"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!canSend ? (
            <p className="mt-3 rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
              Only WhatsApp is connected to a sender. You can still draft {channel} copy
              here and use it elsewhere, but the campaign cannot be launched.
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void onGenerate()}
            disabled={generating}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:opacity-50 sm:w-auto"
          >
            <ShootingStarIcon className="h-5 w-5" />
            {generating ? "Writing…" : "Generate campaign"}
          </button>
        </section>

        <section className="col-span-12 rounded-2xl border border-gray-200 bg-white p-5 lg:col-span-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white/90">
                Message preview
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Edit the copy before launching.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copyMessage()}
              disabled={!message}
              aria-label="Copy campaign message"
              className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:hover:bg-white/[0.05]"
            >
              <CopyIcon className="h-5 w-5" />
            </button>
          </div>

          {source ? (
            <p
              className={`mb-3 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                source === "ai"
                  ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                  : "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300"
              }`}
            >
              {source === "ai" ? "Written by AI" : "Template — no AI model configured"}
            </p>
          ) : null}

          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Your generated campaign message will appear here."
            className="h-[232px] w-full resize-none rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          />
          <div className="mt-3 flex justify-between text-xs text-gray-400">
            <span>{message ? `${message.length} characters` : "Waiting for a brief"}</span>
            <span>{channel} preview</span>
          </div>
          {warnings.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-warning-700 dark:text-warning-400">
              {warnings.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-12 rounded-2xl border border-gray-200 bg-white p-5 lg:col-span-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-50 text-success-600 dark:bg-success-500/10">
              <GroupIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white/90">Audience</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Use a contact list you already imported, or paste one now.
              </p>
            </div>
          </div>

          <div className="mb-4 flex gap-2">
            {(["existing", "paste"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setAudienceMode(mode)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  audienceMode === mode
                    ? "bg-brand-500 text-white"
                    : "bg-gray-100 text-gray-600 dark:bg-white/[0.04] dark:text-gray-300"
                }`}
              >
                {mode === "existing" ? "Existing list" : "Paste contacts"}
              </button>
            ))}
          </div>

          {audienceMode === "existing" ? (
            audiences.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No contact lists yet. Paste contacts here, or import a sheet from{" "}
                <Link href="/contacts" className="text-brand-500 underline">
                  Contacts
                </Link>
                .
              </p>
            ) : (
              <select
                value={datasetId}
                onChange={(event) => setDatasetId(event.target.value)}
                className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                <option value="">Choose a contact list…</option>
                {audiences.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.row_count.toLocaleString("en-IN")} rows
                  </option>
                ))}
              </select>
            )
          ) : (
            <>
              <textarea
                value={contactSource}
                onChange={(event) => setContactSource(event.target.value)}
                placeholder={"Paste phone numbers or email addresses here\n+91 98765 43210\nbuyer@example.com"}
                className="h-28 w-full resize-none rounded-xl border border-gray-300 bg-transparent px-4 py-3 font-mono text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
              />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <label className="cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  Upload CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFile}
                    className="hidden"
                  />
                </label>
                <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <CheckCircleIcon className="h-5 w-5 text-success-500" />
                  {contacts.length} unique contacts detected
                </span>
              </div>
            </>
          )}

          <label className="mt-5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Approved WhatsApp template <span className="text-gray-400">(optional)</span>
            <input
              type="text"
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder="whitefield_launch_v1"
              className="mt-2 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
            />
            <span className="mt-1.5 block text-xs text-gray-500 dark:text-gray-400">
              Meta only allows free-form messages to people who wrote to you in the last
              24 hours. To reach a cold list, name an approved template from{" "}
              <Link href="/whatsapp-templates" className="text-brand-500 underline">
                templates
              </Link>
              .
            </span>
          </label>
        </section>

        <section className="col-span-12 overflow-hidden rounded-2xl border border-gray-200 bg-white lg:col-span-7 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white/90">
                Recent campaigns
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Live counts from the send record.
              </p>
            </div>
            <Link
              href="/outreach"
              className="text-sm font-medium text-brand-500 hover:text-brand-600"
            >
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/[0.02] dark:text-gray-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Campaign</th>
                  <th className="px-5 py-3 font-medium">Audience</th>
                  <th className="px-5 py-3 font-medium">Sent</th>
                  <th className="px-5 py-3 font-medium">Replies</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {recent.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-gray-500">
                      No campaigns yet. Write a brief above to create your first one.
                    </td>
                  </tr>
                ) : (
                  recent.map((campaign) => (
                    <tr key={campaign.id}>
                      <td className="whitespace-nowrap px-5 py-4 font-medium text-gray-800 dark:text-white/90">
                        {campaign.name}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-gray-500 dark:text-gray-400">
                        {campaign.total_recipients.toLocaleString("en-IN")}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-gray-500 dark:text-gray-400">
                        {campaign.sent_count.toLocaleString("en-IN")}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-gray-500 dark:text-gray-400">
                        {campaign.replied_count.toLocaleString("en-IN")}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            STATUS_TONE[campaign.status] ?? STATUS_TONE.draft
                          }`}
                        >
                          {campaign.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {launched ? (
        <div className="rounded-2xl border border-success-200 bg-success-50 p-5 dark:border-success-500/30 dark:bg-success-500/10">
          <p className="font-medium text-gray-900 dark:text-white/90">
            “{launched.name}” created as a draft
          </p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {launched.queued.toLocaleString("en-IN")} recipients queued
            {launched.skipped > 0
              ? `, ${launched.skipped.toLocaleString("en-IN")} skipped`
              : ""}
            .{" "}
            {launched.cold_capable
              ? "It uses an approved template, so it can reach people who have never written in."
              : "It has no template, so it will only reach contacts who messaged you in the last 24 hours."}
          </p>
          {Object.keys(launched.skipped_reasons).length > 0 ? (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Skipped:{" "}
              {Object.entries(launched.skipped_reasons)
                .map(([reason, count]) => `${reason.replaceAll("_", " ")} (${count})`)
                .join(", ")}
            </p>
          ) : null}
          <Link
            href="/outreach"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            Review and start it in Outreach
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-brand-500/20 dark:bg-brand-500/10">
          <div>
            <p className="font-medium text-gray-900 dark:text-white/90">
              Ready to create this campaign?
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {!canSend
                ? `${channel} cannot be launched — only WhatsApp is connected.`
                : !message
                  ? "Generate a message to continue."
                  : !audienceReady
                    ? "Choose a contact list or paste contacts to continue."
                    : audienceMode === "existing"
                      ? "It will be created as a draft you review in Outreach."
                      : `${contacts.length} contacts will become a new list, then a draft campaign.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onLaunch()}
            disabled={launching || !canSend || !message || !audienceReady}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <PaperPlaneIcon className="h-5 w-5" />
            {launching ? "Creating…" : "Create campaign"}
          </button>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-theme-lg dark:bg-white dark:text-gray-900"
        >
          {notice}
        </div>
      )}
    </div>
  );
}
