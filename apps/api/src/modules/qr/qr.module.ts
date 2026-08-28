import { Module } from '@nestjs/common';
import { QrService, QrRenderService } from './qr.service';
import { QrController } from './qr.controller';
import { DomainModule } from '../domain/domain.module';
import { CredentialModule } from '../credential/credential.module';

@Module({
  imports: [DomainModule, CredentialModule],
  controllers: [QrController],
  providers: [QrService, QrRenderService],
  exports: [QrService, QrRenderService],
})
export class QrModule {}
