import { describe, expect, it, mock } from "bun:test";
import type { Redis } from "@upstash/redis";
import { buildUsernameIndexKey, syncUsernameIndex } from "@/lib/server/username-index";

describe("username index", () => {
  it("normalizes usernames and ignores blank values", () => {
    expect(buildUsernameIndexKey("  Example  ")).toBe("username:example");
    expect(buildUsernameIndexKey("  ")).toBeNull();
  });

  it("sets the new key and removes the old key only if owned", async () => {
    const set = mock(async () => "OK");
    const evaluate = mock(async (_script: string, _keys: string[], _args: string[]) => 1);
    const redis = { set, eval: evaluate } as unknown as Redis;
    expect(await syncUsernameIndex(redis, "username:old", "username:new", 12)).toBe(true);
    expect(set).toHaveBeenCalledWith("username:new", "12");
    expect(evaluate.mock.calls[0][1]).toEqual(["username:old"]);
    expect(evaluate.mock.calls[0][2]).toEqual(["12"]);
  });

  it("does not delete an unchanged key", async () => {
    const set = mock(async () => "OK");
    const evaluate = mock(async () => 0);
    const redis = { set, eval: evaluate } as unknown as Redis;
    expect(await syncUsernameIndex(redis, "username:same", "username:same", 12)).toBe(false);
    expect(evaluate).not.toHaveBeenCalled();
  });
});