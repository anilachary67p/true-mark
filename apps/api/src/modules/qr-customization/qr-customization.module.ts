import { Module } from '@nestjs/common';
import { QrCustomizationService } from './qr-customization.service';
import { QrCustomizationController } from './qr-customization.controller';

@Module({
  controllers: [QrCustomizationController],
  providers: [QrCustomizationService],
  exports: [QrCustomizationService],
})
export class QrCustomizationModule {}
