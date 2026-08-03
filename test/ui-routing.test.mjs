import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveUiRoute } from "../services/ui-routing.service.mjs";

const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");

test("serves the home entry point without redirecting to chat", () => {
  for (const pathname of ["/", "/index.html"]) {
    assert.deepEqual(resolveUiRoute(pathname), {
      type: "file",
      path: "/index.html",
    });
  }
});

test("normalizes the chat trailing slash route", () => {
  assert.deepEqual(resolveUiRoute("/chat/"), {
    type: "redirect",
    location: "/chat",
  });
});

test("serves the shared application document from the chat route", () => {
  assert.deepEqual(resolveUiRoute("/chat"), {
    type: "file",
    path: "/index.html",
  });
});

test("serves the commercial plans page from a stable route", () => {
  assert.deepEqual(resolveUiRoute("/planos/"), {
    type: "redirect",
    location: "/planos",
  });
  assert.deepEqual(resolveUiRoute("/planos"), {
    type: "file",
    path: "/plans.html",
  });
});

test("preserves API-independent static asset routes", () => {
  assert.deepEqual(resolveUiRoute("/app.js"), {
    type: "file",
    path: "/app.js",
  });
});

test("production image includes every root-level UI asset", () => {
  for (const file of [
    "index.html",
    "styles.css",
    "app.js",
    "billing-admin.js",
    "charge-analysis.js",
    "plans.html",
    "plans.css",
    "plans.js",
  ]) {
    assert.match(dockerfile, new RegExp(`\\b${file.replace(".", "\\.")}\\b`));
  }
});
