/**
 * Shared Bun test bootstrap for unit API routes.
 * Centralizing shared console defaults and Upstash doubles keeps each spec
 * focused on handler behavior instead of repeating the same client scaffolding.
 */

import { inspect } from "node:util";

import { afterEach, beforeEach, mock } from "bun:test";

console.debug = mock(() => {});
console.log = mock(() => {});
console.info = mock(() => {});
process.env.ANICARDS_UNIT_TEST = "true";
(
  globalThis as typeof globalThis & {
    ANICARDS_UNIT_TEST?: boolean;
    ANICARDS_UNIT_TEST_RUNTIME?: boolean;
  }
).ANICARDS_UNIT_TEST = true;
(
  globalThis as typeof globalThis & {
    ANICARDS_UNIT_TEST?: boolean;
    ANICARDS_UNIT_TEST_RUNTIME?: boolean;
  }
).ANICARDS_UNIT_TEST_RUNTIME = true;

const formatConsoleArgs = (args: unknown[]): string =>
  args
    .map((arg) => {
      if (arg instanceof Error) {
        return [arg.name + ": " + arg.message, arg.stack]
          .filter(Boolean)
          .join("\n");
      }

      return typeof arg === "string"
        ? arg
        : inspect(arg, {
            breakLength: 120,
            depth: 5,
          });
    })
    .join(" ");

function getBodyText(
  body: BodyInit | null | undefined,
  fallback?: string,
): string | undefined {
  if (typeof body === "string") {
    return body;
  }

  if (body instanceof URLSearchParams) {
    return body.toString();
  }

  return body == null ? fallback : undefined;
}

export function getRequestInitBodyText(
  init: RequestInit | undefined,
  fallback?: string,
): string | undefined {
  return getBodyText(init?.body, fallback);
}

export function parseRequestInitJson<T>(
  init: RequestInit | undefined,
  fallback?: string,
): T {
  const bodyText = getRequestInitBodyText(init, fallback);
  if (bodyText === undefined) {
    throw new Error("Expected RequestInit.body to be a string.");
  }

  return JSON.parse(bodyText) as T;
}

export function getRequestInputUrl(
  input: RequestInfo | URL | undefined,
  fallback = "",
): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  if (input instanceof Request) {
    return input.url;
  }

  return fallback;
}

export function getStringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

const unexpectedConsoleWarn = mock((...args: unknown[]) => {
  throw new Error(
    [
      "Unexpected console.warn output during a unit test.",
      "Add a suite-local mock or assertion when the warning is intentional.",
      formatConsoleArgs(args),
    ]
      .filter(Boolean)
      .join("\n\n"),
  );
});

const unexpectedConsoleError = mock((...args: unknown[]) => {
  throw new Error(
    [
      "Unexpected console.error output during a unit test.",
      "Add a suite-local mock or assertion when the error is intentional.",
      formatConsoleArgs(args),
    ]
      .filter(Boolean)
      .join("\n\n"),
  );
});

console.warn = unexpectedConsoleWarn as typeof console.warn;
console.error = unexpectedConsoleError as typeof console.error;

const TEST_ENV_KEYS_TO_CLEAR_BEFORE_EACH = [
  "ALLOW_UNSECURED_CRON_IN_DEV",
  "ANILIST_TOKEN",
  "ANILIST_UPSTREAM_CIRCUIT_COOLDOWN_MS",
  "ANILIST_UPSTREAM_CIRCUIT_FAILURE_THRESHOLD",
  "ANILIST_UPSTREAM_DEGRADED_MODE",
  "API_SECRET_TOKEN",
  "CRON_SECRET",
  "ERROR_ALERT_WEBHOOK_URL",
  "TRUSTED_CLIENT_IP_HEADERS",
] as const;

beforeEach(() => {
  unexpectedConsoleWarn.mockClear();
  unexpectedConsoleError.mockClear();
  console.warn = unexpectedConsoleWarn as typeof console.warn;
  console.error = unexpectedConsoleError as typeof console.error;
  (process.env as Record<string, string | undefined>)["NODE_ENV"] = "test";
  (
    globalThis as typeof globalThis & {
      ANICARDS_UNIT_TEST?: boolean;
      ANICARDS_UNIT_TEST_RUNTIME?: boolean;
    }
  ).ANICARDS_UNIT_TEST = true;
  (
    globalThis as typeof globalThis & {
      ANICARDS_UNIT_TEST?: boolean;
      ANICARDS_UNIT_TEST_RUNTIME?: boolean;
    }
  ).ANICARDS_UNIT_TEST_RUNTIME = true;
  for (const key of TEST_ENV_KEYS_TO_CLEAR_BEFORE_EACH) {
    delete process.env[key];
  }
  sharedRedisMockEval.mockReset();
  sharedRedisMockEval.mockImplementation(defaultRedisEval);
});

afterEach(() => {
  console.warn = unexpectedConsoleWarn as typeof console.warn;
  console.error = unexpectedConsoleError as typeof console.error;
});

export function allowConsoleWarningsAndErrors() {
  const consoleWarn = mock(() => {});
  const consoleError = mock(() => {});

  console.warn = consoleWarn as typeof console.warn;
  console.error = consoleError as typeof console.error;

  return {
    consoleWarn,
    consoleError,
  };
}

type EvalSavePayload = Record<string, unknown> & {
  userId: string;
  presentParts: string[];
  snapshotKeyPrefix: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeEvalExistingState(
  value: unknown,
): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function normalizeEvalPresentParts(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  );
}

function buildEvalSaveMeta(options: {
  payload: Record<string, unknown>;
  parts: Record<string, unknown>;
  revision: number;
  snapshotToken: string;
  normalizedUsername?: string;
}) {
  const meta = isRecord(options.parts.meta) ? { ...options.parts.meta } : {};

  meta.userId = options.payload.userId;
  meta.createdAt = options.payload.createdAt;
  meta.updatedAt = options.payload.updatedAt;
  meta.schemaVersion = options.payload.schemaVersion;
  meta.revision = options.revision;
  meta.storageFormat = options.payload.storageFormat;
  meta.snapshotToken = options.snapshotToken;

  if (typeof options.payload.username === "string") {
    meta.username = options.payload.username;
  } else {
    delete meta.username;
  }

  if (options.normalizedUsername) {
    meta.usernameNormalized = options.normalizedUsername;
  } else {
    delete meta.usernameNormalized;
  }

  return meta;
}

async function applyEvalPartWrites(options: {
  userId: string;
  parts: Record<string, unknown>;
  presentParts: string[];
}) {
  for (const partName of options.presentParts) {
    const serializedPart = JSON.stringify(options.parts[partName]);
    await sharedRedisMockSet(
      `user:${options.userId}:${partName}`,
      serializedPart,
    );
  }
}

function buildEvalCommitPointer(options: {
  payload: Record<string, unknown>;
  revision: number;
  snapshotToken: string;
  snapshotKeyPrefix: string;
  normalizedUsername?: string;
  existingState?: Record<string, unknown>;
}) {
  const commitPointer: Record<string, unknown> = {
    userId: options.payload.userId,
    storageFormat: options.payload.storageFormat,
    readShape: options.payload.readShape,
    schemaVersion: options.payload.schemaVersion,
    revision: options.revision,
    createdAt: options.payload.createdAt,
    updatedAt: options.payload.updatedAt,
    committedAt: options.payload.committedAt,
    snapshotToken: options.snapshotToken,
    snapshotKeyPrefix: options.snapshotKeyPrefix,
    completeness: options.payload.completeness,
  };

  if (typeof options.payload.username === "string") {
    commitPointer.username = options.payload.username;
  }
  if (options.normalizedUsername) {
    commitPointer.usernameNormalized = options.normalizedUsername;
  }

  const existingSnapshot = isRecord(options.existingState?.snapshot)
    ? options.existingState?.snapshot
    : undefined;
  if (typeof existingSnapshot?.token === "string") {
    commitPointer.previousSnapshotToken = existingSnapshot.token;
    commitPointer.previousSnapshotKeyPrefix = `user:${options.payload.userId}:snapshot:${existingSnapshot.token}`;
  }
  if (
    typeof options.existingState?.revision === "number" &&
    options.existingState.revision > 0
  ) {
    commitPointer.previousRevision = options.existingState.revision;
  }
  if (typeof options.existingState?.updatedAt === "string") {
    commitPointer.previousUpdatedAt = options.existingState.updatedAt;
  }
  if (typeof options.existingState?.committedAt === "string") {
    commitPointer.previousCommittedAt = options.existingState.committedAt;
  }
  if (options.existingState?.completeness) {
    commitPointer.previousCompleteness = options.existingState.completeness;
  }

  return commitPointer;
}

function normalizeTrackedAliasValues(values: unknown[]): string[] {
  return values.filter(
    (alias): alias is string => typeof alias === "string" && alias.length > 0,
  );
}

function buildAliasMembers(options: {
  trackedAliases: string[];
  existingNormalizedUsername?: string;
  normalizedUsername?: string;
}): string[] {
  const aliasMembers = new Set<string>(options.trackedAliases);

  if (options.existingNormalizedUsername) {
    aliasMembers.add(options.existingNormalizedUsername);
  }
  if (options.normalizedUsername) {
    aliasMembers.add(options.normalizedUsername);
  }

  return [...aliasMembers];
}

function buildStaleAliasKeys(options: {
  trackedAliases: string[];
  existingNormalizedUsername?: string;
  normalizedUsername?: string;
}): string[] {
  const staleAliasKeys = new Set<string>();

  for (const alias of options.trackedAliases) {
    if (alias !== options.normalizedUsername) {
      staleAliasKeys.add(`username:${alias}`);
    }
  }

  if (
    options.existingNormalizedUsername &&
    options.existingNormalizedUsername !== options.normalizedUsername
  ) {
    staleAliasKeys.add(`username:${options.existingNormalizedUsername}`);
  }

  return [...staleAliasKeys];
}

function invokeSharedRedisMockSmembers(key: string): Promise<string[]> {
  return (
    sharedRedisMockSmembers as unknown as (
      memberKey: string,
    ) => Promise<string[]>
  )(key);
}

function invokeSharedRedisMockSadd(
  key: string,
  ...members: string[]
): Promise<unknown> {
  return (
    sharedRedisMockSadd as unknown as (
      memberKey: string,
      ...memberValues: string[]
    ) => Promise<unknown>
  )(key, ...members);
}

function invokeSharedRedisMockZadd(
  key: string,
  entry: { score: number; member: string },
): Promise<unknown> {
  return (
    sharedRedisMockZadd as unknown as (
      zsetKey: string,
      zsetEntry: { score: number; member: string },
    ) => Promise<unknown>
  )(key, entry);
}

async function applyEvalAliasWrites(options: {
  aliasSetKey?: unknown;
  normalizedUsername?: string;
  existingState?: Record<string, unknown>;
  userId: string;
}) {
  const trackedAliases = normalizeTrackedAliasValues(
    typeof options.aliasSetKey === "string"
      ? await invokeSharedRedisMockSmembers(options.aliasSetKey)
      : [],
  );
  const existingNormalizedUsername =
    typeof options.existingState?.normalizedUsername === "string"
      ? options.existingState.normalizedUsername
      : undefined;

  if (typeof options.aliasSetKey === "string") {
    const aliasMembers = buildAliasMembers({
      trackedAliases,
      existingNormalizedUsername,
      normalizedUsername: options.normalizedUsername,
    });
    if (aliasMembers.length > 0) {
      await invokeSharedRedisMockSadd(options.aliasSetKey, ...aliasMembers);
    }
  }

  const staleAliasKeys = buildStaleAliasKeys({
    trackedAliases,
    existingNormalizedUsername,
    normalizedUsername: options.normalizedUsername,
  });
  if (staleAliasKeys.length > 0) {
    await sharedRedisMockDel(...staleAliasKeys);
  }

  if (options.normalizedUsername) {
    await sharedRedisMockSet(
      `username:${options.normalizedUsername}`,
      options.userId,
    );
  }
}

async function applyEvalRegistryWrites(options: {
  registryKey?: unknown;
  refreshIndexKey?: unknown;
  legacyUserKey?: unknown;
  userId: string;
  updatedAtScore: unknown;
}) {
  if (typeof options.registryKey === "string") {
    await invokeSharedRedisMockSadd(options.registryKey, options.userId);
  }
  if (typeof options.refreshIndexKey === "string") {
    await invokeSharedRedisMockZadd(options.refreshIndexKey, {
      score:
        typeof options.updatedAtScore === "number" ? options.updatedAtScore : 0,
      member: options.userId,
    });
  }
  if (typeof options.legacyUserKey === "string") {
    await sharedRedisMockDel(options.legacyUserKey);
  }
}

function parseEvalSavePayload(rawPayload: string): EvalSavePayload | null {
  try {
    const payload = JSON.parse(rawPayload) as Record<string, unknown>;
    if (
      typeof payload.userId === "string" &&
      typeof payload.snapshotKeyPrefix === "string"
    ) {
      return {
        ...payload,
        userId: payload.userId,
        snapshotKeyPrefix: payload.snapshotKeyPrefix,
        presentParts: normalizeEvalPresentParts(payload.presentParts),
      };
    }
  } catch {
    return null;
  }

  return null;
}

async function emulateAtomicUserSaveEval(
  keys: unknown[],
  rawPayload: string,
): Promise<unknown[]> {
  const payload = parseEvalSavePayload(rawPayload);
  if (!payload) {
    return [1];
  }

  const normalizedUsername =
    typeof payload.normalizedUsername === "string"
      ? payload.normalizedUsername
      : undefined;
  const existingState = normalizeEvalExistingState(payload.existingState);
  const expectedUpdatedAt =
    typeof payload.expectedUpdatedAt === "string"
      ? payload.expectedUpdatedAt
      : undefined;
  const currentUpdatedAt =
    typeof existingState?.updatedAt === "string"
      ? existingState.updatedAt
      : undefined;

  if (
    expectedUpdatedAt &&
    currentUpdatedAt &&
    currentUpdatedAt !== expectedUpdatedAt
  ) {
    return [0, currentUpdatedAt];
  }

  const revision =
    (typeof existingState?.revision === "number" && existingState.revision > 0
      ? existingState.revision
      : 0) + 1;
  const snapshotToken =
    typeof payload.snapshotToken === "string"
      ? payload.snapshotToken
      : "test-snapshot-token";
  const parts = isRecord(payload.parts)
    ? { ...payload.parts }
    : ({} as Record<string, unknown>);
  const meta = buildEvalSaveMeta({
    payload,
    parts,
    revision,
    snapshotToken,
    normalizedUsername,
  });
  parts.meta = meta;

  await applyEvalPartWrites({
    userId: payload.userId,
    parts,
    presentParts: payload.presentParts,
  });

  const commitPointer = buildEvalCommitPointer({
    payload,
    revision,
    snapshotToken,
    snapshotKeyPrefix: payload.snapshotKeyPrefix,
    normalizedUsername,
    existingState,
  });

  if (typeof keys[0] === "string") {
    await sharedRedisMockSet(keys[0], JSON.stringify(commitPointer));
  }
  await applyEvalAliasWrites({
    aliasSetKey: keys[1],
    normalizedUsername,
    existingState,
    userId: payload.userId,
  });
  await applyEvalRegistryWrites({
    registryKey: keys[2],
    refreshIndexKey: keys[3],
    legacyUserKey: keys[5],
    userId: payload.userId,
    updatedAtScore: payload.updatedAtScore,
  });

  return [1, payload.updatedAt, String(revision), snapshotToken];
}

async function defaultRedisEval(
  _script: unknown,
  keys: unknown,
  args: unknown,
): Promise<unknown> {
  const keyList = Array.isArray(keys) ? keys : [];
  const argList = Array.isArray(args) ? args : [];

  if (argList.length === 1 && typeof argList[0] === "string") {
    if (parseEvalSavePayload(argList[0])) {
      return emulateAtomicUserSaveEval(keyList, argList[0]);
    }
  }

  if (keyList.length === 1 && argList.length >= 2) {
    const [cardsKey] = keyList;
    const serializedCardData = argList[1];

    if (
      typeof cardsKey === "string" &&
      typeof serializedCardData === "string"
    ) {
      await sharedRedisMockSet(cardsKey, serializedCardData);
      return [1];
    }
  }

  return [1];
}

/**
 * Shared Redis mock client that will be used by all test files.
 * Each test file will reset these mocks in their setup functions.
 */
export const sharedRedisMockScan = mock();
export const sharedRedisMockGet = mock();
export const sharedRedisMockSet = mock();
export const sharedRedisMockEval = mock(defaultRedisEval);
export const sharedRedisMockDel = mock();
export const sharedRedisMockIncr = mock(async () => 1);
export const sharedRedisMockIncrRaw = mock(async () => 1);
export const sharedRedisMockExpire = mock(async () => 1);
export const sharedRedisMockRpush = mock();
export const sharedRedisMockLrange = mock();
export const sharedRedisMockLtrim = mock();
export const sharedRedisMockMget = mock(
  async (...keys: string[]): Promise<(string | null)[]> => keys.map(() => null),
);
export const sharedRedisMockSadd = mock(async () => 1);
export const sharedRedisMockSmembers = mock(async () => [] as string[]);
export const sharedRedisMockSrem = mock(async () => 1);
export const sharedRedisMockPipeline = mock();
export const sharedRedisMockPipelineSet = mock();
export const sharedRedisMockPipelineDel = mock();
export const sharedRedisMockPipelineSadd = mock();
export const sharedRedisMockPipelineZadd = mock();
export const sharedRedisMockPipelineIncr = mock();
export const sharedRedisMockPipelineExpire = mock();
export const sharedRedisMockZadd = mock(async () => 1);
export const sharedRedisMockZrange = mock(async () => [] as string[]);
export const sharedRedisMockZcard = mock(async () => 0);
export const sharedRedisMockZrem = mock(async () => 1);
export const sharedRedisMockPipelineExec = mock(async () => []);

type SharedRedisCallObserver = (args: unknown[]) => void;

const sharedRedisRpushObservers = new Set<SharedRedisCallObserver>();
const sharedRedisLtrimObservers = new Set<SharedRedisCallObserver>();
const sharedRedisIncrObservers = new Set<SharedRedisCallObserver>();

function notifySharedRedisCallObservers(
  observers: Set<SharedRedisCallObserver>,
  args: unknown[],
): void {
  for (const observer of observers) {
    observer([...args]);
  }
}

function captureSharedRedisCalls(options: {
  getMockCalls: () => unknown[][];
  observers: Set<SharedRedisCallObserver>;
}): {
  readonly calls: unknown[][];
  release: () => void;
} {
  const calls: unknown[][] = [];
  const observer: SharedRedisCallObserver = (args) => {
    calls.push(args);
  };

  options.observers.add(observer);

  return {
    get calls() {
      return calls.map((args) => [...args]);
    },
    release: () => {
      options.observers.delete(observer);
    },
  };
}

export function captureSharedRedisRpushCalls(): {
  calls: unknown[][];
  release: () => void;
} {
  return captureSharedRedisCalls({
    getMockCalls: () => sharedRedisMockRpush.mock.calls,
    observers: sharedRedisRpushObservers,
  });
}

export function captureSharedRedisLtrimCalls(): {
  calls: unknown[][];
  release: () => void;
} {
  return captureSharedRedisCalls({
    getMockCalls: () => sharedRedisMockLtrim.mock.calls,
    observers: sharedRedisLtrimObservers,
  });
}

export function captureSharedRedisIncrCalls(): {
  calls: unknown[][];
  release: () => void;
} {
  return captureSharedRedisCalls({
    getMockCalls: () => sharedRedisMockIncr.mock.calls,
    observers: sharedRedisIncrObservers,
  });
}

function normalizeAnalyticsCounterKeyForAssertions(key: unknown): unknown {
  if (typeof key !== "string") return key;
  return key.replace(/:month:\d{4}-\d{2}$/, "");
}

function detachPromise(result: unknown): void {
  if (result instanceof Promise) {
    result.catch(() => undefined);
  }
}

const sharedRedisPipelineMock = {
  set: mock((...args: unknown[]) => {
    sharedRedisMockPipelineSet(...args);
    sharedRedisMockSet(...args);
    return sharedRedisPipelineMock;
  }),
  del: mock((...args: unknown[]) => {
    sharedRedisMockPipelineDel(...args);
    sharedRedisMockDel(...args);
    return sharedRedisPipelineMock;
  }),
  sadd: mock((...args: unknown[]) => {
    sharedRedisMockPipelineSadd(...args);
    const invokeSharedRedisMockSadd = sharedRedisMockSadd as unknown as (
      ...callArgs: unknown[]
    ) => unknown;
    invokeSharedRedisMockSadd(...args);
    return sharedRedisPipelineMock;
  }),
  zadd: mock((...args: unknown[]) => {
    sharedRedisMockPipelineZadd(...args);
    const invokeSharedRedisMockZadd = sharedRedisMockZadd as unknown as (
      ...callArgs: unknown[]
    ) => unknown;
    invokeSharedRedisMockZadd(...args);
    return sharedRedisPipelineMock;
  }),
  incr: mock((key: unknown) => {
    sharedRedisMockPipelineIncr(key);
    const invokeSharedRedisMockIncrRaw = sharedRedisMockIncrRaw as unknown as (
      ...callArgs: unknown[]
    ) => Promise<unknown>;
    const invokeSharedRedisMockIncr = sharedRedisMockIncr as unknown as (
      ...callArgs: unknown[]
    ) => Promise<unknown>;
    const normalizedKey = normalizeAnalyticsCounterKeyForAssertions(key);

    notifySharedRedisCallObservers(sharedRedisIncrObservers, [normalizedKey]);

    detachPromise(invokeSharedRedisMockIncrRaw(key));
    detachPromise(invokeSharedRedisMockIncr(normalizedKey));
    return sharedRedisPipelineMock;
  }),
  expire: mock((...args: unknown[]) => {
    sharedRedisMockPipelineExpire(...args);
    const expireResult = (
      sharedRedisMockExpire as unknown as (...callArgs: unknown[]) => unknown
    )(...args);
    detachPromise(expireResult);
    return sharedRedisPipelineMock;
  }),
  exec: sharedRedisMockPipelineExec,
};

const sharedRedisFakeClient = {
  scan: sharedRedisMockScan,
  get: sharedRedisMockGet,
  set: sharedRedisMockSet,
  eval: sharedRedisMockEval,
  del: sharedRedisMockDel,
  incr: mock(async (key: unknown) => {
    const invokeSharedRedisMockIncrRaw = sharedRedisMockIncrRaw as unknown as (
      ...callArgs: unknown[]
    ) => Promise<unknown>;
    const invokeSharedRedisMockIncr = sharedRedisMockIncr as unknown as (
      ...callArgs: unknown[]
    ) => Promise<unknown>;
    const normalizedKey = normalizeAnalyticsCounterKeyForAssertions(key);

    notifySharedRedisCallObservers(sharedRedisIncrObservers, [normalizedKey]);

    await invokeSharedRedisMockIncrRaw(key);
    return invokeSharedRedisMockIncr(normalizedKey);
  }),
  expire: sharedRedisMockExpire,
  rpush: (...args: unknown[]) => {
    notifySharedRedisCallObservers(sharedRedisRpushObservers, args);

    const result = (
      sharedRedisMockRpush as unknown as (...callArgs: unknown[]) => unknown
    )(...args);

    return result === undefined ? 1 : result;
  },
  lrange: sharedRedisMockLrange,
  ltrim: (...args: unknown[]) => {
    notifySharedRedisCallObservers(sharedRedisLtrimObservers, args);

    const result = (
      sharedRedisMockLtrim as unknown as (...callArgs: unknown[]) => unknown
    )(...args);

    return result === undefined ? "OK" : result;
  },
  mget: sharedRedisMockMget,
  sadd: sharedRedisMockSadd,
  smembers: sharedRedisMockSmembers,
  srem: sharedRedisMockSrem,
  zadd: sharedRedisMockZadd,
  zrange: sharedRedisMockZrange,
  zcard: sharedRedisMockZcard,
  zrem: sharedRedisMockZrem,
  pipeline: mock(() => {
    sharedRedisMockPipeline();
    return sharedRedisPipelineMock;
  }),
};

mock.module("@upstash/redis", () => ({
  Redis: {
    fromEnv: mock(() => sharedRedisFakeClient),
  },
}));

/**
 * Shared Ratelimit mock that will be used by all test files.
 */
export const sharedRatelimitMockLimit = mock().mockResolvedValue({
  success: true,
  limit: 10,
  remaining: 9,
  reset: Date.now() + 10_000,
  pending: Promise.resolve(),
});
export const sharedRatelimitMockSlidingWindow = mock(() => "fake-limiter");

const RatelimitMockClass = mock().mockImplementation(() => ({
  limit: sharedRatelimitMockLimit,
}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(RatelimitMockClass as any).slidingWindow = sharedRatelimitMockSlidingWindow;

mock.module("@upstash/ratelimit", () => ({
  Ratelimit: RatelimitMockClass,
}));
