# Pre-Implementation Checklist
### Cold-Calling & Follow-Up Workspace — Frontend (RealtyReach / EstateFlow)

**Purpose:** This checklist must be worked through — and explicitly signed off — before changing the current structure or building out the Leads/Cold-Calling workspace described in the implementation plan. Each item below either needs a **decision** (recorded, not assumed) or a **verification** (confirmed against the actual backend spec, not inferred). Do not treat silence on any item as "default to whatever's easiest to build" — flag it and get an explicit answer.

Reference documents:
- `coldcall-followup-backend-requirements.md` (backend data model & API contract)
- `estateflow-system-design.md` (system architecture, event flow, compliance enforcement points)

---

## Section A — API Contract Alignment

- [ ] **Do not hand-invent TypeScript types from the spec prose.** Generate or manually cross-check every model (`LeadStateEnum`, `LeadTier`, `FollowupStatus`, score breakdown shape, timeline entry shape, settings shape) field-by-field against the backend requirements doc §3 and §6, not from summarized descriptions.
- [ ] Confirm exact field names and casing (e.g. `tier: "hot"` vs `"HOT"`) with backend before writing the mock — do not guess a convention and expect backend to match it later.
- [ ] If backend isn't built yet, get agreement on a shared schema stub (OpenAPI/JSON Schema, even minimal) that both frontend mock and real backend commit to, so the mock isn't quietly diverging from what gets built.
- [ ] Confirm the exact set of HTTP status codes each endpoint can return (not just the happy path) — especially `409` for DND/channel-lock, and what a rate-limit or provider-degradation response looks like (see Section D).
- [ ] Mock API responses should include realistic latency variance (not fixed instant/3-second delays) — see Section E.

**Sign-off:** Backend and frontend leads both confirm the type contract before any component is built against it.

---

## Section B — Lead State Model

- [ ] **Decide explicitly:** does the UI show all real backend states (`active`, `snoozed_fixed`, `snoozed_conditional`, `pending_family_decision`, `blocked_dnd`, `parked_financing`, `at_risk_competitor`, `no_show_reschedule`, `ghosted`, `archived`), or a simplified subset (e.g. Active / Snoozed / DND) for v1?
- [ ] If simplifying: confirm the underlying data model still stores and round-trips the *real* state — the UI's simplification must not leak backward and overwrite granular state with a generic one.
- [ ] If simplifying: define what happens when a lead is in a state not covered by the simplified UI (e.g. `at_risk_competitor`) — does it fall into a generic bucket, or get a distinct badge even in the simplified view?
- [ ] Each state shown in the UI should carry a human-readable reason string sourced from `state_reason` (backend field) — not a generic label with no context.
- [ ] Manual state-override UI (the dropdown) must respect the same constraints as the backend state machine — e.g. moving a lead *into* `blocked_dnd` should be easy and always allowed; moving *out* of it should require explicit confirmation, not a casual dropdown click.

**Sign-off:** Product confirms which states are visible in v1 and how "other" states are represented.

---

## Section C — Calling UX (Decide Before Building Any Call UI)

- [ ] **This is a hard blocker — resolve before building the Call button at all.** Choose one:
  - **Tap-to-dial (native phone dialer)** — simple, no telephony cost, but call never touches backend → no recording/transcription/timeline auto-logging possible.
  - **Vobiz-brokered call** — backend places a bridged call via Vobiz, enabling recording + auto-transcription + timeline logging, but requires call-setup UX (connecting state, failure handling, latency).
  - **Hybrid** — tap-to-dial for v1, Vobiz-brokered as a fast-follow. (If chosen, still design the "Log Outbound Call" modal to be the *primary* path for logging what happened, since auto-logging won't exist yet.)
- [ ] Once decided: design the full call lifecycle UI — idle → dialing/connecting → in-call → ended → (if Vobiz) processing/transcribing → timeline updated. Don't design only the "happy path" end state.
- [ ] Define what the agent sees if a Vobiz-brokered call fails to connect or drops mid-call.
- [ ] Confirm whether call recording requires an explicit consent step/disclosure in the UI (regulatory expectation, not just a backend concern) — if so, design where and how this is shown to the agent (and, if relevant, communicated to the lead).

**Sign-off:** Product + backend confirm the calling mechanism before this component is built.

---

## Section D — Compliance Enforcement in UI

- [ ] `blocked_dnd` leads: Call button and outbound message actions must be **disabled/hidden**, not just tappable-then-blocked-by-a-409. A 409 toast is an acceptable *fallback* (e.g. race condition where state changed after page load), not the primary enforcement mechanism.
- [ ] `channel_lock` (from backend spec, not yet in the frontend plan): if a lead is locked to WhatsApp-only, the Call action must be disabled with a clear reason shown — same treatment as DND, not a lesser one.
- [ ] "Approve & Send" on a follow-up draft must be understood (and built) as *queuing for dispatch*, where the backend dispatch layer re-checks DND/channel-lock at send time — frontend must not assume its own state snapshot is authoritative at click-time, since state can change between page load and click.
- [ ] Confirm what the UI shows if an approved draft is later rejected by the dispatch-layer compliance check (e.g. lead moved to DND between approval and actual send) — this should be a visible follow-up notification, not a silent failure.

**Sign-off:** Whoever owns compliance/legal risk for the product confirms these are non-negotiable hard blocks, not soft warnings.

---

## Section E — Async & Failure States (Real Behavior, Not Simulated)

- [ ] Replace the fixed 3-second transcription simulation with realistic variance — real transcription can take anywhere from a few seconds to over a minute, and can fail.
- [ ] Design an explicit **failure state** for transcription (bad audio, provider error, rate limit) with a retry action — not just a success-path animation.
- [ ] Design the UI's data-fetch pattern for async updates: polling interval or websocket/event-driven update — decide which, and build against that pattern from the start rather than retrofitting.
- [ ] Confirm what "pending too long" looks like to the agent (e.g. transcription still processing after 2 minutes) — a stuck spinner with no escape hatch is not acceptable.
- [ ] Apply the same real-async treatment to draft generation, CRM sync status (if surfaced), and any other backend-async operation the UI reflects.

**Sign-off:** Frontend lead confirms the loading/failure state design covers real latency and failure modes, reviewed against backend's actual async behavior.

---

## Section F — Mobile & Field Usage

- [ ] **Decide explicitly:** is this build's primary target the desktop three-column layout, or a mobile-first single-lead-at-a-time flow? These are different UIs, not a responsive reflow of the same one.
- [ ] If mobile-first is the actual target for this persona (independent brokers working in the field), design the mobile flow as the primary spec, with desktop as a secondary/later variant — not the reverse.
- [ ] If desktop-first is intentionally chosen for this phase, document that decision explicitly so it isn't mistaken for an oversight later.
- [ ] Test core flows (voice note upload, call logging, draft approval) on a mid/low-range Android device early — not only in a desktop dev environment — given this is the realistic device profile for the target users.
- [ ] Confirm offline/patchy-connectivity behavior: does a voice note recorded with no signal queue locally and sync later, or fail visibly with a clear retry path? An undecided/silent failure here is not acceptable, since this is likely to happen right after a site visit — exactly the moment the data matters most.

**Sign-off:** Product confirms target device/usage context before layout work begins.

---

## Section G — Performance

- [ ] Animation-heavy interactions (confetti bursts, gauge draw-ins, layout-shift reordering on every queue update) must be tested on representative mid/low-end hardware, not just a dev laptop.
- [ ] Build in a "reduce motion" fallback path from the start rather than as an afterthought.
- [ ] Confirm queue-reordering animations don't cause jank or misclicks when the list is actively changing (e.g. agent about to tap a lead just as it reorders from a new score).

**Sign-off:** Frontend lead confirms a real-device performance pass is part of the build/verification plan, not just `npm run build` success.

---

## Section H — Scope Boundaries

- [ ] Confirm with product that this build's scope is the Leads/Cold-Calling workspace only — explicitly **not** dashboards, CRM-sync status views, or the campaign builder — so this isn't later mistaken for full frontend coverage.
- [ ] If any of those adjacent areas share components or state with this workspace (e.g. a settings panel that dashboards will also read), flag the shared surface now so it's built with that reuse in mind rather than needing rework later.

**Sign-off:** Product confirms scope boundary in writing before kickoff.

---

## Final Go/No-Go

This checklist should be walked through in a short review between product, backend, and frontend leads before implementation starts. Every unchecked item above should have either:
1. An explicit decision recorded (even "defer to Phase 2" is a valid decision), or
2. A named owner and date for when it will be decided.

No item should be silently defaulted to whatever is fastest to build. The cost of a wrong assumption here is a rebuild of exactly the components this plan is about to spend the most effort polishing.
