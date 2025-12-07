import { mock } from "bun:test";

/**
 * Shared mock objects used across all API route tests that need standard @upstash mocks.
 * These mocks are shared between test files and are designed to be compatible when
 * registered multiple times (first registration wins in Bun's mock system).
 */

export const mockRedisSet = mock();
export const mockRedisGet = mock();
export const mockRedisIncr = mock();
export const mockLimit = mock().mockResolvedValue({ success: true });
export const mockSlidingWindow = mock(() => "fake-limiter");

export function createRedisFromEnvMock() {
  return {
    set: mockRedisSet,
    get: mockRedisGet,
    incr: mockRedisIncr,
  };
}

export function createRatelimitMockClass() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const RatelimitMock: any = mock().mockImplementation(() => ({
    limit: mockLimit,
  }));
  // Use the shared mockSlidingWindow so test files can spy on the same mock
  RatelimitMock.slidingWindow = mockSlidingWindow;
  return RatelimitMock;
}
