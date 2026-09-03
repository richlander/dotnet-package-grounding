import assert from "node:assert/strict";
import test from "node:test";
import { childEnvironment } from "../scripts/isolation.mjs";

test("agent environment excludes unrelated host secrets", () => {
  process.env.AWS_SECRET_ACCESS_KEY = "not-for-the-agent";
  process.env.NPM_TOKEN = "not-for-the-agent";
  const env = childEnvironment({ env: { HOME: "/tmp/eval-home" } });
  assert.equal(env.AWS_SECRET_ACCESS_KEY, undefined);
  assert.equal(env.NPM_TOKEN, undefined);
  assert.equal(env.HOME, "/tmp/eval-home");
  delete process.env.AWS_SECRET_ACCESS_KEY;
  delete process.env.NPM_TOKEN;
});
