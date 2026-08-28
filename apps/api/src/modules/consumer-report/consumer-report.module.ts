import { Module } from '@nestjs/common';
import { ConsumerReportService } from './consumer-report.service';
import { ConsumerReportController } from './consumer-report.controller';
import { DomainModule } from '../domain/domain.module';

@Module({
  imports: [DomainModule],
  controllers: [ConsumerReportController],
  providers: [ConsumerReportService],
})
export class ConsumerReportModule {}
