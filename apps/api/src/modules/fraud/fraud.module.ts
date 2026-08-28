import { Module } from '@nestjs/common';
import { SignalEvaluatorService } from './signal-evaluator.service';
import { FraudController } from './fraud.controller';
import { FraudService } from './fraud.service';

@Module({
  controllers: [FraudController],
  providers: [SignalEvaluatorService, FraudService],
  exports: [SignalEvaluatorService, FraudService],
})
export class FraudModule {}
