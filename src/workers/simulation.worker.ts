// Web Worker host for the Monte Carlo simulator. Keeping the simulation off
// the main thread is what makes the UI feel instant for 50k–200k iterations.
//
// Wire protocol:
//   in:  { id: string, type: 'run', cfg: SimConfig }
//   out: { id: string, type: 'progress', completed: number, total: number }
//        { id: string, type: 'result', result: SimResult }
//        { id: string, type: 'error', error: string }

import { runSimulation, type SimConfig, type SimResult } from '../math/simulator.js';

type InMessage = { id: string; type: 'run'; cfg: SimConfig };
type OutMessage =
  | { id: string; type: 'result'; result: SimResult }
  | { id: string; type: 'error'; error: string };

self.addEventListener('message', (e: MessageEvent<InMessage>) => {
  const { id, type, cfg } = e.data;
  if (type !== 'run') return;
  try {
    const result = runSimulation(cfg);
    // Float64Arrays transfer cheaply; we mark them as transferable.
    const msg: OutMessage = { id, type: 'result', result };
    (self as unknown as Worker).postMessage(msg, [
      result.mer.buffer,
      result.netProfitCents.buffer,
      result.netRevenueCents.buffer,
      result.cacCents.buffer,
      ...Object.values(result.inputSamples).map((a) => a.buffer),
    ]);
  } catch (err) {
    const msg: OutMessage = {
      id,
      type: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
    (self as unknown as Worker).postMessage(msg);
  }
});
