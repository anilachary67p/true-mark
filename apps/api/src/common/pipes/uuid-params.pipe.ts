import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates every route parameter named `id` or ending in `Id` as a UUID so malformed ids
 * return 400 instead of reaching Postgres (500) or polluting caches.
 */
@Injectable()
export class UuidParamsPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type !== 'param' || !metadata.data) return value;
    const name = metadata.data;
    if (name !== 'id' && !name.endsWith('Id')) return value;
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
      throw new BadRequestException(`${name} must be a valid UUID`);
    }
    return value.toLowerCase();
  }
}
