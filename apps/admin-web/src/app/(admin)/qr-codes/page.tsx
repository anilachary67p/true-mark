'use client';

import { PageSkeleton } from '@/components/PageSkeleton';
import { FeedbackAlert } from '@/components/FeedbackAlert';
import { PageCard } from '@/components/PageCard';
import { PageHeader } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { EmptyState } from '@/components/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TD } from '@/components/ui/Table';
import { VirtualizedTable } from '@/components/ui/VirtualizedTable';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useTenantId } from '@/lib/hooks';
import { useAsyncAction, useAsyncData, useDebouncedValue } from '@/lib/useAsync';
import { formatNumber, toFiniteNumber } from '@/lib/format';
import { isUuid } from '@/lib/validation';

const PAGE_SIZE = 100;

function downloadBase64(data: string, filename: string, type: string) {
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  } catch {
    throw new Error('The exported file could not be decoded. Please try again.');
  }
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function QrCodesPage() {
  const tenantId = useTenantId();
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim().toLowerCase(), 300);
  const [batchId, setBatchId] = useState('');
  const [batchIdError, setBatchIdError] = useState('');
  const [message, setMessage] = useState('');
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const listQuery = useAsyncData(() => api.listQrCodes(tenantId, PAGE_SIZE, offset), [tenantId, offset], {
    enabled: !!tenantId,
  });
  const previewQuery = useAsyncData(() => api.previewQr(tenantId), [tenantId], {
    enabled: !!tenantId,
  });

  const items = useMemo(
    () => (Array.isArray(listQuery.data?.items) ? listQuery.data.items : []),
    [listQuery.data],
  );
  const total = toFiniteNumber(listQuery.data?.total);
  const visibleItems = useMemo(() => {
    if (!debouncedSearch) return items;
    return items.filter((qr) =>
      [qr.productUnit?.serial?.serialNumber, qr.productUnit?.batch?.batchCode, qr.url, qr.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(debouncedSearch)),
    );
  }, [items, debouncedSearch]);

  const hasPrev = offset > 0;
  const hasNext = items.length >= PAGE_SIZE && (total === 0 || offset + PAGE_SIZE < total);
  const preview = previewQuery.data?.png ? previewQuery.data : null;

  const generateQr = useAsyncAction(async (id: string) => {
    const res = await api.generateBatchQr(tenantId, id);
    setMessage(`Generated ${formatNumber(res?.created)} QR codes for batch`);
  });
  const exportQr = useAsyncAction(async (id: string) => {
    const res = await api.exportBatchQr(tenantId, id, 'ZIP');
    const count = toFiniteNumber(res?.count);
    if (!res?.data || count === 0) {
      setMessage('No QR codes found for this batch to export');
      return;
    }
    downloadBase64(res.data, `qr-batch-${id.slice(0, 8)}.zip`, 'application/zip');
    setMessage(`Exported ${formatNumber(count)} QR codes as ZIP`);
  });
  const revokeQr = useAsyncAction((qrId: string) =>
    api.updateQrStatus(tenantId, qrId, 'REVOKED', 'Admin revoked'),
  );
  const batchBusy = generateQr.pending || exportQr.pending;

  function validBatchId(): string | null {
    const id = batchId.trim();
    if (!isUuid(id)) {
      setBatchIdError('Enter a valid batch ID (UUID)');
      return null;
    }
    setBatchIdError('');
    return id;
  }

  async function handleGenerate() {
    if (batchBusy) return;
    const id = validBatchId();
    if (!id) return;
    setMessage('');
    exportQr.clearError();
    if (await generateQr.run(id)) listQuery.reload();
  }

  async function handleExport() {
    if (batchBusy) return;
    const id = validBatchId();
    if (!id) return;
    setMessage('');
    generateQr.clearError();
    await exportQr.run(id);
  }

  async function handleRevoke(qrId: string, label: string) {
    if (revokeQr.pending) return;
    if (!window.confirm(`Revoke QR code ${label}? Consumers scanning it will see it as revoked. This cannot be undone.`)) {
      return;
    }
    setMessage('');
    setRevokingId(qrId);
    const ok = await revokeQr.run(qrId);
    setRevokingId(null);
    if (ok) {
      setMessage('QR revoked');
      listQuery.reload();
    }
  }

  if (!tenantId) {
    return (
      <>
        <PageHeader title="QR Codes" subtitle="View, export, and manage QR code lifecycle" />
        <PageCard>
          <EmptyState
            title="No tenant assigned"
            description="Your account is not linked to a tenant. Contact your platform administrator."
          />
        </PageCard>
      </>
    );
  }

  return (
    <>
      <PageHeader title="QR Codes" subtitle="View, export, and manage QR code lifecycle" />
      <FeedbackAlert message={revokeQr.error} severity="error" />
      <FeedbackAlert message={message} />

      {preview && (
        <PageCard title="Preview (sample)">
          <p className="mb-2 break-all text-sm text-hope-secondary">{preview.url}</p>
          <img
            src={`data:image/png;base64,${preview.png}`}
            alt="QR preview"
            className="h-[180px] w-[180px] rounded-lg border border-slate-200"
          />
        </PageCard>
      )}
      {previewQuery.error && (
        <Alert variant="warning">
          <div className="flex items-center justify-between gap-3">
            <span>QR preview unavailable: {previewQuery.error}</span>
            <Button size="sm" variant="outline" onClick={previewQuery.reload}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      <PageCard title="Batch operations">
        <div className="mb-4 max-w-md">
          <Input
            label="Batch ID"
            value={batchId}
            aria-invalid={!!batchIdError}
            onChange={(e) => {
              setBatchId(e.target.value);
              if (batchIdError) setBatchIdError('');
            }}
          />
          {batchIdError && <p className="mt-1 text-xs text-red-600">{batchIdError}</p>}
        </div>
        <FeedbackAlert message={generateQr.error || exportQr.error} severity="error" />
        <div className="flex flex-wrap gap-2">
          <Button disabled={batchBusy} onClick={handleGenerate}>
            {generateQr.pending ? 'Generating…' : 'Generate missing QR'}
          </Button>
          <Button variant="outline" disabled={batchBusy} onClick={handleExport}>
            {exportQr.pending ? 'Exporting…' : 'Export batch (ZIP)'}
          </Button>
        </div>
      </PageCard>

      <PageCard title={`Recent QR codes (${formatNumber(total || items.length)})`} noPadding>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full max-w-sm">
            <Input
              label="Search this page"
              placeholder="Serial, batch or URL"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-hope-secondary">
              {items.length > 0
                ? `${formatNumber(offset + 1)}–${formatNumber(offset + items.length)}${total ? ` of ${formatNumber(total)}` : ''}`
                : ''}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={!hasPrev || listQuery.loading}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!hasNext || listQuery.loading}
              onClick={() => setOffset((o) => Math.max(0, o + PAGE_SIZE))}
            >
              Next
            </Button>
          </div>
        </div>
        {listQuery.error ? (
          <div className="p-4">
            <Alert variant="error" className="mb-0">
              <div className="flex items-center justify-between gap-3">
                <span>{listQuery.error}</span>
                <Button size="sm" variant="outline" onClick={listQuery.reload}>
                  Retry
                </Button>
              </div>
            </Alert>
          </div>
        ) : listQuery.loading && !listQuery.data ? (
          <div className="p-4">
            <PageSkeleton />
          </div>
        ) : (
          <VirtualizedTable
            columns={['Serial', 'Batch', 'Status', 'URL', 'Actions']}
            rows={visibleItems}
            rowKey={(qr) => qr.id}
            emptyMessage={
              debouncedSearch
                ? 'No QR codes on this page match your search.'
                : hasPrev
                  ? 'No QR codes on this page.'
                  : 'No QR codes yet. Generate them from a batch above.'
            }
            columnClassNames={[undefined, undefined, undefined, undefined, 'text-right']}
            renderRow={(qr) => (
              <>
                <TD>{qr.productUnit?.serial?.serialNumber ?? '—'}</TD>
                <TD>{qr.productUnit?.batch?.batchCode ?? '—'}</TD>
                <TD>
                  <StatusChip status={qr.status} />
                </TD>
                <TD className="max-w-[280px] truncate">
                  <span className="text-xs">{qr.url}</span>
                </TD>
                <TD className="text-right">
                  {qr.status === 'ACTIVE' && (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={revokeQr.pending}
                      onClick={() =>
                        handleRevoke(qr.id, qr.productUnit?.serial?.serialNumber ?? qr.id.slice(0, 8))
                      }
                    >
                      {revokingId === qr.id ? 'Revoking…' : 'Revoke'}
                    </Button>
                  )}
                </TD>
              </>
            )}
          />
        )}
      </PageCard>
    </>
  );
}
