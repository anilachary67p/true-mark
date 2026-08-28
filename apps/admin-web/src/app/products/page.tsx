'use client';

import { AdminShell } from '@/components/AdminShell';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuthGuard, useTenantId } from '@/lib/hooks';

type Product = {
  id: string;
  name: string;
  sku?: string | null;
  status: string;
  brand: { id: string; name: string; manufacturer: { id: string; name: string } };
  variants: Array<{
    id: string;
    name: string;
    status: string;
    batches: Array<{ id: string; batchCode: string; status: string }>;
  }>;
};

export default function ProductsPage() {
  useAuthGuard();
  const router = useRouter();
  const tenantId = useTenantId();
  const [products, setProducts] = useState<Product[]>([]);
  const [manufacturers, setManufacturers] = useState<
    Array<{ id: string; name: string; brands: Array<{ id: string; name: string }> }>
  >([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [mfgName, setMfgName] = useState('');
  const [brandMfgId, setBrandMfgId] = useState('');
  const [brandName, setBrandName] = useState('');
  const [productBrandId, setProductBrandId] = useState('');
  const [productName, setProductName] = useState('');
  const [productSku, setProductSku] = useState('');
  const [variantProductId, setVariantProductId] = useState('');
  const [variantName, setVariantName] = useState('');
  const [batchVariantId, setBatchVariantId] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [unitBatchId, setUnitBatchId] = useState('');
  const [unitQty, setUnitQty] = useState(10);

  const load = async (tid: string) => {
    setError('');
    try {
      setProducts(await api.getProducts(tid));
      setManufacturers(await api.listManufacturers(tid));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    }
  };

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    if (tenantId) load(tenantId);
  }, [router, tenantId]);

  const brands = manufacturers.flatMap((m) =>
    m.brands.map((b) => ({ ...b, manufacturerId: m.id })),
  );

  if (!tenantId) {
    return (
      <AdminShell>
        <h1>Products</h1>
        <p>Loading tenant context…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <h1>Products</h1>
      <p style={{ color: '#666', margin: '0.5rem 0 1rem' }}>
        Manage manufacturer → brand → product → variant → batch → units hierarchy.
      </p>

      {error && <p style={{ color: '#b00020' }}>{error}</p>}
      {message && <p style={{ color: '#0a7' }}>{message}</p>}

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: '#fff', padding: '1rem', borderRadius: 8 }}>
          <h3>Manufacturer</h3>
          <input placeholder="Name" value={mfgName} onChange={(e) => setMfgName(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
          <button
            onClick={async () => {
              await api.createManufacturer(tenantId, mfgName);
              setMfgName('');
              setMessage('Manufacturer created');
              load(tenantId);
            }}
          >
            Create
          </button>
        </div>

        <div style={{ background: '#fff', padding: '1rem', borderRadius: 8 }}>
          <h3>Brand</h3>
          <select value={brandMfgId} onChange={(e) => setBrandMfgId(e.target.value)} style={{ width: '100%', marginBottom: 8 }}>
            <option value="">Select manufacturer</option>
            {manufacturers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <input placeholder="Brand name" value={brandName} onChange={(e) => setBrandName(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
          <button
            onClick={async () => {
              await api.createBrand(tenantId, brandMfgId, brandName);
              setBrandName('');
              setMessage('Brand created');
              load(tenantId);
            }}
          >
            Create
          </button>
        </div>

        <div style={{ background: '#fff', padding: '1rem', borderRadius: 8 }}>
          <h3>Product</h3>
          <select value={productBrandId} onChange={(e) => setProductBrandId(e.target.value)} style={{ width: '100%', marginBottom: 8 }}>
            <option value="">Select brand</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <input placeholder="Product name" value={productName} onChange={(e) => setProductName(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
          <input placeholder="SKU (optional)" value={productSku} onChange={(e) => setProductSku(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
          <button
            onClick={async () => {
              await api.createProduct(tenantId, { brandId: productBrandId, name: productName, sku: productSku || undefined });
              setProductName('');
              setProductSku('');
              setMessage('Product created (DRAFT)');
              load(tenantId);
            }}
          >
            Create
          </button>
        </div>

        <div style={{ background: '#fff', padding: '1rem', borderRadius: 8 }}>
          <h3>Variant</h3>
          <select value={variantProductId} onChange={(e) => setVariantProductId(e.target.value)} style={{ width: '100%', marginBottom: 8 }}>
            <option value="">Select product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input placeholder="Variant name" value={variantName} onChange={(e) => setVariantName(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
          <button
            onClick={async () => {
              await api.createVariant(tenantId, variantProductId, variantName);
              setVariantName('');
              setMessage('Variant created');
              load(tenantId);
            }}
          >
            Create
          </button>
        </div>

        <div style={{ background: '#fff', padding: '1rem', borderRadius: 8 }}>
          <h3>Batch</h3>
          <select value={batchVariantId} onChange={(e) => setBatchVariantId(e.target.value)} style={{ width: '100%', marginBottom: 8 }}>
            <option value="">Select variant</option>
            {products.flatMap((p) =>
              p.variants.map((v) => (
                <option key={v.id} value={v.id}>{p.name} — {v.name}</option>
              )),
            )}
          </select>
          <input placeholder="Batch code" value={batchCode} onChange={(e) => setBatchCode(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
          <button
            onClick={async () => {
              await api.createBatch(tenantId, { productVariantId: batchVariantId, batchCode });
              setBatchCode('');
              setMessage('Batch created');
              load(tenantId);
            }}
          >
            Create
          </button>
        </div>

        <div style={{ background: '#fff', padding: '1rem', borderRadius: 8 }}>
          <h3>Generate units</h3>
          <select value={unitBatchId} onChange={(e) => setUnitBatchId(e.target.value)} style={{ width: '100%', marginBottom: 8 }}>
            <option value="">Select batch</option>
            {products.flatMap((p) =>
              p.variants.flatMap((v) =>
                v.batches.map((b) => (
                  <option key={b.id} value={b.id}>{p.name} / {b.batchCode}</option>
                )),
              ),
            )}
          </select>
          <input type="number" min={1} max={100000} value={unitQty} onChange={(e) => setUnitQty(Number(e.target.value))} style={{ width: '100%', marginBottom: 8 }} />
          <button
            onClick={async () => {
              const res = await api.generateUnits(tenantId, unitBatchId, unitQty, 'ABC');
              setMessage(res.mode === 'sync' ? `Generated ${res.generated} units` : `Async job ${res.jobId} started`);
              load(tenantId);
            }}
          >
            Generate
          </button>
        </div>
      </section>

      <h2>Product catalog</h2>
      {products.length === 0 ? (
        <p>No products yet.</p>
      ) : (
        products.map((p) => (
          <div key={p.id} style={{ background: '#fff', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{p.name}</strong> ({p.status}) — {p.brand.name}
                {p.sku && <span style={{ color: '#666' }}> · SKU: {p.sku}</span>}
              </div>
              {p.status === 'DRAFT' && (
                <button
                  onClick={async () => {
                    await api.updateProductStatus(tenantId, p.id, 'ACTIVE');
                    setMessage(`${p.name} activated`);
                    load(tenantId);
                  }}
                >
                  Activate
                </button>
              )}
            </div>
            <ul style={{ marginTop: 8 }}>
              {p.variants.map((v) => (
                <li key={v.id}>
                  Variant: {v.name} ({v.status})
                  <ul>
                    {v.batches.map((b) => (
                      <li key={b.id}>Batch {b.batchCode} ({b.status})</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </AdminShell>
  );
}
