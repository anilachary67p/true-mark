import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HybridModule } from '../hybrid/hybrid.module';

@Module({ imports: [HybridModule], controllers: [HealthController] })
export class HealthModule {}
