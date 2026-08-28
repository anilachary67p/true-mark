import { APP_GUARD } from '@nestjs/core';
import { Module, forwardRef } from '@nestjs/common';
import { LicenseController } from './license.controller';
import { LicenseService } from './license.service';
import { LicenseGuard } from './license.guard';
import { LicenseSchedulerService } from './license-scheduler.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [forwardRef(() => TenantModule)],
  controllers: [LicenseController],
  providers: [
    LicenseService,
    LicenseSchedulerService,
    { provide: APP_GUARD, useClass: LicenseGuard },
  ],
  exports: [LicenseService],
})
export class LicenseModule {}
