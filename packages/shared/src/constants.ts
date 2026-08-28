export const VERIFICATION_PATH_PREFIX = '/v';
export const CREDENTIAL_PREFIX = 'TM';
export const SERIAL_PREFIX = 'SN';
export const CORRELATION_HEADER = 'x-correlation-id';
export const API_VERSION = 'v1';

/** Minimum token entropy in bytes (128 bits) */
export const TOKEN_ENTROPY_BYTES = 16;

/** Default impossible travel threshold: km/h */
export const DEFAULT_MAX_TRAVEL_SPEED_KMH = 900;

/** Default high-frequency scan threshold */
export const DEFAULT_HIGH_SCAN_COUNT = 50;
export const DEFAULT_HIGH_SCAN_WINDOW_MINUTES = 30;

/** Rate limit keys */
export const RATE_LIMIT_VERIFY = 'verify';
export const RATE_LIMIT_AI = 'ai';
export const RATE_LIMIT_REPORT = 'report';

/** Units generated synchronously when quantity is at or below this threshold */
export const SYNC_BULK_UNIT_THRESHOLD = 50;

/** Deterministic fixtures for E2E / DR drill validation (seed + Playwright). */
export const E2E_FIXTURES = {
  verifyHostname: 'verify.localhost',
  qrToken: 'e2eFixedQrToken0001',
  manualCode: 'TM-E2E0-FIXD-0001',
  qrUrl: 'https://verify.localhost/v/e2eFixedQrToken0001',
  unitId: '00000000-0000-0000-0000-000000000200',
} as const;
