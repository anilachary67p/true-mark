import { Body, Controller, Get, Headers, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, IsNumber, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Request } from 'express';
import { CoreVerificationService } from './core-verification.service';
import { Public } from '../auth/public.decorator';
import { CorrelationId } from '../../common/decorators/current-user.decorator';

class LocationDto {
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsEnum(['GPS', 'IP', 'NETWORK', 'MANUAL', 'UNKNOWN']) source?:
    'GPS' | 'IP' | 'NETWORK' | 'MANUAL' | 'UNKNOWN';
}

class VerifyQrDto {
  /** Full verification URL or raw QR payload (token encoded in the barcode). */
  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  hostname?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;
}

class VerifyCodeDto {
  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  hostname?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;
}

@ApiTags('public-verification')
@Controller({ path: 'public/verify', version: '1' })
export class PublicVerificationController {
  constructor(private readonly verificationService: CoreVerificationService) {}

  @Public()
  @Get('branding')
  getBranding(@Headers('host') host: string, @Query('hostname') hostname?: string) {
    const resolved = (hostname ?? host)?.split(':')[0] ?? '';
    return this.verificationService.getConsumerBranding(resolved);
  }

  @Public()
  @Throttle({ verify: { limit: 60, ttl: 60000 } })
  @Post('qr')
  verifyQr(
    @Body() dto: VerifyQrDto,
    @Headers('host') host: string,
    @CorrelationId() correlationId: string,
    @Req() req: Request,
  ) {
    const hostname = (dto.hostname ?? host)?.split(':')[0] ?? '';
    return this.verificationService.verifyByQr(
      dto.url,
      hostname,
      dto.location,
      correlationId,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Public()
  @Throttle({ verify: { limit: 60, ttl: 60000 } })
  @Post('code')
  verifyCode(
    @Body() dto: VerifyCodeDto,
    @Headers('host') host: string,
    @CorrelationId() correlationId: string,
    @Req() req: Request,
  ) {
    const hostname = (dto.hostname ?? host)?.split(':')[0] ?? '';
    return this.verificationService.verifyByCode(
      dto.code,
      hostname,
      dto.location,
      correlationId,
      req.ip,
      req.headers['user-agent'],
    );
  }
}
