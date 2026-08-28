import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString } from 'class-validator';
import { Request } from 'express';
import { ConsumerReportService } from './consumer-report.service';
import { Public } from '../auth/public.decorator';

class ReportDto {
  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  verificationPublicId?: string;
}

@ApiTags('consumer-reports')
@Controller({ path: 'public/reports', version: '1' })
export class ConsumerReportController {
  constructor(private readonly service: ConsumerReportService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post()
  report(@Body() dto: ReportDto, @Headers('host') host: string, @Req() req: Request) {
    const hostname = host?.split(':')[0] ?? '';
    return this.service.create(hostname, dto, req.ip);
  }
}
