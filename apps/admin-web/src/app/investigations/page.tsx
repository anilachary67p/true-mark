'use client';

import { AdminShell } from '@/components/AdminShell';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuthGuard, useTenantId } from '@/lib/hooks';

export default function InvestigationsPage() {
  useAuthGuard();
  const router = useRouter();
  const tenantId = useTenantId();
  const [items, setItems] = useState<
    Array<{ id: string; title: string; status: string; description?: string }>
  >([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const load = (tid: string) => api.getInvestigations(tid).then(setItems);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    if (tenantId) load(tenantId);
  }, [router, tenantId]);

  return (
    <AdminShell>
      <h1>Investigations</h1>
      <section
        style={{ background: '#fff', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}
      >
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: '100%', marginBottom: 8 }}
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ width: '100%', marginBottom: 8 }}
        />
        <button
          onClick={async () => {
            if (!tenantId) return;
            await api.createInvestigation(tenantId, { title, description });
            setTitle('');
            setDescription('');
            load(tenantId);
          }}
        >
          Open investigation
        </button>
      </section>
      {items.map((inv) => (
        <div
          key={inv.id}
          style={{ background: '#fff', padding: '1rem', borderRadius: 8, marginBottom: 8 }}
        >
          <strong>{inv.title}</strong> ({inv.status})
          {inv.description && <p style={{ color: '#666', fontSize: 14 }}>{inv.description}</p>}
          {inv.status === 'OPEN' && (
            <button
              onClick={async () => {
                if (!tenantId) return;
                await api.updateInvestigationStatus(
                  tenantId,
                  inv.id,
                  'UNDER_REVIEW',
                  'Review started',
                );
                load(tenantId);
              }}
            >
              Mark under review
            </button>
          )}
        </div>
      ))}
    </AdminShell>
  );
}
