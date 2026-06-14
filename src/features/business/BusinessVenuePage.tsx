import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, MapPin, Phone } from 'lucide-react';
import { getMyBusiness, updateMyBusiness } from '@/api';
import { useAsync } from '@/hooks/useAsync';
import { useSession } from '@/store/session';
import { Button } from '@/components/Button';
import { Input, Textarea } from '@/components/Field';
import { Skeleton } from '@/components/Skeleton';
import { toast } from '@/store/toast';

export function BusinessVenuePage() {
  const navigate = useNavigate();
  const bump = useSession((s) => s.bumpData);
  const data = useAsync(() => getMyBusiness(), []);
  const [form, setForm] = useState({ name: '', description: '', address: '', phone: '' });
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data.data && !ready) {
      const b = data.data.business;
      setForm({ name: b.name, description: b.description, address: b.address, phone: b.phone });
      setReady(true);
    }
  }, [data.data, ready]);

  async function save() {
    setSaving(true);
    try {
      await updateMyBusiness(form);
      bump();
      toast('Venue updated', 'success');
      navigate('/business/dashboard');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update venue', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (data.loading || !ready) {
    return (
      <div className="mx-auto max-w-xl space-y-3">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-72 w-full rounded-card" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <button onClick={() => navigate('/business/dashboard')} className="mb-3 inline-flex items-center gap-1.5 text-meta font-medium text-ink-soft hover:text-ink cursor-pointer">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.8} /> Back to dashboard
      </button>
      <h1 className="font-display text-h1 font-medium text-ink">Edit your venue</h1>
      <p className="mt-1 text-meta text-ink-soft">Update how your venue appears to hosts choosing a place.</p>

      <div className="mt-5 space-y-4 rounded-card border border-border bg-surface p-5">
        <Input label="Business name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} leftIcon={<Building2 className="h-5 w-5" strokeWidth={1.6} />} />
        <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} leftIcon={<MapPin className="h-5 w-5" strokeWidth={1.6} />} />
        <Input label="Phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} leftIcon={<Phone className="h-5 w-5" strokeWidth={1.6} />} />

        <div className="flex gap-3 pt-1">
          <Button variant="outline" size="lg" onClick={() => navigate('/business/dashboard')}>Cancel</Button>
          <Button size="lg" fullWidth loading={saving} disabled={!form.name || !form.address} onClick={save}>
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
