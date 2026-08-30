/**
 * AirtableConfig.mapping is one JSON object doing two jobs: the eight steps,
 * keyed "1".."8", and the options an admin has chosen to ignore.
 *
 * An ignored option is stored under a "~ig:" key with an empty value. The sync
 * engine only reads numeric keys for the ladder and compares values against a
 * non-empty Airtable option, so an empty value can never match anything and
 * the record is left alone — which is exactly what "ignore" means here.
 */

const IGNORE = "~ig:";

export type Mapping = { steps: Record<string, string>; ignored: string[] };

export function splitMapping(raw: Record<string, string>): Mapping {
  const steps: Record<string, string> = {};
  const ignored: string[] = [];
  for (const [key, value] of Object.entries(raw ?? {})) {
    if (key.startsWith(IGNORE)) ignored.push(key.slice(IGNORE.length));
    else if (/^[1-8]$/.test(key) && value) steps[key] = value;
  }
  return { steps, ignored };
}

export function joinMapping(m: Mapping): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(m.steps)) if (value) out[key] = value;
  for (const option of m.ignored) out[IGNORE + option] = "";
  return out;
}
