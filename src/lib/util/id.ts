/** Small id helpers. Centralised so every module generates ids the same way. */

let counter = 0;

/** Monotonic, collision-free id with an optional human-readable prefix. */
export function uid(prefix = 'id'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}
