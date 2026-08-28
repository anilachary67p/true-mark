import { Module } from '@nestjs/common';
import { HybridBoundaryService } from './hybrid-boundary.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [HybridBoundaryService],
  exports: [HybridBoundaryService],
})
export class HybridModule {}
