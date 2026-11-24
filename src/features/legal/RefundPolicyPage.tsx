import { LEGAL, LegalLayout, List, Section } from './LegalLayout';

const mail = 'font-medium text-clay hover:text-clay-press underline underline-offset-2';

export function RefundPolicyPage() {
  return (
    <LegalLayout title="Refund Policy">
      <Section title="1. Overview">
        <p>
          This Refund Policy applies to paid plans on {LEGAL.brand} ({LEGAL.domain}): the Pro Host plan, business venue
          sponsorships, and pinned / extra activities. We don&rsquo;t take card payments. You pay offline by bank
          transfer, CashPlus or cash, quoting the payment reference shown with your upgrade request, and our team
          activates the plan by hand once the payment arrives.
        </p>
      </Section>

      <Section title="2. Prepaid plans, no automatic renewal">
        <List
          items={[
            'Each plan covers a fixed, prepaid period (one month, three months or twelve months, as requested). It ends on its end date and does not renew automatically.',
            'About five days before the end date we remind you by email and in the app. To keep the plan, send a new payment with a new upgrade request.',
            'If you don’t renew, your account simply returns to the Free plan. Nothing more is charged.',
          ]}
        />
      </Section>

      <Section title="3. Before activation">
        <p>
          You can cancel a pending upgrade request at any time from <em>Upgrade requests</em>. If you already sent a
          payment for a request we haven&rsquo;t activated yet, we refund it in full, or, if you prefer, apply it to
          another plan.
        </p>
      </Section>

      <Section title="4. After activation">
        <List
          items={[
            'Once a plan is activated we don’t generally refund the unused part of the period, except where required by law or at our discretion (for example if a technical problem on our side prevented you from using it).',
            'Pinned / extra activities are delivered when we pin or publish the activity, so they are non-refundable after that, unless the activity was cancelled because of us.',
            'If we activated the wrong plan or received a duplicate payment, contact us and we’ll correct it or refund the difference.',
          ]}
        />
      </Section>

      <Section title="5. Your statutory rights">
        <p>
          Where the law gives you a right to cancel or a refund, this Policy doesn&rsquo;t limit that right.
        </p>
      </Section>

      <Section title="6. How to request a refund">
        <p>
          Email{' '}
          <a href={`mailto:${LEGAL.email}`} className={mail}>
            {LEGAL.email}
          </a>{' '}
          with your account email, the payment reference (for example <span dir="ltr">HG-4F7K2</span>), and proof of
          payment such as a transfer receipt or CashPlus slip.
        </p>
      </Section>

      <Section title="7. How refunds are paid">
        <p>
          Approved refunds are paid back the way you paid, or by bank transfer to an account in your name. We aim to send
          them within 10 business days of approval. How long the money takes to arrive depends on your bank or payment
          service.
        </p>
      </Section>

      <Section title="8. Contact us">
        <p>
          Questions about payments or refunds? Email{' '}
          <a href={`mailto:${LEGAL.email}`} className={mail}>
            {LEGAL.email}
          </a>
          .
        </p>
      </Section>
    </LegalLayout>
  );
}
