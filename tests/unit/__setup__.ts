/**
 * Explicit unit-test fixtures for request parsing helpers and the stateful
 * Upstash eval emulation used by persistence and throttling suites.
 */

import { mock } from "bun:test";

import {
  sharedRedisMockDel,
  sharedRedisMockEval,
  sharedRedisMockGet,
  sharedRedisMockSadd,
  sharedRedisMockSet,
  sharedRedisMockSmembers,
  sharedRedisMockSrem,
  sharedRedisMockZadd,
  sharedRedisMockZrem,
} from "./preload";

export * from "./preload";

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

/**
 * Re-enable the stateful Redis eval emulator for suites that exercise the
 * split-user or stored-cards persistence contract. Call this from the suite's
 * own `beforeEach()` after any local mock resets so the lightweight global
 * preload cannot overwrite the implementation order.
 */
export function installStatefulRedisEvalHarness(): void {
  sharedRedisMockEval.mockImplementation(defaultRedisEval);
}

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

type EvalDeletePayload = {
  allParts: string[];
  userId: string;
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

function normalizeEvalUsername(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function parseEvalJsonRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseEvalDeletePayload(args: unknown[]): EvalDeletePayload | null {
  const [rawUserId, rawAllParts] = args;
  if (typeof rawUserId !== "string") {
    return null;
  }

  if (typeof rawAllParts !== "string") {
    return {
      allParts: [],
      userId: rawUserId,
    };
  }

  try {
    const parsed = JSON.parse(rawAllParts) as unknown;
    return {
      allParts: normalizeEvalPresentParts(parsed),
      userId: rawUserId,
    };
  } catch {
    return {
      allParts: [],
      userId: rawUserId,
    };
  }
}

function getNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getPositiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && value > 0 ? value : undefined;
}

function getEvalCurrentSnapshotToken(
  existingState: Record<string, unknown> | undefined,
): string | undefined {
  const snapshot = isRecord(existingState?.snapshot)
    ? existingState.snapshot
    : undefined;

  return getNonEmptyString(snapshot?.token);
}

function buildEvalConflictResult(options: {
  currentUpdatedAt?: string;
  currentRevision: number;
  currentSnapshotToken?: string;
}): unknown[] {
  return [
    0,
    options.currentUpdatedAt ?? "",
    String(options.currentRevision),
    options.currentSnapshotToken ?? "",
  ];
}

function getEvalSaveConflictResult(options: {
  payload: EvalSavePayload;
  existingState: Record<string, unknown> | undefined;
}): unknown[] | null {
  const expectedUpdatedAt = getNonEmptyString(
    options.payload.expectedUpdatedAt,
  );
  const expectedRevision = getPositiveNumber(options.payload.expectedRevision);
  const expectedSnapshotToken = getNonEmptyString(
    options.payload.expectedSnapshotToken,
  );
  const currentUpdatedAt = getNonEmptyString(options.existingState?.updatedAt);
  const currentRevision =
    getPositiveNumber(options.existingState?.revision) ?? 0;
  const currentSnapshotToken = getEvalCurrentSnapshotToken(
    options.existingState,
  );

  if (expectedSnapshotToken && currentSnapshotToken !== expectedSnapshotToken) {
    return buildEvalConflictResult({
      currentUpdatedAt,
      currentRevision,
      currentSnapshotToken,
    });
  }

  if (expectedRevision && currentRevision !== expectedRevision) {
    return buildEvalConflictResult({
      currentUpdatedAt,
      currentRevision,
      currentSnapshotToken,
    });
  }

  if (expectedUpdatedAt && currentUpdatedAt !== expectedUpdatedAt) {
    return buildEvalConflictResult({
      currentUpdatedAt,
      currentRevision,
      currentSnapshotToken,
    });
  }

  return null;
}

function buildEvalStoredCardsUserSnapshotFromRecord(options: {
  record: Record<string, unknown> | null;
  tokenKey?: string;
}): Record<string, unknown> | undefined {
  if (!options.record) {
    return undefined;
  }

  const snapshot: Record<string, unknown> = {};
  const revision = options.record.revision;
  const updatedAt = options.record.updatedAt;
  const committedAt = options.record.committedAt;
  const token = options.tokenKey ? options.record[options.tokenKey] : undefined;

  if (typeof revision === "number" && revision > 0) {
    snapshot.revision = revision;
  }

  if (typeof updatedAt === "string" && updatedAt.length > 0) {
    snapshot.updatedAt = updatedAt;
  }

  if (typeof committedAt === "string" && committedAt.length > 0) {
    snapshot.committedAt = committedAt;
  }

  if (typeof token === "string" && token.length > 0) {
    snapshot.token = token;
  }

  return Object.keys(snapshot).length > 0 ? snapshot : undefined;
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

function getEvalDeletePreviousSnapshotKeyPrefix(
  commitPointer: Record<string, unknown> | null,
): string | undefined {
  if (typeof commitPointer?.retainedSnapshotKeyPrefix === "string") {
    return commitPointer.retainedSnapshotKeyPrefix;
  }

  if (typeof commitPointer?.previousSnapshotKeyPrefix === "string") {
    return commitPointer.previousSnapshotKeyPrefix;
  }

  return undefined;
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

function invokeSharedRedisMockSrem(
  key: string,
  ...members: string[]
): Promise<unknown> {
  return (
    sharedRedisMockSrem as unknown as (
      memberKey: string,
      ...memberValues: string[]
    ) => Promise<unknown>
  )(key, ...members);
}

function invokeSharedRedisMockZrem(
  key: string,
  ...members: string[]
): Promise<unknown> {
  return (
    sharedRedisMockZrem as unknown as (
      zsetKey: string,
      ...memberValues: string[]
    ) => Promise<unknown>
  )(key, ...members);
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
  const conflictResult = getEvalSaveConflictResult({
    payload,
    existingState,
  });

  if (conflictResult) {
    return conflictResult;
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

async function emulateAtomicUserDeleteEval(
  keys: unknown[],
  args: unknown[],
): Promise<unknown[]> {
  const payload = parseEvalDeletePayload(args);
  if (!payload) {
    return [1, JSON.stringify([]), JSON.stringify([])];
  }

  const [
    commitKey,
    metaKey,
    aliasSetKey,
    legacyUserKey,
    cardsKey,
    cardsMetaKey,
    failureKey,
    registryKey,
    refreshIndexKey,
  ] = keys;
  const deletedKeys: string[] = [];
  const removedAliasKeys: string[] = [];
  const aliasValues = new Set<string>();

  const recordAlias = (value: unknown) => {
    const normalized = normalizeEvalUsername(value);
    if (normalized) {
      aliasValues.add(normalized);
    }
  };

  if (typeof aliasSetKey === "string") {
    const trackedAliases = await invokeSharedRedisMockSmembers(aliasSetKey);
    trackedAliases.forEach((alias) => {
      recordAlias(alias);
    });
  }

  const commitPointer =
    typeof commitKey === "string"
      ? parseEvalJsonRecord(await sharedRedisMockGet(commitKey))
      : null;
  const splitMeta =
    typeof metaKey === "string"
      ? parseEvalJsonRecord(await sharedRedisMockGet(metaKey))
      : null;
  const legacyRecord =
    typeof legacyUserKey === "string"
      ? parseEvalJsonRecord(await sharedRedisMockGet(legacyUserKey))
      : null;

  [commitPointer, splitMeta, legacyRecord].forEach((record) => {
    if (!record) {
      return;
    }

    recordAlias(record.usernameNormalized);
    recordAlias(record.username);
  });

  payload.allParts.forEach((partName) => {
    deletedKeys.push(`user:${payload.userId}:${partName}`);
  });

  const snapshotKeyPrefix =
    typeof commitPointer?.snapshotKeyPrefix === "string"
      ? commitPointer.snapshotKeyPrefix
      : undefined;
  if (snapshotKeyPrefix) {
    payload.allParts.forEach((partName) => {
      deletedKeys.push(`${snapshotKeyPrefix}:${partName}`);
    });
  }

  const previousSnapshotKeyPrefix =
    getEvalDeletePreviousSnapshotKeyPrefix(commitPointer);
  if (previousSnapshotKeyPrefix) {
    payload.allParts.forEach((partName) => {
      deletedKeys.push(`${previousSnapshotKeyPrefix}:${partName}`);
    });
  }

  [
    commitKey,
    aliasSetKey,
    legacyUserKey,
    cardsKey,
    cardsMetaKey,
    failureKey,
  ].forEach((key) => {
    if (typeof key === "string") {
      deletedKeys.push(key);
    }
  });

  for (const alias of aliasValues) {
    const aliasKey = `username:${alias}`;
    const aliasOwner = await sharedRedisMockGet(aliasKey);
    if (aliasOwner === payload.userId) {
      deletedKeys.push(aliasKey);
      removedAliasKeys.push(aliasKey);
    }
  }

  if (deletedKeys.length > 0) {
    await sharedRedisMockDel(...deletedKeys);
  }
  if (typeof registryKey === "string") {
    await invokeSharedRedisMockSrem(registryKey, payload.userId);
  }
  if (typeof refreshIndexKey === "string") {
    await invokeSharedRedisMockZrem(refreshIndexKey, payload.userId);
  }

  return [1, JSON.stringify(deletedKeys), JSON.stringify(removedAliasKeys)];
}

async function emulateAtomicStoreCardsEval(
  keys: unknown[],
  args: unknown[],
): Promise<unknown[]> {
  const [cardsKey, cardsMetaKey, commitKey] = keys;
  const [
    rawExpectedUpdatedAt,
    rawSerializedCardData,
    rawExpectedSerializedCurrent,
  ] = args;

  if (
    typeof cardsKey !== "string" ||
    typeof rawSerializedCardData !== "string"
  ) {
    return [1];
  }

  const expectedUpdatedAt =
    typeof rawExpectedUpdatedAt === "string" && rawExpectedUpdatedAt.length > 0
      ? rawExpectedUpdatedAt
      : undefined;
  const expectedSerializedCurrent =
    typeof rawExpectedSerializedCurrent === "string" &&
    rawExpectedSerializedCurrent.length > 0
      ? rawExpectedSerializedCurrent
      : undefined;

  const fetchedCurrentRawRecord = await sharedRedisMockGet(cardsKey);
  const currentRawRecord =
    (fetchedCurrentRawRecord === undefined ||
      fetchedCurrentRawRecord === null) &&
    expectedSerializedCurrent
      ? expectedSerializedCurrent
      : fetchedCurrentRawRecord;

  if (!currentRawRecord && expectedSerializedCurrent) {
    return [0];
  }

  if (
    expectedSerializedCurrent &&
    typeof currentRawRecord === "string" &&
    currentRawRecord !== expectedSerializedCurrent
  ) {
    const currentRecord = parseEvalJsonRecord(currentRawRecord);
    const currentUpdatedAt =
      typeof currentRecord?.updatedAt === "string"
        ? currentRecord.updatedAt
        : undefined;

    return [0, currentUpdatedAt];
  }

  if (expectedUpdatedAt) {
    const currentRecord = parseEvalJsonRecord(currentRawRecord);
    const currentUpdatedAt =
      typeof currentRecord?.updatedAt === "string"
        ? currentRecord.updatedAt
        : undefined;

    if (currentUpdatedAt !== expectedUpdatedAt) {
      return [0, currentUpdatedAt];
    }
  }

  const nextRecord = parseEvalJsonRecord(rawSerializedCardData);
  if (!nextRecord) {
    await sharedRedisMockSet(cardsKey, rawSerializedCardData);
    return [1];
  }

  const commitPointer =
    typeof commitKey === "string"
      ? parseEvalJsonRecord(await sharedRedisMockGet(commitKey))
      : null;
  const userSnapshot =
    typeof commitPointer?.snapshotKeyPrefix === "string"
      ? buildEvalStoredCardsUserSnapshotFromRecord({
          record: commitPointer,
          tokenKey: "snapshotToken",
        })
      : undefined;

  if (!userSnapshot) {
    return [2];
  }

  const currentVersion =
    typeof currentRawRecord === "string"
      ? (parseEvalJsonRecord(currentRawRecord)?.version as number | undefined)
      : undefined;
  const nextVersion =
    typeof currentVersion === "number" && currentVersion > 0
      ? currentVersion + 1
      : 1;

  nextRecord.userSnapshot = userSnapshot;
  nextRecord.version = nextVersion;

  await sharedRedisMockSet(cardsKey, JSON.stringify(nextRecord));
  if (typeof cardsMetaKey === "string") {
    await sharedRedisMockSet(
      cardsMetaKey,
      JSON.stringify({
        userId: nextRecord.userId,
        updatedAt: nextRecord.updatedAt,
        version: nextVersion,
        ...(typeof nextRecord.schemaVersion === "number" &&
        nextRecord.schemaVersion > 0
          ? { schemaVersion: nextRecord.schemaVersion }
          : {}),
        userSnapshot,
      }),
    );
  }

  return [
    1,
    nextRecord.updatedAt,
    String(nextVersion),
    userSnapshot.token,
    String(userSnapshot.revision),
    userSnapshot.updatedAt,
    userSnapshot.committedAt,
  ];
}

function getEvalSavePayloadArg(argList: unknown[]): string | null {
  if (argList.length !== 1 || typeof argList[0] !== "string") {
    return null;
  }

  return parseEvalSavePayload(argList[0]) ? argList[0] : null;
}

function hasEvalDeleteArgs(keyList: unknown[], argList: unknown[]): boolean {
  return (
    keyList.length === 9 &&
    argList.length === 2 &&
    parseEvalDeletePayload(argList) !== null
  );
}

async function tryEmulateDirectCardWrite(
  keyList: unknown[],
  argList: unknown[],
): Promise<unknown[] | null> {
  if (keyList.length !== 1 || argList.length < 2) {
    return null;
  }

  const [cardsKey] = keyList;
  const serializedCardData = argList[1];

  if (typeof cardsKey !== "string" || typeof serializedCardData !== "string") {
    return null;
  }

  await sharedRedisMockSet(cardsKey, serializedCardData);
  return [1];
}

export async function defaultRedisEval(
  _script: unknown,
  keys: unknown,
  args: unknown,
): Promise<unknown> {
  const keyList = Array.isArray(keys) ? keys : [];
  const argList = Array.isArray(args) ? args : [];

  const savePayload = getEvalSavePayloadArg(argList);
  if (savePayload) {
    return emulateAtomicUserSaveEval(keyList, savePayload);
  }

  if (hasEvalDeleteArgs(keyList, argList)) {
    return emulateAtomicUserDeleteEval(keyList, argList);
  }

  if (keyList.length === 5 && argList.length === 3) {
    return emulateAtomicStoreCardsEval(keyList, argList);
  }

  const directWriteResult = await tryEmulateDirectCardWrite(keyList, argList);
  if (directWriteResult) {
    return directWriteResult;
  }

  return [1];
}
