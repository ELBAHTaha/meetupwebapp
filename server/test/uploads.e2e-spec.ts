import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import sharp from 'sharp';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, signupUser } from './helpers';

/** Phase 5 — upload validation, re-encoding and clean-up (local-disk driver). */
describe('uploads (e2e)', () => {
  let app: INestApplication;
  let user: Awaited<ReturnType<typeof signupUser>>;
  const uploadsDir = process.env.UPLOADS_DIR ?? 'uploads';
  const localPath = (url: string) => join(uploadsDir, url.slice(url.indexOf('/uploads/') + '/uploads/'.length));

  /** A large JPEG carrying EXIF (incl. GPS-ish data) to prove it's stripped. */
  const bigJpegWithExif = () =>
    sharp({ create: { width: 3200, height: 2000, channels: 3, background: { r: 200, g: 120, b: 80 } } })
      .jpeg({ quality: 90 })
      .withMetadata({ exif: { IFD0: { Copyright: 'secret', Artist: 'Someone' } } })
      .toBuffer();

  beforeAll(async () => {
    app = await createApp();
    user = await signupUser(app);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('re-encodes avatars to WebP ≤1600px with metadata stripped', async () => {
    const jpeg = await bigJpegWithExif();
    expect((await sharp(jpeg).metadata()).exif).toBeDefined();

    const res = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${user.access}`)
      .attach('photo', jpeg, { filename: 'me.jpg', contentType: 'image/jpeg' })
      .expect(200);
    const url: string = res.body.avatar;
    expect(url).toMatch(/\/uploads\/avatar-[0-9a-f-]+\.webp$/);

    const stored = readFileSync(localPath(url));
    const meta = await sharp(stored).metadata();
    expect(meta.format).toBe('webp');
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(1600);
    expect(meta.exif).toBeUndefined();
  });

  it('deletes the previous avatar file when it is replaced', async () => {
    const before = await app.get(PrismaService).user.findUniqueOrThrow({ where: { id: user.id } });
    const oldPath = localPath(before.photoUrl!);
    expect(existsSync(oldPath)).toBe(true);

    const png = await sharp({ create: { width: 400, height: 400, channels: 4, background: '#336699' } }).png().toBuffer();
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${user.access}`)
      .attach('photo', png, { filename: 'new.png', contentType: 'image/png' })
      .expect(200);
    expect(existsSync(oldPath)).toBe(false);
  });

  it('rejects files whose content is not really an image, whatever the MIME type says', async () => {
    const res = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${user.access}`)
      .attach('photo', Buffer.from('<?php echo "pwned"; ?> definitely a jpeg'), { filename: 'evil.jpg', contentType: 'image/jpeg' })
      .expect(400);
    expect(res.body.code).toBe('INVALID_UPLOAD');

    // A real PDF is still not a valid *photo*.
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${user.access}`)
      .attach('photo', Buffer.from('%PDF-1.4\n%fake\n'), { filename: 'x.jpg', contentType: 'image/jpeg' })
      .expect(400);
  });

  it('rejects photos over 5 MB', async () => {
    const huge = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(5 * 1024 * 1024 + 10)]);
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${user.access}`)
      .attach('photo', huge, { filename: 'huge.jpg', contentType: 'image/jpeg' })
      .expect(413);
  });

  it('accepts PDF business documents (stored as-is) and images (re-encoded)', async () => {
    const biz = await request(app.getHttpServer())
      .post('/businesses')
      .set('Authorization', `Bearer ${user.access}`)
      .send({ name: 'Doc Test Café', category: 'cafe', address: 'Casablanca', contactEmail: user.email, acceptBusinessTos: true })
      .expect(201);
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << >>\n%%EOF\n');
    const jpg = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#eeeeee' } }).jpeg().toBuffer();
    await request(app.getHttpServer())
      .post(`/businesses/${biz.body.id}/verification`)
      .set('Authorization', `Bearer ${user.access}`)
      .field('rcNumber', 'RC-1')
      .attach('documents', pdf, { filename: 'rc.pdf', contentType: 'application/pdf' })
      .attach('documents', jpg, { filename: 'ice.jpg', contentType: 'image/jpeg' })
      .expect(201);
    const v = await app.get(PrismaService).businessVerification.findFirstOrThrow({ where: { businessId: biz.body.id } });
    const urls = v.documentUrls as string[];
    expect(urls.some((u) => u.endsWith('.pdf'))).toBe(true);
    expect(urls.some((u) => u.endsWith('.webp'))).toBe(true);
    expect(readFileSync(localPath(urls.find((u) => u.endsWith('.pdf'))!)).equals(pdf)).toBe(true);

    await request(app.getHttpServer())
      .post(`/businesses/${biz.body.id}/verification`)
      .set('Authorization', `Bearer ${user.access}`)
      .attach('documents', Buffer.from('MZ fake exe'), { filename: 'doc.pdf', contentType: 'application/pdf' })
      .expect(400);
  });
});
