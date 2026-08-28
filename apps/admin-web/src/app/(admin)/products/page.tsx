'use client';

import { PageSkeleton } from '@/components/PageSkeleton';
import { FeedbackAlert } from '@/components/FeedbackAlert';
import { PageCard } from '@/components/PageCard';
import { PageHeader } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuthGuard, useTenantId } from '@/lib/hooks';

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

function CreateCard({
  title,
  children,
  onCreate,
}: {
  title: string;
  children: React.ReactNode;
  onCreate: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <PageCard title={title}>
      {children}
      <Button
        size="sm"
        className="mt-4"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onCreate();
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Creating…' : 'Create'}
      </Button>
    </PageCard>
  );
}

export default function ProductsPage() {
  useAuthGuard();
  const router = useRouter();
  const tenantId = useTenantId();
  const [categories, setCategories] = useState<Category[]>([]);
  const [tagFilter, setTagFilter] = useState('');
  const [filteredVariants, setFilteredVariants] = useState<
    Awaited<ReturnType<typeof api.listVariants>> | null
  >(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [categoryName, setCategoryName] = useState('');
  const [productTypeCategoryId, setProductTypeCategoryId] = useState('');
  const [productTypeName, setProductTypeName] = useState('');
  const [variantProductTypeId, setVariantProductTypeId] = useState('');
  const [variantName, setVariantName] = useState('');
  const [variantTags, setVariantTags] = useState('');
  const [batchVariantId, setBatchVariantId] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [unitBatchId, setUnitBatchId] = useState('');
  const [unitQty, setUnitQty] = useState(10);

  const load = async (tid: string) => {
    setError('');
    try {
      setCategories(await api.getCategories(tid));
      if (tagFilter.trim()) {
        setFilteredVariants(await api.listVariants(tid, { tag: tagFilter.trim() }));
      } else {
        setFilteredVariants(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load catalog');
    }
  };

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    if (tenantId) load(tenantId);
  }, [router, tenantId, tagFilter]);

  const productTypes = categories.flatMap((c) =>
    c.productTypes.map((pt) => ({ ...pt, categoryId: c.id, categoryName: c.name })),
  );

  const allVariants = categories.flatMap((c) =>
    c.productTypes.flatMap((pt) =>
      pt.variants.map((v) => ({ ...v, productTypeName: pt.name, categoryName: c.name })),
    ),
  );

  if (!tenantId) {
    return <PageSkeleton />;
  }

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Category → Product Type → Individual Product/Variant → Batch → Units"
      />
      <FeedbackAlert message={error} severity="error" />
      <FeedbackAlert message={message} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <CreateCard
          title="Category"
          onCreate={async () => {
            await api.createCategory(tenantId, categoryName);
            setCategoryName('');
            setMessage('Category created');
            load(tenantId);
          }}
        >
          <Input label="Category name" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} />
        </CreateCard>

        <CreateCard
          title="Product Type"
          onCreate={async () => {
            await api.createProductType(tenantId, productTypeCategoryId, productTypeName);
            setProductTypeName('');
            setMessage('Product type created');
            load(tenantId);
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
            <Input label="Product type name" value={productTypeName} onChange={(e) => setProductTypeName(e.target.value)} />
          </div>
        </CreateCard>

        <CreateCard
          title="Individual Product / Variant"
          onCreate={async () => {
            const tags = variantTags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean);
            await api.createVariant(tenantId, variantProductTypeId, variantName, tags.length ? tags : undefined);
            setVariantName('');
            setVariantTags('');
            setMessage('Variant created with system product code');
            load(tenantId);
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
            <Input label="Variant name" value={variantName} onChange={(e) => setVariantName(e.target.value)} />
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
          onCreate={async () => {
            await api.createBatch(tenantId, { productVariantId: batchVariantId, batchCode });
            setBatchCode('');
            setMessage('Batch created');
            load(tenantId);
          }}
        >
          <div className="flex flex-col gap-4">
            <Select label="Variant" value={batchVariantId} onChange={(e) => setBatchVariantId(e.target.value)}>
              <option value="">Select variant</option>
              {allVariants.map((v) => (
                <option key={v.id} value={v.id}>{v.categoryName} / {v.productTypeName} — {v.name}</option>
              ))}
            </Select>
            <Input label="Batch code" value={batchCode} onChange={(e) => setBatchCode(e.target.value)} />
          </div>
        </CreateCard>

        <CreateCard
          title="Generate units"
          onCreate={async () => {
            const res = await api.generateUnits(tenantId, unitBatchId, unitQty, 'ABC');
            setMessage(res.mode === 'sync' ? `Generated ${res.generated} units` : `Async job ${res.jobId} started`);
            load(tenantId);
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
              min={1}
              max={100000}
              value={unitQty}
              onChange={(e) => setUnitQty(Number(e.target.value))}
            />
          </div>
        </CreateCard>

        <PageCard title="Filter by tag">
          <Input
            label="Tag"
            placeholder="SH-A"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
          />
        </PageCard>
      </div>

      {filteredVariants && (
        <PageCard title={`Variants matching tag “${tagFilter}”`} className="mb-6">
          {filteredVariants.length === 0 ? (
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
      {categories.length === 0 ? (
        <p className="text-sm text-hope-secondary">No categories yet.</p>
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
                              onClick={async () => {
                                await api.updateVariantStatus(tenantId, v.id, 'ACTIVE');
                                setMessage(`${v.name} activated`);
                                load(tenantId);
                              }}
                            >
                              Activate
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
