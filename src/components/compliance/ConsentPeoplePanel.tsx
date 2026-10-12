"use client";

/**
 * The people behind the consent counts.
 *
 * "Asked us to stop: 4" is not an auditable answer. The question that actually
 * arrives is about one named person — *did you have permission to message Ravi,
 * and what exactly did you tell him?* — and until this panel existed the only
 * way to answer it was a database prompt.
 *
 * So each row opens to the notice as it was sent, word for word. That wording is
 * stored verbatim precisely so it can be shown years later; a screen that keeps
 * it hidden makes the storage pointless.
 *
 * Phone numbers are the most sensitive field on this page, so the list is
 * paginated and searched server-side rather than pulled down whole.
 */

import { useCallback, useEffect, useState } from "react";
import { failureText } from "@/lib/api";
import {
  getConsentPeople,
  shortDate,
  type ConsentPerson,
  type ConsentState,
} from "@/lib/compliance";

const PAGE = 25;

const TABS: Array<{ key: ConsentState; label: string }> = [
  { key: "all", label: "Everyone on file" },
  { key: "told", label: "Told, still standing" },
  { key: "withdrawn", label: "Asked us to stop" },
];

const BASIS_LABEL: Record<string, string> = {
  enquiry: "They enquired with you",
  consent: "They agreed to be contacted",
  contract: "You have a contract with them",
};

export default function ConsentPeoplePanel({
  onLookup,
}: {
  /** Drops a number into the lookup box above, so the two panels work together. */
  onLookup: (phone: string) => void;
}) {
  const [state, setState] = useState<ConsentState>("all");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [people, setPeople] = useState<ConsentPerson[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await getConsentPeople({ state, q: search || undefined, limit: PAGE, offset });
      setPeople(page.people);
      setTotal(page.total);
      setError("");
    } catch (err) {
      setError(failureText(err, "Could not load the people on file."));
    } finally {
      setLoading(false);
    }
  }, [state, search, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const choose = (next: ConsentState) => {
    setState(next);
    setOffset(0);
    setOpen(null);
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(query.trim());
    setOffset(0);
  };

  return (
    <div className="mt-5 border-t border-gray-200 pt-5 dark:border-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-gray-800 dark:text-white/90">
          Who these numbers are
        </p>
        <form onSubmit={submit} className="flex items-center gap-2">
          <input
            className="h-9 w-48 rounded-lg border border-gray-300 bg-transparent px-3 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
            placeholder="Name or number"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            type="submit"
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm font-medium dark:border-gray-700 dark:text-white/90"
          >
            Search
          </button>
          {search ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSearch("");
                setOffset(0);
              }}
              className="text-sm text-brand-500 underline underline-offset-2"
            >
              Clear
            </button>
          ) : null}
        </form>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => choose(tab.key)}
            className={`h-8 rounded-full px-3 text-xs font-medium ${
              state === tab.key
                ? "bg-brand-500 text-white"
                : "border border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}

      {people.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          {loading
            ? "Loading…"
            : search
              ? "Nobody on file matches that."
              : state === "withdrawn"
                ? "Nobody has asked you to stop."
                : "No consent records yet. One is written the first time each customer is told."}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-800/60">
          {people.map((person) => {
            const expanded = open === person.id;
            return (
              <li key={person.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : person.id)}
                    aria-expanded={expanded}
                    className="min-w-0 text-left"
                  >
                    <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                      {person.name || person.phone || "Unnamed"}
                      {person.name && person.phone ? (
                        <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">
                          {person.phone}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {person.withdrawn_at
                        ? `Asked us to stop on ${shortDate(person.withdrawn_at)}`
                        : person.notice_sent_at
                          ? `Told on ${shortDate(person.notice_sent_at)}`
                          : "On file, not yet told"}
                      {" · "}
                      {person.channel === "call" ? "on a call" : "on WhatsApp"}
                      {" · "}
                      <span className="underline underline-offset-2">
                        {expanded ? "hide what they were told" : "see what they were told"}
                      </span>
                    </p>
                  </button>
                  <div className="flex items-center gap-2">
                    {person.withdrawn_at ? (
                      <span className="rounded-full bg-error-50 px-2.5 py-0.5 text-xs font-medium text-error-600 dark:bg-error-500/10 dark:text-error-500">
                        Stopped
                      </span>
                    ) : person.notice_sent_at ? (
                      <span className="rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-medium text-success-700 dark:bg-success-500/15 dark:text-success-500">
                        Told
                      </span>
                    ) : null}
                    {person.phone ? (
                      <button
                        type="button"
                        onClick={() => onLookup(person.phone as string)}
                        className="h-8 rounded-lg border border-gray-300 px-2.5 text-xs font-medium dark:border-gray-700 dark:text-white/90"
                      >
                        Look up
                      </button>
                    ) : null}
                  </div>
                </div>

                {expanded ? (
                  <div className="mt-3 space-y-2 rounded-xl bg-gray-50 p-3 dark:bg-white/[0.04]">
                    {person.notice_text ? (
                      <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">
                        {person.notice_text}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No notice was recorded for this person — the record exists because
                        they asked us to stop.
                      </p>
                    )}
                    <dl className="grid gap-2 text-xs text-gray-500 dark:text-gray-400 sm:grid-cols-2">
                      <div>
                        <dt className="uppercase">Why we may hold it</dt>
                        <dd className="mt-0.5 text-gray-700 dark:text-gray-200">
                          {BASIS_LABEL[person.basis] || person.basis}
                        </dd>
                      </div>
                      <div>
                        <dt className="uppercase">What we said it is for</dt>
                        <dd className="mt-0.5 text-gray-700 dark:text-gray-200">
                          {/* Stored as the sentence the customer was shown
                              ("responding to a property enquiry"), so it needs
                              no translating here. */}
                          {person.purposes.length ? person.purposes.join(", ") : "—"}
                        </dd>
                      </div>
                      {person.notice_version ? (
                        <div>
                          <dt className="uppercase">Wording version</dt>
                          <dd className="mt-0.5 text-gray-700 dark:text-gray-200">
                            {person.notice_version}
                          </dd>
                        </div>
                      ) : null}
                      {person.withdrawn_note ? (
                        <div>
                          <dt className="uppercase">Their words</dt>
                          <dd className="mt-0.5 text-gray-700 dark:text-gray-200">
                            “{person.withdrawn_note}”
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {total > PAGE ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-gray-500 dark:text-gray-400">
            {offset + 1}–{Math.min(offset + PAGE, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE))}
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm font-medium disabled:opacity-40 dark:border-gray-700 dark:text-white/90"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={offset + PAGE >= total}
              onClick={() => setOffset(offset + PAGE)}
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm font-medium disabled:opacity-40 dark:border-gray-700 dark:text-white/90"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
