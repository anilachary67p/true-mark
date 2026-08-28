import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BulkGenerationProcessor, AnalyticsRollupProcessor } from './bulk-generation.processor';
import { AnalyticsSchedulerService } from './analytics-scheduler.service';
import { CredentialModule } from '../modules/credential/credential.module';
import { DomainModule } from '../modules/domain/domain.module';
import { QrModule } from '../modules/qr/qr.module';
import { ProductModule } from '../modules/product/product.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'bulk-generation' }),
    BullModule.registerQueue({ name: 'analytics-rollup' }),
    CredentialModule,
    DomainModule,
    QrModule,
    ProductModule,
  ],
  providers: [BulkGenerationProcessor, AnalyticsRollupProcessor, AnalyticsSchedulerService],
})
export class JobsModule {}
