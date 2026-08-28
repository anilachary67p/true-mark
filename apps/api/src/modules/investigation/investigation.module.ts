import { Module } from '@nestjs/common';
import { InvestigationService } from './investigation.service';
import { InvestigationController } from './investigation.controller';

@Module({
  controllers: [InvestigationController],
  providers: [InvestigationService],
  exports: [InvestigationService],
})
export class InvestigationModule {}
