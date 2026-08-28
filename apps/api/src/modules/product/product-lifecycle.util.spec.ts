import { BadRequestException } from '@nestjs/common';
import { LifecycleStatus } from '@truemark/db';
import { assertLifecycleTransition } from './product-lifecycle.util';

describe('product-lifecycle.util', () => {
  it('allows DRAFT → ACTIVE for catalog entities', () => {
    expect(() =>
      assertLifecycleTransition('catalog', LifecycleStatus.DRAFT, LifecycleStatus.ACTIVE),
    ).not.toThrow();
  });

  it('rejects DRAFT → REVOKED for catalog entities', () => {
    expect(() =>
      assertLifecycleTransition('catalog', LifecycleStatus.DRAFT, LifecycleStatus.REVOKED),
    ).toThrow(BadRequestException);
  });

  it('allows REGISTERED → ACTIVE for units', () => {
    expect(() =>
      assertLifecycleTransition('unit', LifecycleStatus.REGISTERED, LifecycleStatus.ACTIVE),
    ).not.toThrow();
  });

  it('allows ACTIVE → RECALLED for units', () => {
    expect(() =>
      assertLifecycleTransition('unit', LifecycleStatus.ACTIVE, LifecycleStatus.RECALLED),
    ).not.toThrow();
  });
});
