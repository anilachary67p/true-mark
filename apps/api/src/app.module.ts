import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { loadEnv } from '@truemark/config';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { DomainModule } from './modules/domain/domain.module';
import { AuditModule } from './modules/audit/audit.module';
import { ProductModule } from './modules/product/product.module';
import { CredentialModule } from './modules/credential/credential.module';
import { QrModule } from './modules/qr/qr.module';
import { QrCustomizationModule } from './modules/qr-customization/qr-customization.module';
import { VerificationModule } from './modules/verification/verification.module';
import { FraudModule } from './modules/fraud/fraud.module';
import { InvestigationModule } from './modules/investigation/investigation.module';
import { ConsumerReportModule } from './modules/consumer-report/consumer-report.module';
import { AiConfigModule } from './modules/ai-config/ai-config.module';
import { AiOrchestrationModule } from './modules/ai-orchestration/ai-orchestration.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { JobsModule } from './jobs/jobs.module';
import { ProvidersModule } from './providers/providers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [() => loadEnv()] }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 100 },
      { name: 'verify', ttl: 60000, limit: 60 },
      { name: 'ai', ttl: 60000, limit: 10 },
    ]),
    BullModule.forRoot({
      connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
    }),
    ProvidersModule,
    HealthModule,
    AuthModule,
    TenantModule,
    DomainModule,
    AuditModule,
    ProductModule,
    CredentialModule,
    QrModule,
    QrCustomizationModule,
    VerificationModule,
    FraudModule,
    InvestigationModule,
    ConsumerReportModule,
    AiConfigModule,
    AiOrchestrationModule,
    AnalyticsModule,
    JobsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
