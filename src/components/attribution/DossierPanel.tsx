"use client";

import { useState } from "react";
import { failureText } from "@/lib/api";
import {
  formatDay,
  formatStamp,
  getDossier,
  PROOF_CHIP,
  shortHash,
  type Dossier,
} from "@/lib/attribution";

/**
 * The page a channel partner sends a developer when the commission is disputed.
 *
 * Read top to bottom it is the argument in order: I registered them on this date,
 * they were my lead before that, and I took them to the site. What cannot be shown
 * is listed at the end rather than left out — a dossier that overstates its case is
 * worth less than one that does not, because the developer only has to find a single
 * soft claim to dismiss the rest.
 */
export default function DossierPanel() {
  const [phone, setPhone] = useState("");
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const look = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    setError("");
    try {
      setDossier(await getDossier(phone.trim()));
    } catch (err) {
      setDossier(null);
      setError(failureText(err, "Could not build that dossier."));
    } finally {
      setLoading(false);
    }
  };

  const copySummary = async () => {
    if (!dossier) return;
    try {
      await navigator.clipboard.writeText(dossier.summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Could not copy — select the text and copy it by hand.");
    }
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
        Commission dossier
      </h3>
      <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
        Everything on record for one buyer: the registration and its timestamp, the
        first time they wrote in, and every site visit with what can be proved about
        it.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void look();
          }}
          placeholder="Buyer's phone number"
          inputMode="tel"
          className="h-10 w-56 rounded-lg border border-gray-300 bg-transparent px-3 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
        />
        <button
          type="button"
          disabled={loading}
          onClick={() => void look()}
          className="h-10 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {loading ? "Building…" : "Build dossier"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}

      {dossier ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <p className="text-sm text-gray-800 dark:text-white/90">{dossier.summary}</p>
            <button
              type="button"
              onClick={() => void copySummary()}
              className="mt-2 text-xs text-brand-500 underline underline-offset-2"
            >
              {copied ? "Copied" : "Copy this paragraph"}
            </button>
          </div>

          {!dossier.chain.intact ? (
            <p className="rounded-xl bg-error-50 px-3 py-2.5 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-500">
              The registration history does not verify. Do not send this until it has
              been checked — {dossier.chain.breaks[0]?.reason}
            </p>
          ) : (
            <p className="rounded-xl bg-success-50 px-3 py-2.5 text-sm text-success-700 dark:bg-success-500/15 dark:text-success-500">
              Registration history verifies — {dossier.chain.checked} records, unbroken.
            </p>
          )}

          {dossier.registration ? (
            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <h4 className="text-sm font-medium text-gray-800 dark:text-white/90">
                Registration {String(dossier.registration.registration_no)}
              </h4>
              <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-gray-500">Registered</dt>
                  <dd className="text-gray-800 dark:text-white/90">
                    {formatStamp(String(dossier.registration.registered_at || ""))}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Project</dt>
                  <dd className="text-gray-800 dark:text-white/90">
                    {String(dossier.registration.project_name || "—")}
                    {dossier.registration.developer_name
                      ? ` · ${dossier.registration.developer_name}`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Holds until</dt>
                  <dd className="text-gray-800 dark:text-white/90">
                    {formatDay(String(dossier.registration.valid_until || ""))} (
                    {String(dossier.registration.expiry_label || "")})
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Record hash</dt>
                  <dd className="font-mono text-xs text-gray-600 dark:text-gray-300">
                    {shortHash(String(dossier.registration.content_hash || ""))} · chain{" "}
                    {shortHash(String(dossier.registration.chain_hash || ""))}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}

          {dossier.first_contact ? (
            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <h4 className="text-sm font-medium text-gray-800 dark:text-white/90">
                First contact
              </h4>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {formatStamp(dossier.first_contact.at)} over{" "}
                {dossier.first_contact.channel}
              </p>
              {dossier.first_contact.text ? (
                <p className="mt-1 text-sm italic text-gray-500 dark:text-gray-400">
                  “{dossier.first_contact.text}”
                </p>
              ) : null}
              {dossier.first_contact.provider_message_id ? (
                <p className="mt-1 font-mono text-xs text-gray-500 dark:text-gray-400">
                  {/* WhatsApp's own id — a reference the developer can take to Meta. */}
                  {dossier.first_contact.provider_message_id}
                </p>
              ) : null}
            </div>
          ) : null}

          {dossier.visits.length ? (
            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <h4 className="text-sm font-medium text-gray-800 dark:text-white/90">
                Site visits
              </h4>
              <ul className="mt-2 space-y-3">
                {dossier.visits.map((visit) => (
                  <li
                    key={visit.visit_id}
                    className="rounded-lg border border-gray-100 p-3 dark:border-gray-800/60"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm text-gray-800 dark:text-white/90">
                        {formatStamp(visit.scheduled_at)}
                        {visit.property_title ? ` · ${visit.property_title}` : ""}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          PROOF_CHIP[visit.proof.grade] || PROOF_CHIP.none
                        }`}
                      >
                        {visit.proof.grade}
                      </span>
                    </div>
                    {visit.proof.reasons.map((reason) => (
                      <p key={reason} className="mt-1 text-xs text-success-700">
                        + {reason}
                      </p>
                    ))}
                    {visit.proof.gaps.map((gap) => (
                      <p key={gap} className="mt-1 text-xs text-warning-600">
                        − {gap}
                      </p>
                    ))}
                    {visit.proof.customer_words ? (
                      <p className="mt-1 text-xs italic text-gray-500 dark:text-gray-400">
                        “{visit.proof.customer_words}”
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {dossier.gaps.length ? (
            <div className="rounded-xl border border-warning-200 bg-warning-50 p-4 dark:border-warning-500/30 dark:bg-warning-500/10">
              <h4 className="text-sm font-medium text-warning-700 dark:text-warning-500">
                What this cannot show
              </h4>
              <ul className="mt-1 space-y-0.5">
                {dossier.gaps.map((gap) => (
                  <li key={gap} className="text-sm text-warning-700 dark:text-warning-500">
                    {gap}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
