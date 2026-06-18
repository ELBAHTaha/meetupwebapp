import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Camera, Clock, RefreshCw, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { submitVerification } from '@/api';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';

const POSES = [
  'Give a thumbs up 👍',
  'Make a peace sign ✌️',
  'Touch your right ear',
  'Open palm facing the camera ✋',
  'Place a hand on your chin',
  'Wave hello 👋',
];

export function VerifyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useSession((s) => s.user);
  const setUser = useSession((s) => s.setUser);

  const [pose] = useState(() => POSES[Math.floor(Math.random() * POSES.length)]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const status = user?.verificationStatus ?? 'none';
  const verified = !!user?.verified;

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function submit() {
    if (!file) return;
    setSubmitting(true);
    try {
      const updated = await submitVerification(file, pose);
      setUser(updated);
      toast(t('verify.submittedToast'), 'success');
      navigate('/profile');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not submit', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader back title={t('verify.title')} onBack={() => navigate(-1)} />
      <div className="mx-auto max-w-app space-y-4 px-5 pt-4 md:max-w-md md:px-0">
        {/* Already verified */}
        {verified ? (
          <div className="rounded-card border border-olive/30 bg-olive-soft p-6 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-olive text-white">
              <BadgeCheck className="h-7 w-7" strokeWidth={1.7} />
            </span>
            <p className="mt-3 font-display text-h2 font-medium text-ink">{t('verify.verifiedTitle')}</p>
            <p className="mt-1 text-meta text-ink-soft">{t('verify.verifiedBody')}</p>
          </div>
        ) : status === 'pending' ? (
          <div className="rounded-card border border-saffron/30 bg-saffron-soft p-6 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-saffron text-white">
              <Clock className="h-7 w-7" strokeWidth={1.7} />
            </span>
            <p className="mt-3 font-display text-h2 font-medium text-ink">{t('verify.pendingTitle')}</p>
            <p className="mt-1 text-meta text-ink-soft">{t('verify.pendingBody')}</p>
          </div>
        ) : (
          <>
            <div className="rounded-card border border-border bg-surface p-5">
              <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-majorelle-soft text-majorelle">
                <ShieldCheck className="h-6 w-6" strokeWidth={1.7} />
              </span>
              <p className="mt-3 font-display text-h2 font-medium text-ink">{t('verify.subtitle')}</p>
              <p className="mt-1 text-meta leading-relaxed text-ink-soft">{t('verify.why')}</p>
              {status === 'rejected' && (
                <p className="mt-3 rounded-input border border-clay/30 bg-clay-soft px-3 py-2 text-[12px] font-medium text-clay">
                  {t('verify.rejectedNote')}
                </p>
              )}
            </div>

            {/* Pose prompt */}
            <div className="rounded-card border border-clay/30 bg-clay-soft/50 p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-clay">{t('verify.poseLabel')}</p>
              <p className="mt-1 font-display text-h2 font-medium text-ink">{pose}</p>
              <p className="mt-1 text-[12px] text-ink-soft">{t('verify.poseHint')}</p>
            </div>

            {/* Selfie capture */}
            <div className="rounded-card border border-border bg-surface p-5">
              {preview ? (
                <img src={preview} alt="" className="mx-auto aspect-square w-full max-w-xs rounded-card object-cover" />
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="grid aspect-square w-full max-w-xs mx-auto place-items-center rounded-card border border-dashed border-clay/50 bg-clay-soft/40 text-clay hover:bg-clay-soft cursor-pointer"
                >
                  <Camera className="h-8 w-8" strokeWidth={1.5} />
                  <span className="mt-2 text-meta font-medium">{t('verify.takeSelfie')}</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" onChange={onPick} />
              {preview && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="mx-auto mt-3 flex items-center gap-1.5 text-meta font-medium text-clay hover:underline cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.8} /> {t('verify.retake')}
                </button>
              )}
            </div>

            <Button size="lg" fullWidth loading={submitting} disabled={!file} onClick={submit}>
              {t('verify.submit')}
            </Button>
            <p className="text-center text-[12px] text-ink-faint">{t('verify.privacy')}</p>
          </>
        )}
      </div>
    </div>
  );
}
