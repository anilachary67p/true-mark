import { Module } from '@nestjs/common';
import { CoreVerificationService } from './core-verification.service';
import { PublicVerificationController } from './public-verification.controller';
import { VerificationHistoryController } from './verification-history.controller';
import { VerificationHistoryService } from './verification-history.service';
import { DomainModule } from '../domain/domain.module';
import { CredentialModule } from '../credential/credential.module';
import { SignalEvaluatorService } from '../fraud/signal-evaluator.service';

@Module({
  imports: [DomainModule, CredentialModule],
  controllers: [PublicVerificationController, VerificationHistoryController],
  providers: [CoreVerificationService, SignalEvaluatorService, VerificationHistoryService],
  exports: [CoreVerificationService, VerificationHistoryService],
})
export class VerificationModule {}
