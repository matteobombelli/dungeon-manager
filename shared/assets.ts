// Asset ids are crypto.randomUUID() values (shared/ids.ts).
const ASSET_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every string in `value` shaped like an asset id, found anywhere in it. Walking the whole node data
 * rather than naming fields per node type means a new type with a file field is covered without
 * being listed; the caller keeps only the ids that really are the user's assets.
 */
export function assetIdsIn(value: unknown, into = new Set<string>()): Set<string> {
  if (typeof value === "string") {
    if (ASSET_ID.test(value)) into.add(value);
  } else if (Array.isArray(value)) {
    for (const v of value) assetIdsIn(v, into);
  } else if (typeof value === "object" && value !== null) {
    for (const v of Object.values(value)) assetIdsIn(v, into);
  }
  return into;
}
