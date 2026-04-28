const canvas = document.querySelector("#signalCanvas");
const ctx = canvas.getContext("2d");
const riskScore = document.querySelector("#riskScore");
const assistantText = document.querySelector("#assistantText");
const reportButton = document.querySelector("#generateReport");
const metricCards = document.querySelectorAll(".metrics article");
const signalList = document.querySelector(".signal-list");
const loginScreen = document.querySelector("#loginScreen");
const loginForm = document.querySelector("#loginForm");
const loginEmail = document.querySelector("#loginEmail");
const loginPassword = document.querySelector("#loginPassword");
const loginError = document.querySelector("#loginError");
const logoutButton = document.querySelector("#logoutButton");
const environmentName = document.querySelector("#environmentName");
const environmentDetail = document.querySelector("#environmentDetail");
const consultationForm = document.querySelector("#consultationForm");
const consultationModule = document.querySelector("#consultationModule");
const subjectType = document.querySelector("#subjectType");
const subjectIdentifier = document.querySelector("#subjectIdentifier");
const consultationError = document.querySelector("#consultationError");
const moduleList = document.querySelector("#moduleList");
const consultationHistory = document.querySelector("#consultationHistory");
const sourceForm = document.querySelector("#sourceForm");
const sourceName = document.querySelector("#sourceName");
const sourceAgency = document.querySelector("#sourceAgency");
const sourceCategory = document.querySelector("#sourceCategory");
const sourceBaseUrl = document.querySelector("#sourceBaseUrl");
const sourceAccessMethod = document.querySelector("#sourceAccessMethod");
const sourceAuthType = document.querySelector("#sourceAuthType");
const sourceSecretRef = document.querySelector("#sourceSecretRef");
const sourceStatus = document.querySelector("#sourceStatus");
const sourceSchemaNotes = document.querySelector("#sourceSchemaNotes");
const sourceError = document.querySelector("#sourceError");
const sourceList = document.querySelector("#sourceList");
const agentForm = document.querySelector("#agentForm");
const agentQuestion = document.querySelector("#agentQuestion");
const agentAnswer = document.querySelector("#agentAnswer");
const promptSuggestions = document.querySelectorAll("[data-question]");

let phase = 0;

function drawSignal() {
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const gridColor = "rgba(88, 232, 224, 0.14)";
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;

  for (let x = 0; x < width; x += 38) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y < height; y += 38) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const gradients = [
    ["rgba(51, 204, 255, 0.95)", 64, 0.9],
    ["rgba(143, 215, 255, 0.82)", 104, 0.7],
    ["rgba(41, 119, 255, 0.74)", 145, 0.54],
  ];

  gradients.forEach(([color, offset, amp], index) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = index === 0 ? 3 : 2;

    for (let x = 0; x < width; x += 6) {
      const y =
        height * 0.58 +
        Math.sin((x + phase * (1.5 + index)) / offset) * 46 * amp +
        Math.cos((x - phase * 1.2) / (offset * 0.42)) * 18;

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  });

  for (let i = 0; i < 22; i += 1) {
    const x = (i * 73 + phase * 1.8) % width;
    const y = height * 0.52 + Math.sin((i + phase / 18) * 1.7) * 112;
    const radius = 2 + ((i + Math.floor(phase / 10)) % 3);

    ctx.beginPath();
    ctx.fillStyle = i % 5 === 0 ? "rgba(255, 99, 125, 0.86)" : "rgba(143, 215, 255, 0.84)";
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  phase += 1;
  requestAnimationFrame(drawSignal);
}

function rotateRisk() {
  const base = 68 + Math.round(Math.sin(Date.now() / 1800) * 6);
  riskScore.textContent = String(base);
}

reportButton.addEventListener("click", () => {
  assistantText.textContent =
    "Relatorio executivo preparado: 9 alertas consolidados, 3 prioridades criticas, 4 fontes verificadas e recomendacao de revisao fiscal imediata antes da aprovacao final.";
});

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderDashboard(data) {
  const metrics = data.metrics || {};
  const values = [
    formatNumber(metrics.consultationsToday || 0),
    formatNumber(metrics.connectedSources || 0),
    formatNumber(metrics.criticalAlerts || 0),
    metrics.averageAnalysisTime || "0s",
  ];

  metricCards.forEach((card, index) => {
    const value = card.querySelector("strong");
    if (value && values[index]) {
      value.textContent = values[index];
    }
  });

  if (Array.isArray(data.signals) && data.signals.length > 0) {
    signalList.innerHTML = data.signals
      .map(
        (signal) => `
          <li>
            <span class="severity ${escapeHtml(signal.severity)}"></span>
            <div>
              <strong>${escapeHtml(signal.title)}</strong>
              <small>${escapeHtml(signal.description)}</small>
            </div>
          </li>
        `,
      )
      .join("");
  }

  if (data.assistantSummary) {
    assistantText.textContent = data.assistantSummary;
  }
}

function renderModules(modules) {
  consultationModule.innerHTML = modules
    .map((module) => `<option value="${escapeHtml(module.slug)}">${escapeHtml(module.name)}</option>`)
    .join("");

  moduleList.innerHTML = modules
    .map(
      (module) => `
        <article class="module-item">
          <div>
            <strong>${escapeHtml(module.name)}</strong>
            <small>${escapeHtml(module.provider)} | ${escapeHtml(module.accessMethod)}</small>
          </div>
          <span class="module-status ${escapeHtml(module.status)}">${escapeHtml(module.status)}</span>
          <p>${escapeHtml(module.description)}</p>
        </article>
      `,
    )
    .join("");
}

function renderConsultations(consultations) {
  if (!Array.isArray(consultations) || consultations.length === 0) {
    consultationHistory.innerHTML = `<p class="empty-state">Nenhuma consulta registrada ainda.</p>`;
    return;
  }

  consultationHistory.innerHTML = consultations
    .map(
      (consultation) => `
        <article class="history-item">
          <div>
            <strong>${escapeHtml(consultation.moduleName)}</strong>
            <small>${escapeHtml(consultation.subjectType)} | ${escapeHtml(consultation.subjectIdentifierMasked)}</small>
          </div>
          <span class="module-status ${escapeHtml(consultation.status)}">${escapeHtml(consultation.status)}</span>
          <p>${escapeHtml(consultation.resultSummary || "Consulta registrada.")}</p>
        </article>
      `,
    )
    .join("");
}

function renderSources(sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    sourceList.innerHTML = `<p class="empty-state">Nenhuma fonte configurada ainda.</p>`;
    return;
  }

  sourceList.innerHTML = sources
    .map(
      (source) => `
        <article class="source-item">
          <div>
            <strong>${escapeHtml(source.name)}</strong>
            <small>${escapeHtml(source.agency)} | ${escapeHtml(source.category)} | ${escapeHtml(source.accessMethod)}</small>
          </div>
          <span class="module-status ${escapeHtml(source.status)}">${escapeHtml(source.status)}</span>
          <p>${escapeHtml(source.baseUrl)}</p>
          <small>Normalizacao: ${escapeHtml(source.normalizationStatus)}${source.secretRef ? " | Secret referenciado" : ""}</small>
        </article>
      `,
    )
    .join("");
}

function renderAgentAnswer(result) {
  const records = Array.isArray(result.records) ? result.records.slice(0, 8) : [];
  agentAnswer.innerHTML = `
    <strong>${escapeHtml(result.source)}</strong>
    <p>${escapeHtml(result.answer)}</p>
    ${
      records.length
        ? `<div class="agent-records">${records
            .map(
              (record) => `
                <span>${escapeHtml(
                  record.sigla
                    ? `${record.sigla} - ${record.nome}`
                    : record.descricao
                      ? `${record.id} - ${record.descricao}`
                      : record.nome || record.id,
                )}</span>
              `,
            )
            .join("")}</div>`
        : ""
    }
  `;
}

async function loadModules() {
  try {
    const response = await fetch("/api/modules", { headers: { accept: "application/json" } });
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    renderModules(data.modules || []);
  } catch {
    moduleList.innerHTML = `<p class="empty-state">Nao foi possivel carregar os modulos.</p>`;
  }
}

async function loadConsultations() {
  try {
    const response = await fetch("/api/consultations", { headers: { accept: "application/json" } });
    if (response.status === 401) {
      renderConsultations([]);
      return;
    }
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    renderConsultations(data.consultations || []);
  } catch {
    renderConsultations([]);
  }
}

async function loadSources() {
  try {
    const response = await fetch("/api/integrations/sources", { headers: { accept: "application/json" } });
    if (response.status === 401) {
      renderSources([]);
      return;
    }
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    renderSources(data.sources || []);
  } catch {
    renderSources([]);
  }
}

function showLogin(message = "") {
  loginScreen.classList.remove("hidden");
  loginError.textContent = message;
  logoutButton.classList.add("hidden");
  loginEmail.focus();
}

function hideLogin() {
  loginScreen.classList.add("hidden");
  loginError.textContent = "";
}

async function loadAuthState() {
  try {
    const response = await fetch("/api/auth/me", { headers: { accept: "application/json" } });
    if (!response.ok) {
      return { authRequired: false, user: null };
    }
    return response.json();
  } catch {
    return { authRequired: false, user: null };
  }
}

function formatEnvironmentName(environment) {
  const names = {
    local: "Local",
    development: "Desenvolvimento",
    staging: "Staging",
    production: "Producao",
  };

  return names[environment] || environment;
}

async function loadAppConfig() {
  try {
    const response = await fetch("/api/config", { headers: { accept: "application/json" } });
    if (!response.ok) {
      return;
    }

    const config = await response.json();
    environmentName.textContent = formatEnvironmentName(config.environment || "local");
    environmentDetail.textContent = config.appUrl ? new URL(config.appUrl).hostname : "Ambiente Audita";
  } catch {
    environmentName.textContent = "Local";
    environmentDetail.textContent = "Ambiente Audita";
  }
}

async function loadDashboard() {
  try {
    const response = await fetch("/api/dashboard", { headers: { accept: "application/json" } });
    if (response.status === 401) {
      showLogin("Entre para acessar o dashboard.");
      return;
    }
    if (!response.ok) {
      return;
    }
    renderDashboard(await response.json());
  } catch {
    // The static demo remains available when the API is not reachable.
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        email: loginEmail.value,
        password: loginPassword.value,
      }),
    });

    if (!response.ok) {
      showLogin("E-mail ou senha invalidos.");
      return;
    }

    loginPassword.value = "";
    hideLogin();
    logoutButton.classList.remove("hidden");
    await loadDashboard();
    await loadConsultations();
    await loadSources();
  } catch {
    showLogin("Nao foi possivel autenticar agora.");
  }
});

sourceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  sourceError.textContent = "";

  try {
    const response = await fetch("/api/integrations/sources", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        name: sourceName.value,
        agency: sourceAgency.value,
        category: sourceCategory.value,
        baseUrl: sourceBaseUrl.value,
        accessMethod: sourceAccessMethod.value,
        authType: sourceAuthType.value,
        secretRef: sourceSecretRef.value,
        status: sourceStatus.value,
        schemaNotes: sourceSchemaNotes.value,
      }),
    });

    if (response.status === 401) {
      showLogin("Entre para gerenciar integracoes.");
      return;
    }
    if (response.status === 403) {
      sourceError.textContent = "Seu usuario nao tem permissao para gerenciar fontes.";
      return;
    }
    if (!response.ok) {
      sourceError.textContent = "Nao foi possivel salvar a fonte.";
      return;
    }

    sourceForm.reset();
    await loadSources();
  } catch {
    sourceError.textContent = "Falha ao comunicar com a API.";
  }
});

promptSuggestions.forEach((button) => {
  button.addEventListener("click", () => {
    agentQuestion.value = button.dataset.question || "";
    agentQuestion.focus();
  });
});

agentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  agentAnswer.innerHTML = `<p>Consultando a fonte oficial...</p>`;

  try {
    const response = await fetch("/api/agent/query", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ question: agentQuestion.value }),
    });

    if (response.status === 401) {
      showLogin("Entre para usar o agente.");
      return;
    }

    if (!response.ok) {
      agentAnswer.innerHTML = `<p>Nao consegui consultar essa fonte agora. Tente outra pergunta.</p>`;
      return;
    }

    renderAgentAnswer(await response.json());
  } catch {
    agentAnswer.innerHTML = `<p>Falha ao comunicar com o agente.</p>`;
  }
});

consultationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  consultationError.textContent = "";

  try {
    const response = await fetch("/api/consultations", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        moduleSlug: consultationModule.value,
        subjectType: subjectType.value,
        subjectIdentifier: subjectIdentifier.value,
      }),
    });

    if (response.status === 401) {
      showLogin("Entre para registrar consultas.");
      return;
    }

    if (!response.ok) {
      consultationError.textContent = "Nao foi possivel registrar a consulta.";
      return;
    }

    subjectIdentifier.value = "";
    await loadConsultations();
  } catch {
    consultationError.textContent = "Falha ao comunicar com a API.";
  }
});

logoutButton.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  showLogin("Sessao encerrada.");
});

setInterval(rotateRisk, 1400);
drawSignal();

await loadAppConfig();
await loadModules();
const authState = await loadAuthState();
if (authState.authRequired && !authState.user) {
  showLogin();
} else {
  if (authState.user) {
    logoutButton.classList.remove("hidden");
  }
  await loadDashboard();
  await loadConsultations();
  await loadSources();
}
