import { Module } from '@nestjs/common';
import { AiConfigService } from './ai-config.service';
import { AiConfigController, ReferenceDataController } from './ai-config.controller';

@Module({
  controllers: [AiConfigController, ReferenceDataController],
  providers: [AiConfigService],
  exports: [AiConfigService],
})
export class AiConfigModule {}
