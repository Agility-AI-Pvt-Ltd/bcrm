"use client";

import { useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

const contacts = [
  { name: "Kaiya George", role: "Project Manager", time: "15 mins", active: true },
  { name: "Lindsey Curtis", role: "Designer", time: "30 mins" },
  { name: "Zain Geidt", role: "Content Writer", time: "45 mins" },
  { name: "Carla George", role: "Front-end Developer", time: "2 days" },
  { name: "Abram Schleifer", role: "Digital Marketer", time: "1 hour" },
  { name: "Lincoln Donin", role: "Product Designer", time: "3 days" },
];

const messages = [
  {
    from: "them",
    text: "I want to make an appointment tomorrow from 2:00 to 5:00pm?",
    time: "15 mins",
  },
  {
    from: "me",
    text: "Sure, I can schedule that. Would you like an in-person visit or a video call?",
    time: "12 mins",
  },
  {
    from: "them",
    text: "In-person works better. Please send the property address too.",
    time: "10 mins",
  },
];

export default function ChatPage() {
  const [activeContact, setActiveContact] = useState(contacts[0].name);
  const [draft, setDraft] = useState("");

  return (
    <div>
      <PageBreadcrumb pageTitle="Chat" />
      <div className="grid h-[70vh] grid-cols-12 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <aside className="col-span-12 border-b border-gray-200 md:col-span-4 md:border-b-0 md:border-r dark:border-gray-800">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h3 className="font-semibold text-gray-800 dark:text-white/90">Chats</h3>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto custom-scrollbar">
            {contacts.map((contact) => (
              <li key={contact.name}>
                <button
                  type="button"
                  onClick={() => setActiveContact(contact.name)}
                  className={`flex w-full items-start justify-between gap-3 px-5 py-4 text-left transition hover:bg-gray-50 dark:hover:bg-white/[0.03] ${
                    activeContact === contact.name
                      ? "bg-brand-50 dark:bg-brand-500/10"
                      : ""
                  }`}
                >
                  <span>
                    <span className="block font-medium text-gray-800 dark:text-white/90">
                      {contact.name}
                    </span>
                    <span className="mt-1 block text-sm text-gray-500 dark:text-gray-400">
                      {contact.role}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-gray-400">{contact.time}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="col-span-12 flex flex-col md:col-span-8">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h3 className="font-semibold text-gray-800 dark:text-white/90">
              {activeContact}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Online</p>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 custom-scrollbar">
            {messages.map((message, index) => (
              <div
                key={`${message.text}-${index}`}
                className={`flex ${message.from === "me" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                    message.from === "me"
                      ? "bg-brand-500 text-white"
                      : "bg-gray-100 text-gray-800 dark:bg-white/[0.05] dark:text-white/90"
                  }`}
                >
                  <p>{message.text}</p>
                  <p
                    className={`mt-2 text-xs ${
                      message.from === "me" ? "text-white/70" : "text-gray-400"
                    }`}
                  >
                    {message.time}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <form
            className="flex gap-3 border-t border-gray-100 p-4 dark:border-gray-800"
            onSubmit={(event) => {
              event.preventDefault();
              setDraft("");
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type a message"
              className="h-11 flex-1 rounded-lg border border-gray-300 bg-transparent px-4 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
            />
            <button
              type="submit"
              className="rounded-lg bg-brand-500 px-5 text-sm font-medium text-white hover:bg-brand-600"
            >
              Send
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
