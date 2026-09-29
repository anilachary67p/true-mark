'use client';

import { PageSkeleton } from '@/components/PageSkeleton';
import { FeedbackAlert } from '@/components/FeedbackAlert';
import { PageCard } from '@/components/PageCard';
import { PageHeader } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { EmptyState } from '@/components/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { useMemo, useState } from 'react';
import { api, isApiError } from '@/lib/api';
import { useTenantId } from '@/lib/hooks';
import { useAsyncAction, useAsyncData, useDebouncedValue } from '@/lib/useAsync';
import { parseIntInRange } from '@/lib/validation';

const NAME_MAX = 120;
const BATCH_CODE_MAX = 64;
const TAG_MAX = 50;
const TAGS_MAX_COUNT = 50;
const UNITS_MIN = 1;
const UNITS_MAX = 100000;
const SERIAL_PREFIX = /^[A-Za-z0-9-]{1,16}$/;

type Category = {
  id: string;
  name: string;
  status: string;
  productTypes: Array<{
    id: string;
    name: string;
    status: string;
    variants: Array<{
      id: string;
      name: string;
      productCode: string;
      status: string;
      tags: Array<{ tag: { name: string } }>;
      batches: Array<{ id: string; batchCode: string; status: string }>;
    }>;
  }>;
};

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeCategories(raw: unknown): Category[] {
  return asArray(raw as Category[] | undefined).map((c) => ({
    ...c,
    productTypes: asArray(c.productTypes).map((pt) => ({
      ...pt,
      variants: asArray(pt.variants).map((v) => ({
        ...v,
        tags: asArray(v.tags).filter((t) => t?.tag?.name),
        batches: asArray(v.batches),
      })),
    })),
  }));
}

function requireName(value: string, label: string): string {
  const name = value.trim();
  if (!name) throw new Error(`${label} is required`);
  if (name.length > NAME_MAX) throw new Error(`${label} must be at most ${NAME_MAX} characters`);
  return name;
}

function CreateCard({
  title,
  children,
  onCreate,
  conflictMessage,
  submitLabel = 'Create',
  pendingLabel = 'Creating…',
}: {
  title: string;
  children: React.ReactNode;
  onCreate: () => Promise<void>;
  conflictMessage?: string;
  submitLabel?: string;
  pendingLabel?: string;
}) {
  const action = useAsyncAction(async () => {
    try {
      await onCreate();
    } catch (err) {
      if (conflictMessage && isApiError(err, 409)) {
        throw new Error(conflictMessage);
      }
      throw err;
    }
  });
  return (
    <PageCard title={title}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void action.run();
        }}
      >
        {children}
        {action.error && (
          <Alert variant="error" className="mb-0 mt-4">
            {action.error}
          </Alert>
        )}
        <Button type="submit" size="sm" className="mt-4" disabled={action.pending}>
          {action.pending ? pendingLabel : submitLabel}
        </Button>
      </form>
    </PageCard>
  );
}

export default function ProductsPage() {
  const tenantId = useTenantId();
  const [tagFilter, setTagFilter] = useState('');
  const debouncedTag = useDebouncedValue(tagFilter.trim(), 300);
  const [message, setMessage] = useState('');

  const [categoryName, setCategoryName] = useState('');
  const [productTypeCategoryId, setProductTypeCategoryId] = useState('');
  const [productTypeName, setProductTypeName] = useState('');
  const [variantProductTypeId, setVariantProductTypeId] = useState('');
  const [variantName, setVariantName] = useState('');
  const [variantTags, setVariantTags] = useState('');
  const [batchVariantId, setBatchVariantId] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [batchMfgDate, setBatchMfgDate] = useState('');
  const [batchExpiryDate, setBatchExpiryDate] = useState('');
  const [unitBatchId, setUnitBatchId] = useState('');
  const [unitQty, setUnitQty] = useState('10');
  const [serialPrefix, setSerialPrefix] = useState('ABC');
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const catalogQuery = useAsyncData(() => api.getCategories(tenantId), [tenantId], {
    enabled: !!tenantId,
  });
  const variantsQuery = useAsyncData(
    () => api.listVariants(tenantId, { tag: debouncedTag }),
    [tenantId, debouncedTag],
    { enabled: !!tenantId && !!debouncedTag },
  );
  const activateVariant = useAsyncAction((variantId: string) =>
    api.updateVariantStatus(tenantId, variantId, 'ACTIVE'),
  );

  const categories = useMemo(() => normalizeCategories(catalogQuery.data), [catalogQuery.data]);
  const filteredVariants = debouncedTag ? asArray(variantsQuery.data) : null;

  const productTypes = categories.flatMap((c) =>
    c.productTypes.map((pt) => ({ ...pt, categoryId: c.id, categoryName: c.name })),
  );

  const allVariants = categories.flatMap((c) =>
    c.productTypes.flatMap((pt) =>
      pt.variants.map((v) => ({ ...v, productTypeName: pt.name, categoryName: c.name })),
    ),
  );

  const allBatchIds = new Set(allVariants.flatMap((v) => v.batches.map((b) => b.id)));

  function refresh() {
    catalogQuery.reload();
    if (debouncedTag) variantsQuery.reload();
  }

  async function handleActivate(variantId: string, name: string) {
    if (activateVariant.pending) return;
    setMessage('');
    setActivatingId(variantId);
    const ok = await activateVariant.run(variantId);
    setActivatingId(null);
    if (ok) {
      setMessage(`${name} activated`);
      refresh();
    }
  }

  if (!tenantId) {
    return (
      <>
        <PageHeader
          title="Products"
          subtitle="Category → Product Type → Individual Product/Variant → Batch → Units"
        />
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
      <PageHeader
        title="Products"
        subtitle="Category → Product Type → Individual Product/Variant → Batch → Units"
      />
      <FeedbackAlert message={activateVariant.error} severity="error" />
      <FeedbackAlert message={message} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <CreateCard
          title="Category"
          conflictMessage="A category with this name already exists."
          onCreate={async () => {
            const name = requireName(categoryName, 'Category name');
            setMessage('');
            await api.createCategory(tenantId, name);
            setCategoryName('');
            setMessage('Category created');
            refresh();
          }}
        >
          <Input
            label="Category name"
            maxLength={NAME_MAX}
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
          />
        </CreateCard>

        <CreateCard
          title="Product Type"
          conflictMessage="A product type with this name already exists in this category."
          onCreate={async () => {
            if (!categories.some((c) => c.id === productTypeCategoryId)) {
              throw new Error('Select a category');
            }
            const name = requireName(productTypeName, 'Product type name');
            setMessage('');
            await api.createProductType(tenantId, productTypeCategoryId, name);
            setProductTypeName('');
            setMessage('Product type created');
            refresh();
          }}
        >
          <div className="flex flex-col gap-4">
            <Select
              label="Category"
              value={productTypeCategoryId}
              onChange={(e) => setProductTypeCategoryId(e.target.value)}
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <Input
              label="Product type name"
              maxLength={NAME_MAX}
              value={productTypeName}
              onChange={(e) => setProductTypeName(e.target.value)}
            />
          </div>
        </CreateCard>

        <CreateCard
          title="Individual Product / Variant"
          conflictMessage="A variant with this name already exists for this product type."
          onCreate={async () => {
            if (!productTypes.some((pt) => pt.id === variantProductTypeId)) {
              throw new Error('Select a product type');
            }
            const name = requireName(variantName, 'Variant name');
            const tags = Array.from(
              new Set(
                variantTags
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean),
              ),
            );
            if (tags.length > TAGS_MAX_COUNT) throw new Error(`At most ${TAGS_MAX_COUNT} tags are allowed`);
            const longTag = tags.find((t) => t.length > TAG_MAX);
            if (longTag) throw new Error(`Tag "${longTag.slice(0, 20)}…" exceeds ${TAG_MAX} characters`);
            setMessage('');
            await api.createVariant(tenantId, variantProductTypeId, name, tags.length ? tags : undefined);
            setVariantName('');
            setVariantTags('');
            setMessage('Variant created with system product code');
            refresh();
          }}
        >
          <div className="flex flex-col gap-4">
            <Select
              label="Product type"
              value={variantProductTypeId}
              onChange={(e) => setVariantProductTypeId(e.target.value)}
            >
              <option value="">Select product type</option>
              {productTypes.map((pt) => (
                <option key={pt.id} value={pt.id}>{pt.categoryName} → {pt.name}</option>
              ))}
            </Select>
            <Input
              label="Variant name"
              maxLength={NAME_MAX}
              value={variantName}
              onChange={(e) => setVariantName(e.target.value)}
            />
            <Input
              label="Tags (comma-separated)"
              placeholder="SH-A, SH-A-100"
              value={variantTags}
              onChange={(e) => setVariantTags(e.target.value)}
            />
          </div>
        </CreateCard>

        <CreateCard
          title="Batch"
          conflictMessage="A batch with this code already exists."
          onCreate={async () => {
            if (!allVariants.some((v) => v.id === batchVariantId)) throw new Error('Select a variant');
            const code = batchCode.trim();
            if (!code) throw new Error('Batch code is required');
            if (code.length > BATCH_CODE_MAX) {
              throw new Error(`Batch code must be at most ${BATCH_CODE_MAX} characters`);
            }
            const mfg = batchMfgDate ? new Date(batchMfgDate) : null;
            const expiry = batchExpiryDate ? new Date(batchExpiryDate) : null;
            if (mfg && Number.isNaN(mfg.getTime())) throw new Error('Manufacturing date is invalid');
            if (expiry && Number.isNaN(expiry.getTime())) throw new Error('Expiry date is invalid');
            if (mfg && expiry && expiry <= mfg) {
              throw new Error('Expiry date must be after the manufacturing date');
            }
            setMessage('');
            await api.createBatch(tenantId, {
              productVariantId: batchVariantId,
              batchCode: code,
              manufacturingDate: batchMfgDate || undefined,
              expiryDate: batchExpiryDate || undefined,
            });
            setBatchCode('');
            setBatchMfgDate('');
            setBatchExpiryDate('');
            setMessage('Batch created');
            refresh();
          }}
        >
          <div className="flex flex-col gap-4">
            <Select label="Variant" value={batchVariantId} onChange={(e) => setBatchVariantId(e.target.value)}>
              <option value="">Select variant</option>
              {allVariants.map((v) => (
                <option key={v.id} value={v.id}>{v.categoryName} / {v.productTypeName} — {v.name}</option>
              ))}
            </Select>
            <Input
              label="Batch code"
              maxLength={BATCH_CODE_MAX}
              value={batchCode}
              onChange={(e) => setBatchCode(e.target.value)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Manufacturing date (optional)"
                type="date"
                value={batchMfgDate}
                max={batchExpiryDate || undefined}
                onChange={(e) => setBatchMfgDate(e.target.value)}
              />
              <Input
                label="Expiry date (optional)"
                type="date"
                value={batchExpiryDate}
                min={batchMfgDate || undefined}
                onChange={(e) => setBatchExpiryDate(e.target.value)}
              />
            </div>
          </div>
        </CreateCard>

        <CreateCard
          title="Generate units"
          submitLabel="Generate"
          pendingLabel="Generating…"
          conflictMessage="Unit generation is already running for this batch. Please wait for it to finish."
          onCreate={async () => {
            if (!allBatchIds.has(unitBatchId)) throw new Error('Select a batch');
            const quantity = parseIntInRange(unitQty, UNITS_MIN, UNITS_MAX);
            if (quantity === null) {
              throw new Error(
                `Quantity must be a whole number between ${UNITS_MIN} and ${UNITS_MAX.toLocaleString()}`,
              );
            }
            const prefix = serialPrefix.trim();
            if (prefix && !SERIAL_PREFIX.test(prefix)) {
              throw new Error('Serial prefix must be 1-16 letters, digits or dashes');
            }
            setMessage('');
            const res = await api.generateUnits(tenantId, unitBatchId, quantity, prefix || undefined);
            setMessage(
              res?.mode === 'sync'
                ? `Generated ${res.generated ?? quantity} units`
                : res?.jobId
                  ? `Async job ${res.jobId} started`
                  : 'Unit generation started',
            );
            refresh();
          }}
        >
          <div className="flex flex-col gap-4">
            <Select label="Batch" value={unitBatchId} onChange={(e) => setUnitBatchId(e.target.value)}>
              <option value="">Select batch</option>
              {allVariants.flatMap((v) =>
                v.batches.map((b) => (
                  <option key={b.id} value={b.id}>{v.name} / {b.batchCode}</option>
                )),
              )}
            </Select>
            <Input
              label="Quantity"
              type="number"
              inputMode="numeric"
              min={UNITS_MIN}
              max={UNITS_MAX}
              step={1}
              value={unitQty}
              onChange={(e) => setUnitQty(e.target.value)}
            />
            <Input
              label="Serial prefix"
              placeholder="ABC"
              maxLength={16}
              value={serialPrefix}
              onChange={(e) => setSerialPrefix(e.target.value)}
            />
          </div>
        </CreateCard>

        <PageCard title="Filter by tag">
          <Input
            label="Tag"
            placeholder="SH-A"
            maxLength={TAG_MAX}
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
          />
        </PageCard>
      </div>

      {filteredVariants && (
        <PageCard title={`Variants matching tag “${debouncedTag}”`} className="mb-6">
          {variantsQuery.error ? (
            <Alert variant="error" className="mb-0">
              <div className="flex items-center justify-between gap-3">
                <span>{variantsQuery.error}</span>
                <Button size="sm" variant="outline" onClick={variantsQuery.reload}>
                  Retry
                </Button>
              </div>
            </Alert>
          ) : variantsQuery.loading ? (
            <p className="text-sm text-hope-secondary">Searching…</p>
          ) : filteredVariants.length === 0 ? (
            <p className="text-sm text-hope-secondary">No variants found.</p>
          ) : (
            <ul className="space-y-2">
              {filteredVariants.map((v) => (
                <li key={v.id} className="text-sm">
                  <span className="font-medium">{v.name}</span>
                  <span className="text-hope-secondary"> · {v.productCode}</span>
                </li>
              ))}
            </ul>
          )}
        </PageCard>
      )}

      <h2 className="mb-4 text-lg font-semibold text-hope-dark">Product catalog</h2>
      {catalogQuery.error ? (
        <Alert variant="error">
          <div className="flex items-center justify-between gap-3">
            <span>{catalogQuery.error}</span>
            <Button size="sm" variant="outline" onClick={catalogQuery.reload}>
              Retry
            </Button>
          </div>
        </Alert>
      ) : catalogQuery.loading && !catalogQuery.data ? (
        <PageSkeleton />
      ) : categories.length === 0 ? (
        <PageCard>
          <EmptyState title="No categories yet" description="Create a category above to start building your catalog." />
        </PageCard>
      ) : (
        categories.map((category) => (
          <PageCard key={category.id} className="mb-4">
            <div className="mb-3 flex items-center gap-2">
              <p className="font-semibold text-hope-dark">{category.name}</p>
              <StatusChip status={category.status} />
            </div>
            {category.productTypes.length === 0 ? (
              <p className="text-sm text-hope-secondary">No product types.</p>
            ) : (
              category.productTypes.map((pt) => (
                <div key={pt.id} className="mb-4 border-l-2 border-slate-200 pl-4">
                  <p className="text-sm font-medium text-hope-dark">Product type: {pt.name}</p>
                  {pt.variants.length === 0 && (
                    <p className="mt-2 text-xs text-hope-secondary">No variants.</p>
                  )}
                  <ul className="mt-2 space-y-3">
                    {pt.variants.map((v) => (
                      <li key={v.id}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{v.name}</span>
                          <StatusChip status={v.status} />
                          <span className="text-xs text-hope-secondary">{v.productCode}</span>
                          {v.status === 'DRAFT' && (
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700"
                              disabled={activateVariant.pending}
                              onClick={() => handleActivate(v.id, v.name)}
                            >
                              {activatingId === v.id ? 'Activating…' : 'Activate'}
                            </Button>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {v.tags.map((t) => (
                            <span
                              key={t.tag.name}
                              className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-hope-secondary"
                            >
                              {t.tag.name}
                            </span>
                          ))}
                        </div>
                        <ul className="mt-1 space-y-1 pl-2">
                          {v.batches.map((b) => (
                            <li key={b.id} className="text-xs text-hope-secondary">
                              Batch {b.batchCode} · {b.status}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </PageCard>
        ))
      )}
    </>
  );
}
