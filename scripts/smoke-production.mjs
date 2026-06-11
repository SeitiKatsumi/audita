const baseUrl = String(process.env.AUDITA_BASE_URL || process.argv[2] || "").replace(/\/+$/, "");

if (!baseUrl) {
  console.error("Usage: AUDITA_BASE_URL=https://audita.example.com npm run smoke:production");
  process.exit(1);
}

async function fetchJson(path) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { accept: "application/json" } });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${path} did not return JSON: ${text.slice(0, 160)}`);
  }
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function fetchText(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}: ${text.slice(0, 160)}`);
  }
  return text;
}

const failures = [];

function check(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

const health = await fetchJson("/api/health");
check(health.status === "ok", "/api/health status must be ok");
check(Boolean(health.version), "/api/health must expose version");

if (health.database?.configured) {
  check(health.database.ready === true, "database must be ready when configured");
}

const config = await fetchJson("/api/config");
check(config.environment === "production", "APP_ENV should be production");
check(config.authRequired === true, "AUDITA_AUTH_REQUIRED should be true in production");

const html = await fetchText("/");
check(/Audita/i.test(html), "root HTML should contain Audita");

if (failures.length) {
  console.error("Smoke test failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error(JSON.stringify({ health, config }, null, 2));
  process.exit(1);
}

console.log("Smoke test passed.");
console.log(JSON.stringify({ baseUrl, version: health.version, environment: config.environment }, null, 2));
