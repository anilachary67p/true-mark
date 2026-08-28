import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from '@truemark/config';
import { PrismaService } from './prisma.service';
import { EnvSecretProvider } from './secrets/env-secret.provider';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { MinioStorageProvider } from './storage/minio-storage.provider';
import { MockAiProvider } from './ai/mock-ai.provider';
import { OpenAiProvider } from './ai/openai-ai.provider';
import { UnavailableAiProvider } from './ai/unavailable-ai.provider';
import { GatewayAiProvider } from './ai/gateway-ai.provider';

export const SECRET_PROVIDER = 'SECRET_PROVIDER';
export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
export const AI_PROVIDER = 'AI_PROVIDER';

function createAiProvider(config: ConfigService<EnvConfig>) {
  const hybridMode = config.get('HYBRID_MODE', { infer: true });
  const gatewayUrl = config.get('AI_GATEWAY_URL', { infer: true });
  if (hybridMode === 'CORE_ONPREM_AI_CLOUD' && gatewayUrl) {
    return new GatewayAiProvider(gatewayUrl);
  }

  const provider = config.get('AI_PROVIDER', { infer: true }) ?? 'mock';
  const apiKey = config.get('AI_API_KEY', { infer: true });

  if (provider === 'openai' && apiKey) {
    return new OpenAiProvider(apiKey);
  }
  if (provider === 'openai' || provider === 'azure') {
    return new UnavailableAiProvider();
  }
  return new MockAiProvider();
}

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: SECRET_PROVIDER,
      useFactory: () => new EnvSecretProvider(),
    },
    {
      provide: STORAGE_PROVIDER,
      useFactory: (config: ConfigService<EnvConfig>) => {
        const provider = config.get('STORAGE_PROVIDER', { infer: true });
        if (provider === 'minio') {
          return new MinioStorageProvider(config);
        }
        return new LocalStorageProvider();
      },
      inject: [ConfigService],
    },
    {
      provide: AI_PROVIDER,
      useFactory: (config: ConfigService<EnvConfig>) => createAiProvider(config),
      inject: [ConfigService],
    },
  ],
  exports: [PrismaService, SECRET_PROVIDER, STORAGE_PROVIDER, AI_PROVIDER],
})
export class ProvidersModule {}
