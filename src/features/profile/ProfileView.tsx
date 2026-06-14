import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Award, CalendarRange, MapPin, Plane, Star, Users } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { ActivityIcon } from '@/components/ActivityIcon';
import { Tag } from '@/components/Chip';
import { EventCard } from '@/components/EventCard';
import { EmptyState } from '@/components/EmptyState';
import { EventCardSkeletonList } from '@/components/Skeleton';
import { useAsync } from '@/hooks/useAsync';
import { getEventsForUser, getReviewsForUser } from '@/api';
import { db } from '@/api/store';
import type { LookingFor, User } from '@/types';
import { cn } from '@/lib/cn';

type Tab = 'hosting' | 'going' | 'past';

const lookingForLabel: Record<LookingFor, string> = {
  partners: 'profile.lfPartners',
  friends: 'profile.lfFriends',
  both: 'profile.lfBoth',
};

export function ProfileView({ user, self }: { user: User; self: boolean }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>(self ? 'going' : 'hosting');

  const events = useAsync(() => getEventsForUser(user.id), [user.id]);
  const reviews = useAsync(() => getReviewsForUser(user.id), [user.id]);
  const list = events.data?.[tab] ?? [];

  return (
    <div className="px-5 pt-2 md:px-0">
      {/* Identity */}
      <div className="flex items-start gap-4">
        <Avatar src={user.avatar} name={user.name} size="xl" verified={user.verified} />
        <div className="flex-1 pt-1">
          <h1 className="font-display text-h1 font-medium leading-tight text-ink">{user.name}</h1>
          <p className="mt-1 flex items-center gap-1 text-meta text-ink-soft">
            <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} /> {user.city}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Tag className="bg-saffron-soft text-saffron" leftIcon={<Star className="h-3.5 w-3.5 fill-current" />}>{user.trustScore.toFixed(1)}</Tag>
            {user.verified && <Tag className="bg-olive-soft text-olive">{t('profile.verified')}</Tag>}
            {user.isTraveler && <Tag className="bg-majorelle-soft text-majorelle" leftIcon={<Plane className="h-3.5 w-3.5" strokeWidth={1.6} />}>{t('profile.traveler')}</Tag>}
          </div>
        </div>
      </div>

      {/* Here for */}
      <div className="mt-4 flex items-center gap-2 rounded-card border border-border bg-surface px-4 py-3">
        <Users className="h-4 w-4 text-clay" strokeWidth={1.6} />
        <span className="text-meta text-ink-soft">{t('profile.hereFor')}</span>
        <span className="text-meta font-semibold text-ink">{t(lookingForLabel[user.lookingFor])}</span>
      </div>

      {user.bio && <p className="mt-4 text-base leading-relaxed text-ink-soft">{user.bio}</p>}
      <p className="mt-2 text-[12px] text-ink-faint">{t('profile.memberSince', { date: format(new Date(user.joinedAt), 'MMM yyyy') })}</p>

      {/* Activities */}
      <section className="mt-6">
        <h2 className="mb-3 font-display text-h2 font-medium">{t('profile.activities')}</h2>
        <div className="flex flex-wrap gap-2">
          {user.activities.map((ua) => {
            const a = db.activities.find((x) => x.id === ua.activityId);
            if (!a) return null;
            return (
              <div key={ua.activityId} className="flex items-center gap-2 rounded-input border border-border bg-surface py-1.5 pl-2.5 pr-3">
                <ActivityIcon activity={a} size="sm" className="!h-[18px] !w-[18px]" />
                <p className="text-meta font-medium text-ink">{a.name}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Badges */}
      {user.badges.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 font-display text-h2 font-medium">{t('profile.badges')}</h2>
          <div className="flex flex-wrap gap-2">
            {user.badges.map((b) => (
              <Tag key={b} className="border border-border bg-surface text-ink-soft" leftIcon={<Award className="h-3.5 w-3.5 text-saffron" strokeWidth={1.6} />}>{b}</Tag>
            ))}
          </div>
        </section>
      )}

      {/* Event tabs */}
      <section className="mt-6">
        <div className="flex gap-1 rounded-full border border-border bg-surface p-1">
          {(['going', 'hosting', 'past'] as Tab[]).map((tb) => (
            <button key={tb} onClick={() => setTab(tb)} className={cn('flex-1 rounded-full py-2 text-meta font-medium transition-colors cursor-pointer', tab === tb ? 'bg-ink text-bg' : 'text-ink-soft')}>
              {t(`profile.${tb}`)}
            </button>
          ))}
        </div>
        <div className="mt-4">
          {events.loading ? (
            <EventCardSkeletonList count={2} />
          ) : list.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {list.map((e) => <EventCard key={e.id} event={e} fromCity={user.city} />)}
            </div>
          ) : (
            <EmptyState icon={CalendarRange} title={t('profile.noEvents')} />
          )}
        </div>
      </section>

      {/* Reviews */}
      <section className="mt-6 pb-6">
        <h2 className="mb-3 font-display text-h2 font-medium">{t('profile.reviews')}</h2>
        {reviews.data && reviews.data.length > 0 ? (
          <div className="space-y-3">
            {reviews.data.map((r) => {
              const from = db.users.find((u) => u.id === r.fromUserId);
              return (
                <div key={r.id} className="rounded-card border border-border bg-surface p-4">
                  <div className="flex items-center gap-2">
                    {from && <Avatar src={from.avatar} name={from.name} size="sm" />}
                    <div className="flex-1">
                      <p className="text-meta font-medium text-ink">{from?.name}</p>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={cn('h-3 w-3', i < r.rating ? 'fill-saffron text-saffron' : 'text-border')} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-meta text-ink-soft">{r.text}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-meta text-ink-soft">{t('event.noReviews')}</p>
        )}
      </section>
    </div>
  );
}
