import 'server-only';

export interface CircuitBreakerOptions {
  name: string;
  threshold?: number;
  resetMs?: number;
}

const DEFAULT_THRESHOLD = 3;
const DEFAULT_RESET_MS = 60000;

export class CircuitBreaker {
  private readonly name: string;
  private readonly threshold: number;
  private readonly resetMs: number;
  private consecutiveFailures = 0;
  private lastFailureTime = 0;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.threshold = options.threshold ?? DEFAULT_THRESHOLD;
    this.resetMs = options.resetMs ?? DEFAULT_RESET_MS;
  }

  isOpen(): boolean {
    if (this.consecutiveFailures >= this.threshold) {
      if (Date.now() - this.lastFailureTime > this.resetMs) {
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  recordFailure(): void {
    this.consecutiveFailures += 1;
    this.lastFailureTime = Date.now();
  }

  reset(): void {
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
  }
}
