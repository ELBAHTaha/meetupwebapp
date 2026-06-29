import { LEGAL, LegalLayout, List, Section } from './LegalLayout';

export function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <Section title="1. Agreement to these terms">
        <p>
          These Terms of Service (the &ldquo;Terms&rdquo;) are a binding agreement between you and {LEGAL.entity}{' '}
          (&ldquo;{LEGAL.brand}&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo; or &ldquo;our&rdquo;), the operator of the{' '}
          {LEGAL.brand} website and applications available at {LEGAL.domain} (the &ldquo;Service&rdquo;). By creating an
          account, accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not use
          the Service.
        </p>
      </Section>

      <Section title="2. Who can use the Service">
        <p>
          You must be at least 18 years old, or the age of majority in your country of residence, to use {LEGAL.brand}.
          By using the Service you represent that you meet this requirement and that the information you provide is
          accurate and kept up to date. The Service is intended for personal, non-commercial use, except where you use a
          business account expressly provided for organisers and venues.
        </p>
      </Section>

      <Section title="3. Your account">
        <p>
          You are responsible for safeguarding your account credentials and for all activity that occurs under your
          account. Notify us immediately at {LEGAL.email} if you suspect unauthorised use. We may suspend or close
          accounts that violate these Terms or that we reasonably believe pose a risk to other users.
        </p>
      </Section>

      <Section title="4. Acceptable use">
        <p>When using {LEGAL.brand}, you agree not to:</p>
        <List
          items={[
            'Break any applicable law, or use the Service for fraudulent, harmful or deceptive purposes;',
            'Harass, threaten, impersonate or endanger other people, on or off the platform;',
            'Post content that is unlawful, hateful, sexually exploitative, or that infringes the rights of others;',
            'Create activities that are unsafe, misleading, or intended to solicit, scam or spam other users;',
            'Attempt to access accounts, data or systems you are not authorised to access, or interfere with the operation of the Service;',
            'Scrape, copy or resell the Service or its content without our written permission.',
          ]}
        />
      </Section>

      <Section title="5. Activities, meetups and your safety">
        <p>
          {LEGAL.brand} is a platform that helps people discover and organise activities and meetups. We do not host,
          organise, supervise or endorse the activities listed on the Service, and we are not a party to any arrangement
          between organisers and participants.
        </p>
        <p>
          You are solely responsible for your decisions to create, join or attend any activity, whether online or in
          person. Meeting people you do not know carries risk. Use good judgement, meet in public where appropriate, and
          do not share sensitive personal information. You participate in all activities at your own risk.
        </p>
      </Section>

      <Section title="6. Content you provide">
        <p>
          You retain ownership of the content you submit (such as your profile, photos, activity descriptions and
          messages). You grant us a worldwide, non-exclusive, royalty-free licence to host, store, display and
          distribute that content as needed to operate and promote the Service. You are responsible for your content and
          confirm you have the rights necessary to share it.
        </p>
      </Section>

      <Section title="7. Subscriptions, payments and billing">
        <p>
          {LEGAL.brand} offers a free tier as well as paid plans, including the Pro Host subscription, business
          sponsorship plans, and occasional one-off purchases. Prices and inclusions are shown at the point of purchase.
        </p>
        <p>
          Our payments and subscriptions are sold and processed by{' '}
          <strong className="font-semibold text-ink">Paddle.com</strong>, which acts as the merchant of record and
          authorised reseller for these transactions. When you make a purchase, your contract for the sale is with
          Paddle, and Paddle&rsquo;s{' '}
          <a
            href="https://www.paddle.com/legal/checkout-buyer-terms"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-clay hover:text-clay-press underline underline-offset-2"
          >
            Checkout Buyer Terms
          </a>{' '}
          also apply. Paddle handles billing, payment-method processing and applicable taxes (such as VAT). We do not
          receive or store your full card details.
        </p>
        <List
          items={[
            'Subscriptions renew automatically at the end of each billing term (monthly, quarterly or annual, as selected) until cancelled.',
            'You can cancel a subscription at any time; cancellation takes effect at the end of the current paid period and you keep access until then.',
            'We may change prices or plan features with reasonable advance notice; changes apply to your next billing term.',
            'Refunds are governed by our Refund Policy.',
          ]}
        />
      </Section>

      <Section title="8. Cancellations and refunds">
        <p>
          You may cancel paid plans as described above. Refund eligibility and how to request one are set out in our{' '}
          <a href="/refunds" className="font-medium text-clay hover:text-clay-press underline underline-offset-2">
            Refund Policy
          </a>
          , which forms part of these Terms.
        </p>
      </Section>

      <Section title="9. Intellectual property">
        <p>
          The Service, including its software, design, logos and content (other than user content), is owned by{' '}
          {LEGAL.entity} or its licensors and is protected by intellectual-property laws. You may not copy, modify or
          create derivative works from the Service except as permitted by these Terms.
        </p>
      </Section>

      <Section title="10. Third-party services">
        <p>
          The Service relies on third parties such as Paddle (payments), our hosting and email providers, and mapping
          services. Your use of those features may be subject to the third party&rsquo;s own terms and privacy
          practices. We are not responsible for third-party services we do not control.
        </p>
      </Section>

      <Section title="11. Suspension and termination">
        <p>
          You may stop using the Service and delete your account at any time. We may suspend or terminate your access if
          you breach these Terms, if required by law, or to protect the Service or its users. On termination, the
          provisions that by their nature should survive (including payment, disclaimers and limitation of liability)
          will remain in effect.
        </p>
      </Section>

      <Section title="12. Disclaimers">
        <p>
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind,
          whether express or implied, to the fullest extent permitted by law. We do not warrant that the Service will be
          uninterrupted, secure or error-free, or that any activity, organiser or participant will meet your
          expectations.
        </p>
      </Section>

      <Section title="13. Limitation of liability">
        <p>
          To the fullest extent permitted by law, {LEGAL.entity} will not be liable for any indirect, incidental,
          special or consequential damages, or for any loss arising from your participation in activities or your
          interactions with other users. Our total liability for any claim relating to the Service will not exceed the
          amount you paid to us (or via Paddle for our products) in the twelve months before the event giving rise to
          the claim. Nothing in these Terms limits liability that cannot be limited under applicable law.
        </p>
      </Section>

      <Section title="14. Indemnification">
        <p>
          You agree to indemnify and hold {LEGAL.entity} harmless from claims, damages and expenses arising out of your
          use of the Service, your content, or your breach of these Terms or of the rights of any third party.
        </p>
      </Section>

      <Section title="15. Changes to these Terms">
        <p>
          We may update these Terms from time to time. When we make material changes we will update the &ldquo;Last
          updated&rdquo; date above and, where appropriate, notify you. Continued use of the Service after changes take
          effect constitutes acceptance of the revised Terms.
        </p>
      </Section>

      <Section title="16. Governing law">
        <p>
          These Terms are governed by the laws of {LEGAL.jurisdiction}, without regard to its conflict-of-laws rules.
          Mandatory consumer-protection rights you have in your country of residence are unaffected.
        </p>
      </Section>

      <Section title="17. Contact us">
        <p>
          Questions about these Terms? Contact us at{' '}
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
