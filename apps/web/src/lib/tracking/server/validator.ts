import type { z } from 'zod';
import { eventSchemas, getEventSchema } from '@/lib/tracking/schemas';

const VALIDATOR_CACHE_SIZE = 100;
const validatorCache = new Map<string, z.ZodTypeAny>();

export function getValidator(eventName: string): z.ZodTypeAny | null {
  const cached = validatorCache.get(eventName);
  if (cached) return cached;
  const schema = getEventSchema(eventName);
  if (!schema) return null;
  if (validatorCache.size >= VALIDATOR_CACHE_SIZE) {
    const first = validatorCache.keys().next().value;
    if (first) validatorCache.delete(first);
  }
  validatorCache.set(eventName, schema);
  return schema;
}

export function knownEvents(): string[] {
  return Object.keys(eventSchemas);
}

export function clearValidatorCache(): void {
  validatorCache.clear();
}
