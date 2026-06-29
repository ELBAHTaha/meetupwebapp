import { LEGAL, LegalLayout, List, Section } from './LegalLayout';

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <Section title="1. Introduction">
        <p>
          This Privacy Policy explains how {LEGAL.entity} (&ldquo;{LEGAL.brand}&rdquo;, &ldquo;we&rdquo;,
          &ldquo;us&rdquo;) collects, uses and protects your personal data when you use the {LEGAL.brand} website and
          applications at {LEGAL.domain} (the &ldquo;Service&rdquo;). We are the controller of your personal data.
        </p>
      </Section>

      <Section title="2. Information we collect">
        <List
          items={[
            'Account information — your name, email address, password (stored hashed) and the type of account you hold.',
            'Profile information — photos, bio, interests, city, language and other details you choose to add.',
            'Identity verification — if you opt into verification, the selfie and pose images you submit so our team can confirm you are a real person.',
            'Activity and usage data — the activities you create, join or message about, and how you interact with the Service.',
            'Location information — the general area and, once you join an activity, the precise location needed to attend.',
            'Payment information — purchases are handled by Paddle (see section 6). We receive confirmation and limited billing details, but not your full card number.',
            'Device and log data — IP address, browser/device type and basic diagnostics used to keep the Service secure and working.',
            'Communications — messages you send to other users through the Service and any support requests you send to us.',
          ]}
        />
      </Section>

      <Section title="3. How we use your information">
        <List
          items={[
            'To provide, maintain and improve the Service and its features;',
            'To create and manage your account and authenticate you;',
            'To enable activities, group chats, notifications and verification;',
            'To process purchases and manage subscriptions (via Paddle);',
            'To keep the Service safe — preventing fraud, abuse and harmful behaviour, and enforcing our Terms;',
            'To communicate with you about your account, updates and support; and',
            'To comply with our legal obligations.',
          ]}
        />
      </Section>

      <Section title="4. Legal bases for processing">
        <p>
          Where applicable law (such as the GDPR) requires it, we process personal data on the bases of performing our
          contract with you, our legitimate interests in operating and securing the Service, your consent (for example
          for identity verification or optional communications), and compliance with legal obligations.
        </p>
      </Section>

      <Section title="5. How we share information">
        <p>We do not sell your personal data. We share it only as needed:</p>
        <List
          items={[
            'With other users — your public profile and activity details are visible to other members as part of how the Service works.',
            'With service providers — including Paddle (payments), our hosting provider, and our email provider, who process data on our behalf.',
            'For legal reasons — where required by law, regulation, or to protect the rights, safety and property of our users or others.',
            'In a business transfer — if we are involved in a merger, acquisition or sale of assets, subject to this Policy.',
          ]}
        />
      </Section>

      <Section title="6. Payments and Paddle">
        <p>
          Our order process is conducted by our online reseller{' '}
          <strong className="font-semibold text-ink">Paddle.com</strong>, the merchant of record for our products.
          Paddle handles customer service enquiries related to payments and processes your payment data in accordance
          with its own{' '}
          <a
            href="https://www.paddle.com/legal/privacy"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-clay hover:text-clay-press underline underline-offset-2"
          >
            privacy policy
          </a>
          . We do not receive or store your full payment-card details.
        </p>
      </Section>

      <Section title="7. Cookies and local storage">
        <p>
          We use cookies and similar browser storage to keep you signed in, remember your preferences (such as language
          and theme), and operate the Service securely. You can control cookies through your browser settings, although
          some features may not work without them.
        </p>
      </Section>

      <Section title="8. Data retention">
        <p>
          We keep personal data for as long as your account is active and for as long as needed to provide the Service,
          comply with our legal obligations, resolve disputes and enforce our agreements. When you delete your account,
          we delete or anonymise your personal data, except where we must retain it by law.
        </p>
      </Section>

      <Section title="9. Security">
        <p>
          We use reasonable technical and organisational measures to protect your data, including encryption in transit
          and hashed passwords. No method of transmission or storage is completely secure, so we cannot guarantee
          absolute security.
        </p>
      </Section>

      <Section title="10. Your rights">
        <p>
          Depending on where you live, you may have the right to access, correct, delete or export your personal data,
          to object to or restrict certain processing, and to withdraw consent. You can manage much of your information
          in the app, or contact us at {LEGAL.email} to exercise these rights. You also have the right to complain to
          your local data-protection authority.
        </p>
      </Section>

      <Section title="11. International transfers">
        <p>
          Your data may be processed in countries other than your own, including by our service providers. Where
          required, we rely on appropriate safeguards (such as standard contractual clauses) for these transfers.
        </p>
      </Section>

      <Section title="12. Children">
        <p>
          The Service is not directed to anyone under 18, and we do not knowingly collect personal data from children.
          If you believe a child has provided us with personal data, contact us so we can remove it.
        </p>
      </Section>

      <Section title="13. Changes to this Policy">
        <p>
          We may update this Privacy Policy from time to time. We will update the &ldquo;Last updated&rdquo; date above
          and, for material changes, provide additional notice where appropriate.
        </p>
      </Section>

      <Section title="14. Contact us">
        <p>
          For privacy questions or requests, contact us at{' '}
          <a
            href={`mailto:${LEGAL.email}`}
            className="font-medium text-clay hover:text-clay-press underline underline-offset-2"
          >
            {LEGAL.email}
          </a>
          .
        </p>
      </Section>
    </LegalLayout>
  );
}
