import { useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Activity, Ban, BarChart3, Bug, CalendarRange, Check, Crown, DollarSign, FileWarning, Heart, Lightbulb, MessageCircle, MessageSquareText, ShieldAlert, ShieldCheck, Store, TrendingUp, UserX, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Tag } from '@/components/Chip';
import { Sheet } from '@/components/Sheet';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { useAsync } from '@/hooks/useAsync';
import {
  adminAnalytics,
  adminOverview,
  approveActivity,
  approveVerification,
  banUser,
  listFlaggedUsers,
  listPendingActivities,
  listReports,
  listUnderReviewActivities,
  listVerifications,
  listFeedback,
  rejectActivity,
  rejectVerification,
  resolveReport,
  resolveFeedback,
  restoreActivity,
  suspendUser,
  warnUser,
  listBusinessVerificationsAdmin,
  approveBusinessVerification,
  rejectBusinessVerification,
  listVenueClaimsAdmin,
  approveVenueClaim,
  rejectVenueClaim,
  type AdminAnalytics,
  type AdminReport,
  type AdminVerification,
  type AdminFeedback,
  type NamedCount,
  type DailyPoint,
} from '@/api';
import type { AdminBusinessVerification, AdminVenueClaim, EnrichedEvent } from '@/types';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';

type Tab = 'analytics' | 'pending' | 'verify' | 'bizverify' | 'claims' | 'reports' | 'flagged' | 'review' | 'feedback';

const TAB_LABEL: Record<Tab, string> = {
  analytics: 'admin.tabAnalytics',
  pending: 'admin.tabPending',
  verify: 'admin.tabVerify',
  bizverify: 'admin.tabBizVerify',
  claims: 'admin.tabClaims',
  reports: 'admin.tabReports',
  flagged: 'admin.tabFlagged',
  review: 'admin.tabReview',
  feedback: 'admin.tabFeedback',
};

export function AdminPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, bumpData, dataVersion } = useSession();
  const [tab, setTab] = useState<Tab>('analytics');
  const [chatLog, setChatLog] = useState<AdminReport | null>(null);

  const overview = useAsync(() => adminOverview(), [dataVersion]);
  const analytics = useAsync(() => adminAnalytics(), [dataVersion]);
  const reports = useAsync(() => listReports(), [dataVersion]);
  const flagged = useAsync(() => listFlaggedUsers(), [dataVersion]);
  const review = useAsync(() => listUnderReviewActivities(), [dataVersion]);
  const pending = useAsync(() => listPendingActivities(), [dataVersion]);
  const verifications = useAsync(() => listVerifications(), [dataVersion]);
  const bizVerifications = useAsync(() => listBusinessVerificationsAdmin(), [dataVersion]);
  const claims = useAsync(() => listVenueClaimsAdmin(), [dataVersion]);
  const feedback = useAsync(() => listFeedback(), [dataVersion]);

  // Role gate (mock) — non-admins are redirected.
  if (user && user.role !== 'admin') return <Navigate to="/discover" replace />;

  async function act(fn: () => Promise<unknown>, msg: string) {
    await fn();
    bumpData();
    toast(msg, 'success');
  }

  return (
    <div>
      <PageHeader back title={t('admin.title')} onBack={() => navigate('/profile')} />
      <div className="px-5 pt-3 md:px-0">
        <p className="text-meta text-ink-soft">{t('admin.subtitle')}</p>

        {/* Overview */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Stat label={t('admin.openReports')} value={overview.data?.openReports} icon={FileWarning} />
          <Stat label={t('admin.flaggedUsers')} value={overview.data?.flaggedUsers} icon={ShieldAlert} />
          <Stat label={t('admin.liveToday')} value={overview.data?.liveToday} icon={ShieldCheck} />
        </div>

        {/* Tabs */}
        <div className="mt-5 flex gap-1 overflow-x-auto rounded-full border border-border bg-surface p-1">
          {(['analytics', 'pending', 'verify', 'bizverify', 'claims', 'reports', 'flagged', 'review', 'feedback'] as Tab[]).map((tb) => (
            <button key={tb} onClick={() => setTab(tb)} className={cn('flex-1 whitespace-nowrap rounded-full px-2 py-2 text-[13px] font-medium transition-colors cursor-pointer', tab === tb ? 'bg-ink text-bg' : 'text-ink-soft')}>
              {t(TAB_LABEL[tb])}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3 pb-8">
          {tab === 'analytics' &&
            (analytics.loading ? (
              <Skeleton className="h-64 w-full" />
            ) : analytics.data ? (
              <AnalyticsDashboard data={analytics.data} />
            ) : (
              <EmptyState icon={BarChart3} title="No analytics yet" />
            ))}

          {tab === 'pending' &&
            (pending.loading ? (
              <Skeleton className="h-28 w-full" />
            ) : pending.data && pending.data.length > 0 ? (
              pending.data.map((e) => (
                <PendingCard
                  key={e.id}
                  event={e}
                  onApprove={() => act(() => approveActivity(e.id), t('admin.approved'))}
                  onReject={() => act(() => rejectActivity(e.id), t('admin.rejected'))}
                />
              ))
            ) : (
              <EmptyState icon={ShieldCheck} title={t('admin.noPending')} />
            ))}

          {tab === 'verify' &&
            (verifications.loading ? (
              <Skeleton className="h-40 w-full" />
            ) : verifications.data && verifications.data.length > 0 ? (
              verifications.data.map((v) => (
                <VerificationCard
                  key={v.user.id}
                  item={v}
                  onApprove={() => act(() => approveVerification(v.user.id), t('admin.verifyApproved'))}
                  onReject={() => act(() => rejectVerification(v.user.id), t('admin.verifyRejected'))}
                  onOpen={() => navigate(`/user/${v.user.id}`)}
                />
              ))
            ) : (
              <EmptyState icon={ShieldCheck} title={t('admin.noVerify')} />
            ))}

          {tab === 'bizverify' &&
            (bizVerifications.loading ? (
              <Skeleton className="h-40 w-full" />
            ) : bizVerifications.data && bizVerifications.data.length > 0 ? (
              bizVerifications.data.map((v) => (
                <BizVerificationCard
                  key={v.id}
                  item={v}
                  onApprove={() => act(() => approveBusinessVerification(v.id), t('admin.bizVerifyApproved'))}
                  onReject={() => act(() => rejectBusinessVerification(v.id), t('admin.bizVerifyRejected'))}
                />
              ))
            ) : (
              <EmptyState icon={Store} title={t('admin.noBizVerify')} />
            ))}

          {tab === 'claims' &&
            (claims.loading ? (
              <Skeleton className="h-40 w-full" />
            ) : claims.data && claims.data.length > 0 ? (
              claims.data.map((c) => (
                <VenueClaimCard
                  key={c.id}
                  item={c}
                  onApprove={() => act(() => approveVenueClaim(c.id), t('admin.claimApproved'))}
                  onReject={() => act(() => rejectVenueClaim(c.id), t('admin.claimRejected'))}
                />
              ))
            ) : (
              <EmptyState icon={Store} title={t('admin.noClaims')} />
            ))}

          {tab === 'reports' &&
            (reports.loading ? (
              <Skeleton className="h-28 w-full" />
            ) : reports.data && reports.data.length > 0 ? (
              reports.data.map((r) => (
                <ReportCard key={r.id} report={r} onResolve={() => act(() => resolveReport(r.id), t('admin.resolved'))} onViewChat={() => setChatLog(r)} />
              ))
            ) : (
              <EmptyState icon={ShieldCheck} title={t('admin.noReports')} />
            ))}

          {tab === 'flagged' &&
            (flagged.loading ? (
              <Skeleton className="h-28 w-full" />
            ) : flagged.data && flagged.data.length > 0 ? (
              flagged.data.map((f) => (
                <FlaggedCard
                  key={f.user.id}
                  user={f.user}
                  reportCount={f.reportCount}
                  onWarn={() => act(() => warnUser(f.user.id), t('admin.actionDone'))}
                  onSuspend={() => act(() => suspendUser(f.user.id), t('admin.actionDone'))}
                  onBan={() => act(() => banUser(f.user.id), t('admin.actionDone'))}
                  onOpen={() => navigate(`/user/${f.user.id}`)}
                />
              ))
            ) : (
              <EmptyState icon={ShieldCheck} title={t('admin.noFlagged')} />
            ))}

          {tab === 'review' &&
            (review.loading ? (
              <Skeleton className="h-28 w-full" />
            ) : review.data && review.data.length > 0 ? (
              review.data.map((e) => (
                <UnderReviewCard key={e.id} event={e} onRestore={() => act(() => restoreActivity(e.id), t('admin.restored'))} />
              ))
            ) : (
              <EmptyState icon={ShieldCheck} title={t('admin.noReview')} />
            ))}

          {tab === 'feedback' &&
            (feedback.loading ? (
              <Skeleton className="h-28 w-full" />
            ) : feedback.data && feedback.data.length > 0 ? (
              feedback.data.map((f) => (
                <FeedbackCard key={f.id} item={f} onResolve={() => act(() => resolveFeedback(f.id), t('admin.resolved'))} />
              ))
            ) : (
              <EmptyState icon={MessageSquareText} title={t('admin.noFeedback')} />
            ))}
        </div>
      </div>

      {/* Chat log viewer */}
      <Sheet open={!!chatLog} onClose={() => setChatLog(null)} title={t('admin.viewChat')}>
        <div className="space-y-2">
          {chatLog?.thread?.messages.length ? (
            chatLog.thread.messages.map((m) => {
              const sender = chatLog.thread?.participantIds.includes(m.senderId);
              void sender;
              return (
                <div key={m.id} className="rounded-card border border-border bg-surface px-3 py-2">
                  <p className="text-[12px] font-semibold text-ink-soft">{m.senderId}</p>
                  <p className="text-meta text-ink">{m.text}</p>
                </div>
              );
            })
          ) : (
            <p className="text-meta text-ink-soft">No chat log linked.</p>
          )}
        </div>
      </Sheet>
    </div>
  );
}

const FB_META: Record<AdminFeedback['category'], { icon: LucideIcon; cls: string; key: string }> = {
  idea: { icon: Lightbulb, cls: 'bg-majorelle-soft text-majorelle', key: 'feedback.catIdea' },
  bug: { icon: Bug, cls: 'bg-clay-soft text-clay', key: 'feedback.catBug' },
  praise: { icon: Heart, cls: 'bg-olive-soft text-olive', key: 'feedback.catPraise' },
  other: { icon: MessageCircle, cls: 'bg-surface-sunk text-ink-soft', key: 'feedback.catOther' },
};

function FeedbackCard({ item, onResolve }: { item: AdminFeedback; onResolve: () => void }) {
  const { t } = useTranslation();
  const meta = FB_META[item.category] ?? FB_META.other;
  const Icon = meta.icon;
  return (
    <div className={cn('rounded-card border border-border bg-surface p-4', item.resolved && 'opacity-60')}>
      <div className="flex items-start gap-3">
        <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-[10px]', meta.cls)}>
          <Icon className="h-5 w-5" strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Tag className={meta.cls}>{t(meta.key)}</Tag>
            <span className="text-[12px] text-ink-faint">{formatRelative(item.createdAt)}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-meta text-ink">{item.message}</p>
          <p className="mt-2 text-[12px] text-ink-soft">
            {item.user ? item.user.name : t('admin.feedbackAnon')}
            {item.user?.email ? ` · ${item.user.email}` : ''}
            {item.path ? ` · ${item.path}` : ''}
          </p>
        </div>
      </div>
      {item.resolved ? (
        <p className="mt-2 text-right text-[12px] font-medium text-olive">{t('admin.feedbackDone')}</p>
      ) : (
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="outline" onClick={onResolve} leftIcon={<Check className="h-4 w-4" strokeWidth={1.8} />}>
            {t('admin.feedbackResolve')}
          </Button>
        </div>
      )}
    </div>
  );
}

function VerificationCard({ item, onApprove, onReject, onOpen }: { item: AdminVerification; onApprove: () => void; onReject: () => void; onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <button onClick={onOpen} className="flex w-full items-center gap-3 text-left cursor-pointer">
        <Avatar src={item.user.avatar} name={item.user.name} size="md" verified={item.user.verified} />
        <div className="flex-1">
          <p className="font-display text-h3 font-medium text-ink">{item.user.name}</p>
          <p className="text-[12px] text-ink-soft">{t('admin.reporter')} {formatRelative(item.submittedAt)}</p>
        </div>
        {item.pose && <Tag className="bg-majorelle-soft text-majorelle">{item.pose}</Tag>}
      </button>

      {/* Selfie vs profile photo for visual comparison */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <figure>
          <img src={item.selfieUrl} alt="" className="aspect-square w-full rounded-card border border-border object-cover" />
          <figcaption className="mt-1 text-center text-[11px] text-ink-faint">{t('admin.verifySelfie')}</figcaption>
        </figure>
        <figure>
          <img src={item.user.avatar} alt="" className="aspect-square w-full rounded-card border border-border object-cover" />
          <figcaption className="mt-1 text-center text-[11px] text-ink-faint">{t('admin.verifyProfile')}</figcaption>
        </figure>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onApprove}>{t('admin.approve')}</Button>
        <Button size="sm" variant="danger" onClick={onReject}>{t('admin.reject')}</Button>
      </div>
    </div>
  );
}

function BizVerificationCard({ item, onApprove, onReject }: { item: AdminBusinessVerification; onApprove: () => void; onReject: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-majorelle-soft text-majorelle">
          <Store className="h-5 w-5" strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-h3 font-medium text-ink">{item.businessName}</p>
          <p className="text-[12px] text-ink-soft">{item.category} · {item.contactEmail} · {formatRelative(item.submittedAt)}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {item.rcNumber && <Tag className="bg-surface-sunk text-ink-soft">RC {item.rcNumber}</Tag>}
            {item.iceNumber && <Tag className="bg-surface-sunk text-ink-soft">ICE {item.iceNumber}</Tag>}
          </div>
        </div>
      </div>
      {item.documentUrls.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.documentUrls.map((u, i) => (
            <a key={u} href={u} target="_blank" rel="noreferrer" className="text-[12px] font-medium text-clay underline">
              {t('admin.bizVerifyDoc')} {i + 1}
            </a>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onApprove}>{t('admin.approve')}</Button>
        <Button size="sm" variant="danger" onClick={onReject}>{t('admin.reject')}</Button>
      </div>
    </div>
  );
}

function VenueClaimCard({ item, onApprove, onReject }: { item: AdminVenueClaim; onApprove: () => void; onReject: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-clay-soft text-clay">
          <Store className="h-5 w-5" strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-h3 font-medium text-ink">{item.venueName}</p>
          <p className="text-[12px] text-ink-soft">{item.venueAddress}</p>
          <p className="mt-1 text-[12px] text-ink-faint">{t('admin.claimBy')} {item.businessName} · {formatRelative(item.submittedAt)}</p>
        </div>
      </div>
      {item.evidence.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.evidence.map((u, i) => (
            <a key={u} href={u} target="_blank" rel="noreferrer" className="text-[12px] font-medium text-clay underline">
              {t('admin.claimEvidence')} {i + 1}
            </a>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onApprove}>{t('admin.approve')}</Button>
        <Button size="sm" variant="danger" onClick={onReject}>{t('admin.reject')}</Button>
      </div>
    </div>
  );
}

function money(cents: number): string {
  return `${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })} MAD`;
}

function AnalyticsDashboard({ data }: { data: AdminAnalytics }) {
  const { totals, growth, engagement, moderation, monetization, activityStatus, topActivities, topCities, signupsByDay, activitiesByDay } = data;
  return (
    <div className="space-y-4">
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={Users} label="Total users" value={totals.users.toLocaleString()} sub={`+${growth.newUsers7d} this week`} />
        <Kpi icon={CalendarRange} label="Activities" value={totals.activities.toLocaleString()} sub={`${totals.liveActivities} live now`} />
        <Kpi icon={DollarSign} label="Est. MRR" value={money(monetization.mrrCents)} sub={`${totals.subscribers} subscribers`} accent />
        <Kpi icon={TrendingUp} label="Joins / week" value={growth.joins7d.toLocaleString()} sub={`${growth.messages7d} messages`} />
        <Kpi icon={Crown} label="Paid members" value={(monetization.hostBronze + monetization.hostSilver + monetization.hostGold).toLocaleString()} sub={`${monetization.hostBronze}B · ${monetization.hostSilver}S · ${monetization.hostGold}G`} />
        <Kpi icon={Store} label="Businesses" value={totals.businesses.toLocaleString()} sub={`${totals.approvedBusinesses} approved`} />
        <Kpi icon={ShieldCheck} label="Avg trust" value={engagement.avgTrust.toFixed(2)} sub={`${engagement.activeHosts} active hosts`} />
        <Kpi icon={Activity} label="Avg / activity" value={engagement.avgAttendeesPerActivity.toFixed(1)} sub={`${totals.attendances} total joins`} />
      </div>

      {/* Trend charts */}
      <div className="grid gap-3 md:grid-cols-2">
        <ChartCard title="New signups" subtitle="Last 14 days" total={growth.newUsers30d} totalLabel="30d">
          <MiniBars data={signupsByDay} colorClass="bg-clay" />
        </ChartCard>
        <ChartCard title="New activities" subtitle="Last 14 days" total={growth.newActivities7d} totalLabel="7d">
          <MiniBars data={activitiesByDay} colorClass="bg-majorelle" />
        </ChartCard>
      </div>

      {/* Monetization + moderation */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-card border border-border bg-surface p-4">
          <p className="font-display text-h3 font-medium">Revenue</p>
          <p className="mt-1 font-display text-display font-medium leading-none text-olive">{money(monetization.mrrCents)}<span className="ml-1.5 text-meta font-normal text-ink-soft">/mo est.</span></p>
          <div className="mt-3 space-y-1.5">
            <Line label="Bronze members (29.90 MAD)" value={monetization.hostBronze} />
            <Line label="Silver members (59.90 MAD)" value={monetization.hostSilver} />
            <Line label="Gold members (99.90 MAD)" value={monetization.hostGold} />
            <Line label="Paid extra activities" value={monetization.paidExtras} />
            <div className="!mt-2.5 border-t border-border pt-2.5">
              <Line label="Bronze venues (490 MAD)" value={monetization.businessTiers.bronze} />
              <Line label="Silver venues (990 MAD)" value={monetization.businessTiers.silver} />
              <Line label="Gold venues (1990 MAD)" value={monetization.businessTiers.gold} />
            </div>
          </div>
        </div>

        <div className="rounded-card border border-border bg-surface p-4">
          <p className="font-display text-h3 font-medium">Moderation</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MiniStat label="Open reports" value={moderation.openReports} tone="clay" />
            <MiniStat label="Pending approval" value={moderation.pendingApproval} tone="saffron" />
            <MiniStat label="Under review" value={moderation.underReview} tone="majorelle" />
            <MiniStat label="Flagged users" value={moderation.flaggedUsers} tone="clay" />
            <MiniStat label="Suspended" value={moderation.suspended} tone="ink" />
            <MiniStat label="Banned" value={moderation.banned} tone="ink" />
            <MiniStat label="Resolved" value={moderation.resolvedReports} tone="olive" />
          </div>
        </div>
      </div>

      {/* Activity status split */}
      <div className="rounded-card border border-border bg-surface p-4">
        <p className="font-display text-h3 font-medium">Activity status</p>
        <StatusBar live={activityStatus.live} completed={activityStatus.completed} cancelled={activityStatus.cancelled} />
      </div>

      {/* Breakdowns */}
      <div className="grid gap-3 md:grid-cols-2">
        <RankCard title="Top activity types" items={topActivities} colorClass="bg-clay" />
        <RankCard title="Top areas" items={topCities} colorClass="bg-majorelle" />
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, accent }: { icon: typeof Users; label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={cn('rounded-card border p-3.5', accent ? 'border-olive/30 bg-olive-soft' : 'border-border bg-surface')}>
      <Icon className={cn('h-5 w-5', accent ? 'text-olive' : 'text-clay')} strokeWidth={1.6} />
      <p className="mt-2 font-display text-h1 font-medium leading-none">{value}</p>
      <p className="mt-1 text-[12px] font-medium text-ink-soft">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-ink-faint">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, subtitle, total, totalLabel, children }: { title: string; subtitle: string; total: number; totalLabel: string; children: ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-display text-h3 font-medium">{title}</p>
          <p className="text-[12px] text-ink-faint">{subtitle}</p>
        </div>
        <p className="text-meta font-semibold text-ink">{total}<span className="ml-1 text-[11px] font-normal text-ink-faint">{totalLabel}</span></p>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function MiniBars({ data, colorClass }: { data: DailyPoint[]; colorClass: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex h-24 items-end gap-1">
      {data.map((d) => (
        <div key={d.date} className="flex flex-1 flex-col items-center justify-end" title={`${d.date}: ${d.count}`}>
          <div className={cn('w-full rounded-t-sm transition-all', d.count ? colorClass : 'bg-surface-sunk')} style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }} />
        </div>
      ))}
    </div>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-meta">
      <span className="text-ink-soft">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

const TONE: Record<string, string> = {
  clay: 'text-clay',
  saffron: 'text-saffron',
  majorelle: 'text-majorelle',
  olive: 'text-olive',
  ink: 'text-ink',
};

function MiniStat({ label, value, tone }: { label: string; value: number; tone: keyof typeof TONE }) {
  return (
    <div className="rounded-input border border-border bg-bg px-3 py-2">
      <p className={cn('font-display text-h2 font-medium leading-none', TONE[tone])}>{value}</p>
      <p className="mt-1 text-[11px] text-ink-soft">{label}</p>
    </div>
  );
}

function StatusBar({ live, completed, cancelled }: { live: number; completed: number; cancelled: number }) {
  const total = Math.max(1, live + completed + cancelled);
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <div>
      <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-surface-sunk">
        <div className="bg-olive" style={{ width: seg(live) }} />
        <div className="bg-majorelle" style={{ width: seg(completed) }} />
        <div className="bg-clay" style={{ width: seg(cancelled) }} />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
        <Legend dot="bg-olive" label="Live" value={live} />
        <Legend dot="bg-majorelle" label="Completed" value={completed} />
        <Legend dot="bg-clay" label="Cancelled" value={cancelled} />
      </div>
    </div>
  );
}

function Legend({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <span className="flex items-center gap-1.5 text-ink-soft">
      <span className={cn('h-2.5 w-2.5 rounded-full', dot)} />
      {label} <span className="font-semibold text-ink">{value}</span>
    </span>
  );
}

function RankCard({ title, items, colorClass }: { title: string; items: NamedCount[]; colorClass: string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <p className="font-display text-h3 font-medium">{title}</p>
      <div className="mt-3 space-y-2">
        {items.length === 0 && <p className="text-meta text-ink-faint">No data yet.</p>}
        {items.map((i) => (
          <div key={i.label}>
            <div className="flex items-center justify-between text-[12px]">
              <span className="truncate text-ink-soft">{i.label}</span>
              <span className="ml-2 font-semibold text-ink">{i.count}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunk">
              <div className={cn('h-full rounded-full', colorClass)} style={{ width: `${(i.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value?: number; icon: typeof FileWarning }) {
  return (
    <div className="rounded-card border border-border bg-surface p-3.5">
      <Icon className="h-5 w-5 text-clay" strokeWidth={1.6} />
      <p className="mt-2 font-display text-h1 font-medium leading-none">{value ?? '—'}</p>
      <p className="mt-1 text-[12px] text-ink-soft">{label}</p>
    </div>
  );
}

function ReportCard({ report, onResolve, onViewChat }: { report: AdminReport; onResolve: () => void; onViewChat: () => void }) {
  const { t } = useTranslation();
  const targetName = report.targetUser?.name ?? report.targetEvent?.title ?? report.targetId;
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Tag className={report.targetType === 'user' ? 'bg-clay-soft text-clay' : 'bg-majorelle-soft text-majorelle'}>
              {report.targetType === 'user' ? t('report.reportUser') : t('report.reportActivity')}
            </Tag>
            {report.status === 'resolved' && <Tag className="bg-olive-soft text-olive">{t('admin.resolved')}</Tag>}
          </div>
          <p className="mt-2 font-display text-h3 font-medium text-ink">{targetName}</p>
          <p className="text-meta text-ink-soft">{report.reason}</p>
          <p className="mt-1 text-[12px] text-ink-faint">
            {t('admin.reporter')} {report.reporter?.name ?? report.reporterId} · {formatRelative(report.createdAt)}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {report.chatThreadId && (
          <Button size="sm" variant="outline" leftIcon={<MessageSquareText className="h-4 w-4" strokeWidth={1.6} />} onClick={onViewChat}>
            {t('admin.viewChat')}
          </Button>
        )}
        {report.status === 'open' && (
          <Button size="sm" onClick={onResolve}>{t('admin.resolve')}</Button>
        )}
      </div>
    </div>
  );
}

function PendingCard({ event, onApprove, onReject }: { event: EnrichedEvent; onApprove: () => void; onReject: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <Tag className="bg-saffron-soft text-saffron">{t('admin.awaitingApproval')}</Tag>
        <Tag className="bg-majorelle-soft text-majorelle">{t('report.reportActivity')}</Tag>
      </div>
      <p className="mt-2 font-display text-h3 font-medium text-ink">{event.title}</p>
      <p className="text-meta text-ink-soft">
        {t('admin.reporter')} {event.host.name} · {event.generalArea ?? event.resolvedLocation.label} · {formatRelative(event.startsAt)}
      </p>
      {event.description && <p className="mt-1 line-clamp-2 text-[12px] text-ink-soft">{event.description}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onApprove}>{t('admin.approve')}</Button>
        <Button size="sm" variant="danger" onClick={onReject}>{t('admin.reject')}</Button>
      </div>
    </div>
  );
}

function UnderReviewCard({ event, onRestore }: { event: EnrichedEvent; onRestore: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <Tag className="bg-clay text-white">{t('admin.hidden')}</Tag>
        <Tag className="bg-majorelle-soft text-majorelle">{t('report.reportActivity')}</Tag>
      </div>
      <p className="mt-2 font-display text-h3 font-medium text-ink">{event.title}</p>
      <p className="text-meta text-ink-soft">
        {t('admin.reporter')} {event.host.name} · {event.generalArea ?? event.resolvedLocation.label}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onRestore}>{t('admin.restore')}</Button>
      </div>
    </div>
  );
}

function FlaggedCard({
  user,
  reportCount,
  onWarn,
  onSuspend,
  onBan,
  onOpen,
}: {
  user: import('@/types').User;
  reportCount: number;
  onWarn: () => void;
  onSuspend: () => void;
  onBan: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <button onClick={onOpen} className="flex w-full items-center gap-3 text-left cursor-pointer">
        <Avatar src={user.avatar} name={user.name} size="md" verified={user.verified} />
        <div className="flex-1">
          <p className="font-display text-h3 font-medium text-ink">{user.name}</p>
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            <Tag className="bg-saffron-soft text-saffron">{t('admin.trust')} {user.trustScore.toFixed(1)}</Tag>
            {user.flagCount > 0 && <Tag className="bg-clay-soft text-clay">{t('admin.flags', { count: user.flagCount })}</Tag>}
            {reportCount > 0 && <Tag className="bg-surface-sunk text-ink-soft">{t('admin.reports', { count: reportCount })}</Tag>}
            {user.status === 'suspended' && <Tag className="bg-clay text-white">{t('admin.statusSuspended')}</Tag>}
            {user.status === 'banned' && <Tag className="bg-ink text-bg">{t('admin.statusBanned')}</Tag>}
          </div>
        </div>
      </button>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onWarn}>{t('admin.warn')}</Button>
        <Button size="sm" variant="outline" leftIcon={<UserX className="h-4 w-4" strokeWidth={1.6} />} onClick={onSuspend}>{t('admin.suspend')}</Button>
        <Button size="sm" variant="danger" leftIcon={<Ban className="h-4 w-4" strokeWidth={1.6} />} onClick={onBan}>{t('admin.ban')}</Button>
      </div>
    </div>
  );
}
