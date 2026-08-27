"use client";

/**
 * One campaign: progress, lifecycle controls, and the per-recipient delivery log.
 *
 * The recipient list is the part that makes "no lead is lost" checkable — every
 * person selected for the send has a row with a status, and nothing ever deletes
 * one, so a failed or skipped lead stays visible instead of disappearing.
 */

import { useCallback, useState } from "react";
import Badge from "@/components/ui/badge/Badge";
import { ApiError } from "@/lib/api";
import {
  campaignStatusBadgeColor,
  cancelCampaign,
  formatWhen,
  getCampaign,
  listCampaignRecipients,
  pauseCampaign,
  refreshCampaignAudience,
  resumeCampaign,
  sendCampaignBatch,
  sendStatusBadgeColor,
  shortFileLabel,
  startCampaign,
  type CampaignSummary,
  type RecipientPage,
} from "@/lib/outreach";

const RECIPIENTS_PAGE_SIZE = 25;

type Props = {
  campaign: CampaignSummary;
  onChanged: (campaign: CampaignSummary) => void;
  onNotice: (message: string) => void;
};

export default function CampaignCard({ campaign, onChanged, onNotice }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState<RecipientPage | null>(null);
  const [offset, setOffset] = useState(0);
  const [loadingPage, setLoadingPage] = useState(false);

  const loadRecipients = useCallback(
    async (nextOffset: number, nextStatus: string) => {
      setLoadingPage(true);
      try {
        const result = await listCampaignRecipients(campaign.id, {
          status: nextStatus || undefined,
          limit: RECIPIENTS_PAGE_SIZE,
          offset: nextOffset,
        });
        setPage(result);
        setOffset(nextOffset);
      } catch (error) {
        onNotice(
          error instanceof ApiError ? error.message : "Could not load recipients.",
        );
      } finally {
        setLoadingPage(false);
      }
    },
    [campaign.id, onNotice],
  );

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next && !page) {
      await loadRecipients(0, statusFilter);
    }
  };

  const act = async (
    label: string,
    action: () => Promise<{ campaign: CampaignSummary; message: string }>,
  ) => {
    setBusy(label);
    try {
      const result = await action();
      onChanged(result.campaign);
      onNotice(result.message);
      if (open) await loadRecipients(offset, statusFilter);
    } catch (error) {
      onNotice(error instanceof ApiError ? error.message : `${label} failed.`);
    } finally {
      setBusy(null);
    }
  };

  const sendOneBatch = async () => {
    setBusy("send");
    try {
      const result = await sendCampaignBatch(campaign.id);
      onNotice(
        result.paused
          ? "Campaign is paused — resume it first."
          : `Sent ${result.sent}, failed ${result.failed}, skipped ${result.skipped}. ` +
            `${result.outstanding} still waiting.`,
      );
      // The batch endpoint returns counters, not a summary. Re-read the campaign
      // with a plain GET — `refresh-audience` would also *add* recipients, which is
      // not what "show me the new numbers" should do.
      onChanged(await getCampaign(campaign.id));
      if (open) await loadRecipients(offset, statusFilter);
    } catch (error) {
      onNotice(error instanceof ApiError ? error.message : "Sending failed.");
    } finally {
      setBusy(null);
    }
  };

  const status = campaign.status;
  const percent = Math.min(100, Math.round(campaign.progress?.percent ?? 0));
  const canStart = status === "draft" || status === "queued";
  const canPause = status === "running" || status === "queued";
  const canResume = status === "paused";
  const canCancel = status !== "completed" && status !== "draft";

  return (
    <article className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white/90">
                {campaign.name}
              </h3>
              <Badge color={campaignStatusBadgeColor(status)} size="sm">
                {status}
              </Badge>
              {!campaign.workflow_id && status !== "draft" ? (
                <Badge color="light" size="sm">
                  no worker · sends on the next shift
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {shortFileLabel(campaign.source_file)}
              {campaign.template_name ? ` · template ${campaign.template_name}` : " · free-form"}
              {campaign.started_at ? ` · started ${formatWhen(campaign.started_at)}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void toggleOpen()}
            className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
          >
            {open ? "Hide recipients" : "Every recipient"}
          </button>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs text-gray-500">
            <span>
              {campaign.progress?.completed ?? 0} of {campaign.progress?.total ?? 0} handled
            </span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {[
            [campaign.total_recipients, "Audience"],
            [campaign.sent_count, "Sent"],
            [campaign.replied_count, "Replied"],
            [campaign.failed_count, "Failed"],
            [campaign.outstanding, "Waiting"],
          ].map(([value, label]) => (
            <div
              key={String(label)}
              className="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700"
            >
              <p className="text-lg font-semibold text-gray-800 dark:text-white/90">
                {value}
              </p>
              <p className="text-[11px] text-gray-500">{label}</p>
            </div>
          ))}
        </div>

        {campaign.last_error ? (
          <p className="rounded-lg bg-error-50 px-3 py-2 text-xs text-error-600 dark:bg-error-500/10 dark:text-error-400">
            {campaign.last_error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {canStart && (
            <button
              type="button"
              disabled={busy !== null || campaign.total_recipients === 0}
              onClick={() => void act("start", () => startCampaign(campaign.id))}
              className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {busy === "start" ? "Starting…" : "Start sending"}
            </button>
          )}
          {canPause && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void act("pause", () => pauseCampaign(campaign.id))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
            >
              {busy === "pause" ? "Pausing…" : "Pause"}
            </button>
          )}
          {canResume && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void act("resume", () => resumeCampaign(campaign.id))}
              className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {busy === "resume" ? "Resuming…" : "Resume"}
            </button>
          )}
          <button
            type="button"
            disabled={busy !== null || campaign.outstanding === 0}
            onClick={() => void sendOneBatch()}
            title="Sends one batch immediately, without waiting for a worker"
            className="rounded-lg border border-brand-300 px-3 py-2 text-xs font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-500/40 dark:text-brand-300 dark:hover:bg-brand-500/10"
          >
            {busy === "send" ? "Sending…" : "Send one batch now"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              void act("refresh", async () => {
                const result = await refreshCampaignAudience(campaign.id);
                return { campaign: result.campaign, message: result.message };
              })
            }
            title="Pull in customers added to the sheet after this campaign was built"
            className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
          >
            {busy === "refresh" ? "Checking…" : "Pull in new customers"}
          </button>
          {canCancel && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void act("cancel", () => cancelCampaign(campaign.id))}
              className="rounded-lg border border-error-300 px-3 py-2 text-xs font-medium text-error-600 hover:bg-error-50 disabled:opacity-50 dark:border-error-500/40 dark:text-error-400"
            >
              {busy === "cancel" ? "Cancelling…" : "Cancel"}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          <div className="flex flex-wrap items-center gap-2 px-5 py-4">
            <select
              value={statusFilter}
              onChange={(event) => {
                const value = event.target.value;
                setStatusFilter(value);
                void loadRecipients(0, value);
              }}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            >
              <option value="">Every status</option>
              {Object.entries(page?.counts ?? {})
                .filter(([key]) => key !== "total")
                .map(([key, count]) => (
                  <option key={key} value={key}>
                    {key} ({count})
                  </option>
                ))}
            </select>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(page?.counts ?? {})
                .filter(([key, count]) => key !== "total" && count > 0)
                .map(([key, count]) => (
                  <Badge key={key} color={sendStatusBadgeColor(key)} size="sm">
                    {key} {count}
                  </Badge>
                ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/[0.02]">
                <tr>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Sent</th>
                  <th className="px-5 py-3 font-medium">Replied</th>
                  <th className="px-5 py-3 font-medium">Tries</th>
                  <th className="px-5 py-3 font-medium">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loadingPage ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                      Loading recipients…
                    </td>
                  </tr>
                ) : !page || page.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                      No recipients match this filter.
                    </td>
                  </tr>
                ) : (
                  page.items.map((recipient) => (
                    <tr key={recipient.id}>
                      <td className="px-5 py-3 font-medium text-gray-800 dark:text-white/90">
                        {recipient.name || "—"}
                      </td>
                      <td className="px-5 py-3 text-gray-500">{recipient.phone}</td>
                      <td className="px-5 py-3">
                        <Badge color={sendStatusBadgeColor(recipient.send_status)} size="sm">
                          {recipient.send_status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {formatWhen(recipient.sent_at)}
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {formatWhen(recipient.replied_at)}
                      </td>
                      <td className="px-5 py-3 text-gray-500">{recipient.attempts}</td>
                      <td
                        className="max-w-[240px] truncate px-5 py-3 text-gray-500"
                        title={recipient.error || recipient.skip_reason || ""}
                      >
                        {recipient.error || recipient.skip_reason || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
            <span className="text-xs text-gray-500">
              Showing {page?.items.length ? offset + 1 : 0}–
              {offset + (page?.items.length ?? 0)} of {page?.counts?.total ?? 0}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loadingPage || offset === 0}
                onClick={() =>
                  void loadRecipients(Math.max(0, offset - RECIPIENTS_PAGE_SIZE), statusFilter)
                }
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={
                  loadingPage || (page?.items.length ?? 0) < RECIPIENTS_PAGE_SIZE
                }
                onClick={() => void loadRecipients(offset + RECIPIENTS_PAGE_SIZE, statusFilter)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
