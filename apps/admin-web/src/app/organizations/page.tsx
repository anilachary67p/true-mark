'use client';

import { AdminShell } from '@/components/AdminShell';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getToken, Tenant } from '@/lib/api';
import { useAuthGuard } from '@/lib/hooks';

export default function OrganizationsPage() {
  useAuthGuard();
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', legalName: '', deploymentType: 'SAAS' });
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      setTenants(await api.getTenants());
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!getToken()) return;
    load();
  }, [router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await api.createTenant({
        name: form.name,
        legalName: form.legalName || undefined,
        deploymentType: form.deploymentType,
      });
      setShowCreate(false);
      setForm({ name: '', legalName: '', deploymentType: 'SAAS' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tenant');
    } finally {
      setCreating(false);
    }
  }

  return (
    <AdminShell>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1>Organizations / Clients</h1>
          <p style={{ color: '#666', marginTop: 4 }}>Manage tenant companies and onboarding</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{ padding: '0.5rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6 }}
        >
          + Create Tenant
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          style={{ background: '#fff', padding: '1.5rem', borderRadius: 8, marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
        >
          <h2 style={{ fontSize: 16, marginBottom: '1rem' }}>New Tenant</h2>
          {error && <p style={{ color: '#dc2626', marginBottom: '0.75rem', fontSize: 14 }}>{error}</p>}
          <div style={{ display: 'grid', gap: '1rem', maxWidth: 480 }}>
            <label>
              Company name *
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, border: '1px solid #ddd', borderRadius: 4 }}
              />
            </label>
            <label>
              Legal name
              <input
                value={form.legalName}
                onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, border: '1px solid #ddd', borderRadius: 4 }}
              />
            </label>
            <label>
              Deployment type
              <select
                value={form.deploymentType}
                onChange={(e) => setForm({ ...form, deploymentType: e.target.value })}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, border: '1px solid #ddd', borderRadius: 4 }}
              >
                <option value="SAAS">SaaS</option>
                <option value="DEDICATED_CLOUD">Dedicated Cloud</option>
                <option value="CUSTOMER_CLOUD">Customer Cloud</option>
                <option value="ON_PREM">On-Premises</option>
                <option value="HYBRID">Hybrid</option>
              </select>
            </label>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button type="submit" disabled={creating} style={{ padding: '0.5rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4 }}>
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: 'none', borderRadius: 4 }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table style={{ width: '100%', background: '#fff', borderRadius: 8, overflow: 'hidden' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee', background: '#f9fafb' }}>
              <th style={{ padding: '0.75rem' }}>Company</th>
              <th style={{ padding: '0.75rem' }}>Status</th>
              <th style={{ padding: '0.75rem' }}>Deployment</th>
              <th style={{ padding: '0.75rem' }}>Config v</th>
              <th style={{ padding: '0.75rem' }}>Domains</th>
              <th style={{ padding: '0.75rem' }}></th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.75rem' }}>
                  <strong>{t.name}</strong>
                  {t.legalName && <div style={{ fontSize: 12, color: '#888' }}>{t.legalName}</div>}
                </td>
                <td style={{ padding: '0.75rem' }}><StatusBadge status={t.status} /></td>
                <td style={{ padding: '0.75rem', fontSize: 13 }}>{t.deploymentType}</td>
                <td style={{ padding: '0.75rem', fontSize: 13 }}>{t.configVersion}</td>
                <td style={{ padding: '0.75rem', fontSize: 13 }}>
                  {(t.verificationDomains?.length ?? 0)} verification
                </td>
                <td style={{ padding: '0.75rem' }}>
                  <Link href={`/domains?tenantId=${t.id}`} style={{ fontSize: 14 }}>Configure domains</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: '#16a34a',
    PENDING: '#d97706',
    SUSPENDED: '#dc2626',
    DISABLED: '#6b7280',
  };
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color: colors[status] ?? '#666' }}>{status}</span>
  );
}
