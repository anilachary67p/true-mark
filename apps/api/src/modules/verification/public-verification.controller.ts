import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Request } from 'express';
import { CoreVerificationService } from './core-verification.service';
import { Public } from '../auth/public.decorator';
import { CorrelationId } from '../../common/decorators/current-user.decorator';
import { resolveConsumerHostname } from './consumer-hostname.util';

class LocationDto {
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsString() @MaxLength(120) region?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @IsEnum(['GPS', 'IP', 'NETWORK', 'MANUAL', 'UNKNOWN']) source?:
    | 'GPS'
    | 'IP'
    | 'NETWORK'
    | 'MANUAL'
    | 'UNKNOWN';
}

class VerifyQrDto {
  /** Full verification URL or raw QR payload (token encoded in the barcode). */
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(253)
  hostname?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;
}

class VerifyCodeDto {
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(253)
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
  getBranding(@Req() req: Request, @Query('hostname') hostname?: string) {
    return this.verificationService.getConsumerBranding(resolveConsumerHostname(req, hostname));
  }

  @Public()
  @Throttle({ verify: { limit: 60, ttl: 60000 } })
  @Post('qr')
  verifyQr(@Body() dto: VerifyQrDto, @CorrelationId() correlationId: string, @Req() req: Request) {
    return this.verificationService.verifyByQr(
      dto.url.trim(),
      resolveConsumerHostname(req, dto.hostname),
      dto.location,
      correlationId,
      req.ip,
      req.headers['user-agent']?.slice(0, 512),
    );
  }

  @Public()
  @Throttle({ verify: { limit: 20, ttl: 60000 } })
  @Post('code')
  verifyCode(
    @Body() dto: VerifyCodeDto,
    @CorrelationId() correlationId: string,
    @Req() req: Request,
  ) {
    return this.verificationService.verifyByCode(
      dto.code.trim(),
      resolveConsumerHostname(req, dto.hostname),
      dto.location,
      correlationId,
      req.ip,
      req.headers['user-agent']?.slice(0, 512),
    );
  }
}
