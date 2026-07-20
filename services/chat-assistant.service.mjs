const DEFAULT_MODEL = "gpt-5-mini";
const DEFAULT_TIMEOUT_MS = 90000;
const DEFAULT_MAX_TURNS = 8;

export const AUDITA_CHAT_CAPABILITIES = [
  {
    id: "state_courts",
    name: "Certidoes estaduais",
    description: "Emissao e acompanhamento de certidoes nos tribunais estaduais.",
    status: "active_assisted",
    statusLabel: "Ativa, com assistencia humana quando necessaria",
    route: "/#consulta-tjdft-pf",
  },
  {
    id: "property_search",
    name: "Busca de imoveis",
    description: "Pesquisa patrimonial pela estrutura ONR / RI Digital.",
    status: "homologation",
    statusLabel: "Em homologacao; ainda nao disponivel como consulta final",
    route: "/#consulta-imoveis",
  },
  {
    id: "asset_unavailability",
    name: "Indisponibilidade de bens",
    description: "Triagem de ocorrencias de indisponibilidade por CPF ou CNPJ.",
    status: "provider_required",
    statusLabel: "Aguardando provedor; consulta real ainda indisponivel",
    route: "/#consulta-cnib",
  },
  {
    id: "audit_history",
    name: "Historico de consultas",
    description: "Revisao de consultas e evidencias registradas no Audita.",
    status: "active",
    statusLabel: "Ativa",
    route: "/#historico",
  },
  {
    id: "ibge",
    name: "IBGE",
    description: "Consulta publica de estados e municipios brasileiros.",
    status: "active",
    statusLabel: "Ativa",
    route: "",
  },
];

const MODULE_ACTIONS = {
  state_courts: {
    label: "Abrir certid\u00f5es estaduais",
    title: "Certid\u00f5es estaduais",
    description: "Continue no formul\u00e1rio seguro do Audita para informar documento, estado e autoriza\u00e7\u00e3o.",
    route: "/#consulta-tjdft-pf",
  },
  property_search: {
    label: "Abrir busca de im\u00f3veis",
    title: "Busca de im\u00f3veis",
    description: "Veja as modalidades dispon\u00edveis e os requisitos de credenciamento do m\u00f3dulo imobili\u00e1rio.",
    route: "/#consulta-imoveis",
  },
  asset_unavailability: {
    label: "Abrir indisponibilidade",
    title: "Indisponibilidade de bens",
    description: "Abra o m\u00f3dulo para validar a fonte habilitada e iniciar uma consulta autorizada.",
    route: "/#consulta-cnib",
  },
  audit_history: {
    label: "Ver hist\u00f3rico",
    title: "Hist\u00f3rico de consultas",
    description: "Revise consultas anteriores, status e evid\u00eancias armazenadas.",
    route: "/#historico",
  },
};

function envNumber(env, key, fallback) {
  const value = Number(env?.[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function maskSensitiveIdentifiers(value) {
  return String(value || "")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF informado]")
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[CNPJ informado]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[e-mail informado]");
}

export function normalizeChatMessages(messages) {
  if (!Array.isArray(messages)) return [];

  const normalized = messages
    .filter((message) => ["user", "assistant"].includes(message?.role))
    .map((message) => ({
      role: message.role,
      content: maskSensitiveIdentifiers(String(message.content || "").trim()).slice(0, 5000),
    }))
    .filter((message) => message.content)
    .slice(-24);

  let total = 0;
  return normalized
    .reverse()
    .filter((message) => {
      total += message.content.length;
      return total <= 24000;
    })
    .reverse();
}

export function buildAuditaChatInstructions(customPrompt = "") {
  return [
    "Voce e a Audita IA, uma assistente conversacional especializada em consultas, documentos e analises juridicas no Brasil.",
    "Seu papel e entender o objetivo do usuario, explicar o caminho com clareza e usar as ferramentas do Audita quando elas forem pertinentes.",
    "Nunca afirme que uma consulta foi executada se uma ferramenta apenas preparou ou abriu um modulo.",
    "Nunca invente certidoes, processos, saldos, protocolos, ocorrencias ou conclusoes juridicas.",
    "Quando faltar contexto, faca uma pergunta curta por vez.",
    "Nao solicite CPF, CNPJ, senha, certificado digital ou dados pessoais no chat. Encaminhe o usuario ao formulario seguro do modulo apropriado.",
    "Diferencie dado oficial, dado de provedor, inferencia e orientacao geral.",
    "Use os rotulos de status em portugues e nunca exponha identificadores internos como active_assisted, homologation ou provider_required.",
    "Em temas de risco, informe limitacoes e recomende validacao profissional quando houver efeito juridico relevante.",
    "Responda em portugues do Brasil, em linguagem natural, objetiva e acolhedora.",
    "Use listas apenas quando ajudarem. Termine com uma proxima acao concreta quando houver uma.",
    customPrompt ? `Diretriz adicional configurada pelo tenant: ${customPrompt}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildTranscript(messages, userName) {
  const transcript = messages
    .map((message) => `${message.role === "assistant" ? "AUDITA" : "USUARIO"}: ${message.content}`)
    .join("\n\n");

  return [
    userName ? `Nome do usuario autenticado: ${userName}` : "",
    "Conversa atual:",
    transcript,
    "Responda a ultima mensagem considerando o historico e usando ferramentas quando necessario.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildModuleRoute(moduleId, uf) {
  const action = MODULE_ACTIONS[moduleId];
  if (!action) return null;
  const normalizedUf = String(uf || "").trim().toUpperCase();
  const route = moduleId === "state_courts" && /^[A-Z]{2}$/.test(normalizedUf)
    ? `/?uf=${encodeURIComponent(normalizedUf)}#consulta-tjdft-pf`
    : action.route;
  return { ...action, moduleId, route, uf: normalizedUf || "" };
}

function addUniqueAction(actions, action) {
  if (!action || actions.some((item) => item.moduleId === action.moduleId && item.route === action.route)) return;
  actions.push(action);
}

function addUniqueSource(sources, source) {
  if (!source || sources.some((item) => item.url === source.url)) return;
  sources.push(source);
}

function buildChatTools({ tool, z, actions, sources }) {
  return [
    tool({
      name: "listar_capacidades_audita",
      description: "Lista os modulos e fontes que a Audita pode usar, incluindo o status real de cada integracao.",
      parameters: z.object({}),
      execute: async () => ({ capabilities: AUDITA_CHAT_CAPABILITIES }),
    }),
    tool({
      name: "preparar_fluxo_audita",
      description: "Prepara a proxima acao no Audita para certidoes estaduais, busca de imoveis, indisponibilidade de bens ou historico.",
      parameters: z.object({
        module: z.enum(["state_courts", "property_search", "asset_unavailability", "audit_history"]),
        uf: z.string().optional(),
        reason: z.string().optional(),
      }),
      execute: async ({ module, uf, reason }) => {
        const action = buildModuleRoute(module, uf);
        addUniqueAction(actions, action);
        return {
          status: "prepared",
          reason: reason || "Fluxo preparado para continuacao segura no Audita.",
          action,
          note: "A consulta ainda nao foi executada. O usuario deve revisar os dados e confirmar a base legal no formulario.",
        };
      },
    }),
    tool({
      name: "consultar_ibge",
      description: "Consulta a API publica do IBGE para listar estados ou municipios de uma UF.",
      parameters: z.object({
        query: z.enum(["states", "municipalities"]),
        uf: z.string().optional(),
      }),
      execute: async ({ query, uf }) => {
        const normalizedUf = String(uf || "").trim().toUpperCase();
        if (query === "municipalities" && !/^[A-Z]{2}$/.test(normalizedUf)) {
          return { status: "missing_uf", message: "Informe a UF para consultar municipios." };
        }

        const url = query === "states"
          ? "https://servicodados.ibge.gov.br/api/v1/localidades/estados"
          : `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${normalizedUf}/municipios`;
        const response = await fetch(url, { headers: { accept: "application/json" } });
        if (!response.ok) throw new Error(`IBGE retornou HTTP ${response.status}`);
        const data = await response.json();
        const records = (Array.isArray(data) ? data : []).slice(0, 120).map((item) => ({
          id: item.id,
          name: item.nome,
          uf: item.sigla || normalizedUf,
          region: item.regiao?.nome || "",
        }));
        const source = { name: "IBGE Localidades", url };
        addUniqueSource(sources, source);
        return { status: "success", count: Array.isArray(data) ? data.length : 0, records, source };
      },
    }),
  ];
}

export async function runAuditaChat({ messages, settings = {}, userName = "", env = process.env } = {}) {
  const normalizedMessages = normalizeChatMessages(messages);
  if (!normalizedMessages.length || normalizedMessages.at(-1)?.role !== "user") {
    return { invalid: true };
  }

  const secretRef = String(env.AUDITA_CHAT_API_KEY_SECRET || settings.apiKeySecretRef || "OPENAI_API_KEY").trim();
  const apiKey = env[secretRef];
  if (!apiKey || apiKey === "change-me") {
    return { unavailable: true, reason: "openai_not_configured", secretRef };
  }

  const { Agent, Runner, tool } = await import("@openai/agents");
  const { OpenAIProvider } = await import("@openai/agents-openai");
  const { z } = await import("zod");
  const actions = [];
  const sources = [];
  const model = String(env.AUDITA_CHAT_MODEL || settings.model || DEFAULT_MODEL).trim();
  const provider = new OpenAIProvider({ apiKey, useResponses: true, cacheResponsesWebSocketModels: false });
  const runner = new Runner({
    modelProvider: provider,
    tracingDisabled: true,
    traceIncludeSensitiveData: false,
  });
  const agent = new Agent({
    name: "Audita IA",
    model,
    instructions: buildAuditaChatInstructions(settings.systemPrompt),
    tools: buildChatTools({ tool, z, actions, sources }),
  });
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    envNumber(env, "AUDITA_CHAT_TIMEOUT_MS", DEFAULT_TIMEOUT_MS),
  );

  try {
    const result = await runner.run(agent, buildTranscript(normalizedMessages, userName), {
      maxTurns: envNumber(env, "AUDITA_CHAT_MAX_TURNS", DEFAULT_MAX_TURNS),
      signal: controller.signal,
    });
    const answer = String(result?.finalOutput || "").trim();
    return {
      answer: answer || "Nao consegui concluir a resposta neste turno. Reformule o pedido em uma frase curta.",
      actions,
      sources,
      model,
      capabilities: AUDITA_CHAT_CAPABILITIES,
    };
  } finally {
    clearTimeout(timeout);
    await provider.close();
  }
}
