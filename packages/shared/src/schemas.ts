import { z } from 'zod';

export const locationSchema = z.object({
  country: z.string().max(2).optional(),
  region: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  source: z.enum(['GPS', 'IP', 'NETWORK', 'MANUAL', 'UNKNOWN']).default('UNKNOWN'),
});

export const createTenantSchema = z.object({
  name: z.string().min(1).max(255),
  legalName: z.string().max(255).optional(),
  deploymentType: z.enum(['SAAS', 'DEDICATED_CLOUD', 'ON_PREM', 'HYBRID']).default('SAAS'),
});

export const createCompanyDomainSchema = z.object({
  url: z.string().url().refine((u) => u.startsWith('https://'), {
    message: 'Company domain must use HTTPS',
  }),
});

export const createVerificationDomainSchema = z.object({
  hostname: z
    .string()
    .min(3)
    .max(253)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i),
  verificationPath: z.string().default('/v'),
});

export const verifyQrSchema = z.object({
  url: z.string().url(),
  location: locationSchema.optional(),
});

export const verifyCodeSchema = z.object({
  code: z.string().min(8).max(64),
  location: locationSchema.optional(),
});

export const consumerReportSchema = z.object({
  verificationPublicId: z.string().optional(),
  reason: z.string().min(1).max(500),
  comment: z.string().max(2000).optional(),
});

export const bulkGenerateUnitsSchema = z.object({
  quantity: z.number().int().min(1).max(100000),
  serialPrefix: z.string().max(20).optional(),
});

export const qrCustomizationSchema = z.object({
  width: z.number().int().min(100).max(2000).default(300),
  height: z.number().int().min(100).max(2000).default(300),
  errorCorrectionLevel: z.enum(['L', 'M', 'Q', 'H']).default('M'),
  foregroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#000000'),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#FFFFFF'),
  quietZone: z.number().int().min(0).max(50).default(4),
  outputFormat: z.enum(['PNG', 'SVG', 'PDF']).default('PNG'),
  textAbove: z.string().max(200).optional(),
  textBelow: z.string().max(200).optional(),
  showSerial: z.boolean().default(true),
  showProductCode: z.boolean().default(true),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type VerifyQrInput = z.infer<typeof verifyQrSchema>;
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
export type LocationInput = z.infer<typeof locationSchema>;
