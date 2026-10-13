import type { Metadata } from "next";
import LegalShell, { Rows, Section } from "@/components/legal/LegalShell";
import {
  BREACH_NOTICE_HOURS,
  COMPANY,
  CONTACT_EMAIL,
  CUSTOMER_KEYWORDS,
  GOOGLE_SCOPES,
  PRODUCT,
  REQUEST_SLA_DAYS,
  RETENTION_MONTHS,
  SUBPROCESSORS,
} from "@/lib/legal";

/**
 * `/privacy` — public, no sign-in, same domain as the home page.
 *
 * Written for two readers who want different things, which is why it says the
 * same facts twice in different places:
 *
 * * **A Google OAuth reviewer**, who checks that this page exists on the
 *   homepage's domain, opens without a login, names the app, lists the Google
 *   scopes, and carries the Limited Use disclosure. Missing any one of those is
 *   a rejection.
 * * **A customer or an agency** under India's DPDP Act, who needs to know who
 *   holds their data, why, who else sees it, how long, and how to get it out or
 *   deleted — with a contact that answers.
 *
 * Every figure here is the one the product enforces (`src/lib/legal.ts` names
 * the backend constants). Nothing claims a certification we do not hold, and
 * nothing promises security in absolute terms.
 */
export const metadata: Metadata = {
  title: { absolute: `Privacy Policy — ${PRODUCT}` },
  description: `How ${COMPANY} handles personal data in ${PRODUCT}: what is collected, who processes it, how long it is kept, and how to have it exported or deleted.`,
};

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      intro={`${PRODUCT} is a customer-relationship tool used by real-estate agencies to answer property enquiries on WhatsApp and by phone. This page explains what personal data passes through it, who sees that data, and what you can ask us to do with it.`}
    >
      <Section title="Two different roles, and which one applies to you">
        <p>
          Almost every piece of personal data in {PRODUCT} belongs to a customer of an
          estate agency — somebody who enquired about a property. For that data the{" "}
          <strong>agency is the data fiduciary</strong>: it decides what is collected and
          why. {COMPANY} is the <strong>data processor</strong>, storing and handling it
          only on that agency&apos;s instructions, keeping each agency&apos;s data
          separate from every other agency&apos;s, and deleting or exporting it when the
          agency asks.
        </p>
        <p>
          So if you are a customer who was messaged or called, the agency you enquired
          with is the first place to go, and this page tells you what they can do. If you
          cannot reach them, write to us at{" "}
          <a className="underline underline-offset-2" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>{" "}
          and we will route it.
        </p>
        <p>
          For the agency&apos;s own account — the staff who sign in, their email, their
          connected integrations — {COMPANY} is the fiduciary, and the rest of this page
          applies to us directly.
        </p>
      </Section>

      <Section title="What is collected">
        <Rows
          items={[
            {
              label: "From a customer",
              body: "Their name and phone number, the WhatsApp messages they exchange with the agency, what they said they are looking for (budget, size, locality, timing), site visits booked, and — when the agency's assistant phones them — the call recording's transcript and a summary of it.",
            },
            {
              label: "From an agency's staff",
              body: "Name, email, phone, the organisation they belong to, and what they do in the product.",
            },
            {
              label: "From connected accounts",
              body: "Only what the specific integration needs, listed under Google data below. Credentials for connected services are stored encrypted and are never shown back in any screen or API response.",
            },
            {
              label: "Automatically",
              body: "Ordinary server logs — a request's time, path and outcome — kept for operating and debugging the service.",
            },
          ]}
        />
      </Section>

      <Section title="Why, and on what basis">
        <p>
          Customer data is used to answer the enquiry the customer started: replying on
          WhatsApp, sending matching property options, arranging and following up site
          visits, and — where the agency has the customer&apos;s permission — phoning
          them about it. It is not sold, and it is not used to build advertising profiles.
        </p>
        <p>
          The first message every customer receives states who holds their details, what
          for, and how to stop. That notice is stored word for word against their record,
          so what a person was told can be shown later rather than reconstructed.
        </p>
      </Section>

      <Section title="Automated messages and calls">
        <p>
          Replies on WhatsApp are generated automatically. Phone calls are placed by an
          automated voice assistant, and every call opens by saying so before anything
          else — a caller is told they are speaking to a machine, not left to work it out.
        </p>
        <p>
          A call is only placed to somebody who recently enquired, and only after they
          have been asked on WhatsApp whether a call is welcome. Calls are transcribed and
          summarised so the agency has a record of what was agreed.
        </p>
      </Section>

      <Section title="Your choices, as a customer">
        <Rows items={CUSTOMER_KEYWORDS.map((item) => ({ label: `Reply ${item.word}`, body: item.means }))} />
        <p>
          You can also ask for a copy of everything held about you. A request for access
          or erasure is answered within {REQUEST_SLA_DAYS} days. Some records are kept
          with your name and number removed where the agency has to retain the underlying
          transaction — a commission registration or a billing line, for example — and the
          erasure receipt says exactly what was deleted and what was kept.
        </p>
      </Section>

      <Section title="Google user data">
        <p>
          Connecting a Google account is optional and is done by an individual agent for
          their own calendar, or by an agency for one property spreadsheet.{" "}
          {PRODUCT} requests only these scopes:
        </p>
        <Rows items={GOOGLE_SCOPES.map((item) => ({ label: item.scope, body: item.why }))} />
        <p>
          <strong>Limited Use.</strong> {PRODUCT}&apos;s use and transfer of information
          received from Google APIs adheres to the{" "}
          <a
            className="underline underline-offset-2"
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. Specifically: data from Google APIs is
          used only to provide the features described above; it is not transferred to
          others except as needed to provide those features, for security, or where the
          law requires it; it is not used for advertising; and no human reads it except
          with your explicit permission, for security purposes, or where the law requires
          it.
        </p>
        <p>
          Calendar access writes only events this product created, and reads only when you
          are busy — not the contents of your other appointments. We do not use Google
          data to train any machine-learning model. You can disconnect at any time from
          the visit calendar screen, or revoke access in your Google account; either stops
          all further access immediately.
        </p>
      </Section>

      <Section title="Who else sees the data">
        <p>
          {PRODUCT} is built on services that necessarily see some of what passes through
          it. This is the full set, not a comfortable subset:
        </p>
        <Rows
          items={SUBPROCESSORS.map((item) => ({
            label: item.optional ? `${item.name} (optional)` : item.name,
            body: item.purpose,
          }))}
        />
        <p>
          Some of these process data outside India. We do not otherwise sell, rent or
          share personal data, and we disclose it to authorities only where the law
          obliges us to.
        </p>
      </Section>

      <Section title="How long it is kept">
        <p>
          A customer&apos;s file is kept for up to {RETENTION_MONTHS} months after the last
          contact with them, after which the agency is shown it and can delete it. An
          agency can delete any customer&apos;s data sooner, and we delete or return an
          agency&apos;s whole dataset when they ask or when their account closes.
        </p>
        <p>
          Records of data requests themselves outlive the data they concern, holding a
          one-way fingerprint of the phone number rather than the number — the proof that
          a deletion happened on the person&apos;s own instruction must not be the one
          place the deleted number survives.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Access is scoped per organisation throughout, so one agency cannot read or change
          another&apos;s records. Credentials for connected services are encrypted at rest.
          Traffic is served over HTTPS. Access to production data is limited to the people
          who operate the service.
        </p>
        <p>
          No system is immune. If we become aware of a breach affecting personal data we
          aim to notify affected agencies within {BREACH_NOTICE_HOURS} hours of becoming
          aware of it, alongside whatever regulatory notification applies.
        </p>
      </Section>

      <Section title="Children">
        <p>
          {PRODUCT} is a business tool and is not directed at children. We do not knowingly
          collect data from anyone under 18.
        </p>
      </Section>

      <Section title="Changes, and how to reach us">
        <p>
          If this policy changes materially we will update the date at the top of this page
          and tell account holders. For a data request, a complaint, or any question about
          this page — including grievance redressal under the Digital Personal Data
          Protection Act, 2023 — write to{" "}
          <a className="underline underline-offset-2" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          . We aim to respond within {REQUEST_SLA_DAYS} days.
        </p>
      </Section>
    </LegalShell>
  );
}
