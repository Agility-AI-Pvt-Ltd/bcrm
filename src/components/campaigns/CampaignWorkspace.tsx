"use client";

import { ChangeEvent, useMemo, useState } from "react";
import {
  CheckCircleIcon,
  CopyIcon,
  GroupIcon,
  PaperPlaneIcon,
  ShootingStarIcon,
} from "@/icons";

const sampleCampaigns = [
  {
    name: "Whitefield 3BHK Launch",
    audience: "248 buyers",
    channel: "WhatsApp",
    status: "Draft",
  },
  {
    name: "Weekend Open House",
    audience: "132 leads",
    channel: "SMS",
    status: "Completed",
  },
  {
    name: "Investor Follow-up",
    audience: "86 investors",
    channel: "WhatsApp",
    status: "Scheduled",
  },
];

function parseContacts(value: string) {
  const matches =
    value.match(
      /(?:\+?\d[\d\s()-]{7,}\d)|(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi,
    ) ?? [];

  return Array.from(
    new Set(matches.map((contact) => contact.replace(/[()\s-]/g, "").toLowerCase())),
  );
}

export default function CampaignWorkspace() {
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState("Professional");
  const [channel, setChannel] = useState("WhatsApp");
  const [message, setMessage] = useState("");
  const [contactSource, setContactSource] = useState("");
  const [notice, setNotice] = useState("");

  const contacts = useMemo(() => parseContacts(contactSource), [contactSource]);

  const generateCampaign = () => {
    const brief = prompt.trim();
    if (!brief) {
      setNotice("Describe the property before generating.");
      return;
    }

    setMessage(
      `🏡 RealtyReach Property Alert!\n\n${brief}\n\nReply YES to get pricing and book a viewing.\n\n— RealtyReach Team`,
    );
    setNotice("Campaign copy generated successfully.");
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setNotice("Please select a CSV file.");
      event.target.value = "";
      return;
    }

    setContactSource(await file.text());
    setNotice(`${file.name} imported successfully.`);
  };

  const copyMessage = async () => {
    if (!message) return;
    await navigator.clipboard.writeText(message);
    setNotice("Message copied to clipboard.");
  };

  const prepareCampaign = () => {
    if (!message || contacts.length === 0) return;
    setNotice(
      `Campaign drafted for ${contacts.length} contacts. Ready to connect messaging provider.`,
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="mb-1 text-sm font-semibold text-brand-500">Campaign Studio</p>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white/90">
          Outreach Builder
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Generate campaign dispatches, import client lists, and launch campaigns.
        </p>
      </div>

      {/* Grid: Layout split in 2 columns for clean, minimal visuals */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Column 1: Generator and Preview (Width 7/12) */}
        <div className="lg:col-span-7 space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <h2 className="font-bold text-sm text-gray-900 dark:text-white/90 flex items-center gap-1.5 mb-3">
              <ShootingStarIcon className="h-4 w-4 text-brand-500" />
              Generate Message
            </h2>
            
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Example: 3BHK flat in Whitefield starting at ₹1.2 Cr, close to metro. Invite buyers for a weekend open house."
              className="h-28 w-full resize-none rounded-xl border border-gray-200 bg-transparent px-3 py-2 text-xs text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
            />

            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-gray-500">
                Tone
                <select
                  value={tone}
                  onChange={(event) => setTone(event.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                >
                  <option>Professional</option>
                  <option>Friendly</option>
                  <option>Luxury</option>
                  <option>Urgent</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-gray-500">
                Channel
                <select
                  value={channel}
                  onChange={(event) => setChannel(event.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                >
                  <option>WhatsApp</option>
                  <option>SMS</option>
                  <option>Email</option>
                </select>
              </label>
            </div>

            <button
              onClick={generateCampaign}
              className="mt-4 w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-xs font-bold text-white shadow-theme-xs hover:bg-brand-600 transition"
            >
              <ShootingStarIcon className="h-4 w-4" />
              Generate copy
            </button>
          </section>

          {/* Message Preview */}
          {message && (
            <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-bold text-sm text-gray-900 dark:text-white/90">
                  Message Preview
                </h2>
                <button
                  onClick={copyMessage}
                  className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/[0.05]"
                  title="Copy to clipboard"
                >
                  <CopyIcon className="h-4 w-4" />
                </button>
              </div>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="h-32 w-full resize-none rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-800 outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
            </section>
          )}
        </div>

        {/* Column 2: Import Contacts & Recent campaigns (Width 5/12) */}
        <div className="lg:col-span-5 space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <h2 className="font-bold text-sm text-gray-900 dark:text-white/90 flex items-center gap-1.5 mb-3">
              <GroupIcon className="h-4 w-4 text-brand-500" />
              Import Targets
            </h2>

            <textarea
              value={contactSource}
              onChange={(event) => setContactSource(event.target.value)}
              placeholder="Paste phone numbers or email addresses here..."
              className="h-24 w-full resize-none rounded-xl border border-gray-200 bg-transparent px-3 py-2 font-mono text-xs text-gray-800 outline-none dark:border-gray-700 dark:text-white/90"
            />
            
            <div className="mt-3 flex items-center justify-between">
              <label className="cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                Upload CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFile}
                  className="hidden"
                />
              </label>
              <span className="flex items-center gap-1 text-xs text-gray-500 font-semibold">
                <CheckCircleIcon className="h-4 w-4 text-success-500" />
                {contacts.length} targets detected
              </span>
            </div>
          </section>

          {/* Action Trigger Banner */}
          <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4 dark:border-brand-500/20 dark:bg-brand-500/10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-xs text-gray-900 dark:text-white/90">
                Launch Campaign
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {message
                  ? `${contacts.length} targets selected for a ${channel} campaign.`
                  : "Generate copy and import targets to proceed."}
              </p>
            </div>
            <button
              onClick={prepareCampaign}
              disabled={!message || contacts.length === 0}
              className="inline-flex items-center justify-center gap-1 bg-brand-500 px-4 py-2.5 rounded-lg text-xs font-bold text-white transition hover:bg-brand-600 disabled:opacity-40 cursor-pointer shadow-theme-xs disabled:cursor-not-allowed"
            >
              <PaperPlaneIcon className="h-4 w-4" />
              Prepare
            </button>
          </div>
        </div>

      </div>

      {/* Toast popup */}
      {notice && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 rounded-xl bg-gray-900 px-4 py-2.5 text-xs text-white shadow-theme-lg"
        >
          {notice}
        </div>
      )}
    </div>
  );
}
