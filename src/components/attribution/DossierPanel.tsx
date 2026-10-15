"use client";

import { useEffect, useState } from "react";
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
export default function DossierPanel({
  phone,
  onClose,
}: {
  phone: string;
  onClose: () => void;
}) {
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const look = async () => {
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

  useEffect(() => {
    void look();
    // The drawer owns one buyer for its lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

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
    <div className="fixed inset-0 z-50 bg-gray-900/30" role="presentation" onClick={onClose}>
      <section
        className="absolute inset-y-0 right-0 w-full max-w-2xl overflow-y-auto border-l border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-800 dark:bg-gray-950 lg:p-7"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dossier-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-500">
              Commission evidence
            </p>
            <h3 id="dossier-title" className="mt-1 text-xl font-semibold text-gray-900 dark:text-white/95">
              Buyer dossier
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{phone}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:border-brand-400 hover:text-brand-600 dark:border-gray-700 dark:text-gray-300" aria-label="Close dossier">
            Close
          </button>
        </div>

        {loading ? <p className="mt-8 text-sm text-gray-500">Building dossier from persisted records…</p> : null}
        {error ? <p className="mt-4 rounded-lg bg-error-50 px-3 py-2 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">{error}</p> : null}

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

          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <h4 className="text-sm font-medium text-gray-800 dark:text-white/90">Claim history</h4>
            {dossier.claims.length ? (
              <ul className="mt-2 space-y-2">
                {dossier.claims.map((claim, index) => (
                  <li key={`${String(claim.registration_no || "claim")}-${index}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-gray-700 dark:text-gray-300">{String(claim.registration_no || "Unnumbered claim")} · {String(claim.project_name || "Project unavailable")}</span>
                    <span className="text-xs text-gray-500">{String(claim.status || "status unavailable")}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-gray-500">No additional claim records are available.</p>}
          </div>

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
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700">No inbound conversation evidence is available for this buyer.</div>
          )}

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
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700">No site-visit records are available for this buyer.</div>
          )}

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
    </div>
  );
}
