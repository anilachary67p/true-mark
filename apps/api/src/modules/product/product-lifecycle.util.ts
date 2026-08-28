import { BadRequestException } from '@nestjs/common';
import { LifecycleStatus } from '@truemark/db';

/** Allowed lifecycle transitions for catalog entities (product, variant, manufacturer, brand). */
const CATALOG_TRANSITIONS: Partial<Record<LifecycleStatus, LifecycleStatus[]>> = {
  [LifecycleStatus.DRAFT]: [LifecycleStatus.ACTIVE, LifecycleStatus.RETIRED],
  [LifecycleStatus.ACTIVE]: [
    LifecycleStatus.INACTIVE,
    LifecycleStatus.SUSPENDED,
    LifecycleStatus.BLOCKED,
    LifecycleStatus.RECALLED,
    LifecycleStatus.DISCONTINUED,
    LifecycleStatus.RETIRED,
  ],
  [LifecycleStatus.INACTIVE]: [LifecycleStatus.ACTIVE, LifecycleStatus.RETIRED],
  [LifecycleStatus.SUSPENDED]: [LifecycleStatus.ACTIVE, LifecycleStatus.BLOCKED, LifecycleStatus.RETIRED],
  [LifecycleStatus.BLOCKED]: [LifecycleStatus.ACTIVE, LifecycleStatus.REVOKED, LifecycleStatus.RETIRED],
  [LifecycleStatus.RECALLED]: [LifecycleStatus.RETIRED],
  [LifecycleStatus.DISCONTINUED]: [LifecycleStatus.RETIRED],
  [LifecycleStatus.REVOKED]: [LifecycleStatus.RETIRED],
  [LifecycleStatus.RETIRED]: [],
};

/** Batch and product-unit lifecycle transitions. */
const UNIT_TRANSITIONS: Partial<Record<LifecycleStatus, LifecycleStatus[]>> = {
  [LifecycleStatus.DRAFT]: [LifecycleStatus.REGISTERED, LifecycleStatus.ACTIVE],
  [LifecycleStatus.REGISTERED]: [LifecycleStatus.ACTIVE, LifecycleStatus.SUSPENDED, LifecycleStatus.BLOCKED],
  [LifecycleStatus.ACTIVE]: [
    LifecycleStatus.SUSPENDED,
    LifecycleStatus.BLOCKED,
    LifecycleStatus.REVOKED,
    LifecycleStatus.RECALLED,
    LifecycleStatus.RETIRED,
  ],
  [LifecycleStatus.SUSPENDED]: [LifecycleStatus.ACTIVE, LifecycleStatus.BLOCKED, LifecycleStatus.REVOKED],
  [LifecycleStatus.BLOCKED]: [LifecycleStatus.ACTIVE, LifecycleStatus.REVOKED, LifecycleStatus.RETIRED],
  [LifecycleStatus.REVOKED]: [LifecycleStatus.RETIRED],
  [LifecycleStatus.RECALLED]: [LifecycleStatus.RETIRED],
  [LifecycleStatus.RETIRED]: [],
};

export type LifecycleEntityKind = 'catalog' | 'unit';

export function assertLifecycleTransition(
  kind: LifecycleEntityKind,
  from: LifecycleStatus,
  to: LifecycleStatus,
): void {
  if (from === to) return;
  const map = kind === 'catalog' ? CATALOG_TRANSITIONS : UNIT_TRANSITIONS;
  const allowed = map[from] ?? [];
  if (!allowed.includes(to)) {
    throw new BadRequestException(`Invalid lifecycle transition: ${from} → ${to}`);
  }
}

export function isActiveForVerification(status: LifecycleStatus): boolean {
  return status === LifecycleStatus.ACTIVE || status === LifecycleStatus.REGISTERED;
}
