import { Module } from '@nestjs/common';
import { AiOrchestrationService } from './ai-orchestration.service';
import { AiOrchestrationController } from './ai-orchestration.controller';
import { VisualAiService } from './visual-ai.service';
import { AiConfigModule } from '../ai-config/ai-config.module';
import { HybridModule } from '../hybrid/hybrid.module';

@Module({
  imports: [AiConfigModule, HybridModule],
  controllers: [AiOrchestrationController],
  providers: [AiOrchestrationService, VisualAiService],
  exports: [AiOrchestrationService, VisualAiService],
})
export class AiOrchestrationModule {}
