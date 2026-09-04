"use client";

/**
 * One call campaign, watched while it runs.
 *
 * A call campaign is slow by nature — 200 leads on 5 lines is an hour and a half —
 * so this card is built to make a long-running batch look healthy rather than
 * stuck. It leads with progress and a time estimate, and only expands into
 * per-call detail when asked.
 */

import { useCallback, useEffect, useState } from "react";
import Badge from "@/components/ui/badge/Badge";
import { ApiError } from "@/lib/api";
import {
  CALL_STATUS_LABELS,
  CAMPAIGN_FINISHED,
  cancelCallCampaign,
  describeDuration,
  getCallCampaign,
  listCalls,
  pauseCallCampaign,
  resumeCallCampaign,
  type CallCampaign,
  type CallCampaignDetail,
  type CallRecord,
  type CallStatus,
} from "@/lib/calls";

/** Slow enough not to hammer the API, quick enough that progress feels live. */
const POLL_MS = 10000;

type Props = {
  campaign: CallCampaign;
  onChanged?: () => void;
};

const STATUS_COLOUR: Record<string, "success" | "warning" | "error" | "info" | "light"> = {
  running: "success",
  paused: "warning",
  completed: "info",
  canceled: "light",
};

function outcomeTone(status: CallStatus): "success" | "warning" | "error" | "light" {
  if (status === "completed") return "success";
  if (status === "failed") return "error";
  if (status === "no_answer" || status === "busy") return "warning";
  return "light";
}

export default function CallCampaignCard({ campaign, onChanged }: Props) {
  const [detail, setDetail] = useState<CallCampaignDetail | null>(null);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const live = !CAMPAIGN_FINISHED.includes(campaign.status);

  const refresh = useCallback(async () => {
    try {
      setDetail(await getCallCampaign(campaign.id));
    } catch {
      // A failed poll is not worth an error banner over a card that is otherwise
      // readable; the next tick usually succeeds.
    }
  }, [campaign.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Only a running campaign polls. A finished one never changes again, and left
  // polling it would keep every completed campaign on the page hitting the API.
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [live, refresh]);

  useEffect(() => {
    if (!expanded) return;
    void (async () => {
      try {
        const page = await listCalls({ limit: 200 });
        setCalls(page.items.filter((call) => call.campaign_id === campaign.id));
      } catch {
        setCalls([]);
      }
    })();
  }, [expanded, campaign.id, detail?.progress.completed]);

  const act = async (action: "pause" | "resume" | "cancel") => {
    if (action === "cancel") {
      const ok = window.confirm(
        "Cancel this campaign? Calls that have not started will be cancelled. " +
          "Anyone already on the phone will finish their conversation.",
      );
      if (!ok) return;
    }
    setBusy(true);
    setError("");
    try {
      const runner =
        action === "pause"
          ? pauseCallCampaign
          : action === "resume"
            ? resumeCallCampaign
            : cancelCallCampaign;
      setDetail(await runner(campaign.id));
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the campaign");
    } finally {
      setBusy(false);
    }
  };

  const progress = detail?.progress;
  const done = progress?.completed ?? 0;
  const total = progress?.total ?? campaign.total_calls;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const status = detail?.status ?? campaign.status;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-gray-900 dark:text-white/90">
              {campaign.name}
            </h3>
            <Badge color={STATUS_COLOUR[status] ?? "light"}>{status}</Badge>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {total} call{total === 1 ? "" : "s"} · {campaign.concurrency} line
            {campaign.concurrency === 1 ? "" : "s"}
            {campaign.scheduled_at && status === "running" && !campaign.started_at
              ? ` · starts ${new Date(campaign.scheduled_at).toLocaleString()}`
              : ""}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          {live ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void act(status === "paused" ? "resume" : "pause")}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
              >
                {status === "paused" ? "Resume" : "Pause"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void act("cancel")}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                Cancel
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
          >
            {expanded ? "Hide calls" : "See calls"}
          </button>
        </div>
      </div>

      <div className="mt-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          <span>
            {done} of {total} done
          </span>
          {progress?.in_flight ? <span>{progress.in_flight} on the phone now</span> : null}
          {progress?.pending ? <span>{progress.pending} still to call</span> : null}
          {live && detail?.estimated_minutes ? (
            <span>{describeDuration(detail.estimated_minutes)} left</span>
          ) : null}
        </div>
      </div>

      {progress && Object.keys(progress.by_status).length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(progress.by_status).map(([key, count]) => (
            <span
              key={key}
              className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              {CALL_STATUS_LABELS[key as CallStatus] ?? key}: {count}
            </span>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {expanded ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">
              <tr>
                <th className="px-4 py-2 font-medium">Number</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Outcome</th>
                <th className="px-4 py-2 font-medium">What was said</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {calls.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                    No calls to show yet.
                  </td>
                </tr>
              ) : (
                calls.map((call) => (
                  <tr key={call.id}>
                    <td className="px-4 py-2 text-gray-800 dark:text-gray-200">
                      {call.phone_number}
                    </td>
                    <td className="px-4 py-2">
                      <Badge color={outcomeTone(call.status)}>
                        {CALL_STATUS_LABELS[call.status] ?? call.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                      {call.outcome ?? "—"}
                    </td>
                    <td className="max-w-xs px-4 py-2 text-gray-600 dark:text-gray-400">
                      <span className="line-clamp-2">{call.summary ?? "—"}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
