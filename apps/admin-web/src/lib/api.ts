import { buildDateQuery, DateRangeValue } from './dateRange';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';

export type { DateRangeValue };

let token: string | null = null;
let refreshToken: string | null = null;

const TOKEN_KEY = 'truemark_token';
const REFRESH_TOKEN_KEY = 'truemark_refresh_token';
const REQUEST_TIMEOUT_MS = 30_000;
const UNSAFE_PATH = /(^|\/)\.\.?(\/|$|\?)|%2e|%2f|%5c|\\/i;

/** Error thrown for any failed API call; `status` is 0 for network failures and timeouts. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isApiError(error: unknown, status?: number): error is ApiError {
  return error instanceof ApiError && (status === undefined || error.status === status);
}

/** Human-readable message for any thrown value, suitable for user-facing alerts. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function storageGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode, quota); in-memory tokens still work for this tab.
  }
}

export function setToken(t: string) {
  token = t;
  storageSet(TOKEN_KEY, t);
}

export function setRefreshToken(t: string) {
  refreshToken = t;
  storageSet(REFRESH_TOKEN_KEY, t);
}

export function getRefreshToken(): string | null {
  if (refreshToken) return refreshToken;
  refreshToken = storageGet(REFRESH_TOKEN_KEY);
  return refreshToken;
}

export function clearAuth() {
  token = null;
  refreshToken = null;
  storageSet(TOKEN_KEY, null);
  storageSet(REFRESH_TOKEN_KEY, null);
}

export function getToken(): string | null {
  if (token) return token;
  token = storageGet(TOKEN_KEY);
  return token;
}

/**
 * Session is unrecoverable: drop credentials and hard-navigate to login. A full navigation
 * (not router.push) also discards every in-memory cache so the next user cannot inherit it.
 */
function handleUnauthorized() {
  clearAuth();
  if (typeof window === 'undefined') return;
  if (window.location.pathname.startsWith('/login')) return;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.replace(`/login?reason=expired&next=${next}`);
}

function withTimeout(signal: AbortSignal | null | undefined): {
  signal: AbortSignal;
  cleanup: () => void;
  timedOut: () => boolean;
} {
  const controller = new AbortController();
  let didTimeout = false;
  const timer = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    timedOut: () => didTimeout,
    cleanup: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

function messageForStatus(status: number): string {
  if (status === 403) return 'You do not have permission to perform this action.';
  if (status === 404) return 'The requested resource was not found.';
  if (status === 409) return 'This conflicts with the current state. Refresh and try again.';
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status >= 500) return 'The server encountered an error. Please try again shortly.';
  return `Request failed (HTTP ${status})`;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  allowRefresh = true,
): Promise<T> {
  if (UNSAFE_PATH.test(path.split('?')[0]!)) {
    throw new ApiError('Invalid request path', 400);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;

  const timeout = withTimeout(options.signal);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, { ...options, headers, signal: timeout.signal });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(
      timeout.timedOut()
        ? 'The server took too long to respond. Please try again.'
        : 'Unable to reach the server. Check your connection and try again.',
      0,
    );
  } finally {
    timeout.cleanup();
  }

  const isAuthEndpoint = path === '/admin/auth/login' || path === '/admin/auth/refresh';
  if (res.status === 401 && !isAuthEndpoint) {
    if (allowRefresh && (await refreshAccessToken())) {
      return request<T>(path, options, false);
    }
    handleUnauthorized();
    throw new ApiError('Your session has expired. Please sign in again.', 401, 'SESSION_EXPIRED');
  }

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
      code?: string;
      correlationId?: string;
    };
    const message = Array.isArray(err.message) ? err.message.join(', ') : err.message;
    throw new ApiError(
      message || messageForStatus(res.status),
      res.status,
      err.code,
      err.correlationId ?? res.headers.get('x-correlation-id') ?? undefined,
    );
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) {
    if ((options.method ?? 'GET').toUpperCase() !== 'GET') return undefined as T;
    throw new ApiError(`API ${path} returned an empty body (HTTP ${res.status})`, res.status);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError('Received an unexpected response from the server.', res.status);
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const rt = getRefreshToken();
    if (!rt) return false;
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { accessToken: string; refreshToken?: string };
      setToken(data.accessToken);
      if (data.refreshToken) setRefreshToken(data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export type Tenant = {
  id: string;
  name: string;
  legalName?: string | null;
  status: string;
  deploymentType: string;
  configVersion: number;
  profile?: {
    companyDisplayName?: string | null;
    contactEmail?: string | null;
    country?: string | null;
    address?: string | null;
  };
  companyDomains?: CompanyDomain[];
  verificationDomains?: VerificationDomain[];
};

export type CompanyDomain = {
  id: string;
  url: string;
  status: string;
  version: number;
};

export type VerificationDomain = {
  id: string;
  hostname: string;
  verificationPath: string;
  status: string;
  version: number;
  isPrimary: boolean;
  dnsInstructions?: {
    type: string;
    host: string;
    value: string;
    expiresAt?: string;
    verifiedAt?: string | null;
  } | null;
  verificationUrlExample?: string;
};

export const api = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; refreshToken: string; user: unknown }>('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  refresh: (refreshTokenValue: string) =>
    request<{ accessToken: string; refreshToken: string }>('/admin/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: refreshTokenValue }),
    }),

  logout: (refreshTokenValue: string) =>
    request<{ success: boolean }>('/admin/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: refreshTokenValue }),
    }),

  me: () =>
    request<{ user: { email: string; roles: string[]; tenantIds: string[] } }>('/admin/auth/me'),

  getTenants: () => request<Tenant[]>('/admin/tenants'),

  getTenant: (tenantId: string) => request<Tenant>(`/admin/tenants/${tenantId}`),

  createTenant: (data: {
    name: string;
    legalName?: string;
    deploymentType?: string;
    commercialModel?: string;
    licenseValidDays?: number;
  }) => request<Tenant>('/admin/tenants', { method: 'POST', body: JSON.stringify(data) }),

  updateTenant: (
    tenantId: string,
    data: Partial<{ name: string; legalName: string; status: string }>,
  ) =>
    request<Tenant>(`/admin/tenants/${tenantId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  updateTenantProfile: (
    tenantId: string,
    data: {
      companyDisplayName?: string;
      address?: string;
      country?: string;
      contactEmail?: string;
    },
  ) =>
    request(`/admin/tenants/${tenantId}/profile`, { method: 'PATCH', body: JSON.stringify(data) }),

  getDomainConfiguration: (tenantId: string) =>
    request<{
      tenant: Tenant;
      companyDomains: CompanyDomain[];
      verificationDomains: VerificationDomain[];
    }>(`/admin/tenants/${tenantId}/domains`),

  createCompanyDomain: (tenantId: string, url: string) =>
    request<CompanyDomain>(`/admin/tenants/${tenantId}/domains/company`, {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),

  activateCompanyDomain: (tenantId: string, domainId: string) =>
    request(`/admin/tenants/${tenantId}/domains/company/${domainId}/activate`, { method: 'POST' }),

  updateCompanyDomainStatus: (tenantId: string, domainId: string, status: string) =>
    request(`/admin/tenants/${tenantId}/domains/company/${domainId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  createVerificationDomain: (
    tenantId: string,
    data: { hostname: string; verificationPath?: string; setPrimary?: boolean },
  ) =>
    request<VerificationDomain>(`/admin/tenants/${tenantId}/domains/verification`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  verifyVerificationDomain: (tenantId: string, domainId: string) =>
    request(`/admin/tenants/${tenantId}/domains/verification/${domainId}/verify`, {
      method: 'POST',
    }),

  refreshVerificationChallenge: (tenantId: string, domainId: string) =>
    request(`/admin/tenants/${tenantId}/domains/verification/${domainId}/challenge/refresh`, {
      method: 'POST',
    }),

  updateVerificationDomainStatus: (tenantId: string, domainId: string, status: string) =>
    request(`/admin/tenants/${tenantId}/domains/verification/${domainId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  setPrimaryVerificationDomain: (tenantId: string, domainId: string) =>
    request(`/admin/tenants/${tenantId}/domains/verification/${domainId}/primary`, {
      method: 'POST',
    }),

  getDashboard: (tenantId: string, range?: DateRangeValue) =>
    request<Record<string, unknown>>(
      `/admin/tenants/${tenantId}/analytics/dashboard${buildDateQuery(range)}`,
    ),

  getCategories: (tenantId: string) =>
    request<
      Array<{
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
      }>
    >(`/admin/tenants/${tenantId}/categories`),

  createCategory: (tenantId: string, name: string) =>
    request(`/admin/tenants/${tenantId}/categories`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  createProductType: (tenantId: string, categoryId: string, name: string) =>
    request(`/admin/tenants/${tenantId}/product-types`, {
      method: 'POST',
      body: JSON.stringify({ categoryId, name }),
    }),

  createVariant: (tenantId: string, productTypeId: string, name: string, tags?: string[]) =>
    request(`/admin/tenants/${tenantId}/variants`, {
      method: 'POST',
      body: JSON.stringify({ productTypeId, name, tags }),
    }),

  listVariants: (tenantId: string, params?: { tag?: string; productTypeId?: string }) => {
    const q = new URLSearchParams();
    if (params?.tag) q.set('tag', params.tag);
    if (params?.productTypeId) q.set('productTypeId', params.productTypeId);
    const qs = q.toString();
    return request<
      Array<{
        id: string;
        name: string;
        productCode: string;
        status: string;
        productType: { id: string; name: string; category: { id: string; name: string } };
        tags: Array<{ tag: { name: string } }>;
        batches: Array<{ id: string; batchCode: string; status: string }>;
      }>
    >(`/admin/tenants/${tenantId}/variants${qs ? `?${qs}` : ''}`);
  },

  getCatalogStats: (tenantId: string) =>
    request<{
      tenantId: string;
      tenantName: string;
      totals: { categories: number; productTypes: number; variants: number; tags: number };
      categories: Array<{
        id: string;
        name: string;
        productTypeCount: number;
        variantCount: number;
        productTypes: Array<{
          id: string;
          name: string;
          variantCount: number;
          variants: Array<{ id: string; name: string; productCode: string; status: string }>;
        }>;
      }>;
    }>(`/admin/tenants/${tenantId}/catalog-stats`),

  getPlatformOverview: () =>
    request<{
      totals: {
        tenants: number;
        categories: number;
        productTypes: number;
        variants: number;
        tags: number;
        licenses: number;
      };
      tenants: Array<{
        id: string;
        name: string;
        status: string;
        deploymentType: string;
        catalog: { categories: number; productTypes: number; variants: number; tags: number };
        license: { validUntil: string; commercialModel: string } | null;
      }>;
    }>('/admin/platform/overview'),

  getPlatformDashboard: (range?: DateRangeValue) =>
    request<{
      dateRange: { from: string; to: string };
      previousDateRange: { from: string; to: string };
      totals: Record<
        string,
        { current: number; previous: number; delta: number; deltaPercent: number }
      >;
      dailyVolume: Array<{ date: string; count: number }>;
      previousDailyVolume: Array<{ date: string; count: number }>;
      resultDistribution: Array<{ result: string; count: number; previous: number }>;
      tenantsByDeployment: Array<{ deploymentType: string; count: number }>;
      tenantBreakdown: Array<{
        tenantId: string;
        tenantName: string;
        status: string;
        deploymentType: string;
        verifications: number;
        verified: number;
        suspicious: number;
        verificationRate: number;
        catalog: { categories: number; productTypes: number; variants: number; tags: number };
      }>;
    }>(`/admin/platform/analytics/dashboard${buildDateQuery(range)}`),

  getPlatformTenantDashboard: (tenantId: string, range?: DateRangeValue) =>
    request<{
      tenant: { id: string; name: string; status: string; deploymentType: string };
      totals: Record<
        string,
        { current: number; previous: number; delta: number; deltaPercent: number }
      >;
      dailyVolume: Array<{ date: string; count: number }>;
      previousDailyVolume: Array<{ date: string; count: number }>;
      catalog: { categories: number; productTypes: number; variants: number; tags: number };
    }>(`/admin/platform/analytics/tenants/${tenantId}/dashboard${buildDateQuery(range)}`),

  updateVariantStatus: (tenantId: string, variantId: string, status: string) =>
    request(`/admin/tenants/${tenantId}/variants/${variantId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  createBatch: (
    tenantId: string,
    data: {
      productVariantId: string;
      batchCode: string;
      manufacturingDate?: string;
      expiryDate?: string;
    },
  ) =>
    request(`/admin/tenants/${tenantId}/batches`, { method: 'POST', body: JSON.stringify(data) }),

  generateUnits: (tenantId: string, batchId: string, quantity: number, serialPrefix?: string) =>
    request<{ mode: string; generated?: number; jobId?: string; status?: string }>(
      `/admin/tenants/${tenantId}/batches/${batchId}/generate-units`,
      { method: 'POST', body: JSON.stringify({ quantity, serialPrefix }) },
    ),

  listQrCodes: (tenantId: string, limit = 100, offset = 0) =>
    request<{
      items: Array<{
        id: string;
        token: string;
        url: string;
        status: string;
        productUnit?: { serial?: { serialNumber: string }; batch?: { batchCode: string } };
      }>;
      total: number;
    }>(`/admin/tenants/${tenantId}/qr?limit=${limit}&offset=${offset}`),

  generateBatchQr: (tenantId: string, batchId: string) =>
    request<{ batchId: string; created: number }>(
      `/admin/tenants/${tenantId}/qr/batches/${batchId}/generate`,
      { method: 'POST' },
    ),

  exportBatchQr: (tenantId: string, batchId: string, format: 'PNG' | 'SVG' | 'ZIP' = 'PNG') =>
    request<{
      batchId: string;
      count: number;
      format: string;
      data?: string;
      items?: Array<{ qrCodeId: string; serial?: string; url: string; data: string }>;
    }>(`/admin/tenants/${tenantId}/qr/batches/${batchId}/export?format=${format}`, {
      method: 'POST',
    }),

  getAuditLogs: (
    tenantId: string,
    params?: { limit?: number; offset?: number; action?: string; resourceType?: string },
  ) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.action) q.set('action', params.action);
    if (params?.resourceType) q.set('resourceType', params.resourceType);
    const qs = q.toString();
    return request<{
      items: Array<{
        id: string;
        action: string;
        resourceType: string;
        resourceId?: string;
        createdAt: string;
        user?: { email: string; name?: string };
      }>;
      total: number;
    }>(`/admin/tenants/${tenantId}/audit${qs ? `?${qs}` : ''}`);
  },

  previewQr: (tenantId: string) =>
    request<{ url: string; png: string; config: Record<string, unknown> }>(
      `/admin/tenants/${tenantId}/qr/preview`,
    ),

  exportQr: (tenantId: string, qrCodeId: string, format: 'PNG' | 'SVG' = 'PNG') =>
    request<{ format: string; data: string; url: string }>(
      `/admin/tenants/${tenantId}/qr/${qrCodeId}/export?format=${format}`,
      { method: 'POST' },
    ),

  updateQrStatus: (tenantId: string, qrCodeId: string, status: string, reason?: string) =>
    request(`/admin/tenants/${tenantId}/qr/${qrCodeId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    }),

  getVerificationHistory: (
    tenantId: string,
    options: { limit?: number; range?: DateRangeValue } = {},
  ) => {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.range?.from) params.set('from', options.range.from);
    if (options.range?.to) params.set('to', options.range.to);
    const qs = params.toString();
    return request<{
      items: Array<{
        publicId: string;
        result: string;
        method: string;
        riskLevel?: string;
        createdAt: string;
        serial?: string;
        productSnapshot?: Record<string, unknown>;
      }>;
      total: number;
    }>(`/admin/tenants/${tenantId}/verification-history${qs ? `?${qs}` : ''}`);
  },

  getAiConfig: (tenantId: string) =>
    request<{
      mode: string;
      quota: number;
      usage?: number;
      config?: Record<string, unknown>;
      referenceData?: unknown[];
    }>(`/admin/tenants/${tenantId}/ai-config`),

  updateAiConfig: (tenantId: string, data: { mode?: string; quota?: number; config?: object }) =>
    request(`/admin/tenants/${tenantId}/ai-config`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  listReferenceData: (tenantId: string) =>
    request<Array<{ id: string; scope: string; objectKey: string; scopeId?: string }>>(
      `/admin/tenants/${tenantId}/reference-data`,
    ),

  createReferenceData: (
    tenantId: string,
    data: { objectKey: string; scope?: string; scopeId?: string },
  ) =>
    request(`/admin/tenants/${tenantId}/reference-data`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteReferenceData: (tenantId: string, id: string) =>
    request(`/admin/tenants/${tenantId}/reference-data/${id}`, { method: 'DELETE' }),

  getFraudSignals: (tenantId: string) =>
    request<Array<{ id: string; signalType: string; severity: string; createdAt: string }>>(
      `/admin/tenants/${tenantId}/fraud/signals`,
    ),

  getFraudSummary: (tenantId: string) =>
    request<{ riskScore: number; riskLevel: string; totalSignals: number }>(
      `/admin/tenants/${tenantId}/fraud/summary`,
    ),

  getFraudHotspots: (tenantId: string) => request(`/admin/tenants/${tenantId}/fraud/hotspots`),

  getFraudConfig: (tenantId: string) =>
    request<{
      highScanCount: number;
      highScanWindowMinutes: number;
      maxTravelSpeedKmh: number;
      impossibleTravelMinutes: number;
    }>(`/admin/tenants/${tenantId}/fraud/config`),

  updateFraudConfig: (
    tenantId: string,
    data: {
      highScanCount?: number;
      highScanWindowMinutes?: number;
      maxTravelSpeedKmh?: number;
      impossibleTravelMinutes?: number;
    },
  ) =>
    request(`/admin/tenants/${tenantId}/fraud/config`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getFraudAlerts: (tenantId: string) =>
    request<
      Array<{
        id: string;
        signalType: string;
        severity: string;
        createdAt: string;
        verificationEvent?: { publicId: string; result: string; correlationId?: string };
      }>
    >(`/admin/tenants/${tenantId}/fraud/alerts`),

  getAnalyticsDaily: (tenantId: string, range?: DateRangeValue) =>
    request<Array<{ date: string; metrics: Record<string, unknown> }>>(
      `/admin/tenants/${tenantId}/analytics/daily${buildDateQuery(range)}`,
    ),

  triggerAnalyticsRollup: (tenantId: string) =>
    request(`/admin/tenants/${tenantId}/analytics/rollup`, { method: 'POST' }),

  getInvestigations: (tenantId: string) =>
    request<Array<{ id: string; title: string; status: string; description?: string }>>(
      `/admin/tenants/${tenantId}/investigations`,
    ),

  createInvestigation: (tenantId: string, data: { title: string; description?: string }) =>
    request(`/admin/tenants/${tenantId}/investigations`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateInvestigationStatus: (tenantId: string, id: string, status: string, note?: string) =>
    request(`/admin/tenants/${tenantId}/investigations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note }),
    }),

  getQrCustomization: (tenantId: string) =>
    request<{ config: Record<string, unknown>; version: number } | null>(
      `/admin/tenants/${tenantId}/qr-customization`,
    ),

  saveQrCustomization: (tenantId: string, config: Record<string, unknown>) =>
    request(`/admin/tenants/${tenantId}/qr-customization`, {
      method: 'POST',
      body: JSON.stringify({ config }),
    }),

  getLicenseStatus: (tenantId: string) =>
    request<{
      tenantId: string;
      licenseId?: string;
      organizationName?: string;
      deploymentModel?: string;
      commercialModel?: string;
      status: string;
      validFrom?: string;
      validUntil?: string;
      daysUntilExpiry?: number;
      graceDaysRemaining?: number;
      productOwnerEmail?: string;
      productOwnerPhone?: string;
      message?: string;
    }>(`/admin/tenants/${tenantId}/license/status`),

  listPlatformLicenses: () =>
    request<
      Array<{
        tenantId: string;
        licenseId: string;
        organizationName: string;
        deploymentModel: string;
        commercialModel: string;
        validUntil: string;
        productOwnerEmail: string;
      }>
    >('/admin/platform/licenses'),

  renewPlatformLicense: (tenantId: string, validUntil: string) =>
    request(`/admin/platform/licenses/${tenantId}/renew`, {
      method: 'POST',
      body: JSON.stringify({ validUntil }),
    }),

  installPlatformLicense: (licenseFile: string) =>
    request('/admin/platform/licenses/install', {
      method: 'POST',
      body: JSON.stringify({ licenseFile }),
    }),
};
