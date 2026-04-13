import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — Sturgeon Spirits',
}

export default function PrivacyPage() {
  const updated = 'April 12, 2026'

  return (
    <div className="max-w-lg mx-auto px-4 py-10 space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#242622]">Privacy Policy</h1>
        <p className="text-xs text-[#9E8F7E] mt-1">Last updated: {updated}</p>
      </div>

      <Section title="Who we are">
        <P>
          Sturgeon Spirits Inc. ("we", "us", "our") operates the Spearers Club
          loyalty program and the website at club.sturgeonspirits.com. This
          policy explains what personal information we collect, why we collect
          it, and how we protect it.
        </P>
      </Section>

      <Section title="What we collect">
        <P>When you create an account or use our app we may collect:</P>
        <List items={[
          'Email address — used to sign you in and send transactional messages (check-in confirmations, reward notifications).',
          'Name and display name — shown on leaderboards and to staff when you redeem a reward.',
          'Phone number (optional) — used only to match your account with an existing Toast loyalty card.',
          'Birthday (month and day only, no year) — used to send you a free birthday cocktail when you check in on your birthday.',
          'Points activity and event history — check-ins, mission completions, leaderboard scores, and reward redemptions.',
          'Device information — browser type and push notification subscription endpoint, used only to deliver push notifications you opted into.',
        ]} />
      </Section>

      <Section title="What we do NOT collect">
        <List items={[
          'We do not collect payment or credit card information through the app.',
          'We do not collect precise geolocation. Check-in requires scanning a QR code physically present at the bar.',
          'We do not collect your birth year or full date of birth.',
          'We do not sell, rent, or share your personal information with third parties for marketing purposes.',
        ]} />
      </Section>

      <Section title="How we use your information">
        <List items={[
          'To operate the loyalty program — awarding points, tracking missions, displaying leaderboard standings.',
          'To verify your identity when you sign in (via one-time email code).',
          'To send you push notifications you opted into (event reminders, reward alerts).',
          'To detect your birthday and auto-apply your free birthday cocktail.',
          'To match your app account with your existing Toast loyalty card so your historical points carry over.',
          'To generate aggregate, anonymous statistics (total check-ins, popular rewards) for our internal use.',
        ]} />
      </Section>

      <Section title="Third-party services">
        <P>We use the following services to operate the app:</P>
        <List items={[
          'Supabase (database and authentication) — your data is stored in Supabase-managed infrastructure. Their privacy policy applies to data at rest.',
          'Netlify (hosting) — serves the web application. Netlify does not access your personal data.',
          'Toast POS (optional integration) — if you link your Toast loyalty card, we read your Toast points balance and transaction history to import them into the app. We do not write data back to Toast.',
        ]} />
        <P>
          We do not use any advertising networks, analytics trackers, or
          third-party cookies.
        </P>
      </Section>

      <Section title="Data retention">
        <P>
          We keep your account and activity data for as long as your account is
          active. If you ask us to delete your account, we will remove your
          personal information within 30 days. Anonymized, aggregate data (e.g.
          total check-ins per week) may be retained indefinitely.
        </P>
      </Section>

      <Section title="Your rights">
        <P>You can, at any time:</P>
        <List items={[
          'View your data — your profile, points history, and activity are visible in the app.',
          'Update your information — edit your display name, birthday, or notification preferences from your profile.',
          'Request deletion — email us at the address below and we will delete your account and personal data within 30 days.',
          'Opt out of push notifications — revoke notification permission in your browser settings at any time.',
        ]} />
      </Section>

      <Section title="Security">
        <P>
          All data is transmitted over HTTPS. Authentication uses one-time
          email codes — we never store passwords. Database access is protected
          by row-level security policies that ensure customers can only read
          their own data. Staff access is restricted to authorized accounts.
        </P>
      </Section>

      <Section title="Children">
        <P>
          The Spearers Club is intended for customers of legal drinking age
          (21+). We do not knowingly collect information from anyone under 21.
          If we learn that we have, we will delete it promptly.
        </P>
      </Section>

      <Section title="Changes to this policy">
        <P>
          We may update this policy from time to time. Material changes will be
          noted with a new "last updated" date at the top of this page. Your
          continued use of the app after changes constitutes acceptance.
        </P>
      </Section>

      <Section title="Contact">
        <P>
          Questions or requests? Email us at{' '}
          <a href="mailto:info@sturgeonspirits.com" className="text-[#96321F] underline">
            info@sturgeonspirits.com
          </a>
          {' '}or ask any staff member in person.
        </P>
      </Section>

      <div className="pt-4 border-t border-[#D4CFC3]">
        <Link href="/club" className="text-sm text-[#9E8F7E] hover:text-[#7E613F] transition-colors">
          ← Back to Spearers Club
        </Link>
      </div>
    </div>
  )
}

/* ── Tiny layout helpers (no external deps) ──────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold text-[#242622] uppercase tracking-wider">{title}</h2>
      {children}
    </section>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[#4a4a4a] leading-relaxed">{children}</p>
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 pl-1">
      {items.map((item, i) => (
        <li key={i} className="text-sm text-[#4a4a4a] leading-relaxed flex gap-2">
          <span className="text-[#9E8F7E] shrink-0">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
