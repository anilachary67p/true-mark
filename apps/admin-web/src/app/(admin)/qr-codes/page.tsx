'use client';

import { PageSkeleton } from '@/components/PageSkeleton';
import { FeedbackAlert } from '@/components/FeedbackAlert';
import { PageCard } from '@/components/PageCard';
import { PageHeader } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuthGuard, useTenantId } from '@/lib/hooks';

export default function QrCodesPage() {
  useAuthGuard();
  const router = useRouter();
  const tenantId = useTenantId();
  const [items, setItems] = useState<
    Array<{
      id: string;
      url: string;
      status: string;
      productUnit?: { serial?: { serialNumber: string }; batch?: { batchCode: string } };
    }>
  >([]);
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
    return <PageSkeleton />;
  }

  return (
    <>
      <PageHeader title="QR Codes" subtitle="View, export, and manage QR code lifecycle" />
      <FeedbackAlert message={error} severity="error" />
      <FeedbackAlert message={message} />

      {preview && (
        <PageCard title="Preview (sample)">
          <p className="mb-2 text-sm text-hope-secondary">{preview.url}</p>
          <img
            src={`data:image/png;base64,${preview.png}`}
            alt="QR preview"
            className="h-[180px] w-[180px] rounded-lg border border-slate-200"
          />
        </PageCard>
      )}

      <PageCard title="Batch operations">
        <div className="mb-4 max-w-md">
          <Input
            label="Batch ID"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={async () => {
              const res = await api.generateBatchQr(tenantId, batchId);
              setMessage(`Generated ${res.created} QR codes for batch`);
              load(tenantId);
            }}
          >
            Generate missing QR
          </Button>
          <Button
            variant="outline"
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
          </Button>
        </div>
      </PageCard>

      <PageCard title={`Recent QR codes (${items.length})`} noPadding>
        <Table>
          <THead>
            <TR>
              <TH>Serial</TH>
              <TH>Batch</TH>
              <TH>Status</TH>
              <TH>URL</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {items.map((qr) => (
              <TR key={qr.id}>
                <TD>{qr.productUnit?.serial?.serialNumber ?? '—'}</TD>
                <TD>{qr.productUnit?.batch?.batchCode ?? '—'}</TD>
                <TD><StatusChip status={qr.status} /></TD>
                <TD className="max-w-[280px] truncate">
                  <span className="text-xs">{qr.url}</span>
                </TD>
                <TD className="text-right">
                  {qr.status === 'ACTIVE' && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={async () => {
                        await api.updateQrStatus(tenantId, qr.id, 'REVOKED', 'Admin revoked');
                        setMessage('QR revoked');
                        load(tenantId);
                      }}
                    >
                      Revoke
                    </Button>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </PageCard>
    </>
  );
}
