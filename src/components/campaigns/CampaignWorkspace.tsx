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
      setNotice("Describe the property or campaign before generating.");
      return;
    }

    setMessage(
      `🏡 A property worth discovering!\n\n${brief}\n\nReply YES to receive pricing, floor plans, and available viewing slots. Our property advisor will get in touch shortly.\n\n— Your Real Estate Team`,
    );
    setNotice(`${tone} ${channel} campaign copy generated locally.`);
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setNotice("Please export your Excel or Google Sheet as a CSV file.");
      event.target.value = "";
      return;
    }

    setContactSource(await file.text());
    setNotice(`${file.name} imported. Review the detected contacts before sending.`);
  };

  const copyMessage = async () => {
    if (!message) return;
    await navigator.clipboard.writeText(message);
    setNotice("Campaign message copied.");
  };

  const prepareCampaign = () => {
    if (!message || contacts.length === 0) return;
    setNotice(
      `Draft prepared for ${contacts.length} contacts. Connect a messaging provider before it can be sent.`,
    );
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
            Generate outreach copy, import contacts, and prepare a real-estate
            campaign from one workspace.
          </p>
        </div>
        <span className="w-fit rounded-full bg-warning-50 px-3 py-1.5 text-xs font-medium text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
          Prototype mode · no messages are sent
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          ["1,284", "Contacts", "Ready for outreach"],
          ["12", "Active campaigns", "3 scheduled today"],
          ["18.6%", "Reply rate", "Up 4.2% this month"],
        ].map(([value, label, detail]) => (
          <div
            key={label}
            className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
          >
            <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white/90">
              {value}
            </p>
            <p className="mt-1 text-xs text-success-600 dark:text-success-400">
              {detail}
            </p>
          </div>
        ))}
      </div>

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
            className="h-36 w-full resize-none rounded-xl border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:text-white/90"
          />

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Tone
              <select
                value={tone}
                onChange={(event) => setTone(event.target.value)}
                className="mt-2 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                <option>Professional</option>
                <option>Friendly</option>
                <option>Luxury</option>
                <option>Urgent</option>
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Channel
              <select
                value={channel}
                onChange={(event) => setChannel(event.target.value)}
                className="mt-2 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                <option>WhatsApp</option>
                <option>SMS</option>
                <option>Email</option>
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={generateCampaign}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 sm:w-auto"
          >
            <ShootingStarIcon className="h-5 w-5" />
            Generate campaign
          </button>
        </section>

        <section className="col-span-12 rounded-2xl border border-gray-200 bg-white p-5 lg:col-span-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white/90">
                Message preview
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Edit the generated copy before using it.
              </p>
            </div>
            <button
              type="button"
              onClick={copyMessage}
              disabled={!message}
              aria-label="Copy campaign message"
              className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:hover:bg-white/[0.05]"
            >
              <CopyIcon className="h-5 w-5" />
            </button>
          </div>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Your generated campaign message will appear here."
            className="h-[286px] w-full resize-none rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          />
          <div className="mt-3 flex justify-between text-xs text-gray-400">
            <span>{message ? `${message.length} characters` : "Waiting for a brief"}</span>
            <span>{channel} preview</span>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-12 rounded-2xl border border-gray-200 bg-white p-5 lg:col-span-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-50 text-success-600 dark:bg-success-500/10">
              <GroupIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white/90">
                Import contacts
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Paste a spreadsheet column or upload a CSV.
              </p>
            </div>
          </div>

          <textarea
            value={contactSource}
            onChange={(event) => setContactSource(event.target.value)}
            placeholder={"Paste phone numbers or email addresses here\n+91 98765 43210\nbuyer@example.com"}
            className="h-32 w-full resize-none rounded-xl border border-gray-300 bg-transparent px-4 py-3 font-mono text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
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
        </section>

        <section className="col-span-12 overflow-hidden rounded-2xl border border-gray-200 bg-white lg:col-span-7 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white/90">
                Recent campaigns
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Monitor property outreach from one place.
              </p>
            </div>
            <button className="text-sm font-medium text-brand-500 hover:text-brand-600">
              View all
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/[0.02] dark:text-gray-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Campaign</th>
                  <th className="px-5 py-3 font-medium">Audience</th>
                  <th className="px-5 py-3 font-medium">Channel</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {sampleCampaigns.map((campaign) => (
                  <tr key={campaign.name}>
                    <td className="whitespace-nowrap px-5 py-4 font-medium text-gray-800 dark:text-white/90">
                      {campaign.name}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-gray-500 dark:text-gray-400">
                      {campaign.audience}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-gray-500 dark:text-gray-400">
                      {campaign.channel}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                        {campaign.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-brand-500/20 dark:bg-brand-500/10">
        <div>
          <p className="font-medium text-gray-900 dark:text-white/90">
            Ready to prepare this campaign?
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {message
              ? `${contacts.length} contacts selected for a ${channel} draft.`
              : "Generate a message and add contacts to continue."}
          </p>
        </div>
        <button
          type="button"
          onClick={prepareCampaign}
          disabled={!message || contacts.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PaperPlaneIcon className="h-5 w-5" />
          Prepare campaign
        </button>
      </div>

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
