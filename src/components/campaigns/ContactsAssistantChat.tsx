"use client";

import { FormEvent, useEffect, useState } from "react";
import Badge from "@/components/ui/badge/Badge";
import { ApiError } from "@/lib/api";
import {
  chatContactsAssistant,
  type ContactsAssistantChatMessage,
} from "@/lib/contactIntelligence";

const SESSION_KEY = "bcrm.contactsAssistant.sessionId";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "anonymous";
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `sess-${Date.now()}`;
  window.localStorage.setItem(SESSION_KEY, created);
  return created;
}

export default function ContactsAssistantChat() {
  const [sessionId, setSessionId] = useState("anonymous");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ContactsAssistantChatMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [memoryEnabled, setMemoryEnabled] = useState(false);

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    if (!text || asking) return;

    const history = messages.slice(-8);
    setMessages((current) => [...current, { role: "user", content: text }]);
    setQuestion("");
    setAsking(true);
    setError("");

    try {
      const result = await chatContactsAssistant({
        question: text,
        history,
        session_id: sessionId,
      });
      setMemoryEnabled(Boolean(result.memory_enabled));
      setMessages((current) => [
        ...current,
        { role: "assistant", content: result.answer },
      ]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Assistant failed.");
    } finally {
      setAsking(false);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-brand-500">Contacts AI</p>
          <h2 className="font-semibold text-gray-900 dark:text-white/90">
            Ask about contacts, leads, buyers, and imported tables
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Read-only LangGraph assistant with local Mem0 memory. Uses
            schema/metadata/search tools only — no create, update, or delete.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge color="info" size="sm">
            Read-only · Contacts scope
          </Badge>
          <Badge color={memoryEnabled ? "success" : "light"} size="sm">
            {memoryEnabled ? "Mem0 on" : "Mem0 idle"}
          </Badge>
        </div>
      </div>

      <div className="mb-4 max-h-64 space-y-3 overflow-y-auto rounded-xl bg-gray-50 p-4 dark:bg-white/[0.02]">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500">
            Try: “How many contacts have phones?”, “List imported tables”, or “Find lead
            named Rahul”. Follow-ups reuse Mem0 session memory.
          </p>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`rounded-lg px-3 py-2 text-sm ${
                message.role === "user"
                  ? "ml-8 bg-brand-500 text-white"
                  : "mr-8 bg-white text-gray-800 dark:bg-gray-900 dark:text-gray-200"
              }`}
            >
              {message.content}
            </div>
          ))
        )}
      </div>

      <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask a Contacts page question…"
          className="h-11 flex-1 rounded-lg border border-gray-300 bg-transparent px-4 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
        />
        <button
          type="submit"
          disabled={asking || !question.trim()}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {asking ? "Thinking…" : "Ask"}
        </button>
      </form>
      {error ? <p className="mt-2 text-sm text-error-500">{error}</p> : null}
    </section>
  );
}
