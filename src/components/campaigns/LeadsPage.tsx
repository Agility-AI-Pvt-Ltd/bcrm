"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Phone,
  MessageSquare,
  Volume2,
  Settings as SettingsIcon,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Upload,
  Clock,
  ChevronDown,
  User,
  Zap,
  TrendingUp,
  Sliders,
  Send,
  Loader2,
  Trash2,
} from "lucide-react";
import Badge from "@/components/ui/badge/Badge";
import {
  LeadStateEnum,
  LeadTier,
  FollowupStatus,
  LeadPriorityItem,
  RecommendedChannelResult,
  TimelineItem,
  FollowupDraftItem,
  AgentSettings,
  getPriorityQueue,
  getRecommendedChannel,
  changeLeadState,
  getLeadTimeline,
  uploadVoiceNote,
  logOutboundCall,
  getPendingFollowups,
  approveFollowup,
  dismissFollowup,
  getAgentSettings,
  updateAgentSettings,
} from "@/lib/leads";

export default function LeadsPage() {
  // Leads & Queue State
  const [leads, setLeads] = useState<LeadPriorityItem[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadPriorityItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | LeadTier>("all");
  const [loadingLeads, setLoadingLeads] = useState(true);

  // Lead Details Panel State
  const [recommendedChannel, setRecommendedChannel] = useState<RecommendedChannelResult | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [loadingChannel, setLoadingChannel] = useState(false);

  // Manual State Override
  const [stateReason, setStateReason] = useState("");
  const [snoozeDate, setSnoozeDate] = useState("");
  const [snoozeCondition, setSnoozeCondition] = useState("");
  const [pendingStateChange, setPendingStateChange] = useState<LeadStateEnum | null>(null);

  // Upload & Log Action State
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showCallLogModal, setShowCallLogModal] = useState(false);
  const [callDuration, setCallDuration] = useState(30);
  const [callNotes, setCallNotes] = useState("");
  const [loggingCall, setLoggingCall] = useState(false);

  // AI Drafts State
  const [drafts, setDrafts] = useState<FollowupDraftItem[]>([]);
  const [editingDraftText, setEditingDraftText] = useState<{ [id: string]: string }>({});
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [actioningDraft, setActioningDraft] = useState<string | null>(null);

  // Settings State
  const [settings, setSettings] = useState<AgentSettings>({
    preferred_language: "hi",
    working_hours: { start: "09:00", end: "18:00" },
    dnd_windows: [{ start: "20:00", end: "08:00" }],
    scoring_weights: { budget: 10, property_interest: 10, conversation_depth: 25 },
    cadence_rules: { followup_interval_days: 3 },
    voice_provider: "sarvam",
  });
  const [activeTab, setActiveTab] = useState<"workspace" | "settings">("workspace");
  const [savingSettings, setSavingSettings] = useState(false);

  // UI Toast State
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial Data Fetch
  useEffect(() => {
    fetchLeads();
    fetchDrafts();
    fetchSettings();
  }, []);

  // Fetch Lead details when selection changes
  useEffect(() => {
    if (selectedLead) {
      fetchLeadWorkspaceData(selectedLead.id);
    } else {
      setTimeline([]);
      setRecommendedChannel(null);
    }
  }, [selectedLead]);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchLeads = async () => {
    setLoadingLeads(true);
    try {
      const data = await getPriorityQueue();
      setLeads(data);
      if (data.length > 0 && !selectedLead) {
        setSelectedLead(data[0]);
      }
    } catch (err: any) {
      console.error(err);
      showToast("Failed to load priority queue: " + err.message, "error");
    } finally {
      setLoadingLeads(false);
    }
  };

  const fetchDrafts = async () => {
    setLoadingDrafts(true);
    try {
      const data = await getPendingFollowups();
      setDrafts(data);
      const textStates: { [id: string]: string } = {};
      data.forEach((d) => {
        textStates[d.id] = d.draft_text;
      });
      setEditingDraftText(textStates);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingDrafts(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const data = await getAgentSettings();
      setSettings({
        preferred_language: data.preferred_language || "hi",
        working_hours: data.working_hours?.start
          ? data.working_hours
          : { start: "09:00", end: "18:00" },
        dnd_windows: data.dnd_windows?.length
          ? data.dnd_windows
          : [{ start: "20:00", end: "08:00" }],
        scoring_weights: data.scoring_weights?.budget
          ? data.scoring_weights
          : { budget: 10, property_interest: 10, conversation_depth: 25 },
        cadence_rules: data.cadence_rules?.followup_interval_days
          ? data.cadence_rules
          : { followup_interval_days: 3 },
        voice_provider: data.voice_provider || "sarvam",
      });
    } catch (err: any) {
      console.error(err);
    }
  };

  const fetchLeadWorkspaceData = async (leadId: string) => {
    setLoadingTimeline(true);
    setLoadingChannel(true);
    try {
      const timelineData = await getLeadTimeline(leadId);
      setTimeline(timelineData);
    } catch (err: any) {
      console.error(err);
      showToast("Failed to load timeline: " + err.message, "error");
    } finally {
      setLoadingTimeline(false);
    }

    try {
      const recChannel = await getRecommendedChannel(leadId);
      setRecommendedChannel(recChannel);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingChannel(false);
    }
  };

  // State Change Handling
  const handleStateSelect = (state: LeadStateEnum) => {
    if (state === "snoozed_fixed" || state === "snoozed_conditional" || state === "blocked_dnd") {
      setPendingStateChange(state);
      setStateReason("");
      setSnoozeDate("");
      setSnoozeCondition("");
    } else {
      executeStateChange(state, "Manual override to " + state);
    }
  };

  const executeStateChange = async (state: LeadStateEnum, reason: string) => {
    if (!selectedLead) return;
    try {
      await changeLeadState(selectedLead.id, state, reason);
      showToast(`Lead state updated to ${state.replace("_", " ")}`);
      setPendingStateChange(null);
      fetchLeads();
      fetchLeadWorkspaceData(selectedLead.id);
    } catch (err: any) {
      console.error(err);
      showToast("Failed to update state: " + err.message, "error");
    }
  };

  // Voice Note Upload
  const handleVoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedLead) return;

    setUploadingVoice(true);
    setUploadProgress(10);
    try {
      const progressInterval = setInterval(() => {
        setUploadProgress((p) => (p < 90 ? p + 20 : p));
      }, 200);

      const res = await uploadVoiceNote(selectedLead.id, file);
      clearInterval(progressInterval);
      setUploadProgress(100);
      showToast("Voice note uploaded! Transcribing audio...");

      // Instantly inject a simulated processing item
      const processingId = "processing-" + Date.now();
      const processingItem: TimelineItem = {
        id: processingId,
        role: "customer",
        message_type: "audio",
        text: null,
        transcript: null,
        transcript_language: null,
        audio_url: res.audio_url || "https://storage.googleapis.com/estateflow/voice_notes/example.wav",
        created_at: new Date().toISOString(),
        extracted_entities: { status: "processing" },
      };
      setTimeline((t) => [...t, processingItem]);

      setTimeout(async () => {
        if (selectedLead) {
          const updatedTimeline = await getLeadTimeline(selectedLead.id);
          setTimeline(updatedTimeline);
          showToast("Transcription and entity extraction completed!");
        }
      }, 3000);

    } catch (err: any) {
      console.error(err);
      showToast("Voice upload failed: " + err.message, "error");
    } finally {
      setTimeout(() => {
        setUploadingVoice(false);
        setUploadProgress(0);
      }, 500);
    }
  };

  // Log Call Handler
  const handleLogCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    setLoggingCall(true);
    try {
      await logOutboundCall(
        selectedLead.id,
        callDuration,
        "https://storage.googleapis.com/estateflow/calls/sample_call.mp3"
      );
      showToast("Outbound call logged");
      setShowCallLogModal(false);
      setCallNotes("");
      fetchLeadWorkspaceData(selectedLead.id);
    } catch (err: any) {
      console.error(err);
      showToast("Call logging failed: " + err.message, "error");
    } finally {
      setLoggingCall(false);
    }
  };

  // Draft Review Handler
  const handleApproveDraft = async (draftId: string) => {
    setActioningDraft(draftId);
    try {
      const customText = editingDraftText[draftId];
      await approveFollowup(draftId, customText);
      showToast("Follow-up draft sent successfully!");
      setDrafts((d) => d.filter((item) => item.id !== draftId));
    } catch (err: any) {
      console.error(err);
      if (err.status === 409) {
        showToast(
          "Cannot send: Lead is currently registered under Do-Not-Disturb (DND) status.",
          "error"
        );
      } else {
        showToast("Failed to send draft: " + err.message, "error");
      }
    } finally {
      setActioningDraft(null);
    }
  };

  const handleDismissDraft = async (draftId: string) => {
    setActioningDraft(draftId);
    try {
      await dismissFollowup(draftId);
      showToast("Draft discarded");
      setDrafts((d) => d.filter((item) => item.id !== draftId));
    } catch (err: any) {
      console.error(err);
      showToast("Failed to dismiss draft: " + err.message, "error");
    } finally {
      setActioningDraft(null);
    }
  };

  // Update Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await updateAgentSettings(settings);
      showToast("Settings updated successfully!");
    } catch (err: any) {
      console.error(err);
      showToast("Failed to update settings: " + err.message, "error");
    } finally {
      setSavingSettings(false);
    }
  };

  // UI Helpers
  const filteredLeads = leads
    .filter((lead) => {
      if (tierFilter === "all") return true;
      return lead.tier === tierFilter;
    })
    .filter((lead) => {
      const q = searchQuery.toLowerCase();
      return (
        lead.name.toLowerCase().includes(q) ||
        (lead.phone && lead.phone.includes(q)) ||
        lead.reason.toLowerCase().includes(q)
      );
    });

  // Find if there is a pending AI draft for the currently selected lead
  const currentLeadDraft = selectedLead
    ? drafts.find((d) => d.lead_id === selectedLead.id)
    : null;

  const getTierBadgeColor = (tier: LeadTier) => {
    switch (tier) {
      case "hot":
        return "error";
      case "warm":
        return "warning";
      case "cold":
        return "primary";
    }
  };

  return (
    <div className="relative">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-9999 flex max-w-md items-center gap-3 rounded-xl px-5 py-4 shadow-theme-xl border ${
            toast.type === "error"
              ? "bg-error-50 border-error-200 text-error-800 dark:bg-error-950 dark:border-error-900"
              : "bg-success-50 border-success-200 text-success-800 dark:bg-success-950 dark:border-success-900"
          }`}
        >
          <span className="text-sm font-semibold">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-auto">
            <XCircle className="h-4 w-4 text-gray-400 hover:text-gray-600" />
          </button>
        </div>
      )}

      {/* Screen Tabs */}
      <div className="mb-6 flex justify-between items-center border-b border-gray-200 pb-2 dark:border-gray-800">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("workspace")}
            className={`flex items-center gap-2 pb-2 text-sm font-semibold border-b-2 px-1 transition-all ${
              activeTab === "workspace"
                ? "border-brand-500 text-brand-500"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <Zap className="h-4 w-4" />
            Outreach Workspace
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 pb-2 text-sm font-semibold border-b-2 px-1 transition-all ${
              activeTab === "settings"
                ? "border-brand-500 text-brand-500"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <SettingsIcon className="h-4 w-4" />
            Scoring Rules
          </button>
        </div>
      </div>

      {activeTab === "workspace" ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          
          {/* COLUMN 1: Lead Selector List (Left Side - Width 4/12) */}
          <div className="md:col-span-4 flex flex-col bg-white rounded-2xl border border-gray-200 dark:bg-white/[0.03] dark:border-gray-800 h-[calc(100vh-180px)] overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search active leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs border rounded-xl bg-gray-50 border-gray-200 dark:bg-white/[0.02] dark:border-gray-800 focus:outline-none dark:text-white"
                />
              </div>

              {/* Filters */}
              <div className="flex gap-1 mt-3">
                {(["all", "hot", "warm", "cold"] as const).map((tier) => (
                  <button
                    key={tier}
                    onClick={() => setTierFilter(tier)}
                    className={`px-3 py-1 text-xs font-medium rounded-lg capitalize border transition-all ${
                      tierFilter === tier
                        ? "bg-brand-50 border-brand-200 text-brand-500 dark:bg-brand-500/10 dark:border-brand-500/30"
                        : "bg-transparent border-gray-100 text-gray-500 hover:text-gray-800 dark:border-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>

            {/* Queue list items */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 no-scrollbar">
              {loadingLeads ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
                  <span className="text-xs text-gray-400">Loading priority queue...</span>
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-xs">No active leads match.</div>
              ) : (
                filteredLeads.map((lead) => (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-white/[0.02] ${
                      selectedLead?.id === lead.id
                        ? "bg-brand-50/50 border-brand-200 dark:bg-brand-500/5 dark:border-brand-500/20"
                        : "bg-white border-gray-100 dark:bg-white/[0.01] dark:border-gray-800/40"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-xs text-gray-800 dark:text-white/90 truncate">
                        {lead.name}
                      </span>
                      <Badge color={getTierBadgeColor(lead.tier)} size="sm">
                        {lead.score.toFixed(0)} pts
                      </Badge>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 truncate">{lead.reason}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* COLUMN 2: Workspace Panel (Right Side - Width 8/12) */}
          <div className="md:col-span-8 flex flex-col bg-white rounded-2xl border border-gray-200 dark:bg-white/[0.03] dark:border-gray-800 h-[calc(100vh-180px)] overflow-hidden">
            {selectedLead ? (
              <>
                {/* Active Lead Header */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-wrap gap-4 items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                      {selectedLead.name}
                      <Badge color={getTierBadgeColor(selectedLead.tier)} size="sm">
                        {selectedLead.tier} · {selectedLead.score.toFixed(0)} pts
                      </Badge>
                    </h3>
                    <div className="flex gap-2 items-center mt-1">
                      <span className="text-xs text-gray-400">
                        {selectedLead.phone || "No phone registered"}
                      </span>
                      {selectedLead.phone && (
                        <a
                          href={`tel:${selectedLead.phone}`}
                          className="text-brand-500 p-1 hover:bg-gray-100 rounded-full"
                          title="Dial phone number"
                        >
                          <Phone className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Outreach State drop selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Outreach State:</span>
                    <select
                      value="active" // Simple action picker
                      onChange={(e) => handleStateSelect(e.target.value as LeadStateEnum)}
                      className="text-xs font-semibold p-1.5 border rounded-xl bg-gray-50 border-gray-200 dark:bg-white/[0.02] dark:border-gray-800 focus:outline-none dark:text-white"
                    >
                      <option value="active">Active Outreach</option>
                      <option value="snoozed_fixed">Snooze (Time-bound)</option>
                      <option value="snoozed_conditional">Snooze (Condition)</option>
                      <option value="blocked_dnd">DND (Block)</option>
                      <option value="archived">Archive Lead</option>
                    </select>
                  </div>
                </div>

                {/* Telemetry Channel Recommendation Banner */}
                {recommendedChannel && (
                  <div className="px-4 py-2 bg-brand-50/30 border-b border-gray-100 dark:bg-brand-500/[0.02] dark:border-gray-800/80 flex items-center gap-2">
                    {recommendedChannel.channel === "whatsapp" ? (
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Phone className="h-3.5 w-3.5 text-blue-500" />
                    )}
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      Recommended: <strong className="capitalize">{recommendedChannel.channel}</strong>.{" "}
                      <span className="text-gray-400">{recommendedChannel.reason}</span>
                    </span>
                  </div>
                )}

                {/* Main Content Workspace: Integrates Timeline + AI Draft in one list */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar bg-gray-50/20 dark:bg-white/[0.005]">
                  
                  {/* Inline AI Follow-up Draft Card (if exists for this lead) */}
                  {currentLeadDraft && (
                    <div className="p-4 rounded-xl border border-warning-200 bg-warning-50/30 dark:border-warning-900/30 dark:bg-warning-950/10">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-warning-800 dark:text-warning-300 flex items-center gap-1">
                          <Zap className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                          Pending AI Follow-up Draft
                        </span>
                        <span className="text-[10px] text-gray-400">
                          Channel: {currentLeadDraft.channel}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mb-2 italic">
                        Reason: {currentLeadDraft.generation_reason}
                      </p>
                      
                      <textarea
                        rows={3}
                        value={editingDraftText[currentLeadDraft.id] || ""}
                        onChange={(e) =>
                          setEditingDraftText({
                            ...editingDraftText,
                            [currentLeadDraft.id]: e.target.value,
                          })
                        }
                        className="w-full p-2 text-xs border rounded-lg bg-white border-gray-200 dark:bg-white/[0.01] dark:border-gray-800 focus:outline-none dark:text-white"
                      />
                      
                      <div className="flex gap-2 justify-end mt-3">
                        <button
                          onClick={() => handleDismissDraft(currentLeadDraft.id)}
                          disabled={actioningDraft === currentLeadDraft.id}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium text-gray-500 hover:text-gray-700 bg-white dark:bg-transparent dark:border-gray-800 dark:text-gray-400 cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" />
                          Dismiss
                        </button>
                        <button
                          onClick={() => handleApproveDraft(currentLeadDraft.id)}
                          disabled={actioningDraft === currentLeadDraft.id}
                          className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold cursor-pointer shadow-theme-xs disabled:opacity-50"
                        >
                          <Send className="h-3 w-3" />
                          Send WhatsApp
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Timeline Message Stream */}
                  {loadingTimeline ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                      <span className="text-xs text-gray-400">Loading timeline...</span>
                    </div>
                  ) : timeline.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 text-xs">Timeline history is empty.</div>
                  ) : (
                    <div className="space-y-3 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-[1px] before:bg-gray-200 dark:before:bg-gray-800">
                      {timeline.map((item, idx) => {
                        const isCustomer = item.role === "customer";
                        const isCall = item.message_type === "call_log";
                        
                        return (
                          <div key={item.id || idx} className="relative pl-7">
                            <div className={`absolute left-1 top-0.5 h-5 w-5 rounded-full flex items-center justify-center z-10 text-white text-[9px] ${
                              isCustomer
                                ? "bg-brand-500"
                                : isCall
                                ? "bg-amber-500"
                                : "bg-gray-400"
                            }`}>
                              {isCall ? <Phone className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
                            </div>

                            <div className="p-3 bg-white rounded-xl border border-gray-100 dark:border-gray-800 dark:bg-white/[0.01]">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-bold text-gray-800 dark:text-white capitalize">
                                  {isCustomer ? selectedLead.name : item.role}
                                </span>
                                <span className="text-[9px] text-gray-400">
                                  {new Date(item.created_at).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>

                              {item.extracted_entities?.status === "processing" ? (
                                <span className="text-xs text-gray-400 animate-pulse">Transcribing...</span>
                              ) : (
                                <>
                                  {item.text && <p className="text-xs text-gray-700 dark:text-gray-300">{item.text}</p>}
                                  {item.transcript && (
                                    <div className="mt-1.5 p-2 rounded-lg bg-gray-50 border border-gray-100 dark:bg-white/[0.01] dark:border-gray-800">
                                      <p className="text-[10px] text-brand-500 font-bold">Transcript:</p>
                                      <p className="text-xs italic text-gray-600 dark:text-gray-300">"{item.transcript}"</p>
                                    </div>
                                  )}
                                  {item.extracted_entities && (
                                    <div className="flex gap-2 mt-2">
                                      {item.extracted_entities.sentiment && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 border text-gray-500 dark:bg-white/[0.02]">
                                          Sentiment: {item.extracted_entities.sentiment}
                                        </span>
                                      )}
                                      {item.extracted_entities.callback_condition && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand-50 text-brand-600 dark:bg-brand-500/10">
                                          Follow-up: {item.extracted_entities.callback_condition}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Timeline Controls (Simplified uploads / call log triggers) */}
                <div className="p-3 bg-white border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleVoiceUpload}
                      accept="audio/*"
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingVoice}
                      className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-gray-200 dark:border-gray-800 rounded-lg text-xs font-semibold text-gray-500 hover:text-brand-500 hover:border-brand-500 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {uploadingVoice ? `Uploading (${uploadProgress}%)` : "Upload Lead Voice Note"}
                    </button>
                  </div>

                  <button
                    onClick={() => setShowCallLogModal(true)}
                    className="flex items-center gap-1 bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold px-3 py-2 rounded-lg cursor-pointer"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Log Outbound Call
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                <Zap className="h-10 w-10 text-gray-200 dark:text-gray-700 mb-2 animate-bounce" />
                <h3 className="font-bold text-gray-800 dark:text-white/80">No lead selected</h3>
                <p className="text-xs text-gray-400 mt-1">Select an active client from the queue to start follow-up audits.</p>
              </div>
            )}
          </div>

        </div>
      ) : (
        /* TAB 2: Simplified Scoring Rules Configuration */
        <div className="max-w-xl bg-white border border-gray-200 dark:bg-white/[0.03] dark:border-gray-800 rounded-2xl p-5">
          <form onSubmit={handleSaveSettings} className="space-y-4">
            
            {/* Preferred Language */}
            <div className="grid grid-cols-12 gap-3 items-center">
              <label className="col-span-5 text-xs font-semibold text-gray-800 dark:text-white">
                Outbound Language
              </label>
              <div className="col-span-7">
                <select
                  value={settings.preferred_language}
                  onChange={(e) => setSettings({ ...settings, preferred_language: e.target.value })}
                  className="w-full p-2 text-xs border rounded-lg bg-gray-50 border-gray-200 dark:bg-white/[0.02] dark:border-gray-800 focus:outline-none dark:text-white"
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi (hi)</option>
                  <option value="en-IN">Indian English (en-IN)</option>
                </select>
              </div>
            </div>

            {/* Voice Provider */}
            <div className="grid grid-cols-12 gap-3 items-center">
              <label className="col-span-5 text-xs font-semibold text-gray-800 dark:text-white">
                Voice Provider
              </label>
              <div className="col-span-7">
                <select
                  value={settings.voice_provider}
                  onChange={(e) => setSettings({ ...settings, voice_provider: e.target.value })}
                  className="w-full p-2 text-xs border rounded-lg bg-gray-50 border-gray-200 dark:bg-white/[0.02] dark:border-gray-800 focus:outline-none dark:text-white"
                >
                  <option value="sarvam">Sarvam AI (Recommended)</option>
                  <option value="elevenlabs">ElevenLabs</option>
                  <option value="google">Google Cloud TTS</option>
                </select>
              </div>
            </div>

            {/* Cadence Rules */}
            <div className="grid grid-cols-12 gap-3 items-center">
              <label className="col-span-5 text-xs font-semibold text-gray-800 dark:text-white">
                Follow-up Interval (Days)
              </label>
              <div className="col-span-7">
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={settings.cadence_rules.followup_interval_days}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      cadence_rules: {
                        ...settings.cadence_rules,
                        followup_interval_days: parseInt(e.target.value) || 3,
                      },
                    })
                  }
                  className="w-full p-2 text-xs border rounded-lg bg-gray-50 border-gray-200 dark:bg-white/[0.02] dark:border-gray-800 focus:outline-none dark:text-white"
                />
              </div>
            </div>

            {/* Score Weights */}
            <div className="border-t border-gray-100 pt-3 dark:border-gray-800 space-y-3">
              <h4 className="text-xs font-bold text-gray-800 dark:text-white">Telemetry Weights</h4>
              
              <div className="grid grid-cols-12 gap-2 items-center">
                <label className="col-span-5 text-[10px] text-gray-500">Budget matching weight</label>
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={settings.scoring_weights.budget}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      scoring_weights: { ...settings.scoring_weights, budget: parseFloat(e.target.value) },
                    })
                  }
                  className="col-span-5 accent-brand-500"
                />
                <span className="col-span-2 text-right text-xs font-bold">+{settings.scoring_weights.budget}</span>
              </div>

              <div className="grid grid-cols-12 gap-2 items-center">
                <label className="col-span-5 text-[10px] text-gray-500">Property matching weight</label>
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={settings.scoring_weights.property_interest}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      scoring_weights: { ...settings.scoring_weights, property_interest: parseFloat(e.target.value) },
                    })
                  }
                  className="col-span-5 accent-brand-500"
                />
                <span className="col-span-2 text-right text-xs font-bold">+{settings.scoring_weights.property_interest}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="w-full mt-4 bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-theme-xs disabled:opacity-50"
            >
              {savingSettings && <Loader2 className="h-3 w-3 animate-spin" />}
              Save Workspace Configurations
            </button>
          </form>
        </div>
      )}

      {/* MODAL: Log Outbound Call */}
      {showCallLogModal && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-sm overflow-hidden p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-xs text-gray-900 dark:text-white flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-brand-500" />
                Log Call Details
              </h3>
              <button onClick={() => setShowCallLogModal(false)}>
                <XCircle className="h-4 w-4 text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleLogCall} className="space-y-3">
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Duration (seconds)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={5}
                    max={600}
                    step={5}
                    value={callDuration}
                    onChange={(e) => setCallDuration(parseInt(e.target.value))}
                    className="flex-1 accent-brand-500"
                  />
                  <span className="text-xs font-bold w-8 text-right">{callDuration}s</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Summarize the outcome..."
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  className="w-full p-2 text-xs border rounded-lg bg-white dark:bg-white/[0.01] dark:border-gray-800 focus:outline-none dark:text-white resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCallLogModal(false)}
                  className="px-3 py-1.5 border rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loggingCall}
                  className="px-4 py-1.5 bg-brand-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                >
                  {loggingCall && <Loader2 className="h-3 w-3 animate-spin" />}
                  Log Call
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL: Override Specific Settings for Snooze or DND */}
      {pendingStateChange && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-xs p-4 space-y-4">
            <h3 className="font-bold text-xs text-gray-900 dark:text-white flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-warning-500" />
              Status Override: {pendingStateChange.replace("_", " ")}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Override Reason</label>
                <input
                  type="text"
                  required
                  placeholder="Enter reason..."
                  value={stateReason}
                  onChange={(e) => setStateReason(e.target.value)}
                  className="w-full p-1.5 text-xs border rounded-lg bg-gray-50 border-gray-200 dark:bg-white/[0.02] focus:outline-none dark:text-white"
                />
              </div>

              {pendingStateChange === "snoozed_fixed" && (
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Resurface Datetime</label>
                  <input
                    type="datetime-local"
                    required
                    value={snoozeDate}
                    onChange={(e) => setSnoozeDate(e.target.value)}
                    className="w-full p-1.5 text-xs border rounded-lg bg-gray-50 border-gray-200 dark:bg-white/[0.02] focus:outline-none dark:text-white"
                  />
                </div>
              )}

              {pendingStateChange === "snoozed_conditional" && (
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Condition Trigger</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter condition..."
                    value={snoozeCondition}
                    onChange={(e) => setSnoozeCondition(e.target.value)}
                    className="w-full p-1.5 text-xs border rounded-lg bg-gray-50 border-gray-200 dark:bg-white/[0.02] focus:outline-none dark:text-white"
                  />
                </div>
              )}

              {pendingStateChange === "blocked_dnd" && (
                <div className="bg-error-50 p-2.5 rounded-lg border border-error-100 text-error-800 text-[10px]">
                  <strong>Warning:</strong> This will hard block all campaign messages and dispatches to this lead on the backend.
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => setPendingStateChange(null)}
                  className="px-3 py-1.5 border rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 bg-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    let finalReason = stateReason;
                    if (pendingStateChange === "snoozed_fixed" && snoozeDate) {
                      finalReason += ` (Until: ${new Date(snoozeDate).toLocaleString()})`;
                    } else if (pendingStateChange === "snoozed_conditional" && snoozeCondition) {
                      finalReason += ` (Condition: ${snoozeCondition})`;
                    }
                    executeStateChange(pendingStateChange, finalReason);
                  }}
                  className="px-4 py-1.5 bg-brand-500 text-white rounded-lg text-xs font-bold"
                >
                  Confirm Override
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
