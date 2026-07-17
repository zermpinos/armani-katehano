import React from "react";
import Head from "next/head";
import Link from "next/link";
import Layout from "@/components/ui/Layout";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-[11px] font-black tracking-[0.14em] uppercase text-ak-red-text mb-3">{title}</h2>
      <div className="text-[13px] text-ak-text-dim leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 py-2.5 border-b border-ak-border last:border-0">
      <span className="w-40 shrink-0 text-[11px] font-black tracking-[0.08em] uppercase text-ak-text-sub">{label}</span>
      <span className="text-[13px] text-ak-text">{value}</span>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <Layout
      title="Privacy Notice"
      ogDescription="How Armani Katehano handles your email address for game emails."
    >
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="max-w-[680px] mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-ak-text tracking-[-0.02em] mb-1">Privacy Notice</h1>
          <p className="text-[12px] text-ak-text-dim">Email subscription · Last updated May 2026</p>
          <p className="text-[11px] text-ak-text-dim mt-1">May 2026: scope of email subscription widened to include post-game recap emails (referred to together as &quot;game emails&quot;).</p>
        </div>

        <div className="rounded-2xl border border-ak-border bg-ak-surface p-6 mb-8">
          <Section title="Who we are">
            <p>
              Armani Katehano Basketball Club (&quot;we&quot;, &quot;us&quot;) operates this site to publish
              season statistics, roster announcements, and post-game recaps. For questions about this notice, contact us at{" "}
              <a
                href="mailto:webmaster@armani-katehano.com"
                className="text-ak-red-text underline"
              >
                webmaster@armani-katehano.com
              </a>
              .
            </p>
          </Section>

          <Section title="What data we collect and why">
            <p>
              We collect only your <strong className="text-ak-text">email address</strong>, submitted voluntarily
              through the subscribe form on the homepage. We use it solely to send you Armani Katehano
              <strong className="text-ak-text"> game emails</strong>: roster announcements before games and
              post-game recap emails after the box score is published.
            </p>
            <p>The legal basis for processing is your explicit consent (GDPR Art. 6(1)(a)), given through the double opt-in confirmation step.</p>
          </Section>

          <Section title="How long we keep your data">
            <div className="rounded-xl overflow-hidden border border-ak-border divide-y divide-ak-border">
              <Row label="Unconfirmed" value="Deleted after 24 hours if the confirmation link is never clicked." />
              <Row label="Active subscriber" value="Kept while you remain subscribed. Deleted automatically if no game email is sent for 1 year." />
              <Row label="Unsubscribed" value="Deleted immediately when you click Unsubscribe." />
            </div>
          </Section>

          <Section title="Cookies">
            <p>
              We do not use tracking or advertising cookies. The site sets two functional cookies, both strictly necessary for security:
            </p>
            <div className="rounded-xl overflow-hidden border border-ak-border divide-y divide-ak-border mt-3">
              <Row label="Session cookie" value="Set only when you log in to the admin or coach portal. Expires on sign-out. Never set for public visitors." />
              <Row label="CSRF token" value="Set alongside the session cookie to prevent cross-site request forgery. Expires with the session." />
            </div>
            <p className="mt-2">No consent banner is shown because no tracking cookies are set for public visitors.</p>
          </Section>

          <Section title="Analytics">
            <p>
              This site does not use a third-party analytics service. It records anonymous <strong className="text-ak-text">Web Vitals</strong>, aggregate page-performance measurements such as load and responsiveness timings, on its own infrastructure. No cookies are set, nothing is shared with a third party, and no personally identifiable information is collected.
            </p>
          </Section>

          <Section title="Sub-processors">
            <p>We share your email address with the following third-party services to operate the subscription feature:</p>
            <div className="rounded-xl overflow-hidden border border-ak-border divide-y divide-ak-border mt-3">
              <Row label="Neon (database)" value="Stores subscriber records. Hosted on AWS eu-central-1 (Frankfurt, EU)." />
              <Row label="Brevo (email)" value="Delivers confirmation and game emails. Brevo SAS (Sendinblue), Paris, France. EU-based, subject to GDPR." />
              <Row label="Vercel (hosting)" value="Serves the web application. Vercel Inc., United States. Transfer based on Vercel's Standard Contractual Clauses." />
            </div>
          </Section>

          <Section title="Your rights">
            <p>Under GDPR you have the right to access, rectify, or erase your personal data, and to withdraw consent at any time.</p>
            <p>To <strong className="text-ak-text">unsubscribe</strong>, use the link at the bottom of any game email. Your record is deleted immediately. </p>
            <p>
              For any other request, email{" "}
              <a href="mailto:webmaster@armani-katehano.com" className="text-ak-red-text underline">
                webmaster@armani-katehano.com
              </a>
              .
            </p>
          </Section>

          <Section title="Security">
            <p>
              Subscription tokens are stripped from browser history and error reports. Unconfirmed addresses are
              purged daily. All data is transmitted over TLS.
            </p>
            <p>
              Game emails contain no tracking pixels, no open-rate monitoring, and no click tracking. We do not know whether you read them.
            </p>
          </Section>
        </div>

        <div className="text-center">
          <Link
            href="/"
            className="inline-block px-5 py-2 rounded-lg bg-ak-surface border border-ak-border2 text-ak-text text-xs font-black tracking-[0.1em] uppercase"
          >
            Back to site
          </Link>
        </div>
      </div>
    </Layout>
  );
}
