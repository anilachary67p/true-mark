import { Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ImageViewAngle } from '@truemark/db';
import { IsEnum, IsString, MaxLength } from 'class-validator';
import { AiOrchestrationService } from './ai-orchestration.service';
import { Public } from '../auth/public.decorator';

class InitiateAiDto {
  @IsString()
  @MaxLength(64)
  verificationPublicId!: string;
}

class UploadAiImageDto {
  @IsEnum(ImageViewAngle)
  viewAngle!: ImageViewAngle;
}

@ApiTags('ai-orchestration')
@Controller({ path: 'public/verify/ai', version: '1' })
export class AiOrchestrationController {
  constructor(private readonly service: AiOrchestrationService) {}

  @Public()
  @Throttle({ ai: { limit: 10, ttl: 60000 } })
  @Post('initiate')
  initiate(@Body() dto: InitiateAiDto) {
    return this.service.initiate(dto.verificationPublicId);
  }

  @Public()
  @Throttle({ ai: { limit: 10, ttl: 60000 } })
  @Post(':jobId/images')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 5 } }),
  )
  uploadImage(
    @Param('jobId') jobId: string,
    @Body() dto: UploadAiImageDto,
    @UploadedFile() file?: { buffer: Buffer },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Image file is required');
    }
    return this.service.uploadImage(jobId, dto.viewAngle, file.buffer);
  }

  @Public()
  @Throttle({ ai: { limit: 10, ttl: 60000 } })
  @Post(':jobId/process')
  process(@Param('jobId') jobId: string) {
    return this.service.processJob(jobId);
  }

  @Public()
  @Throttle({ ai: { limit: 30, ttl: 60000 } })
  @Get(':jobId/status')
  status(@Param('jobId') jobId: string) {
    return this.service.getStatus(jobId);
  }
}
