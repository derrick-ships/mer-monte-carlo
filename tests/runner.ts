// Minimal zero-dependency test runner. Designed to run under tsx without any
// framework dep (no Jest/Vitest). The whole point of this calculator is
// auditability; using a battle-tested 50-line runner is consistent with that.

type Assertion = {
  toEqual: (expected: unknown) => void;
  toBe: (expected: unknown) => void;
  toBeCloseTo: (expected: number, tolerance?: number) => void;
  toBeWithinPercent: (expected: number, percent: number) => void;
  toBeTruthy: () => void;
  toBeFalsy: () => void;
  toBeNaN: () => void;
  toBeFinite: () => void;
  toThrow: (msg?: string | RegExp) => void;
  toBeGreaterThan: (n: number) => void;
  toBeGreaterThanOrEqual: (n: number) => void;
  toBeLessThan: (n: number) => void;
  toBeLessThanOrEqual: (n: number) => void;
};

let passed = 0;
let failed = 0;
const failures: string[] = [];
const ctxStack: string[] = [];

export function describe(name: string, fn: () => void): void {
  ctxStack.push(name);
  try {
    fn();
  } finally {
    ctxStack.pop();
  }
}

export function it(name: string, fn: () => void | Promise<void>): void {
  const ctx = [...ctxStack, name].join(' > ');
  try {
    const r = fn();
    if (r instanceof Promise) {
      throw new Error('Async tests not supported in this runner; refactor to sync.');
    }
    passed++;
    process.stdout.write(`  [32m✓[0m ${ctx}\n`);
  } catch (e) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    failures.push(`${ctx}\n    ${msg}`);
    process.stdout.write(`  [31m✗[0m ${ctx}\n    ${msg}\n`);
  }
}

export function expect(actual: unknown): Assertion {
  return {
    toEqual(expected) {
      const a = JSON.stringify(actual, replacer);
      const b = JSON.stringify(expected, replacer);
      if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
    },
    toBe(expected) {
      if (actual !== expected) throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
    },
    toBeCloseTo(expected, tolerance = 1e-6) {
      const a = actual as number;
      if (!Number.isFinite(a)) throw new Error(`Expected finite, got ${a}`);
      if (Math.abs(a - expected) > tolerance) {
        throw new Error(`Expected ~${expected} (±${tolerance}), got ${a} (diff ${Math.abs(a - expected)})`);
      }
    },
    toBeWithinPercent(expected, percent) {
      const a = actual as number;
      const tol = Math.abs(expected) * (percent / 100);
      if (Math.abs(a - expected) > tol) {
        throw new Error(`Expected ${a} within ${percent}% of ${expected} (tol=${tol})`);
      }
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${String(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, got ${String(actual)}`);
    },
    toBeNaN() {
      if (!Number.isNaN(actual as number)) throw new Error(`Expected NaN, got ${String(actual)}`);
    },
    toBeFinite() {
      if (!Number.isFinite(actual as number)) throw new Error(`Expected finite, got ${String(actual)}`);
    },
    toThrow(msg) {
      try {
        (actual as () => unknown)();
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        if (msg === undefined) return;
        const ok = msg instanceof RegExp ? msg.test(m) : m.includes(msg);
        if (!ok) throw new Error(`Threw "${m}", expected match ${msg}`);
        return;
      }
      throw new Error('Expected to throw, did not');
    },
    toBeGreaterThan(n) {
      if (!((actual as number) > n)) throw new Error(`Expected > ${n}, got ${String(actual)}`);
    },
    toBeGreaterThanOrEqual(n) {
      if (!((actual as number) >= n)) throw new Error(`Expected >= ${n}, got ${String(actual)}`);
    },
    toBeLessThan(n) {
      if (!((actual as number) < n)) throw new Error(`Expected < ${n}, got ${String(actual)}`);
    },
    toBeLessThanOrEqual(n) {
      if (!((actual as number) <= n)) throw new Error(`Expected <= ${n}, got ${String(actual)}`);
    },
  };
}

function replacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString() + 'n';
  if (value instanceof Float64Array) return Array.from(value);
  return value;
}

export function reportTests(): void {
  process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.stdout.write('\nFailures:\n');
    for (const f of failures) process.stdout.write(`  ${f}\n`);
    process.exit(1);
  }
}
