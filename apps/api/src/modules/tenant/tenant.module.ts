import { Module, forwardRef } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { LicenseModule } from '../license/license.module';

@Module({
  imports: [forwardRef(() => LicenseModule)],
  controllers: [TenantController],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}
