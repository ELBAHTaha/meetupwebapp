import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators/public.decorator';
import { nearestCityName } from '../common/utils/area';
import { ogImageForActivity } from './activity-images';

/**
 * Crawler-friendly share pages. Link-preview bots (WhatsApp, Facebook, X,
 * iMessage) don't run JavaScript, so OpenGraph tags can't come from the React
 * SPA — they must be server-rendered. `GET /share/e/:id` returns a tiny HTML
 * document with the right OG/Twitter tags (built from public, progressively-
 * disclosed event data — never the exact address) and instantly redirects a
 * human visitor to the public SPA page `/a/:id`.
 */
@ApiExcludeController()
@Controller('share')
export class ShareController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('e/:id')
  async event(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const frontendUrl = (this.config.get<string>('frontendUrl') ?? '').replace(/\/$/, '');
    const publicUrl = (this.config.get<string>('publicUrl') ?? '').replace(/\/$/, '');
    const canonical = `${publicUrl}/share/e/${encodeURIComponent(id)}`;
    const appUrl = `${frontendUrl}/a/${encodeURIComponent(id)}`;

    // Only LIVE, admin-approved, public activities get a rich card.
    const e = await this.prisma.event.findFirst({
      where: { id, approvedAt: { not: null }, status: 'LIVE', visibility: 'PUBLIC' },
      include: { activityType: { select: { name: true, slug: true } } },
    });

    if (!e) {
      res
        .type('html')
        .send(
          shell({
            title: 'Jmaâ — meet people through real activities',
            description: 'Find or host coffee, padel, surf, hikes and more across Morocco.',
            image: ogImageForActivity(null),
            canonical,
            redirect: frontendUrl || appUrl,
          }),
        );
      return;
    }

    const going =
      1 + (await this.prisma.attendance.count({ where: { eventId: e.id, status: 'JOINED' } }));
    const spots = Math.max(0, e.maxAttendees - going);
    const area = e.isOnline
      ? 'Online'
      : e.areaLabel ?? nearestCityName({ lat: e.lat, lng: e.lng }) ?? 'Morocco';
    const when = new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(e.startsAt);
    const spotsText = spots > 0 ? `, ${spots} spot${spots > 1 ? 's' : ''} left` : '';

    res.type('html').send(
      shell({
        title: e.title,
        description: `${e.activityType.name} · ${area} · ${when}. ${going} going${spotsText} — join on Jmaâ.`,
        image: ogImageForActivity(e.activityType.slug),
        canonical,
        redirect: appUrl,
      }),
    );
  }
}

interface OgMeta {
  title: string;
  description: string;
  image: string;
  canonical: string;
  redirect: string;
}

/** Escape a string for safe use inside an HTML attribute value. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Minimal OG document. The meta-refresh (CSP-safe, unlike an inline script)
 * bounces human visitors to the app; crawlers read the tags and ignore it.
 */
function shell(m: OgMeta): string {
  const title = esc(m.title);
  const description = esc(m.description);
  const image = esc(m.image);
  const canonical = esc(m.canonical);
  const redirect = esc(m.redirect);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Jmaâ">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${image}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">
<meta http-equiv="refresh" content="0; url=${redirect}">
</head>
<body>
<p>Redirecting to <a href="${redirect}">Jmaâ</a>…</p>
</body>
</html>`;
}
