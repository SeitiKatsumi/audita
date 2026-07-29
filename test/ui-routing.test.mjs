import assert from "node:assert/strict";
import test from "node:test";

import { resolveUiRoute } from "../services/ui-routing.service.mjs";

test("redirects legacy UI entry points to chat", () => {
  for (const pathname of ["/", "/index.html", "/chat/"]) {
    assert.deepEqual(resolveUiRoute(pathname), {
      type: "redirect",
      location: "/chat",
    });
  }
});

test("serves the shared application document only from the chat route", () => {
  assert.deepEqual(resolveUiRoute("/chat"), {
    type: "file",
    path: "/index.html",
  });
});

test("preserves API-independent static asset routes", () => {
  assert.deepEqual(resolveUiRoute("/app.js"), {
    type: "file",
    path: "/app.js",
  });
});
