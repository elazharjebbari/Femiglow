import type { CircuitBreakerConfig } from './types';
import { ProviderError } from './types';

enum State {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitBreaker {
  private state = State.CLOSED;
  private failureCount = 0;
  private halfOpenCalls = 0;
  private lastFailureTime = 0;

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMaxCalls: number;

  constructor(config: CircuitBreakerConfig) {
    this.failureThreshold = config.failureThreshold;
    this.resetTimeoutMs = config.resetTimeoutMs;
    this.halfOpenMaxCalls = config.halfOpenMaxCalls;
  }

  getState(): string {
    this.maybeTransitionToHalfOpen();
    return this.state;
  }

  reset(): void {
    this.state = State.CLOSED;
    this.failureCount = 0;
    this.halfOpenCalls = 0;
    this.lastFailureTime = 0;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.maybeTransitionToHalfOpen();

    if (this.state === State.OPEN) {
      throw new ProviderError('Circuit breaker is open', {
        provider: 'unknown',
        model: 'unknown',
        retryable: false,
      });
    }

    if (
      this.state === State.HALF_OPEN &&
      this.halfOpenCalls >= this.halfOpenMaxCalls
    ) {
      throw new ProviderError('Circuit breaker half-open limit reached', {
        provider: 'unknown',
        model: 'unknown',
        retryable: false,
      });
    }

    if (this.state === State.HALF_OPEN) {
      this.halfOpenCalls += 1;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === State.HALF_OPEN) {
      this.state = State.CLOSED;
      this.failureCount = 0;
      this.halfOpenCalls = 0;
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();

    if (this.state === State.HALF_OPEN) {
      this.state = State.OPEN;
      return;
    }

    if (this.failureCount >= this.failureThreshold) {
      this.state = State.OPEN;
    }
  }

  private maybeTransitionToHalfOpen(): void {
    if (
      this.state === State.OPEN &&
      Date.now() - this.lastFailureTime >= this.resetTimeoutMs
    ) {
      this.state = State.HALF_OPEN;
      this.halfOpenCalls = 0;
    }
  }
}
