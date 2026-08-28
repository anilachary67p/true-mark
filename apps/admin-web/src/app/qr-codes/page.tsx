'use client';

import { AdminShell } from '@/components/AdminShell';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuthGuard, useTenantId } from '@/lib/hooks';

export default function QrCodesPage() {
  useAuthGuard();
  const router = useRouter();
  const tenantId = useTenantId();
  const [items, setItems] = useState<Array<{ id: string; url: string; status: string; productUnit?: { serial?: { serialNumber: string }; batch?: { batchCode: string } } }>>([]);
  const [preview, setPreview] = useState<{ url: string; png: string } | null>(null);
  const [batchId, setBatchId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async (tid: string) => {
    try {
      const res = await api.listQrCodes(tid);
      setItems(res.items);
      setPreview(await api.previewQr(tid));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load QR codes');
    }
  };

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    if (tenantId) load(tenantId);
  }, [router, tenantId]);

  if (!tenantId) {
    return (
      <AdminShell>
        <h1>QR Codes</h1>
        <p>Loading…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <h1>QR Codes</h1>
      <p style={{ color: '#666', margin: '0.5rem 0 1rem' }}>View, export, and manage QR code lifecycle.</p>

      {error && <p style={{ color: '#b00020' }}>{error}</p>}
      {message && <p style={{ color: '#0a7' }}>{message}</p>}

      {preview && (
        <section style={{ background: '#fff', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}>
          <h3>Preview (sample)</h3>
          <p style={{ fontSize: 13, color: '#666' }}>{preview.url}</p>
          <img src={`data:image/png;base64,${preview.png}`} alt="QR preview" width={180} height={180} />
        </section>
      )}

      <section style={{ background: '#fff', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}>
        <h3>Batch operations</h3>
        <input
          placeholder="Batch ID"
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          style={{ width: '100%', maxWidth: 480, marginBottom: 8 }}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={async () => {
              const res = await api.generateBatchQr(tenantId, batchId);
              setMessage(`Generated ${res.created} QR codes for batch`);
              load(tenantId);
            }}
          >
            Generate missing QR
          </button>
          <button
            onClick={async () => {
              const res = await api.exportBatchQr(tenantId, batchId, 'ZIP');
              if (res.data) {
                const blob = Uint8Array.from(atob(res.data), (c) => c.charCodeAt(0));
                const url = URL.createObjectURL(new Blob([blob], { type: 'application/zip' }));
                const a = document.createElement('a');
                a.href = url;
                a.download = `qr-batch-${batchId.slice(0, 8)}.zip`;
                a.click();
                URL.revokeObjectURL(url);
              }
              setMessage(`Exported ${res.count} QR codes as ZIP`);
            }}
          >
            Export batch (ZIP)
          </button>
        </div>
      </section>

      <h2>Recent QR codes ({items.length})</h2>
      <table style={{ width: '100%', background: '#fff', borderRadius: 8, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 8 }}>Serial</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Batch</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Status</th>
            <th style={{ textAlign: 'left', padding: 8 }}>URL</th>
            <th style={{ padding: 8 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((qr) => (
            <tr key={qr.id}>
              <td style={{ padding: 8 }}>{qr.productUnit?.serial?.serialNumber ?? '—'}</td>
              <td style={{ padding: 8 }}>{qr.productUnit?.batch?.batchCode ?? '—'}</td>
              <td style={{ padding: 8 }}>{qr.status}</td>
              <td style={{ padding: 8, fontSize: 12, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>{qr.url}</td>
              <td style={{ padding: 8 }}>
                {qr.status === 'ACTIVE' && (
                  <button
                    onClick={async () => {
                      await api.updateQrStatus(tenantId, qr.id, 'REVOKED', 'Admin revoked');
                      setMessage('QR revoked');
                      load(tenantId);
                    }}
                  >
                    Revoke
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </AdminShell>
  );
}
