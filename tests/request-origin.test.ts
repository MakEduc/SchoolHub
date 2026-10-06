import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowedRequestOrigin } from "../src/lib/request-origin";

test("accepts the browser host when Next.js listens on an internal address", () => {
  assert.ok(isAllowedRequestOrigin("http://localhost:3100", "http://0.0.0.0:3100/api/studies", "localhost:3100"));
  assert.ok(isAllowedRequestOrigin("http://192.168.1.15:3000", "http://localhost:3000/api/studies", "192.168.1.15:3000"));
  assert.ok(isAllowedRequestOrigin("http://[::1]:3000", "http://localhost:3000/api/studies", "[::1]:3000"));
});

test("normalizes configured site URLs for deployment behind a proxy", () => {
  assert.ok(isAllowedRequestOrigin("https://school.example", "http://localhost:3000/api/studies", "school.example", "https://school.example/"));
});

test("rejects unrelated origins, different ports, and malformed hosts", () => {
  const url = "http://localhost:3000/api/studies";
  assert.equal(isAllowedRequestOrigin("https://attacker.example", url, "localhost:3000"), false);
  assert.equal(isAllowedRequestOrigin("http://localhost:4000", url, "localhost:3000"), false);
  assert.equal(isAllowedRequestOrigin("https://attacker.example", url, "localhost@attacker.example"), false);
  assert.equal(isAllowedRequestOrigin("null", url, "localhost:3000"), false);
});
