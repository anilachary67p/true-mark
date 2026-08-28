import { z } from 'zod';

export const hybridTenantConfigSchema = z.object({
  pattern: z.enum(['CORE_ONPREM_AI_CLOUD', 'CORE_CLOUD_DATA_ONPREM', 'FULL_ON_PREM']).optional(),
  dataBoundary: z
    .object({
      consumerImages: z.enum(['on_prem', 'cloud']).optional(),
      aiResults: z.enum(['on_prem', 'cloud']).optional(),
    })
    .optional(),
});

export type HybridTenantConfig = z.infer<typeof hybridTenantConfigSchema>;

export type DataClassification = 'ON_PREM_ONLY' | 'CLOUD_ALLOWED' | 'TRANSIENT';
