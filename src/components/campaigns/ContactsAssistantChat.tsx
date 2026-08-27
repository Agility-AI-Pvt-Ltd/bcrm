"use client";

import { FormEvent, Fragment, useEffect, useState, type ReactNode } from "react";
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

function normalizeAssistantText(text: string): string {
  return text
    .replace(/\s+(\d+)\.\s+/g, "\n$1. ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderAssistantMarkdown(text: string): ReactNode {
  const normalized = normalizeAssistantText(text);
  const lines = normalized.split("\n");

  return lines.map((line, lineIndex) => (
    <Fragment key={`line-${lineIndex}`}>
      {lineIndex > 0 ? <br /> : null}
      {renderInlineMarkdown(line)}
    </Fragment>
  ));
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).filter(Boolean);
  return tokens.map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**") && token.length > 4) {
      return (
        <strong key={index} className="font-semibold text-gray-950 dark:text-white">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith("*") && token.endsWith("*") && token.length > 2) {
      return (
        <em key={index} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    if (token.startsWith("`") && token.endsWith("`") && token.length > 2) {
      return (
        <code
          key={index}
          className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[0.8em] dark:bg-white/10"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={index}>{token}</Fragment>;
  });
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
    <section className="ai-shine-panel overflow-hidden">
      <div className="rounded-[0.92rem] bg-white p-4 dark:bg-gray-dark">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-brand-500">Contacts AI</p>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white/90">
              Ask about contacts, leads, buyers
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Read-only · local Mem0 · schema & search tools
            </p>
          </div>
          <Badge color={memoryEnabled ? "success" : "light"} size="sm">
            {memoryEnabled ? "Mem0" : "Idle"}
          </Badge>
        </div>

        <div className="mb-3 max-h-64 min-h-44 space-y-2 overflow-y-auto rounded-lg bg-gray-50 p-3 dark:bg-white/[0.02]">
          {messages.length === 0 ? (
            <p className="text-xs text-gray-500">
              e.g. “How many contacts?”, “List imported tables”
            </p>
          ) : (
            messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-md px-2.5 py-1.5 text-xs leading-relaxed ${
                  message.role === "user"
                    ? "ml-4 bg-brand-500 text-white"
                    : "mr-4 bg-white text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                }`}
              >
                {message.role === "assistant"
                  ? renderAssistantMarkdown(message.content)
                  : message.content}
              </div>
            ))
          )}
        </div>

        <form onSubmit={(event) => void onSubmit(event)} className="flex gap-2">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask a question…"
            className="h-9 min-w-0 flex-1 rounded-lg border border-gray-300 bg-transparent px-3 text-xs outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
          />
          <button
            type="submit"
            disabled={asking || !question.trim()}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-brand-500 px-3 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {asking ? "…" : "Ask"}
          </button>
        </form>
        {error ? <p className="mt-2 text-xs text-error-500">{error}</p> : null}
      </div>
    </section>
  );
}
