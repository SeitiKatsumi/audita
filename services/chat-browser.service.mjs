import crypto from "node:crypto";
import { chromium } from "playwright";

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const FINAL_ACTION_PATTERN =
  /\b(protocolar|ajuizar|assinar|enviar\s+(?:peti[cç][aã]o|processo)|confirmar\s+(?:envio|ajuizamento)|finalizar\s+(?:peti[cç][aã]o|protocolo))\b/i;

function envBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
}

function envNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeBaseUrl(value) {
  return String(value || "http://127.0.0.1:3000").replace(/\/+$/, "");
}

function normalizeOwner(owner = {}) {
  return {
    tenantId: owner.tenantId === undefined || owner.tenantId === null ? "" : String(owner.tenantId),
    userId: owner.userId === undefined || owner.userId === null ? "" : String(owner.userId),
  };
}

function ownerForbidden(session, auth) {
  if (!auth) return false;
  const owner = normalizeOwner(session?.owner);
  const requester = normalizeOwner({
    tenantId: auth.tenantId,
    userId: auth.userId ?? auth.user?.id,
  });
  if (owner.tenantId && owner.tenantId !== requester.tenantId) return true;
  if (owner.userId && owner.userId !== requester.userId) return true;
  return false;
}

function normalizeAllowedHosts(hosts = []) {
  return [...new Set(
    (Array.isArray(hosts) ? hosts : [])
      .map((host) => String(host || "").trim().toLowerCase().replace(/^\.+/, ""))
      .filter(Boolean),
  )];
}

function hostMatches(hostname, allowedHost) {
  return hostname === allowedHost || hostname.endsWith(`.${allowedHost}`);
}

export function validateChatBrowserPortalUrl(rawUrl, allowedHosts = [], {
  allowHttpLocal = false,
} = {}) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || ""));
  } catch {
    return { valid: false, reason: "invalid_portal_url" };
  }
  const isLocal =
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "localhost" ||
    parsed.hostname === "::1";
  if (parsed.protocol !== "https:" && !(allowHttpLocal && isLocal && parsed.protocol === "http:")) {
    return { valid: false, reason: "portal_https_required" };
  }
  const normalizedHosts = normalizeAllowedHosts(allowedHosts);
  if (!normalizedHosts.length || !normalizedHosts.some((host) => hostMatches(parsed.hostname.toLowerCase(), host))) {
    return { valid: false, reason: "portal_host_not_allowed" };
  }
  return { valid: true, url: parsed.toString(), hostname: parsed.hostname.toLowerCase() };
}

function replaceOrigin(rawUrl, baseUrl, protocol) {
  const parsed = new URL(String(rawUrl || ""), baseUrl);
  const target = new URL(baseUrl);
  parsed.protocol = protocol || target.protocol;
  parsed.hostname = target.hostname;
  parsed.port = target.port;
  return parsed.toString();
}

function steelWebSocketHeaders(baseUrl) {
  const target = new URL(baseUrl);
  return {
    Host: `localhost${target.port ? `:${target.port}` : ""}`,
  };
}

function getPage(session) {
  if (!session?.browser) return null;
  const contexts = session.browser.contexts();
  const pages = contexts.flatMap((context) => context.pages());
  return pages.at(-1) || null;
}

async function visibleLocator(locator) {
  const count = await locator.count().catch(() => 0);
  for (let index = 0; index < Math.min(count, 25); index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) return candidate;
  }
  return null;
}

function compactText(value, max = 160) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

async function collectFrameState(frame) {
  return frame.evaluate(() => {
    const clean = (value, max = 160) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
    const labelFor = (element) => {
      const explicit = element.id
        ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)
        : null;
      const wrapping = element.closest("label");
      return clean(
        explicit?.innerText ||
          wrapping?.innerText ||
          element.getAttribute("aria-label") ||
          element.getAttribute("placeholder") ||
          element.getAttribute("name") ||
          element.id,
      );
    };
    const visible = (element) => {
      const style = getComputedStyle(element);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        !element.disabled &&
        Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
      );
    };
    const controls = [...document.querySelectorAll("input, select, textarea")]
      .filter(visible)
      .slice(0, 80)
      .map((element) => {
        const type = element.tagName.toLowerCase() === "select"
          ? "select"
          : element.tagName.toLowerCase() === "textarea"
            ? "textarea"
            : element.type || "text";
        const value = type === "checkbox" || type === "radio"
          ? (element.checked ? "checked" : "")
          : element.value || "";
        return {
          label: labelFor(element),
          name: clean(element.name || element.id),
          type,
          filled: Boolean(value),
          valuePreview: /password/i.test(type) ? "" : clean(value, 80),
          options: element.tagName.toLowerCase() === "select"
            ? [...element.options].slice(0, 25).map((option) => clean(option.textContent || option.value, 80))
            : [],
        };
      });
    const actions = [...document.querySelectorAll("button, a[href], input[type='submit'], input[type='button']")]
      .filter(visible)
      .slice(0, 80)
      .map((element) => ({
        label: clean(
          element.innerText ||
            element.value ||
            element.getAttribute("aria-label") ||
            element.getAttribute("title"),
        ),
        tag: element.tagName.toLowerCase(),
        href: element.href || "",
      }))
      .filter((item) => item.label);
    return {
      title: document.title || "",
      url: location.href,
      text: (document.body?.innerText || "").slice(0, 10000),
      controls,
      actions,
    };
  }).catch(() => null);
}

async function readFormState(page) {
  const frames = page.frames();
  const snapshots = (await Promise.all(frames.map(collectFrameState))).filter(Boolean);
  const controls = snapshots.flatMap((snapshot) =>
    snapshot.controls.map((control) => ({ ...control, frameUrl: snapshot.url })),
  );
  const actions = snapshots.flatMap((snapshot) =>
    snapshot.actions.map((action) => ({ ...action, frameUrl: snapshot.url })),
  );
  return {
    filledCount: controls.filter((control) => control.filled).length,
    totalCount: controls.length,
    controls,
    actions,
    frames: snapshots.map(({ title, url, text }) => ({
      title,
      url,
      text: text.slice(0, 5000),
    })),
  };
}

async function findField(page, label) {
  const escaped = String(label || "").trim();
  if (!escaped) return null;
  for (const frame of page.frames()) {
    const locators = [
      frame.getByLabel(escaped, { exact: false }),
      frame.getByPlaceholder(escaped, { exact: false }),
      frame.getByRole("textbox", { name: escaped, exact: false }),
      frame.locator(
        `input[name*="${escaped.replace(/["\\]/g, "")}" i], select[name*="${escaped.replace(/["\\]/g, "")}" i], textarea[name*="${escaped.replace(/["\\]/g, "")}" i]`,
      ),
    ];
    for (const locator of locators) {
      const found = await visibleLocator(locator);
      if (found) return found;
    }
  }
  return null;
}

async function findTextTarget(page, label) {
  const text = String(label || "").trim();
  if (!text) return null;
  for (const frame of page.frames()) {
    const locators = [
      frame.getByRole("button", { name: text, exact: false }),
      frame.getByRole("link", { name: text, exact: false }),
      frame.getByText(text, { exact: false }),
    ];
    for (const locator of locators) {
      const found = await visibleLocator(locator);
      if (found) return found;
    }
  }
  return null;
}

export function rewriteSteelViewerHtml(html, websocketUrl) {
  const escaped = String(websocketUrl || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return String(html || "")
    .replace(
      /const\s+baseWsUrl\s*=\s*(['"])(?:\\.|(?!\1).)*\1\s*;/,
      `const baseWsUrl = '${escaped}';`,
    )
    .replace(
      /const parentHeight = container\.clientHeight;\s*\/\/ Scale to height while maintaining aspect ratio\s*const targetHeight = parentHeight;\s*const targetWidth = targetHeight \* \(tabData\.currentImageWidth \/ tabData\.currentImageHeight\);/,
      `const parentHeight = container.clientHeight;
              const parentWidth = container.clientWidth;
              const imageRatio = tabData.currentImageWidth / tabData.currentImageHeight;
              let targetWidth = parentWidth;
              let targetHeight = targetWidth / imageRatio;
              if (targetHeight > parentHeight) {
                  targetHeight = parentHeight;
                  targetWidth = targetHeight * imageRatio;
              }`,
    )
    .replace(
      /canvas\.style\.height = '100%';\s*canvas\.style\.width = 'auto';/,
      `canvas.style.height = targetHeight + 'px';
              canvas.style.width = targetWidth + 'px';`,
    )
    .replace(
      /ws\.onopen = \(\) => \{\s*console\.log\(`WebSocket connection opened for tab \$\{pageId\}`\);/,
      `ws.onopen = () => {
                  console.log(\`WebSocket connection opened for tab \${pageId}\`);
                  if (pageId !== 'tab-discovery') {
                      window.parent.postMessage({ type: 'audita-browser-status', status: 'online' }, window.location.origin);
                  }`,
    )
    .replace(
      /ws\.onclose = \(\) => \{\s*console\.log\(`WebSocket connection closed for tab \$\{pageId\}`\);/,
      `ws.onclose = () => {
                  console.log(\`WebSocket connection closed for tab \${pageId}\`);
                  if (activeTabId === pageId) {
                      window.parent.postMessage({ type: 'audita-browser-status', status: 'offline' }, window.location.origin);
                  }`,
    )
    .replace(
      /ws\.onerror = \(\) => \{\s*console\.log\(`WebSocket connection error for tab \$\{pageId\}`\);/,
      `ws.onerror = () => {
                  console.log(\`WebSocket connection error for tab \${pageId}\`);
                  if (pageId === 'tab-discovery' || activeTabId === pageId) {
                      window.parent.postMessage({ type: 'audita-browser-status', status: 'offline' }, window.location.origin);
                  }`,
    )
    .replace(
      /\s*\}\)\(\);\s*<\/script>\s*<\/body>/,
      `
          const auditaResizeObserver = new ResizeObserver(() => {
              for (const pageId of Object.keys(tabs)) updateCanvasSize(pageId);
          });
          auditaResizeObserver.observe(contentContainer);
    })();
    </script>
</body>`,
    )
    .replace(/<title>Steel Session Player<\/title>/i, "<title>Navegador Audita</title>");
}

export function createChatBrowserService({
  fetchImpl = globalThis.fetch,
  chromiumImpl = chromium,
  now = () => Date.now(),
  config = {},
} = {}) {
  const enabled = config.enabled ?? envBoolean(process.env.AUDITA_CHAT_LIVE_BROWSER_ENABLED, false);
  const provider = String(config.provider || process.env.AUDITA_CHAT_BROWSER_PROVIDER || "steel").toLowerCase();
  const baseUrl = normalizeBaseUrl(config.baseUrl || process.env.STEEL_BROWSER_URL);
  const timeoutMs = envNumber(
    config.timeoutMs || process.env.AUDITA_CHAT_BROWSER_SESSION_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
  );
  const maxSessions = envNumber(
    config.maxSessions || process.env.AUDITA_CHAT_BROWSER_MAX_SESSIONS,
    1,
  );
  const allowHttpLocal =
    config.allowHttpLocal ??
    envBoolean(process.env.AUDITA_CHAT_BROWSER_ALLOW_HTTP_LOCAL, false);
  const sessions = new Map();

  function publicSession(session) {
    if (!session) return null;
    return {
      id: session.id,
      provider: session.provider,
      transport: "live",
      live: true,
      status: session.status,
      controlMode: session.controlMode,
      courtName: session.courtName,
      courtUf: session.courtUf,
      portalUrl: session.portalUrl,
      title: session.title || session.courtName,
      url: session.url || session.portalUrl,
      viewerUrl: `/api/chat-browser-sessions/${encodeURIComponent(session.id)}/view`,
      finalSubmissionHumanOnly: session.finalSubmissionHumanOnly,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      expiresAt: new Date(session.expiresAt).toISOString(),
      agentSessionId: session.agentSessionId || "",
    };
  }

  async function health() {
    if (!enabled) {
      return { enabled: false, available: false, provider, reason: "disabled" };
    }
    if (provider !== "steel") {
      return { enabled: true, available: false, provider, reason: "unsupported_provider" };
    }
    try {
      const response = await fetchImpl(`${baseUrl}/v1/health`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(3000),
      });
      return {
        enabled: true,
        available: response.ok,
        provider,
        reason: response.ok ? "" : `steel_health_${response.status}`,
      };
    } catch (error) {
      return {
        enabled: true,
        available: false,
        provider,
        reason: error instanceof Error ? error.message : "steel_unavailable",
      };
    }
  }

  async function closeInternal(session) {
    if (!session || session.status === "closed") return;
    session.status = "closing";
    session.updatedAt = new Date().toISOString();
    await session.browser?.close().catch(() => {});
    await fetchImpl(`${baseUrl}/v1/sessions/${encodeURIComponent(session.providerSessionId)}/release`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    session.status = "closed";
    session.updatedAt = new Date().toISOString();
    sessions.delete(session.id);
  }

  async function open({
    portalUrl,
    courtName,
    courtUf,
    owner,
    purpose = "chat_browser",
    allowedHosts = [],
    finalSubmissionHumanOnly = true,
  }) {
    if (!enabled) return { unavailable: true, reason: "disabled" };
    if (provider !== "steel") return { unavailable: true, reason: "unsupported_provider" };
    const validated = validateChatBrowserPortalUrl(portalUrl, allowedHosts, { allowHttpLocal });
    if (!validated.valid) return { invalid: true, reason: validated.reason };
    const active = [...sessions.values()].filter((session) => session.status !== "closed");
    if (active.length >= maxSessions) {
      return { unavailable: true, reason: "browser_worker_busy" };
    }
    const readiness = await health();
    if (!readiness.available) return { unavailable: true, reason: readiness.reason };

    let providerSession;
    let browser;
    try {
      const createResponse = await fetchImpl(`${baseUrl}/v1/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          dimensions: { width: 1440, height: 900 },
          timezone: "America/Sao_Paulo",
          headless: true,
          skipFingerprintInjection: true,
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!createResponse.ok) {
        return { unavailable: true, reason: `steel_session_${createResponse.status}` };
      }
      providerSession = await createResponse.json();
      const cdpUrl = replaceOrigin(providerSession.websocketUrl || baseUrl, baseUrl, "ws:");
      browser = await chromiumImpl.connectOverCDP(cdpUrl, {
        timeout: 30000,
        headers: steelWebSocketHeaders(baseUrl),
      });
      const contexts = browser.contexts();
      const context = contexts[0] || await browser.newContext();
      const page = context.pages().at(-1) || await context.newPage();
      await page.goto(validated.url, { waitUntil: "domcontentloaded", timeout: 35000 });
      const createdAt = new Date().toISOString();
      const id = `cbs-${crypto.randomBytes(12).toString("base64url")}`;
      const session = {
        id,
        provider,
        providerSessionId: String(providerSession.id || ""),
        browser,
        owner: normalizeOwner(owner),
        purpose,
        allowedHosts: normalizeAllowedHosts(allowedHosts),
        finalSubmissionHumanOnly: Boolean(finalSubmissionHumanOnly),
        courtName: String(courtName || "Portal oficial"),
        courtUf: String(courtUf || "").toUpperCase(),
        portalUrl: validated.url,
        status: "live",
        controlMode: "agent",
        title: await page.title().catch(() => String(courtName || "Portal oficial")),
        url: page.url(),
        createdAt,
        updatedAt: createdAt,
        expiresAt: now() + timeoutMs,
        agentSessionId: "",
      };
      sessions.set(id, session);
      return { sessionId: id, session: publicSession(session) };
    } catch (error) {
      console.error("[chat-browser] Steel session startup failed", {
        stage: providerSession?.id ? "connect_or_navigate" : "create_session",
        message: error instanceof Error ? error.message : "Unknown error",
      });
      await browser?.close().catch(() => {});
      if (providerSession?.id) {
        await fetchImpl(`${baseUrl}/v1/sessions/${encodeURIComponent(providerSession.id)}/release`, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: "{}",
        }).catch(() => null);
      }
      return {
        unavailable: true,
        reason: "steel_session_start_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async function get(sessionId, auth) {
    const session = sessions.get(String(sessionId || ""));
    if (!session) return { notFound: true };
    if (ownerForbidden(session, auth)) return { forbidden: true };
    if (session.expiresAt <= now()) {
      await closeInternal(session);
      return { notFound: true, expired: true };
    }
    const page = getPage(session);
    if (
      !page ||
      page.isClosed?.() === true ||
      session.browser.isConnected?.() === false
    ) {
      session.status = "offline";
      return { ...publicSession(session), closed: true };
    }
    session.title = await page.title().catch(() => session.title);
    session.url = page.url();
    session.updatedAt = new Date().toISOString();
    return publicSession(session);
  }

  async function getView(sessionId, auth) {
    const session = sessions.get(String(sessionId || ""));
    if (!session) return { notFound: true };
    if (ownerForbidden(session, auth)) return { forbidden: true };
    if (session.expiresAt <= now()) {
      await closeInternal(session);
      return { notFound: true, expired: true };
    }
    const page = getPage(session);
    if (
      !page ||
      page.isClosed?.() === true ||
      session.browser.isConnected?.() === false
    ) {
      session.status = "offline";
      return { ...publicSession(session), closed: true };
    }
    const [title, screenshot, formState] = await Promise.all([
      page.title().catch(() => session.title),
      page.screenshot({ type: "jpeg", quality: 72, fullPage: false }).catch(() => null),
      readFormState(page),
    ]);
    session.title = title;
    session.url = page.url();
    session.updatedAt = new Date().toISOString();
    const combinedText = formState.frames.map((frame) => frame.text).join("\n").slice(0, 18000);
    const captchaPending = /captcha|recaptcha|hcaptcha|turnstile|cloudflare/i.test(
      `${combinedText} ${JSON.stringify(formState.actions)}`,
    );
    return {
      ...publicSession(session),
      closed: false,
      viewport: page.viewportSize() || { width: 1440, height: 900 },
      formState,
      outcome: { status: captchaPending ? "captcha_pending" : "in_progress" },
      screenshot: screenshot ? `data:image/jpeg;base64,${screenshot.toString("base64")}` : "",
    };
  }

  async function interact(sessionId, action = {}, auth) {
    const session = sessions.get(String(sessionId || ""));
    if (!session) return { notFound: true };
    if (ownerForbidden(session, auth)) return { forbidden: true };
    if (session.controlMode !== "agent") {
      return { invalid: true, reason: "human_has_control" };
    }
    const page = getPage(session);
    if (!page) return { closed: true };
    const type = String(action.type || "");
    const label = compactText(action.label || action.text || action.name, 240);
    if (
      session.finalSubmissionHumanOnly &&
      (type === "submit" || FINAL_ACTION_PATTERN.test(label))
    ) {
      return { invalid: true, reason: "final_submission_human_only" };
    }
    if (type === "clickText") {
      const target = await findTextTarget(page, label);
      if (!target) return { invalid: true, reason: "text_target_not_found" };
      await target.click();
    } else if (type === "fillField") {
      const field = await findField(page, action.label || action.name);
      if (!field) return { invalid: true, reason: "field_not_found" };
      await field.fill(String(action.value || ""));
    } else if (type === "selectField") {
      const field = await findField(page, action.label || action.name);
      if (!field) return { invalid: true, reason: "select_target_not_found" };
      const value = String(action.value || action.option || "");
      await field.selectOption({ label: value }).catch(() => field.selectOption(value));
    } else if (type === "type") {
      await page.keyboard.type(String(action.text || ""));
    } else if (type === "press") {
      await page.keyboard.press(String(action.key || ""));
    } else if (type === "scroll") {
      await page.mouse.wheel(Number(action.deltaX || 0), Number(action.deltaY || 0));
    } else if (type === "recover") {
      await page.goto(session.portalUrl, { waitUntil: "domcontentloaded", timeout: 35000 });
    } else if (type === "close") {
      await closeInternal(session);
      return { id: sessionId, closed: true };
    } else {
      return { invalid: true, reason: "unsupported_live_browser_action" };
    }
    await page.waitForTimeout(250);
    return getView(sessionId, auth);
  }

  async function setControl(sessionId, controlMode, auth) {
    const session = sessions.get(String(sessionId || ""));
    if (!session) return { notFound: true };
    if (ownerForbidden(session, auth)) return { forbidden: true };
    if (!["agent", "human"].includes(controlMode)) return { invalid: true };
    session.controlMode = controlMode;
    session.updatedAt = new Date().toISOString();
    return publicSession(session);
  }

  function attachAgent(sessionId, agentSessionId) {
    const session = sessions.get(String(sessionId || ""));
    if (!session) return null;
    session.agentSessionId = String(agentSessionId || "");
    session.updatedAt = new Date().toISOString();
    return publicSession(session);
  }

  async function close(sessionId, auth) {
    const session = sessions.get(String(sessionId || ""));
    if (!session) return { notFound: true };
    if (ownerForbidden(session, auth)) return { forbidden: true };
    await closeInternal(session);
    return { id: sessionId, closed: true };
  }

  async function viewerHtml(sessionId, auth, websocketUrl) {
    const owned = await get(sessionId, auth);
    if (owned.notFound || owned.forbidden) return owned;
    if (owned.closed || owned.status !== "live") {
      return { unavailable: true, reason: "chat_browser_session_offline" };
    }
    const response = await fetchImpl(
      `${baseUrl}/v1/sessions/debug?showControls=true&theme=dark&interactive=true`,
      {
        headers: { accept: "text/html" },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) return { unavailable: true, reason: `steel_viewer_${response.status}` };
    return {
      html: rewriteSteelViewerHtml(await response.text(), websocketUrl),
      session: owned,
    };
  }

  function upstreamCastUrl(sessionId, requestUrl = "") {
    const session = sessions.get(String(sessionId || ""));
    if (!session) return null;
    const requested = new URL(requestUrl || "/", "http://audita.local");
    const upstream = new URL("/v1/sessions/cast", baseUrl.replace(/^http/, "ws"));
    for (const [key, value] of requested.searchParams.entries()) {
      upstream.searchParams.set(key, value);
    }
    return upstream.toString();
  }

  function getRawOwnedSession(sessionId, auth) {
    const session = sessions.get(String(sessionId || ""));
    if (!session) return { notFound: true };
    if (ownerForbidden(session, auth)) return { forbidden: true };
    return session;
  }

  const cleanupTimer = setInterval(() => {
    for (const session of sessions.values()) {
      if (session.expiresAt <= now()) closeInternal(session).catch(() => {});
    }
  }, Math.min(60000, Math.max(5000, Math.floor(timeoutMs / 4))));
  cleanupTimer.unref?.();

  return {
    enabled,
    provider,
    baseUrl,
    health,
    open,
    get,
    getView,
    interact,
    setControl,
    attachAgent,
    close,
    viewerHtml,
    upstreamCastUrl,
    getRawOwnedSession,
    publicSession,
  };
}
