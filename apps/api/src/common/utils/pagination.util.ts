import { BadRequestException } from '@nestjs/common';

export interface Pagination {
  take: number;
  skip: number;
}

/**
 * Parses untrusted `limit` / `offset` query values. Rejects non-integers and negatives
 * (instead of letting `NaN` reach Prisma) and clamps `limit` to `maxLimit`.
 */
export function parsePagination(
  limit: string | number | undefined,
  offset: string | number | undefined,
  { defaultLimit = 50, maxLimit = 200 }: { defaultLimit?: number; maxLimit?: number } = {},
): Pagination {
  const take = parseNonNegativeInt(limit, 'limit') ?? defaultLimit;
  const skip = parseNonNegativeInt(offset, 'offset') ?? 0;
  if (take < 1) throw new BadRequestException('limit must be at least 1');
  return { take: Math.min(take, maxLimit), skip };
}

function parseNonNegativeInt(value: string | number | undefined, name: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new BadRequestException(`${name} must be a non-negative integer`);
  }
  return parsed;
}
