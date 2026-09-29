import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Request } from 'express';
import { ConsumerReportService } from './consumer-report.service';
import { Public } from '../auth/public.decorator';
import { resolveConsumerHostname } from '../verification/consumer-hostname.util';

class ReportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  verificationPublicId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(253)
  hostname?: string;
}

@ApiTags('consumer-reports')
@Controller({ path: 'public/reports', version: '1' })
export class ConsumerReportController {
  constructor(private readonly service: ConsumerReportService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post()
  report(@Body() dto: ReportDto, @Req() req: Request) {
    const { hostname, ...report } = dto;
    return this.service.create(resolveConsumerHostname(req, hostname), report, req.ip);
  }
}
