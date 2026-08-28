import { Injectable } from '@nestjs/common';
import { LifecycleStatus } from '@truemark/db';
import { PrismaService } from '../../providers/prisma.service';
import { CredentialService } from '../credential/credential.service';

export interface GeneratedUnitRecord {
  productUnitId: string;
  serialNumber: string;
  tokenPrefix: string;
}

@Injectable()
export class UnitGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialService: CredentialService,
  ) {}

  /**
   * Creates product units with serials and verification credentials (no QR — Phase 4).
   * Returns generated unit metadata; plaintext tokens are never persisted.
   */
  async generateUnits(
    tenantId: string,
    batchId: string,
    quantity: number,
    serialPrefix: string,
    startIndex = 0,
  ): Promise<GeneratedUnitRecord[]> {
    const records: GeneratedUnitRecord[] = [];

    await this.prisma.client.$transaction(async (tx) => {
      for (let i = 0; i < quantity; i++) {
        const index = startIndex + i + 1;
        const { plaintext, prefix } = this.credentialService.generateToken();
        const tokenHash = await this.credentialService.hashToken(plaintext);
        const serialNumber = this.credentialService.generateSerialNumber(serialPrefix, index);

        const productUnit = await tx.productUnit.create({
          data: { tenantId, batchId, status: LifecycleStatus.REGISTERED },
        });

        await tx.serial.create({
          data: { tenantId, productUnitId: productUnit.id, serialNumber },
        });

        await tx.verificationCredential.create({
          data: {
            tenantId,
            productUnitId: productUnit.id,
            tokenHash,
            tokenPrefix: prefix,
            status: LifecycleStatus.ACTIVE,
          },
        });

        records.push({
          productUnitId: productUnit.id,
          serialNumber,
          tokenPrefix: prefix,
        });
      }
    });

    return records;
  }
}
