import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createChatBrowserService,
  rewriteSteelViewerHtml,
  validateChatBrowserPortalUrl,
} from "../services/chat-browser.service.mjs";

function createRuntime() {
  const calls = [];
  const page = {
    currentUrl: "about:blank",
    async goto(url) {
      this.currentUrl = url;
    },
    async title() {
      return "Portal de teste";
    },
    url() {
      return this.currentUrl;
    },
    frames() {
      return [
        {
          async evaluate() {
            return {
              title: "Portal de teste",
              url: page.currentUrl,
              text: "Formulario seguro",
              controls: [],
              actions: [{ label: "Continuar", tag: "button", href: "" }],
            };
          },
          getByLabel() {
            return emptyLocator;
          },
          getByPlaceholder() {
            return emptyLocator;
          },
          getByRole() {
            return emptyLocator;
          },
          getByText() {
            return emptyLocator;
          },
          locator() {
            return emptyLocator;
          },
        },
      ];
    },
    async screenshot() {
      return Buffer.from("jpeg");
    },
    viewportSize() {
      return { width: 1440, height: 900 };
    },
    keyboard: {
      async type() {},
      async press() {},
    },
    mouse: {
      async wheel() {},
    },
    async waitForTimeout() {},
  };
  const emptyLocator = {
    async count() {
      return 0;
    },
  };
  const context = {
    pages() {
      return [page];
    },
    async newPage() {
      return page;
    },
  };
  const browser = {
    contexts() {
      return [context];
    },
    async close() {},
  };
  const chromiumImpl = {
    async connectOverCDP(url, options) {
      calls.push({ type: "cdp", url, options });
      return browser;
    },
  };
  const fetchImpl = async (url, options = {}) => {
    calls.push({
      type: "fetch",
      url: String(url),
      method: options.method || "GET",
      contentType: options.headers?.["content-type"] || "",
      body: options.body || "",
    });
    if (String(url).endsWith("/v1/health")) {
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (String(url).endsWith("/v1/sessions") && options.method === "POST") {
      return new Response(
        JSON.stringify({
          id: "steel-1",
          websocketUrl: "ws://steel-internal:3000",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (String(url).includes("/v1/sessions/debug")) {
      return new Response(
        "<html><head><title>Steel Session Player</title></head><script>const baseWsUrl = 'ws://steel:3000/v1/sessions/cast';</script></html>",
        { status: 200, headers: { "content-type": "text/html" } },
      );
    }
    if (String(url).includes("/release")) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  };
  return { calls, page, chromiumImpl, fetchImpl };
}

test("portal URL must be HTTPS and belong to the explicit allowlist", () => {
  assert.equal(
    validateChatBrowserPortalUrl("https://esaj.tjsp.jus.br/teste", ["tjsp.jus.br"]).valid,
    true,
  );
  assert.equal(
    validateChatBrowserPortalUrl("http://esaj.tjsp.jus.br/teste", ["tjsp.jus.br"]).reason,
    "portal_https_required",
  );
  assert.equal(
    validateChatBrowserPortalUrl("https://example.com/teste", ["tjsp.jus.br"]).reason,
    "portal_host_not_allowed",
  );
});

test("Steel CDP connection uses a localhost Host header behind private service DNS", async () => {
  const { calls, chromiumImpl, fetchImpl } = createRuntime();
  const service = createChatBrowserService({
    chromiumImpl,
    fetchImpl,
    config: {
      enabled: true,
      baseUrl: "http://srv-captain--audita-steel:3000",
    },
  });

  const opened = await service.open({
    portalUrl: "https://esaj.tjsp.jus.br/teste",
    courtName: "TJSP",
    courtUf: "SP",
    allowedHosts: ["tjsp.jus.br"],
  });

  assert.ok(opened.sessionId);
  const cdp = calls.find((call) => call.type === "cdp");
  assert.equal(cdp.url, "ws://srv-captain--audita-steel:3000/");
  assert.equal(cdp.options.headers.Host, "localhost:3000");
  await service.close(opened.sessionId);
});

test("Steel viewer is rewritten to use the authenticated Audita websocket", () => {
  const output = rewriteSteelViewerHtml(
    `<title>Steel Session Player</title><script>(function(){
      const baseWsUrl = 'ws://steel:3000/v1/sessions/cast';
      let tabs = {};
      const contentContainer = document.body;
      const ws = {};
      const pageId = 'page-1';
      ws.onopen = () => {
        console.log(\`WebSocket connection opened for tab \${pageId}\`);
      };
      ws.onclose = () => {
        console.log(\`WebSocket connection closed for tab \${pageId}\`);
      };
      ws.onerror = () => {
        console.log(\`WebSocket connection error for tab \${pageId}\`);
      };
      function updateCanvasSize(pageId) {
        const container = tabs[pageId].canvasContainer;
        const canvas = tabs[pageId].canvas;
        const parentHeight = container.clientHeight;
        // Scale to height while maintaining aspect ratio
        const targetHeight = parentHeight;
        const targetWidth = targetHeight * (tabData.currentImageWidth / tabData.currentImageHeight);
        canvas.style.height = '100%';
        canvas.style.width = 'auto';
      }
    })();</script></body>`,
    "wss://audita.example/api/chat-browser-sessions/cbs-1/cast",
  );
  assert.match(output, /Navegador Audita/);
  assert.match(output, /wss:\/\/audita\.example\/api\/chat-browser-sessions\/cbs-1\/cast/);
  assert.doesNotMatch(output, /ws:\/\/steel:3000/);
  assert.match(output, /container\.clientWidth/);
  assert.match(output, /ResizeObserver/);
  assert.match(output, /audita-browser-status/);
});

test("disabled live browser reports an explicit unavailable state for fallback", async () => {
  const service = createChatBrowserService({ config: { enabled: false } });
  const result = await service.open({
    portalUrl: "https://esaj.tjsp.jus.br/teste",
    allowedHosts: ["tjsp.jus.br"],
  });
  assert.equal(result.unavailable, true);
  assert.equal(result.reason, "disabled");
});

test("live session shares one Steel browser while preserving tenant ownership", async () => {
  const runtime = createRuntime();
  const service = createChatBrowserService({
    fetchImpl: runtime.fetchImpl,
    chromiumImpl: runtime.chromiumImpl,
    config: {
      enabled: true,
      baseUrl: "http://127.0.0.1:3000",
      maxSessions: 1,
    },
  });
  const opened = await service.open({
    portalUrl: "https://esaj.tjsp.jus.br/teste",
    courtName: "TJSP",
    courtUf: "SP",
    owner: { tenantId: "tenant-a", userId: "user-a" },
    allowedHosts: ["tjsp.jus.br"],
    finalSubmissionHumanOnly: true,
  });

  assert.equal(opened.session.live, true);
  assert.equal(opened.session.transport, "live");
  assert.match(opened.session.viewerUrl, /^\/api\/chat-browser-sessions\//);
  assert.equal(runtime.page.currentUrl, "https://esaj.tjsp.jus.br/teste");
  assert.equal(
    runtime.calls.find((call) => call.type === "cdp").url,
    "ws://127.0.0.1:3000/",
  );

  const forbidden = await service.get(opened.sessionId, {
    tenantId: "tenant-b",
    user: { id: "user-b" },
  });
  assert.equal(forbidden.forbidden, true);

  const owned = await service.get(opened.sessionId, {
    tenantId: "tenant-a",
    user: { id: "user-a" },
  });
  assert.equal(owned.controlMode, "agent");

  await service.close(opened.sessionId, {
    tenantId: "tenant-a",
    user: { id: "user-a" },
  });
  const releaseCall = runtime.calls.find((call) => call.url.includes("/release"));
  assert.equal(releaseCall.contentType, "application/json");
  assert.equal(releaseCall.body, "{}");
});

test("human takeover blocks agent interaction and return restores it", async () => {
  const runtime = createRuntime();
  const service = createChatBrowserService({
    fetchImpl: runtime.fetchImpl,
    chromiumImpl: runtime.chromiumImpl,
    config: { enabled: true, baseUrl: "http://127.0.0.1:3000" },
  });
  const auth = { tenantId: "tenant-a", user: { id: "user-a" } };
  const opened = await service.open({
    portalUrl: "https://esaj.tjsp.jus.br/teste",
    owner: { tenantId: "tenant-a", userId: "user-a" },
    allowedHosts: ["tjsp.jus.br"],
  });

  const takeover = await service.setControl(opened.sessionId, "human", auth);
  assert.equal(takeover.controlMode, "human");
  const blocked = await service.interact(opened.sessionId, { type: "scroll", deltaY: 300 });
  assert.equal(blocked.reason, "human_has_control");

  const returned = await service.setControl(opened.sessionId, "agent", auth);
  assert.equal(returned.controlMode, "agent");
  const scrolled = await service.interact(opened.sessionId, { type: "scroll", deltaY: 300 });
  assert.equal(scrolled.closed, false);
});

test("agent can never execute the final legal submission", async () => {
  const runtime = createRuntime();
  const service = createChatBrowserService({
    fetchImpl: runtime.fetchImpl,
    chromiumImpl: runtime.chromiumImpl,
    config: { enabled: true, baseUrl: "http://127.0.0.1:3000" },
  });
  const opened = await service.open({
    portalUrl: "https://esaj.tjsp.jus.br/teste",
    owner: { tenantId: "tenant-a", userId: "user-a" },
    allowedHosts: ["tjsp.jus.br"],
    finalSubmissionHumanOnly: true,
  });

  const directSubmit = await service.interact(opened.sessionId, { type: "submit" });
  const textSubmit = await service.interact(opened.sessionId, {
    type: "clickText",
    label: "Protocolar petição",
  });
  assert.equal(directSubmit.reason, "final_submission_human_only");
  assert.equal(textSubmit.reason, "final_submission_human_only");
});

test("chat UI contains a dedicated live browser pane without changing certificate markup", async () => {
  const [html, app, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(html, /id="chatBrowserPane"/);
  assert.match(html, /id="chatBrowserTakeover"/);
  assert.match(html, /id="chatBrowserReconnect"/);
  assert.match(app, /openChatBrowserPane/);
  assert.match(app, /chatBrowserAction\("takeover"\)/);
  assert.match(app, /renderActiveJecFlow/);
  assert.match(app, /browserSessionId:\s*activeChatBrowserSession\?\.id/);
  assert.doesNotMatch(
    app.match(/function renderItauCaseCard[\s\S]+?function getActiveJecFlow/)?.[0] || "",
    /\$\{renderJecPetitionPanel\(caseData\)\}/,
  );
  assert.match(css, /\.chat-page\.browser-open/);
  assert.match(css, /\.chat-browser-pane\[data-control="human"\]/);
  assert.match(html, /id="auditForm"/);
});
