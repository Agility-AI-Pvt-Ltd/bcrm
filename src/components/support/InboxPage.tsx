"use client";

import Link from "next/link";
import { useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

const emails = [
  {
    sender: "Codescandy",
    subject: 'Contact For "Website Design"',
    preview: "Hello Dear Alexander, Lorem ipsum dolor sit amet...",
    time: "2:45 PM",
    unread: true,
  },
  {
    sender: "Kaiya George",
    subject: "Site visit confirmation",
    preview: "Please confirm the Whitefield apartment viewing slot.",
    time: "1:12 PM",
    unread: true,
  },
  {
    sender: "Lindsey Curtis",
    subject: "Campaign assets ready",
    preview: "I uploaded the latest brochure and floor-plan images.",
    time: "11:08 AM",
    unread: false,
  },
  {
    sender: "Support Bot",
    subject: "Lead follow-up reminder",
    preview: "3 leads replied YES and are waiting for pricing details.",
    time: "Yesterday",
    unread: false,
  },
];

export default function InboxPage() {
  const [selected, setSelected] = useState(0);

  return (
    <div>
      <PageBreadcrumb pageTitle="Inbox" />
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-white/90">Inbox</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              4 of 120 conversations
            </p>
          </div>
          <Link
            href="/inbox-details"
            className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            Compose
          </Link>
        </div>

        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {emails.map((email, index) => (
            <li key={email.subject}>
              <button
                type="button"
                onClick={() => setSelected(index)}
                className={`flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition hover:bg-gray-50 dark:hover:bg-white/[0.03] ${
                  selected === index ? "bg-brand-50 dark:bg-brand-500/10" : ""
                }`}
              >
                <span className="min-w-0">
                  <span className="mb-1 flex items-center gap-2">
                    <span
                      className={`font-medium ${
                        email.unread
                          ? "text-gray-900 dark:text-white"
                          : "text-gray-700 dark:text-white/80"
                      }`}
                    >
                      {email.sender}
                    </span>
                    {email.unread && (
                      <span className="h-2 w-2 rounded-full bg-brand-500" />
                    )}
                  </span>
                  <span className="block truncate text-sm font-medium text-gray-800 dark:text-white/90">
                    {email.subject}
                  </span>
                  <span className="mt-1 block truncate text-sm text-gray-500 dark:text-gray-400">
                    {email.preview}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-gray-400">{email.time}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
