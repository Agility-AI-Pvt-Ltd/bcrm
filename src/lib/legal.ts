/**
 * Every real-world fact the public Privacy and Terms pages state, in one place.
 *
 * These two pages are not marketing copy: Google opens them during OAuth
 * verification, and India's DPDP Act requires a published point of contact for
 * data requests. So the rule here is that nothing on either page is invented —
 * each figure below is the one the product actually enforces, and where a value
 * came from the backend it names the constant, so a change there is a change
 * here rather than a page that quietly starts lying.
 *
 * NOT LEGAL ADVICE. These pages were drafted to describe this system accurately;
 * they have not been reviewed by a lawyer. Have one read them before relying on
 * them in a dispute.
 */

export const COMPANY = "Agility AI";
export const PRODUCT = "EstateFlow";

/** Published on both pages. DPDP needs a reachable contact; Google checks it. */
export const CONTACT_EMAIL = "agilityaibusiness@gmail.com";

/** Governing law and the courts named in the Terms. */
export const JURISDICTION = "Ghaziabad, Uttar Pradesh, India";

export const HOME_URL = "https://bcrm-delta.vercel.app";

/**
 * Shown as "last updated". A date in the future would be a lie and a date that
 * silently tracks `new Date()` is worse — it would claim the policy changed on
 * whatever day somebody happened to read it. So it is set by hand, and should be
 * changed when the text is.
 */
export const EFFECTIVE_DATE = "13 October 2026";

/** `consent.DEFAULT_RETENTION_MONTHS` in the backend. */
export const RETENTION_MONTHS = 24;

/** `consent.DEFAULT_REQUEST_SLA_DAYS`. */
export const REQUEST_SLA_DAYS = 30;

/** `consent.DEFAULT_BREACH_NOTICE_HOURS`. */
export const BREACH_NOTICE_HOURS = 72;

/**
 * The services that see customer data on our behalf, and the one sentence each
 * that says why. A sub-processor list is the part of a privacy policy people
 * actually check, and an incomplete one is the part that gets a company in
 * trouble — so this is the set the code really calls, not a safe-sounding
 * subset. Add to it when you add an integration.
 */
export const SUBPROCESSORS: Array<{ name: string; purpose: string; optional?: boolean }> = [
  {
    name: "Meta Platforms (WhatsApp Business Cloud API)",
    purpose:
      "Delivers and receives the WhatsApp messages. Meta sees the phone number and message content, as it does for any WhatsApp message.",
  },
  {
    name: "Vobiz",
    purpose:
      "Places the automated phone calls and carries the audio. Sees the number dialled and the call audio.",
  },
  {
    name: "Sarvam AI",
    purpose:
      "Turns call audio into text and text into speech, so the assistant can hold a conversation in Indian languages.",
  },
  {
    name: "OpenAI",
    purpose:
      "The language model behind the assistant's replies on chat and on calls. Receives the conversation it is replying to.",
  },
  {
    name: "Google",
    purpose:
      "Only if an agent connects it: Google Calendar for their own site-visit diary, and Google Sheets when an agency syncs its property list from a sheet.",
    optional: true,
  },
  {
    name: "Zoho",
    purpose: "Only if an agency connects it: lead records are read from and matched against Zoho CRM.",
    optional: true,
  },
  {
    name: "Vercel",
    purpose: "Hosts and serves this web application.",
  },
];

/**
 * The Google scopes the product can request, and the plain reason for each.
 *
 * Google's verification reviewers compare this list against what the OAuth
 * client asks for, so it has to match `google_calendar_scopes` and the Sheets
 * integration exactly. A scope listed here that the app does not use is as much
 * of a problem as one it uses and does not list.
 */
export const GOOGLE_SCOPES: Array<{ scope: string; why: string }> = [
  {
    scope: "calendar.events",
    why: "Create and update the site visits you are assigned to as events in your own calendar, and remove them when a visit is reassigned. It only ever touches events this product created.",
  },
  {
    scope: "calendar.readonly",
    why: "Read when you are busy, so a customer cannot book a site visit on top of something else in your day. It reads the times you are busy, not what the appointments are.",
  },
  {
    scope: "spreadsheets.readonly / drive.file",
    why: "Only when an agency chooses to sync its property list from a Google Sheet: read the rows of that one sheet. No other file in your Drive is read.",
  },
];

/** The two keywords a customer can reply with on WhatsApp, as the code reads them. */
export const CUSTOMER_KEYWORDS = [
  { word: "STOP", means: "Stop all messages. Nothing further is sent to that number." },
  {
    word: "DELETE",
    means: `Ask for their data to be erased. Messaging stops at once and the request is logged for the agency to action within ${REQUEST_SLA_DAYS} days.`,
  },
];
