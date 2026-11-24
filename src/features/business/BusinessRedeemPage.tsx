import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, ScanLine, Ticket } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Input } from '@/components/Field';
import { lookupCoupon, redeemCoupon } from '@/api';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import { formatEventDate } from '@/lib/format';
import type { CouponCheck } from '@/types';

/**
 * Staff screen: type or paste an attendee's coupon code, check who and which
 * activity it belongs to, then mark it redeemed (once per attendee/activity,
 * on the activity's day ± 1).
 */
export function BusinessRedeemPage() {
  const { t } = useTranslation();
  const businessId = useSession((s) => s.user?.businessId);
  const bumpData = useSession((s) => s.bumpData);
  const [code, setCode] = useState('');
  const [check, setCheck] = useState<CouponCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  async function onCheck(e?: React.FormEvent) {
    e?.preventDefault();
    if (!businessId || !code.trim()) return;
    setChecking(true);
    try {
      setCheck(await lookupCoupon(businessId, code.trim()));
    } catch (err) {
      toast(err instanceof Error ? err.message : t('authFlow.genericError'), 'error');
    } finally {
      setChecking(false);
    }
  }

  async function onRedeem() {
    if (!businessId || !check?.code) return;
    setRedeeming(true);
    try {
      const done = await redeemCoupon(businessId, check.code);
      setCheck(done); // ok + redeemedAt → success state
      bumpData();
      toast(t('coupon.redeemedToast'), 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : t('authFlow.genericError'), 'error');
      void onCheck();
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="font-display text-h1 font-medium text-ink">{t('coupon.redeemTitle')}</h1>
        <p className="text-meta text-ink-soft">{t('coupon.redeemSubtitle')}</p>
      </div>

      <form onSubmit={onCheck} className="space-y-3 rounded-card border border-border bg-surface p-4">
        <Input
          dir="ltr"
          label={t('coupon.codeLabel')}
          placeholder="HUDLGO-ABC123-7KQ2"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setCheck(null);
          }}
          leftIcon={<Ticket className="h-5 w-5" strokeWidth={1.6} />}
          autoCapitalize="characters"
          autoComplete="off"
          className="font-mono tracking-wider"
        />
        <Button type="submit" fullWidth loading={checking} disabled={!code.trim()} leftIcon={<ScanLine className="h-4 w-4" />}>
          {t('coupon.check')}
        </Button>
      </form>

      {check && (
        <div className="rounded-card border border-border bg-surface p-4">
          {check.attendee && (
            <div className="flex items-center gap-3">
              <Avatar src={check.attendee.avatar} name={check.attendee.name} size="md" />
              <div className="min-w-0">
                <p className="truncate font-display text-h3 font-medium text-ink">{check.attendee.name}</p>
                {check.activity && (
                  <p className="truncate text-[12px] text-ink-soft">
                    {check.activity.title} · {formatEventDate(check.activity.startsAt)}
                  </p>
                )}
              </div>
            </div>
          )}
          {!check.attendee && check.activity && (
            <p className="text-meta text-ink">{check.activity.title} · {formatEventDate(check.activity.startsAt)}</p>
          )}
          {check.activity && (
            <p className="mt-2 text-meta text-ink-soft">{t('coupon.offerIs', { offer: check.offer || t('coupon.defaultOffer') })}</p>
          )}

          {check.ok && check.redeemedAt ? (
            <p className="mt-4 flex items-center gap-2 rounded-input bg-olive-soft px-3 py-3 text-meta font-semibold text-olive">
              <CheckCircle2 className="h-5 w-5" strokeWidth={1.8} /> {t('coupon.redeemedToast')}
            </p>
          ) : check.ok ? (
            <Button className="mt-4" size="lg" fullWidth loading={redeeming} leftIcon={<CheckCircle2 className="h-5 w-5" />} onClick={onRedeem}>
              {t('coupon.markRedeemed')}
            </Button>
          ) : (
            <p className="mt-3 flex items-start gap-2 rounded-input bg-clay-soft px-3 py-2.5 text-meta font-medium text-clay">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
              <span>
                {t(`coupon.problem.${check.problem}`)}
                {check.problem === 'ALREADY_REDEEMED' && check.redeemedAt && ` (${new Date(check.redeemedAt).toLocaleString()})`}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
