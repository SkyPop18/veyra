import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ThemeToggle } from '../components/ui/Primitives';
import { CURRENT_TERMS_VERSION } from '../lib/core';

function LegalShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen veyra-bg text-[#09090b] dark:text-[#fafafa]">
      <header className="border-b border-[#e4e4e7] dark:border-white/10 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-[#52525b] dark:text-[#a1a1aa] hover:text-[#09090b] dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Veyra</span>
          </Link>
          <div className="flex items-center gap-4 text-xs">
            <Link to="/privacy" className="text-[#52525b] dark:text-[#a1a1aa] hover:text-[#3b82f6]">
              Privacy Policy
            </Link>
            <Link to="/terms" className="text-[#52525b] dark:text-[#a1a1aa] hover:text-[#3b82f6]">
              Terms &amp; Conditions
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        <div className="space-y-2 border-b border-[#e4e4e7] dark:border-white/10 pb-6">
          <p className="font-mono-num text-xs font-semibold text-[#3b82f6]">
            Version {CURRENT_TERMS_VERSION} · Last Updated: November 22, 2026
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-[#52525b] dark:text-[#a1a1aa]">{subtitle}</p>
        </div>

        <article className="glass-surface p-6 sm:p-10 space-y-8 text-sm leading-relaxed text-[#3f3f46] dark:text-[#d4d4d8]">
          {children}
        </article>
      </main>
    </div>
  );
}

export function PrivacyPolicyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      subtitle="Clear, plain-language explanation of what Veyra collects, why we collect it, how long we keep it, and how you control your data."
    >
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-[#09090b] dark:text-white">
          1. Who We Are &amp; Contact
        </h2>
        <p>
          Veyra is a strictly <strong>view-only</strong> global currency and cryptocurrency analytics platform. For privacy requests, data inquiries, or security reports, contact us at{' '}
          <a href="mailto:akshatbhopali@gmail.com" className="text-[#3b82f6] font-medium hover:underline">
            akshatbhopali@gmail.com
          </a>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-[#09090b] dark:text-white">
          2. Data We Collect, Why We Collect It, and Retention
        </h2>
        <div className="overflow-x-auto rounded-xl border border-[#e4e4e7] dark:border-white/10">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#e4e4e7] dark:border-white/10 bg-[#f4f4f5]/80 dark:bg-white/[0.04] text-[#09090b] dark:text-white">
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold">Exact Data Stored</th>
                <th className="py-3 px-4 font-semibold">Purpose</th>
                <th className="py-3 px-4 font-semibold">Retention Period</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e4e7]/70 dark:divide-white/5">
              <tr>
                <td className="py-3 px-4 font-medium text-[#09090b] dark:text-white">Account &amp; Consent</td>
                <td className="py-3 px-4">Email address, full name, optional avatar URL, Terms/Privacy acceptance timestamps &amp; version ({CURRENT_TERMS_VERSION})</td>
                <td className="py-3 px-4">Authentication, account identity, and proof of legal consent</td>
                <td className="py-3 px-4">Until you delete your account</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-[#09090b] dark:text-white">Workspace Preferences</td>
                <td className="py-3 px-4">Watchlist symbols, price alert targets, followed news categories, bookmarked articles</td>
                <td className="py-3 px-4">Powering your dashboard, alerts, and saved research</td>
                <td className="py-3 px-4">Until removed by you or account deletion</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-[#09090b] dark:text-white">News Interactions</td>
                <td className="py-3 px-4">Like, dislike, save, view, and search topic tags inside Veyra</td>
                <td className="py-3 px-4">Personalizing your in-app market news feed</td>
                <td className="py-3 px-4">180 days (rolling window) or until account deletion</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-[#09090b] dark:text-white">AI Analysis Queries (Pro)</td>
                <td className="py-3 px-4">Your prompts, generated market analysis responses, and token count</td>
                <td className="py-3 px-4">Delivering AI research and showing your recent chat history</td>
                <td className="py-3 px-4">90 days (rolling window) or until account deletion</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-[#09090b] dark:text-white">Manual Pro Payments</td>
                <td className="py-3 px-4">Submitted transaction reference ID, payment method, optional proof URL, approval status</td>
                <td className="py-3 px-4">Manually verifying ₹200/month Pro activation and preventing fraud</td>
                <td className="py-3 px-4">Retained for accounting &amp; dispute records as required by law</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-[#09090b] dark:text-white">Optional Discord Link</td>
                <td className="py-3 px-4">Discord numeric user ID and username (only if you choose to connect)</td>
                <td className="py-3 px-4">Forwarding your price alerts and syncing bot slash commands</td>
                <td className="py-3 px-4">Until you disconnect Discord or delete your account</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-[#09090b] dark:text-white">
          3. What We Do NOT Do
        </h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>We <strong>never</strong> execute trades, hold funds, connect wallets, or ask for private keys or seed phrases.</li>
          <li>We <strong>never</strong> collect or store credit cards, debit cards, CVVs, or bank passwords.</li>
          <li>We <strong>never</strong> sell, rent, or broker your personal data to advertisers or data brokers.</li>
          <li>We <strong>never</strong> load third-party cross-site advertising trackers or behavioral ad pixels.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-[#09090b] dark:text-white">
          4. Service Providers (Subprocessors)
        </h2>
        <p>We rely on trusted infrastructure providers strictly to operate Veyra:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Cloud Infrastructure &amp; Security</strong> — Encrypted authentication, session protection, and resilient database storage.</li>
          <li><strong>AI Intelligence Engine</strong> — Processes Pro tier market intelligence prompts on secure servers (no personal account data is transmitted).</li>
          <li><strong>ExchangeRate-API, CoinGecko &amp; Alternative.me</strong> — Live public fiat rates, cryptocurrency prices, and sentiment indices.</li>
          <li><strong>Discord</strong> — Only used if you voluntarily link your Discord account or run Veyra bot commands.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-[#09090b] dark:text-white">
          5. Essential Cookies &amp; Local Storage
        </h2>
        <p>
          Veyra uses <strong>essential cookies and session storage only</strong> to keep you signed in securely and to remember your dark/light theme preference. We do not use advertising or marketing cookies.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-[#09090b] dark:text-white">
          6. Your Privacy Rights &amp; Self-Service Controls
        </h2>
        <p>
          You have the right to access, correct, export, or permanently delete your personal data at any time:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Download My Data:</strong> Export a complete JSON copy of your profile, watchlists, alerts, bookmarks, and AI history directly from <em>Dashboard → Settings → General</em>.</li>
          <li><strong>Delete My Account:</strong> Permanently erase your account and associated workspace data directly from <em>Dashboard → Settings → General</em>, or by emailing{' '}
            <a href="mailto:akshatbhopali@gmail.com" className="text-[#3b82f6] hover:underline">
              akshatbhopali@gmail.com
            </a>.
          </li>
          <li><strong>Sign Out Everywhere:</strong> Revoke all active sessions across devices anytime in Settings.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-[#09090b] dark:text-white">
          7. Age Requirement
        </h2>
        <p>
          Veyra is intended for users aged <strong>13 years or older</strong> (or the minimum digital consent age in your jurisdiction). We do not knowingly collect data from children under 13.
        </p>
      </section>
    </LegalShell>
  );
}

export function TermsPage() {
  return (
    <LegalShell
      title="Terms & Conditions"
      subtitle="Rules governing your use of the Veyra view-only market intelligence platform."
    >
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-[#09090b] dark:text-white">
          1. View-Only Informational Service — Not Financial Advice
        </h2>
        <p>
          Veyra provides currency strength metrics, live exchange rates, cryptocurrency market data, aggregated news, and AI-assisted research summaries strictly for <strong>informational and educational purposes</strong>. Nothing on Veyra constitutes investment, trading, tax, legal, or financial advice. You are solely responsible for any financial decisions you make outside Veyra.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-[#09090b] dark:text-white">
          2. Accounts, Eligibility &amp; Security
        </h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>You must be at least <strong>13 years old</strong> to create an account.</li>
          <li>You must verify your email address and accept the current Terms &amp; Conditions and Privacy Policy ({CURRENT_TERMS_VERSION}) before accessing the dashboard.</li>
          <li>Passwords must be at least 10 characters long. You are responsible for keeping your login credentials confidential.</li>
          <li>If we materially update these Terms, we will bump the version number and ask you to review and accept the updated terms before continuing.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-[#09090b] dark:text-white">
          3. Veyra Pro Subscription &amp; Manual Payments
        </h2>
        <p>
          <strong>Pro is ₹200/month. Payments are handled manually.</strong> We do not process recurring card charges or auto-renewals. To purchase or renew Pro, reach out via Discord (<strong>statusbrew</strong>), email (
          <a href="mailto:akshatbhopali@gmail.com" className="text-[#3b82f6] hover:underline">
            akshatbhopali@gmail.com
          </a>
          ), or{' '}
          <a
            href="https://supportme-akshat.netlify.app/supportme"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#3b82f6] hover:underline"
          >
            supportme-akshat.netlify.app/supportme
          </a>
          , then submit your payment reference in Settings. Once verified, Pro access remains active for 30 days and automatically returns to the Free tier upon expiry.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-[#09090b] dark:text-white">
          4. Acceptable Use
        </h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Do not attempt to bypass authentication, privilege controls, rate limits, or subscription gates.</li>
          <li>Do not scrape, overload, or redistribute Veyra API responses or third-party market feeds.</li>
          <li>We may suspend accounts that abuse the platform, submit fraudulent payment claims, or violate applicable law.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-[#09090b] dark:text-white">
          5. Data Accuracy &amp; Limitation of Liability
        </h2>
        <p>
          Market quotes, exchange rates, RSS headlines, and AI summaries are sourced from third-party providers and may be delayed, incomplete, or temporarily unavailable. Veyra is provided &ldquo;as is&rdquo; without warranties of any kind. To the maximum extent permitted by law, Veyra and its operators are not liable for any trading losses, missed opportunities, or indirect damages arising from use of the platform.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-[#09090b] dark:text-white">
          6. Contact
        </h2>
        <p>
          Questions regarding these Terms may be sent to{' '}
          <a href="mailto:akshatbhopali@gmail.com" className="text-[#3b82f6] hover:underline">
            akshatbhopali@gmail.com
          </a>
          .
        </p>
      </section>
    </LegalShell>
  );
}
