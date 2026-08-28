import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ProductService } from './product.service';
import { PlatformCatalogController, ProductController } from './product.controller';
import { UnitGenerationService } from './unit-generation.service';
import { CredentialModule } from '../credential/credential.module';
import { QrModule } from '../qr/qr.module';

@Module({
  imports: [BullModule.registerQueue({ name: 'bulk-generation' }), CredentialModule, QrModule],
  controllers: [ProductController, PlatformCatalogController],
  providers: [ProductService, UnitGenerationService],
  exports: [ProductService, UnitGenerationService],
})
export class ProductModule {}
