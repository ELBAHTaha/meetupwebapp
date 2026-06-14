import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Ban, FileWarning, MessageSquareText, ShieldAlert, ShieldCheck, UserX } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Tag } from '@/components/Chip';
import { Sheet } from '@/components/Sheet';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { useAsync } from '@/hooks/useAsync';
import {
  adminOverview,
  approveActivity,
  banUser,
  listFlaggedUsers,
  listPendingActivities,
  listReports,
  listUnderReviewActivities,
  rejectActivity,
  resolveReport,
  restoreActivity,
  suspendUser,
  warnUser,
  type AdminReport,
} from '@/api';
import type { EnrichedEvent } from '@/types';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';

type Tab = 'pending' | 'reports' | 'flagged' | 'review';

export function AdminPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, bumpData, dataVersion } = useSession();
  const [tab, setTab] = useState<Tab>('pending');
  const [chatLog, setChatLog] = useState<AdminReport | null>(null);

  const overview = useAsync(() => adminOverview(), [dataVersion]);
  const reports = useAsync(() => listReports(), [dataVersion]);
  const flagged = useAsync(() => listFlaggedUsers(), [dataVersion]);
  const review = useAsync(() => listUnderReviewActivities(), [dataVersion]);
  const pending = useAsync(() => listPendingActivities(), [dataVersion]);

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
        <div className="mt-5 flex gap-1 rounded-full border border-border bg-surface p-1">
          {(['pending', 'reports', 'flagged', 'review'] as Tab[]).map((tb) => (
            <button key={tb} onClick={() => setTab(tb)} className={cn('flex-1 rounded-full py-2 text-meta font-medium transition-colors cursor-pointer', tab === tb ? 'bg-ink text-bg' : 'text-ink-soft')}>
              {t(tb === 'pending' ? 'admin.tabPending' : tb === 'reports' ? 'admin.tabReports' : tb === 'flagged' ? 'admin.tabFlagged' : 'admin.tabReview')}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3 pb-8">
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
