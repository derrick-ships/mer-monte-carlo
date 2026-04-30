// URL state encoding for shareable simulation configurations. We base64 the
// JSON of the SimConfig + a version tag so v2 can detect old links and migrate
// or reject them cleanly instead of silently producing wrong outputs.

import type { SimConfig } from '../math/simulator.js';

const STATE_VERSION = 1;

type EncodedState = {
  v: number;
  cfg: SimConfig;
};

export function encodeStateToHash(cfg: SimConfig): string {
  const payload: EncodedState = { v: STATE_VERSION, cfg };
  const json = JSON.stringify(payload);
  // btoa handles only Latin-1; encode UTF-8 first.
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return `#s=${b64}`;
}

export function decodeStateFromHash(hash: string): SimConfig | null {
  const m = /^#?s=(.+)$/.exec(hash.startsWith('#') ? hash.slice(1) : hash);
  if (!m) return null;
  try {
    const json = decodeURIComponent(escape(atob(m[1]!)));
    const parsed = JSON.parse(json) as EncodedState;
    if (parsed.v !== STATE_VERSION) {
      console.warn(`State version mismatch: got ${parsed.v}, expected ${STATE_VERSION}`);
      return null;
    }
    return parsed.cfg;
  } catch (e) {
    console.warn('Failed to decode state from hash:', e);
    return null;
  }
}
