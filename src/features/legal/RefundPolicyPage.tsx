import { LEGAL, LegalLayout, List, Section } from './LegalLayout';

export function RefundPolicyPage() {
  return (
    <LegalLayout title="Refund Policy">
      <Section title="1. Overview">
        <p>
          This Refund Policy applies to purchases made on {LEGAL.brand} ({LEGAL.domain}), including the Pro Host
          subscription, business sponsorship plans, and one-off purchases. Payments are sold and processed by{' '}
          <strong className="font-semibold text-ink">Paddle.com</strong>, our merchant of record, so refunds are issued
          through Paddle to your original payment method.
        </p>
      </Section>

      <Section title="2. Subscriptions">
        <p>
          Subscriptions renew automatically at the end of each billing term (monthly, quarterly or annual, as selected).
          You can cancel at any time:
        </p>
        <List
          items={[
            'Cancellation stops future renewals. It takes effect at the end of your current paid period, and you keep access until then.',
            'We do not generally provide pro-rata refunds for the unused portion of a billing term once it has started, except where required by law or at our discretion.',
            'If you were charged after cancelling, or were charged in error, contact us and we will correct it.',
          ]}
        />
      </Section>

      <Section title="3. 14-day cooling-off period">
        <p>
          If you are a consumer in the EU, UK or another jurisdiction with statutory cancellation rights, you may be
          entitled to a refund within 14 days of purchase. Where you ask us to begin a subscription service immediately
          and then cancel within this period, we may deduct an amount proportionate to the service already provided.
          Your statutory rights are not affected by this Policy.
        </p>
      </Section>

      <Section title="4. One-off purchases">
        <p>
          One-off digital purchases (such as a pinned or promoted activity) are delivered and consumed immediately. Once
          the benefit has been provided, these purchases are generally non-refundable, except where the product is
          faulty, was not delivered, or where a refund is required by law.
        </p>
      </Section>

      <Section title="5. How to request a refund">
        <p>
          To request a refund or raise a billing question, email us at{' '}
          <a
            href={`mailto:${LEGAL.email}`}
            className="font-medium text-clay hover:text-clay-press underline underline-offset-2"
          >
            {LEGAL.email}
          </a>{' '}
          with the email address used at purchase and your order or receipt details. You can also contact Paddle
          directly through{' '}
          <a
            href="https://paddle.net"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-clay hover:text-clay-press underline underline-offset-2"
          >
            paddle.net
          </a>
          , Paddle&rsquo;s buyer support portal, since Paddle is the merchant of record for your purchase.
        </p>
      </Section>

      <Section title="6. Processing time">
        <p>
          Approved refunds are returned to your original payment method via Paddle. Depending on your bank or card
          issuer, it can take several business days for the refunded amount to appear on your statement.
        </p>
      </Section>

      <Section title="7. Chargebacks">
        <p>
          If you do not recognise a charge, please contact us before initiating a chargeback so we can help resolve the
          issue quickly. Fraudulent chargebacks may result in suspension of your account.
        </p>
      </Section>

      <Section title="8. Contact us">
        <p>
          Questions about refunds or billing? Email{' '}
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
