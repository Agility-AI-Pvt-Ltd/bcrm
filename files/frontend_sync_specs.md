# Frontend Integration Specification - Cold-Calling & Follow-Up Module

This document outlines the API endpoints, data models, error codes, and integration requirements for the **EstateFlow Cold-Calling and Follow-Up Module**.

---

## 1. Core Data Enums & Values

The frontend should map the following state and status enums to sync accurately with backend rules.

### Lead Outreach State (`LeadStateEnum`)
Represents the compliance or snooze status of a lead:
* `"active"`: Eligible for regular follow-up campaigns and queue priority.
* `"snooze_fixed"`: Temporarily paused until a specific datetime (resurfaces automatically).
* `"snooze_conditional"`: Paused until a condition is met (e.g., "once registry is done", "after consulting husband").
* `"blocked_dnd"`: **Do Not Disturb** flag. Any campaign or outbound messages to this lead will return an `HTTP 409 Conflict` error.
* `"archived"`: Lead is closed or lost.

### Lead Priority Tier (`LeadTier`)
Calculated dynamically based on profile completeness and conversation depth:
* `"hot"`: Dynamic score $\ge$ 70.
* `"warm"`: Dynamic score between 40 and 69.
* `"cold"`: Dynamic score $<$ 40.

### Follow-up Draft Status (`FollowupStatus`)
* `"pending"`: AI has prepared a follow-up draft; awaiting broker review.
* `"approved_sent"`: Broker approved and dispatched the message.
* `"dismissed"`: Broker discarded the draft.

---

## 2. API Endpoints Reference

All requests must carry the standard authentication headers required by the core app (e.g., Bearer tokens).

---

### A. Leads & Priority Queue

#### 1. Retrieve Priority Queue
Returns the active leads list sorted in descending order of lead priority score.
* **Method:** `GET`
* **Path:** `/api/v1/leads/priority-queue`
* **Query Params:**
  * `limit`: Integer (Default: `50`, Max: `500`)
* **Response (Success):** `HTTP 200 OK`
```json
{
  "data": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d471",
      "name": "Ravi Kumar",
      "phone": "+919876543210",
      "score": 75.0,
      "tier": "hot",
      "score_breakdown": {
        "base_score": 50.0,
        "budget_profile_present": 10.0,
        "property_interest_present": 10.0,
        "phone_profile_present": 5.0
      },
      "reason": "budget_profile_present: +10.0, property_interest_present: +10.0, phone_profile_present: +5.0"
    }
  ]
}
```

#### 2. Get Recommended Channel
Determines if outbound outreach should use voice call or WhatsApp based on recent conversation telemetry (e.g. locks or multiple unanswered call metrics).
* **Method:** `GET`
* **Path:** `/api/v1/leads/{lead_id}/recommended-channel`
* **Response (Success):** `HTTP 200 OK`
```json
{
  "data": {
    "channel": "whatsapp",
    "reason": "Detected 2 consecutive unanswered outbound calls."
  }
}
```

#### 3. Change Lead State (Manual Override)
Enables brokers to manually put a lead on DND, fixed snooze, or conditional callback.
* **Method:** `POST`
* **Path:** `/api/v1/leads/{lead_id}/state`
* **Body:**
```json
{
  "current_state": "blocked_dnd",
  "state_reason": "Requested DND during our afternoon call."
}
```
* **Response (Success):** `HTTP 200 OK`
```json
{
  "data": {
    "id": "e67ba30a-28cc-4372-a567-0e02b2c3d551",
    "current_state": "blocked_dnd",
    "state_reason": "Requested DND during our afternoon call."
  }
}
```

#### 4. Unified Timeline
Retrieves a chronological list of interactions (calls, WhatsApp messages, and voice note transcripts) for a specific lead.
* **Method:** `GET`
* **Path:** `/api/v1/leads/{lead_id}/timeline`
* **Response (Success):** `HTTP 200 OK`
```json
{
  "data": [
    {
      "id": "c57ac10b-58cc-4372-a567-0e02b2c3d901",
      "role": "customer",
      "message_type": "audio",
      "text": null,
      "transcript": "Wife se consult karke bataunga.",
      "transcript_language": "hi",
      "extracted_entities": {
        "callback_condition": "after wife consultation",
        "sentiment": "positive"
      },
      "audio_url": "https://storage.googleapis.com/estateflow/voice_notes/default/lead_id/uuid.wav",
      "created_at": "2026-08-15T10:00:00Z"
    }
  ]
}
```

---

### B. Conversations & Media Uploads

#### 1. Upload Voice Note
Used when a broker uploads an audio recording or voice memo from a lead.
* **Method:** `POST`
* **Path:** `/api/v1/conversations/voice-note`
* **Content-Type:** `multipart/form-data`
* **Form Fields:**
  * `lead_id`: String (UUID)
  * `file`: Binary file upload (e.g. `.mp3`, `.wav`, `.m4a`)
* **Response (Success):** `HTTP 200 OK`
```json
{
  "data": {
    "message_id": "c57ac10b-58cc-4372-a567-0e02b2c3d901",
    "audio_url": "https://storage.googleapis.com/estateflow/voice_notes/default/lead_id/uuid.wav",
    "status": "processing"
  }
}
```
> **Frontend Note:** This action runs STT and entity extraction asynchronously in the background. The broker UI should show a "transcribing..." spinner.

#### 2. Log Outbound Call
Registers a phone call summary details.
* **Method:** `POST`
* **Path:** `/api/v1/conversations/call-log`
* **Content-Type:** `application/x-www-form-urlencoded` or `multipart/form-data`
* **Form Fields:**
  * `lead_id`: String (UUID)
  * `duration`: Integer (seconds)
  * `audio_url`: String (optional, link to recording file if call was recorded)
* **Response (Success):** `HTTP 200 OK`
```json
{
  "data": {
    "message_id": "d17ac10b-58cc-4372-a567-0e02b2c3d910",
    "status": "logged"
  }
}
```

---

### C. Follow-up Draft Reviews

#### 1. List Pending Drafts
Broker inbox list of AI-generated WhatsApp messages waiting for verification.
* **Method:** `GET`
* **Path:** `/api/v1/followups/pending`
* **Response (Success):** `HTTP 200 OK`
```json
{
  "data": [
    {
      "id": "a47ac10b-58cc-4372-a567-0e02b2c3d801",
      "lead_id": "f47ac10b-58cc-4372-a567-0e02b2c3d471",
      "channel": "whatsapp",
      "draft_text": "Hello Ravi, regarding your interest in 3 BHK flat in Whitefield. Are you available for a brief call tomorrow?",
      "generation_reason": "Requested info about Whitefield 3 BHK properties",
      "status": "pending",
      "created_at": "2026-08-15T12:00:00Z"
    }
  ]
}
```

#### 2. Approve & Send Draft
Sends the message out over WhatsApp. Brokers can optional edit/override the AI draft text before sending.
* **Method:** `POST`
* **Path:** `/api/v1/followups/{draft_id}/approve`
* **Body:** (Optional edit payload)
```json
{
  "draft_text": "Hello Ravi, regarding your interest in Whitefield. Let me know when you are free."
}
```
* **Response (Success):** `HTTP 200 OK`
```json
{
  "data": {
    "id": "a47ac10b-58cc-4372-a567-0e02b2c3d801",
    "status": "approved_sent"
  }
}
```
* **Response (DND Compliance Error):** `HTTP 409 Conflict` (See Error Handling section)

#### 3. Dismiss Draft
Discards the AI draft.
* **Method:** `POST`
* **Path:** `/api/v1/followups/{draft_id}/dismiss`
* **Response (Success):** `HTTP 200 OK`
```json
{
  "data": {
    "id": "a47ac10b-58cc-4372-a567-0e02b2c3d801",
    "status": "dismissed"
  }
}
```

---

### D. Settings

#### 1. Retrieve Settings
Fetches preferred language, working hours, and voice provider preferences.
* **Method:** `GET`
* **Path:** `/api/v1/settings/agent/{agent_id}` (For Agent-level overrides) or `/api/v1/settings/team/{org_id}` (For global team defaults)
* **Response (Success):** `HTTP 200 OK`
```json
{
  "data": {
    "id": "s47ac10b-58cc-4372-a567-0e02b2c3d100",
    "preferred_language": "hi",
    "working_hours": {"start": "09:00", "end": "18:00"},
    "dnd_windows": [{"start": "20:00", "end": "08:00"}],
    "scoring_weights": {"budget": 10.0, "property_interest": 10.0, "conversation_depth": 25.0},
    "cadence_rules": {"followup_interval_days": 3},
    "voice_provider": "sarvam"
  }
}
```

#### 2. Update Settings
Saves settings updates.
* **Method:** `PUT`
* **Path:** `/api/v1/settings/agent/{agent_id}` or `/api/v1/settings/team/{org_id}`
* **Body:** (Submit fields to change)
```json
{
  "preferred_language": "hi",
  "cadence_rules": {"followup_interval_days": 2}
}
```
* **Response (Success):** `HTTP 200 OK`
```json
{
  "data": {
    "id": "s47ac10b-58cc-4372-a567-0e02b2c3d100",
    "status": "updated"
  }
}
```

---

## 3. Important Error Handling Specs

The backend enforces strict validation policies. The frontend must handle the following compliance error code:

### DND Conflict Block (`HTTP 409 Conflict`)
If the broker attempts to trigger an outgoing campaign or approve a follow-up draft to a lead who has requested DND state, the backend rejects it with `HTTP 409`.
* **Triggered by:** `POST /followups/{id}/approve`
* **Response Payload:**
```json
{
  "detail": "Action blocked: Lead f47ac10b-58cc-4372-a567-0e02b2c3d472 is in DND (Do Not Disturb) state."
}
```
* **Frontend Recommendation:** Show a blocking toast notification: *"Cannot send: Lead is currently registered under Do-Not-Disturb (DND) status."*
