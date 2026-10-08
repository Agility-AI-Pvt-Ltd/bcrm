"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { failureText } from "@/lib/api";
import {
  getOnboarding,
  STEP_CHIP,
  STEP_LABEL,
  type OnboardingReport,
} from "@/lib/reporting";

/**
 * Everything between this agency and sending its first message.
 *
 * The screen leads with **one** instruction, not a list — a list is how people stall.
 * The rest of the steps are there to be glanced at, with the ones waiting on Meta
 * marked as such: telling somebody to "submit a template" while one is already under
 * review is how a setup screen loses its credibility.
 *
 * Nothing is remembered. The checklist is recomputed from the database each time, so a
 * template Meta later rejected turns its own step back to not-done by itself.
 */
export default function GoLiveChecklist({ compact = false }: { compact?: boolean }) {
  const [report, setReport] = useState<OnboardingReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // Guarded against the component going away mid-request: this renders on pages the
    // user is passing through, and a setState after unmount is a console warning for
    // them and nothing for us.
    let alive = true;
    void (async () => {
      try {
        const next = await getOnboarding();
        if (alive) setReport(next);
      } catch (err) {
        if (alive) setError(failureText(err, "Could not check your setup."));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <p className="text-sm text-error-500">{error}</p>
      </section>
    );
  }
  if (!report) return null;
  // Nothing to nag a fully set-up agency about on a page they opened for something else.
  if (compact && report.live) return null;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            {report.live ? "You are live" : "Finish setting up"}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            {report.summary}
          </p>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {report.done} of {report.required} done
        </span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]">
        <div
          className={`h-full rounded-full ${report.live ? "bg-success-500" : "bg-brand-500"}`}
          style={{ width: `${report.percent}%` }}
        />
      </div>

      {report.next_step && !report.live ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-500/30 dark:bg-brand-500/10">
          <div>
            <p className="text-sm font-medium text-brand-700 dark:text-brand-400">
              {report.next_step.title}
            </p>
            <p className="text-xs text-brand-600 dark:text-brand-400">
              {report.next_step.detail || report.next_step.why}
            </p>
          </div>
          {report.next_step.action_path ? (
            <Link
              href={report.next_step.action_path}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              {report.next_step.action_label || "Open"}
            </Link>
          ) : null}
        </div>
      ) : null}

      <ul className="mt-4 space-y-2">
        {report.steps.map((step) => (
          <li
            key={step.key}
            className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-gray-200 px-3.5 py-2.5 dark:border-gray-800"
          >
            <div className="min-w-0">
              <p className="text-sm text-gray-800 dark:text-white/90">
                {step.title}
                {!step.required ? (
                  <span className="ml-2 text-xs text-gray-400">optional</span>
                ) : null}
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {step.detail ||
                  (step.status === "blocked" && step.waiting_for
                    ? `Waiting on ${step.waiting_for}`
                    : step.why)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  STEP_CHIP[step.status] || STEP_CHIP.blocked
                }`}
              >
                {STEP_LABEL[step.status] || step.status}
              </span>
              {step.status !== "done" && step.action_path ? (
                <Link
                  href={step.action_path}
                  className="text-xs text-brand-500 underline underline-offset-2"
                >
                  {step.action_label || "Open"}
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
