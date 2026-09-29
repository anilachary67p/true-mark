import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LifecycleStatus } from '@truemark/db';
import { PrismaService } from '../../providers/prisma.service';
import { CredentialService } from '../credential/credential.service';

export interface GeneratedUnitRecord {
  productUnitId: string;
  serialNumber: string;
  tokenPrefix: string;
}

/** argon2id is memory-hard (~64 MB each); bound parallelism to protect the process. */
const HASH_CONCURRENCY = 4;
const TRANSACTION_TIMEOUT_MS = 60_000;

@Injectable()
export class UnitGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialService: CredentialService,
  ) {}

  /**
   * Creates product units with serials and verification credentials (no QR — Phase 4).
   * Returns generated unit metadata; plaintext tokens are never persisted.
   *
   * Expensive hashing runs before the transaction opens so the transaction only performs
   * fast bulk inserts and cannot exceed Prisma's interactive-transaction timeout.
   */
  async generateUnits(
    tenantId: string,
    batchId: string,
    quantity: number,
    serialPrefix: string,
    startIndex = 0,
  ): Promise<GeneratedUnitRecord[]> {
    const prepared = await this.prepareUnits(quantity, serialPrefix, startIndex);

    await this.prisma.client.$transaction(
      async (tx) => {
        await tx.productUnit.createMany({
          data: prepared.map((u) => ({
            id: u.productUnitId,
            tenantId,
            batchId,
            status: LifecycleStatus.REGISTERED,
          })),
        });
        await tx.serial.createMany({
          data: prepared.map((u) => ({
            tenantId,
            productUnitId: u.productUnitId,
            serialNumber: u.serialNumber,
          })),
        });
        await tx.verificationCredential.createMany({
          data: prepared.map((u) => ({
            tenantId,
            productUnitId: u.productUnitId,
            tokenHash: u.tokenHash,
            tokenPrefix: u.tokenPrefix,
            status: LifecycleStatus.ACTIVE,
          })),
        });
      },
      { maxWait: 10_000, timeout: TRANSACTION_TIMEOUT_MS },
    );

    return prepared.map(({ productUnitId, serialNumber, tokenPrefix }) => ({
      productUnitId,
      serialNumber,
      tokenPrefix,
    }));
  }

  private async prepareUnits(quantity: number, serialPrefix: string, startIndex: number) {
    const prepared: Array<GeneratedUnitRecord & { tokenHash: string }> = new Array(quantity);
    let next = 0;

    const worker = async () => {
      while (next < quantity) {
        const i = next++;
        const { plaintext, prefix } = this.credentialService.generateToken();
        prepared[i] = {
          productUnitId: randomUUID(),
          serialNumber: this.credentialService.generateSerialNumber(serialPrefix, startIndex + i + 1),
          tokenPrefix: prefix,
          tokenHash: await this.credentialService.hashToken(plaintext),
        };
      }
    };

    await Promise.all(Array.from({ length: Math.min(HASH_CONCURRENCY, quantity) }, worker));
    return prepared;
  }
}
