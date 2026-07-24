import { extractOpenAIUsage } from "./api-usage.service.mjs";

const DEFAULT_AGENT_ASSISTED_UFS = "AC,AP,MG,MT,PA,PI,RJ,RN,RO,RR,RS,SC";
const agentSessions = new Map();
const runningAgentTasks = new Map();
const runningAgentControllers = new Map();

function envNumber(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function envList(name, fallback = "") {
  const raw = process.env[name];
  return String(raw === undefined ? fallback : raw)
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function agentSessionId() {
  return `sca-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function redactDocument(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length <= 4) return digits ? "*".repeat(digits.length) : "";
  return `${digits.slice(0, 3)}${"*".repeat(Math.min(digits.length - 5, 12))}${digits.slice(-2)}`;
}

function publicSession(session) {
  if (!session) return null;
  return {
    id: session.id,
    status: session.status,
    uf: session.uf,
    tribunal: session.tribunal,
    portalUrl: session.portalUrl,
    assistedSession: session.assistedSession,
    messages: session.messages.slice(-30),
    nextAction: session.nextAction,
    result: session.result || null,
    updatedAt: session.updatedAt,
    createdAt: session.createdAt,
  };
}

function addMessage(session, role, content, extra = {}) {
  const message = {
    id: `${session.messages.length + 1}`,
    role,
    content: String(content || "").trim(),
    createdAt: new Date().toISOString(),
    ...extra,
  };
  session.messages.push(message);
  session.updatedAt = message.createdAt;
  return message;
}

export function getAgentAssistedAllowlist() {
  return new Set(envList("STATE_COURT_AGENT_ASSISTED_UFS", DEFAULT_AGENT_ASSISTED_UFS));
}

export function isStateCourtAgentAssistedEnabled(profile) {
  const uf = String(profile?.uf || "").trim().toUpperCase();
  return Boolean(uf && getAgentAssistedAllowlist().has(uf));
}

export function getStateCourtAgentPortalPrompt(profile) {
  const uf = String(profile?.uf || "").toUpperCase();
  const common = [
    `Portal oficial: ${profile?.url || ""}`,
    "Use os dados recebidos antes de navegar.",
    "Se encontrar CAPTCHA, reCAPTCHA, anti-bot, login, certificado digital, pagamento ou confirmacao sensivel, pare e chame o humano.",
    "Nao tente burlar CAPTCHA, anti-bot, Cloudflare, Turnstile ou qualquer validacao humana.",
    "Capture PDF, protocolo, pedido registrado ou texto conclusivo quando disponivel.",
  ];
  const portalSpecific = {
    AC: [
      "UF AC/TJAC: partir do sistema oficial https://certidoes.tjac.jus.br/.",
      "O pedido de certidao exige login gov.br nivel prata/ouro. Se a pagina solicitar gov.br, use handoff_human com essa instrucao objetiva.",
      "A area Validacao/Download Certidao serve para baixar certidao ja emitida; nao use como emissao nova sem protocolo.",
    ],
    AP: [
      "UF AP/TJAP: partir do Tucujuris certidao publica.",
      "Preencha Tipo de pessoa = FISICA, Nome, Sexo, Data de nascimento, Nome da mae, Nome do pai se houver, CPF, Numero da identidade, UF, Email e Tipo da certidao.",
      "O campo Sexo/Genero aparece como radio MASCULINO/FEMININO. Para os dados padrao de teste, selecione MASCULINO antes de qualquer handoff.",
      "Use Civel e Criminal quando o usuario nao especificar outro tipo; se houver multiplos tipos solicitados, priorize o tipo visivel ou pare para confirmar.",
      "O portal usa Cloudflare/Turnstile. Se a validacao humana aparecer, pare com handoff_human e instrua o usuario a resolver no navegador exibido.",
      "Depois que o humano resolver a validacao, continue pelo botao Enviar requisicao e capture protocolo, PDF ou mensagem de pedido registrado.",
    ],
    PI: [
      "UF PI/TJPI: partir da pagina de certidao negativa do TJPI.",
      "Procure formulario ou botao de emissao/solicitacao de certidao negativa.",
      "No formulario Modulo Certidoes Unificada, antes do CAPTCHA preencha todos os campos acessiveis.",
      "Campos iniciais do TJPI: Tipo Pessoa, Grau de Jurisdicao, Tipo Certidao e Nome/Razao Social do Requerente.",
      "Nao clique em Login nem em Certidao Interna; esses caminhos levam a autenticacao e nao ao formulario publico.",
      "No TJPI, nao use click_browser_text para focar rotulos de campos como CPF, RG, Mae, Pai, CEP, Endereco, Bairro, UF ou Municipio. Use fill_browser_field/select_browser_field diretamente.",
      "Use select_browser_field para os combos do TJPI: Tipo Pessoa = PESSOA FISICA, Grau de Jurisdicao = PRIMEIRO GRAU, Tipo Certidao = Negativa Civel, Execucao Civel, Criminal e Auditoria Militar.",
      "Depois de selecionar Tipo Pessoa e Tipo Certidao, observe de novo: o portal pode revelar CPF, RG, orgao expedidor, filiacao, endereco e outros campos.",
      "Campos obrigatorios do TJPI depois da expansao: CPF, RG, Orgao Expedidor, Estado Civil, Mae, CEP, Endereco, Numero, Bairro, UF e Municipio.",
      "Use estes campos recebidos quando existirem: rg, issuingAuthority, civilStatus, motherName, cep, address, addressNumber, neighborhood, stateUf e city.",
      "O campo UF do endereco deve receber stateUf. O campo Orgao Expedidor deve receber issuingAuthority.",
      "Mapa tecnico TJPI: requerente=fullName, cpf=documento, rg=rg, orgaoExpedidor=issuingAuthority, estadoCivil=civilStatus, pai=fatherName, mae=motherName, cep=cep, endereco=address, numero=addressNumber, complemento=addressComplement, bairro=neighborhood, ufRequerente=stateUf, municipioRequerente=city.",
      "Use select_browser_field tambem para Estado Civil, UF e Municipio. Depois de selecionar UF, observe novamente antes de selecionar Municipio, pois a lista pode carregar dinamicamente.",
      "Antes de handoff_human no reCAPTCHA do TJPI, observe a tela e confirme que nenhum campo obrigatorio visivel com dado recebido ficou vazio.",
      "Preencha todos os campos obrigatorios visiveis que tenham dados recebidos antes do handoff. Se faltar campo obrigatorio indispensavel, use ask_user antes de parar no CAPTCHA.",
      "Somente depois de preencher todos os campos obrigatorios possiveis, pare em handoff_human para o usuario resolver o reCAPTCHA.",
    ],
    PA: [
      "UF PA/TJPA: partir do portal novo de solicitacao de certidao.",
      "Primeira etapa: informe CPF e data de nascimento, deixe o humano resolver o desafio de arrastar/hCaptcha quando ele bloquear a pesquisa, e depois continue.",
      "Depois da tela 'Solicitar Certidao Judicial - Confira seus dados', nao pare so porque ainda existe iframe hCaptcha residual. Se houver campos visiveis vazios, continue preenchendo.",
      "Campos PA depois da validacao inicial: Nome completo=fullName, Nome da mae=motherName, Nome do pai=fatherName, Data de nascimento=birthDate, Naturalidade=naturality, Estado civil=civilStatus, Nacionalidade=nationality, CEP=cep, Endereco completo=address, Numero=addressNumber, Complemento=addressComplement, Bairro=neighborhood, UF=stateUf, Municipio=city e E-mail=email quando aparecerem.",
      "Use select_browser_field para Naturalidade, Estado civil, Nacionalidade, UF e Municipio quando o controle for dropdown.",
      "Antes de handoff_human por hCaptcha/CAPTCHA no PA, observe a tela e confirme que nenhum campo visivel com dado recebido ficou vazio.",
      "Nao diga que nome, mae ou pai foram preenchidos sem verificar no observe_browser que o campo ficou preenchido.",
    ],
    MG: [
      "UF MG/TJMG: partir diretamente do formulario RUPE: https://rupe.tjmg.jus.br/rupe/justica/publico/certidoes/criarSolicitacaoCertidao.rupe?solicitacaoPublica=true.",
      "Nao navegue pela pagina institucional do TJMG; ela e apenas informativa. A emissao publica fica no sistema RUPE.",
      "No formulario formCriacaoSolicitacaoCertidao, selecione 1a Instancia, Tipo de Certidao = Normal e Natureza = Civel, salvo se o usuario pedir outro tipo.",
      "Para comarca, use a informada pelo usuario; se nao houver comarca mineira informada, selecione Belo Horizonte.",
      "Selecione tipo de documento CPF para pessoa fisica, preencha Nome Pesquisado, Nome do Solicitante, CPF do Solicitante, E-mail e Confirmacao de E-mail.",
      "Campos importantes do RUPE: tipoCertidaoCertidao, comarcaCertidao2, tipoDocPesquisado, nomePesquisado, nomeSolicitante, cpfSolicitante, email, confirmacaoEmail.",
      "O RUPE pode exigir Gerar Codigo, codigo de verificacao por e-mail e reCAPTCHA. Depois de preencher os campos seguros, pare em handoff_human para o usuario resolver codigo/reCAPTCHA/confirmacao.",
    ],
    MT: [
      "UF MT/TJMT: partir do formulario SEC de primeiro grau para criar pedido de certidao.",
      "Preencha CPF, nome completo, data de nascimento e tipo/natureza da certidao quando aparecerem.",
      "Use natureza Civel como default quando o usuario nao especificar. Se o portal estiver instavel ou resetar conexao, registre erro oficial/indisponibilidade.",
      "Se o reCAPTCHA exibir mensagem de cota excedida, site exceeded quota, exceeded free quota ou erro equivalente, trate como erro oficial do portal. Nao peca para o usuario preencher campos manualmente; informe que a emissao depende do TJMT normalizar o reCAPTCHA ou reteste posterior.",
      "Se o reCAPTCHA bloquear a visualizacao/interacao com os campos, pare em handoff_human com status de bloqueio oficial. Se os campos estiverem acessiveis antes do CAPTCHA, preencha apenas os campos seguros e depois pare.",
      "Pare em CAPTCHA, login, certificado, pagamento ou confirmacao sensivel usando handoff_human.",
    ],
    RJ: [
      "UF RJ/TJRJ: partir diretamente da pagina CJE de modelos para RJ/Capital: /CJE/certidao/judicial/solicitarCapital?comarca=Capital.",
      "Na tela 'Modelos de Requerimento', escolha 'Acoes Civeis' para certidao civel. Esse item e um formulario POST com id myForm1 e TipoModelo=CVCapital; clique no card ou submeta o formulario, nao procure um link href.",
      "Na tela 'Requerimento de Certidao Eletronica', mantenha Tipo Pessoa = Fisica para CPF e preencha Nome, Documento/CPF, Email e Telefone quando disponivel.",
      "Depois clique em Continuar para ir para 'Dados para Pesquisa'. Nessa tela, confira/preencha Nome, CPF/CNPJ, Data de Nascimento em dd/mm/aaaa, Nome da Mae e Nome do Pai e clique diretamente em Continuar.",
      "Nao use o botao Adicionar no fluxo comum de um unico CPF; ele e para montar lista de multiplos pesquisados e pode causar erro de CPF/CNPJ ja cadastrado.",
      "Na tela Finalidade, selecione 'Informacao pessoal' como default quando o usuario nao especificar outra finalidade, preencha Complemento de Finalidade com 'Informacao pessoal' e clique Continuar.",
      "Na tela Resumo, confira se os dados aparecem e pare em handoff_human se houver reCAPTCHA/hCaptcha antes de clicar Gerar Requerimento.",
      "Se o usuario solicitar criminal, use 'Acoes Criminais' (myForm2/CRCapital). Se solicitar falencia, use 'Acoes de Falencia e Concordata' (myForm6/FCCapital).",
      "Pare em CAPTCHA, login, certificado, pagamento ou confirmacao sensivel usando handoff_human.",
    ],
    RR: [
      "UF RR/TJRR: partir do Projudi/certidao.",
      "Procure o fluxo publico de certidao antes de qualquer login. Preencha CPF/CNPJ, nome, filiacao, nascimento e e-mail quando visiveis.",
      "Se o portal exigir login/certificado ou nao houver formulario publico sem autenticacao, use handoff_human e registre o checkpoint.",
      "Pare em CAPTCHA, login, certificado, pagamento ou confirmacao sensivel usando handoff_human.",
    ],
    SC: [
      "UF SC/TJSC: partir do portal oficial certidoes.tjsc.jus.br.",
      "Procure emissao publica de certidao, selecione natureza Civel/default quando necessario e preencha CPF/CNPJ, nome, filiacao, nascimento e e-mail quando visiveis.",
      "Se o portal exigir captcha, login, certificado ou abrir etapa externa, preencha antes os campos seguros disponiveis e use handoff_human.",
      "Nao tente resolver nem contornar CAPTCHA.",
    ],
    RN: [
      "UF RN/TJRN: partir do portal oficial https://certidao.tjrn.jus.br/.",
      "Localize a emissao publica de certidao estadual e avance por menus/etapas ate o formulario.",
      "Preencha CPF/nome/filiacao/data de nascimento/e-mail quando os campos aparecerem; pare em CAPTCHA, login, certificado ou pagamento.",
    ],
    RO: [
      "UF RO/TJRO: partir da Certidao Unificada oficial.",
      "Se o STIC exibir Pagina Bloqueada, acesso bloqueado, suspeita de robotizacao ou support ID, use handoff_human; nao tente contornar.",
      "Se a pagina carregar normalmente, procure Emissao de Certidao, CPF/CNPJ, nome e tipo de certidao; prossiga sem pedir permissao ate CAPTCHA/login/bloqueio.",
    ],
    RS: [
      "UF RS/TJRS: partir da pagina de emissao de certidoes do TJRS.",
      "O formulario oficial pode estar em iframe do proprio TJRS, normalmente https://www.tjrs.jus.br/proc/alvara/; observe campos dentro de iframes.",
      "Nao use Balcao Virtual nem Login para emitir certidao publica; se a pagina so mostrar login/Balcao Virtual sem formulario de certidao, registre fluxo nao identificavel.",
      "Procure opcoes de Alvara de Folha Corrida, Certidoes Judiciais, Emitir Documento, documento desejado, nome e CPF.",
      "No TJRS, nao clique no botao Buscar da busca institucional do topo ou da pagina /novo/busca; ele nao emite certidao e desvia do fluxo. Use apenas Emitir Documento dentro do formulario de certidao.",
      "Depois de clicar Emitir Documento, observe a tela. Se nao houver PDF, protocolo ou mensagem conclusiva, use handoff_human/manual_review em vez de clicar Buscar.",
    ],
  };
  return [...common, ...(portalSpecific[uf] || [])].join("\n");
}

export function createStateCourtAgentSession({
  uf,
  tribunal,
  portalUrl,
  assistedSession,
  input,
  profile,
  requestedCertificates,
  getView,
  interact,
  owner = null,
}) {
  const id = agentSessionId();
  const documentValue =
    input?.tipoDocumento === "cnpj"
      ? input?.extraFields?.cnpjDocument || input?.documento
      : input?.extraFields?.cpfDocument || input?.documento;
  const fields = input?.extraFields?.stateCourtFields || {};
  const session = {
    id,
    status: "ready",
    uf,
    tribunal,
    portalUrl,
    assistedSession,
    input,
    profile,
    requestedCertificates,
    getView,
    interact,
    owner,
    messages: [],
    nextAction: "agent_continue",
    result: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  addMessage(
    session,
    "system",
    `Agente preparado para ${tribunal}/${uf}. Documento: ${redactDocument(documentValue)}. Campos recebidos: ${Object.keys(fields).sort().join(", ") || "nenhum campo estadual adicional"}.`,
  );
  agentSessions.set(id, session);
  return publicSession(session);
}

export function getStateCourtAgentSession(sessionId) {
  return publicSession(agentSessions.get(String(sessionId || "")));
}

function agentSessionForbidden(session, auth) {
  if (!session?.owner || !auth) return false;
  const ownerTenant = String(session.owner.tenantId || "");
  const ownerUser = String(session.owner.userId || "");
  const authTenant = String(auth.tenantId || "");
  const authUser = String(auth.userId || auth.user?.id || "");
  if (ownerTenant && ownerTenant !== authTenant) return true;
  if (ownerUser && ownerUser !== authUser) return true;
  return false;
}

export function getOwnedStateCourtAgentSession(sessionId, auth) {
  const session = agentSessions.get(String(sessionId || ""));
  if (!session) return null;
  if (agentSessionForbidden(session, auth)) return { forbidden: true };
  return publicSession(session);
}

export async function handleStateCourtAgentAction(sessionId, action = {}, auth) {
  const session = agentSessions.get(String(sessionId || ""));
  if (!session) return { notFound: true };
  if (agentSessionForbidden(session, auth)) return { forbidden: true };

  const type = String(action.type || action.action || "").trim();
  if (type === "stop") {
    runningAgentControllers.get(session.id)?.abort("user_stop");
    session.status = "stopped";
    session.nextAction = "";
    addMessage(session, "system", "Agente parado pelo usuario.");
    return publicSession(session);
  }

  if (type === "message") {
    addMessage(session, "user", String(action.message || action.text || ""));
    session.status = "ready";
    session.nextAction = "agent_continue";
  }

  if (type && !["continue", "message"].includes(type)) {
    return { invalid: true };
  }

  startStateCourtAgentSession(session.id, {
    userMessage:
      type === "message"
        ? String(action.message || action.text || "")
        : "Continue a navegacao a partir do estado atual. Se houver validacao humana ou ambiguidade, use handoff_human.",
  });
  return publicSession(session);
}

export async function runStateCourtAgentSessionById(sessionId, options = {}) {
  const session = agentSessions.get(String(sessionId || ""));
  if (!session) return { notFound: true };
  await runStateCourtAgentSession(session, options);
  return publicSession(session);
}

export function startStateCourtAgentSession(sessionId, options = {}) {
  const session = agentSessions.get(String(sessionId || ""));
  if (!session) return { notFound: true };
  if (runningAgentTasks.has(session.id)) {
    return publicSession(session);
  }
  const timeoutMs = envNumber("STATE_COURT_AGENT_RUN_TIMEOUT_MS", 180000);
  const controller = new AbortController();
  runningAgentControllers.set(session.id, controller);
  const hardTimeout = setTimeout(() => controller.abort("timeout"), timeoutMs);
  const task = runStateCourtAgentSession(session, {
    ...options,
    signal: controller.signal,
  })
    .catch((error) => {
      const message = error instanceof Error ? error.message : "erro desconhecido";
      const aborted = /aborted|abort/i.test(message);
      session.status = "blocked";
      session.nextAction = aborted ? "agent_continue" : "manual_review";
      addMessage(
        session,
        "system",
        aborted
          ? "Agente atingiu o limite de tempo desta rodada. A sessao oficial continua aberta; use Devolver ao agente para continuar do ponto atual."
          : `Falha ao executar agente: ${message}.`,
      );
    })
    .finally(() => {
      clearTimeout(hardTimeout);
      runningAgentTasks.delete(session.id);
      if (runningAgentControllers.get(session.id) === controller) {
        runningAgentControllers.delete(session.id);
      }
    });
  runningAgentTasks.set(session.id, task);
  return publicSession(session);
}

async function runStateCourtAgentSession(session, { userMessage = "", signal } = {}) {
  if (session.status === "running") return;
  const preferredApiKeyRef = process.env.STATE_COURT_AGENT_API_KEY_SECRET || "AUDITA_OPENAI_API_KEY";
  const apiKeyRef = process.env[preferredApiKeyRef]
    ? preferredApiKeyRef
    : process.env.AUDITA_OPENAI_API_KEY
      ? "AUDITA_OPENAI_API_KEY"
      : process.env.OPENAI_API_KEY
        ? "OPENAI_API_KEY"
        : preferredApiKeyRef;
  const apiKey = process.env[apiKeyRef];
  if (!apiKey) {
    session.status = "blocked";
    session.nextAction = "configure_openai";
    addMessage(session, "system", `Secret ${apiKeyRef} nao configurado. O navegador assistido continua disponivel, mas o agente IA nao pode executar.`);
    return;
  }

  session.status = "running";
  session.nextAction = "agent_running";
  addMessage(session, "user", userMessage || "Inicie a navegacao assistida.");

  try {
    const { Agent, Runner, tool } = await import("@openai/agents");
    const { OpenAIProvider } = await import("@openai/agents-openai");
    const { z } = await import("zod");
    const tools = buildAgentTools({ session, tool, z });
    const agent = new Agent({
      name: `Audita State Court Agent ${session.uf}`,
      model: process.env.STATE_COURT_AGENT_MODEL || "gpt-5-mini",
      instructions: buildStateCourtAgentInstructions(session),
      tools,
    });
    const localController = signal ? null : new AbortController();
    const runSignal = signal || localController.signal;
    const localTimeout = localController
      ? setTimeout(
          () => localController.abort("timeout"),
          envNumber("STATE_COURT_AGENT_RUN_TIMEOUT_MS", 180000),
        )
      : null;
    const runner = new Runner({
      modelProvider: new OpenAIProvider({
        apiKey,
        useResponses: true,
        cacheResponsesWebSocketModels: false,
      }),
      tracingDisabled: true,
      traceIncludeSensitiveData: false,
    });
    let result;
    try {
      result = await runner.run(agent, buildAgentInput(session), {
        maxTurns: envNumber("STATE_COURT_AGENT_MAX_TURNS", 24),
        signal: runSignal,
      });
    } finally {
      if (localTimeout) clearTimeout(localTimeout);
    }
    const finalText = String(result?.finalOutput || "").trim();
    await recordAgentUsage(session, {
      ...extractOpenAIUsage(result),
      status: "success",
    });
    if (finalText) {
      addMessage(session, "assistant", finalText);
    }
    if (session.status === "running") {
      session.status = "waiting_user_action";
      session.nextAction = "human_review";
      addMessage(session, "system", "Agente concluiu o turno. Revise a tela oficial ou continue a partir do painel.");
    }
  } catch (error) {
    await recordAgentUsage(session, {
      requestCount: 1,
      status: error?.name === "AbortError" ? "cancelled" : "failed",
    });
    if (session.status === "stopped") {
      return;
    }
    const aborted =
      signal?.aborted ||
      error?.name === "AbortError" ||
      /aborted|abort/i.test(String(error?.message || ""));
    session.status = "blocked";
    session.nextAction = aborted ? "agent_continue" : "manual_review";
    addMessage(
      session,
      "system",
      aborted
        ? "Agente atingiu o limite desta rodada. A sessao oficial continua aberta; use Devolver ao agente para retomar."
        : `Falha ao executar agente: ${error instanceof Error ? error.message : "erro desconhecido"}.`,
    );
  }
}

async function recordAgentUsage(session, usage) {
  if (typeof session?.input?.recordApiUsage !== "function") return;
  try {
    await session.input.recordApiUsage(session.input.usageContext || {}, {
      provider: "openai",
      service: "responses",
      operation: "state_court_agent",
      model: process.env.STATE_COURT_AGENT_MODEL || "gpt-5-mini",
      referenceId: `${session.id}:${Date.now()}`,
      unitName: "token",
      metadata: { uf: session.uf, tribunal: session.tribunal },
      ...usage,
    });
  } catch (error) {
    console.error("[audita] failed to record state court agent usage", error);
  }
}

function buildStateCourtAgentInstructions(session) {
  if (session.profile?.agentPurpose === "jec_petition") {
    return [
      "Voce e o copiloto navegador do Audita para iniciar uma peticao no Juizado Especial Civel.",
      "Seu objetivo e avancar com seguranca, preencher apenas dados recebidos e registrar claramente o ponto de parada.",
      "Nunca invente fatos, pedidos, valores, competencia, classe, assunto, dados pessoais ou documentos.",
      "Nunca clique no comando final de enviar, protocolar, ajuizar, assinar ou confirmar a peticao.",
      "Pare em login, gov.br, CAPTCHA, certificado, upload sensivel, pagamento, ambiguidade juridica e revisao final.",
      "Use handoff_human para pedir a intervencao da pessoa e explique uma unica acao objetiva.",
      "Prefira observar, preencher por rotulo, selecionar por rotulo e clicar por texto.",
      "Nao use clique por coordenadas neste fluxo.",
      String(session.profile?.agentInstructions || ""),
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    "Voce e um agente navegador do Audita para portais oficiais de tribunais estaduais.",
    "Objetivo: avancar a emissao de certidoes oficiais usando dados pre-carregados e registrar o ponto de parada.",
    "Nunca burle CAPTCHA, reCAPTCHA, Cloudflare, Turnstile, anti-bot, login, certificado digital, pagamento ou confirmacao humana.",
    "Se houver CAPTCHA/reCAPTCHA mas campos comuns estiverem acessiveis, preencha primeiro os campos seguros com os dados recebidos, nao envie o formulario, e depois use handoff_human.",
    "Use handoff_human imediatamente quando a validacao humana bloquear a visualizacao ou interacao com os campos, ou quando houver login, certificado, pagamento, confirmacao sensivel ou ambiguidade relevante.",
    "Nunca concatene dados de campos diferentes. Campo de nome recebe apenas nome; campo CPF/CNPJ recebe apenas documento; e-mail recebe apenas e-mail.",
    "Use ask_user apenas quando faltar dado indispensavel para continuar.",
    "Prefira observar a tela antes de clicar. Use poucos passos por turno.",
    "Prefira fill_browser_field, select_browser_field e click_browser_text quando houver campos, botoes ou links identificaveis por rotulo/texto. Use coordenadas apenas quando nao houver alternativa.",
    "Nao pergunte se deve prosseguir em acao segura e reversivel; prossiga ate completar, encontrar resultado oficial ou atingir uma condicao real de handoff.",
    "Nao invente resultado. Capture resultado somente quando a tela oficial indicar PDF, protocolo, pedido registrado, nada consta ou consta.",
    getStateCourtAgentPortalPrompt(session.profile),
  ].join("\n");
}

function buildAgentInput(session) {
  const fields = session.input?.extraFields?.stateCourtFields || {};
  const documentValue =
    session.input?.tipoDocumento === "cnpj"
      ? session.input?.extraFields?.cnpjDocument || session.input?.documento
      : session.input?.extraFields?.cpfDocument || session.input?.documento;
  return JSON.stringify(
    {
      uf: session.uf,
      tribunal: session.tribunal,
      portalUrl: session.portalUrl,
      tipoDocumento: session.input?.tipoDocumento,
      documento: String(documentValue || "").replace(/\D/g, ""),
      documentoMascarado: redactDocument(documentValue),
      camposDisponiveis: fields,
      certidoesSolicitadas: session.requestedCertificates,
      mensagensRecentes: session.messages.slice(-8).map(({ role, content }) => ({ role, content })),
    },
    null,
    2,
  );
}

function normalizeToolFieldValue(session, label, value) {
  const normalizedLabel = String(label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const fields = session.input?.extraFields?.stateCourtFields || {};
  const documentValue =
    session.input?.tipoDocumento === "cnpj"
      ? session.input?.extraFields?.cnpjDocument || session.input?.documento
      : session.input?.extraFields?.cpfDocument || session.input?.documento;
  const rawValue = String(value || "");
  const valueDigits = rawValue.replace(/\D/g, "");
  if (/(^|[^a-z])(nome|razao|requerente|interessado)/i.test(normalizedLabel) && valueDigits.length >= 8 && fields.fullName) {
    return String(fields.fullName);
  }
  if (/(cpf|cnpj|documento|numero do documento)/i.test(normalizedLabel) && documentValue) {
    return String(documentValue).replace(/\D/g, "");
  }
  if (/(^|[^a-z])(rg|identidade)/i.test(normalizedLabel) && fields.rg) {
    return String(fields.rg);
  }
  if (/(mae|m[ãa]e|genitora|filiacao.*mae|filia[cç][aã]o.*m[ãa]e)/i.test(normalizedLabel) && fields.motherName) {
    return String(fields.motherName);
  }
  if (/(pai|genitor|filiacao.*pai|filia[cç][aã]o.*pai)/i.test(normalizedLabel) && fields.fatherName) {
    return String(fields.fatherName);
  }
  if (/(nascimento|data.*nasc)/i.test(normalizedLabel) && fields.birthDate) {
    return String(fields.birthDate);
  }
  if (/(cep)/i.test(normalizedLabel) && fields.cep) {
    return String(fields.cep).replace(/\D/g, "");
  }
  if (/(endere[cç]o|logradouro)/i.test(normalizedLabel) && fields.address) {
    return String(fields.address);
  }
  if (/(numero|n[ºo]|nro)/i.test(normalizedLabel) && (fields.addressNumber || fields.number || fields.complement)) {
    return String(fields.addressNumber || fields.number || fields.complement);
  }
  if (/(^|[^a-z])(n|no|num|numero|nro|nº|n°)([^a-z]|$)/i.test(normalizedLabel) && (fields.addressNumber || fields.number)) {
    return String(fields.addressNumber || fields.number);
  }
  if (/(complemento)/i.test(normalizedLabel) && fields.addressComplement) {
    return String(fields.addressComplement);
  }
  if (/estado\s*civil|civil\s*status/i.test(normalizedLabel) && fields.civilStatus) {
    return String(fields.civilStatus);
  }
  if (/(bairro)/i.test(normalizedLabel) && fields.neighborhood) {
    return String(fields.neighborhood);
  }
  if (/(^|[^a-z])(uf|estado)([^a-z]|$)/i.test(normalizedLabel) && (fields.stateUf || fields.uf)) {
    return String(fields.stateUf || fields.uf).toUpperCase();
  }
  if (/(municipio|cidade)/i.test(normalizedLabel) && fields.city) {
    return String(fields.city);
  }
  if (/(orgao|expedidor|emissor)/i.test(normalizedLabel) && fields.issuingAuthority) {
    return String(fields.issuingAuthority);
  }
  if (/(orgao|[oó]rg[aã]o|expedidor|emissor)/i.test(normalizedLabel) && (fields.issuingAgency || fields.rgIssuer)) {
    return String(fields.issuingAgency || fields.rgIssuer);
  }
  if (/e-?mail|email/i.test(normalizedLabel) && fields.email) {
    return String(fields.email);
  }
  return rawValue;
}

function summarizeToolView(result) {
  if (!result || result.notFound || result.closed || result.invalid) return result;
  return {
    id: result.id,
    closed: result.closed,
    title: result.title,
    url: result.url,
    formState: result.formState
      ? {
          filledCount: result.formState.filledCount,
          totalCount: result.formState.totalCount,
          controls: Array.isArray(result.formState.controls)
            ? result.formState.controls.slice(0, 20).map(({ label, type, filled, valuePreview, options, frameUrl }) => ({
                label,
                type,
                filled,
                valuePreview,
                options: Array.isArray(options) ? options.slice(0, 12) : [],
                frameUrl,
              }))
            : [],
          actions: Array.isArray(result.formState.actions)
            ? result.formState.actions.slice(0, 15).map(({ label, tag, href, frameUrl }) => ({ label, tag, href, frameUrl }))
            : [],
          frames: result.formState.frames || [],
        }
      : null,
    outcome: result.outcome
      ? {
          status: result.outcome.status,
          protocol: result.outcome.protocol,
          requestRegistered: result.outcome.requestRegistered,
          textSample: String(result.outcome.textSample || "").slice(0, 900),
          pdfLinks: Array.isArray(result.outcome.pdfLinks) ? result.outcome.pdfLinks.slice(0, 3) : [],
        }
      : null,
  };
}

function buildAgentTools({ session, tool, z }) {
  return [
    tool({
      name: "observe_browser",
      description: "Observa a tela atual do navegador assistido e retorna texto, URL, titulo e estado dos campos.",
      parameters: z.object({}),
      execute: async () => {
        addMessage(session, "tool", "Agente observou a tela do navegador.");
        const view = await session.getView(session.assistedSession);
        if (view?.notFound) return { error: "assisted_session_not_found" };
        const summary = summarizeToolView(view);
        return {
          title: summary.title,
          url: summary.url,
          formState: summary.formState,
          outcome: summary.outcome,
          visibleControls: summary.formState?.controls || [],
          visibleActions: summary.formState?.actions || [],
          textSample: String(view.outcome?.textSample || "").slice(0, 1200),
        };
      },
    }),
    tool({
      name: "click_browser_text",
      description: "Clica em um botao, link ou controle identificado pelo texto visivel, aria-label, title ou value.",
      parameters: z.object({ label: z.string(), reason: z.string().optional() }),
      execute: async ({ label, reason }) => {
        const normalizedLabel = String(label || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
          .toLowerCase();
        if (session.uf === "RS" && normalizedLabel === "buscar") {
          addMessage(session, "tool", "Clique em Buscar bloqueado no TJRS para evitar desvio para a busca institucional.");
          const view = await session.getView(session.assistedSession);
          return {
            blocked: true,
            reason: "No TJRS, Buscar pertence a busca institucional e nao ao fluxo de emissao de certidao. Observe a tela e use handoff_human/manual_review se Emitir Documento nao retornou resultado.",
            currentView: summarizeToolView(view),
          };
        }
        if (session.uf === "PI" && /(login|certidao interna)/.test(normalizedLabel)) {
          addMessage(session, "tool", "Clique bloqueado no TJPI para evitar desvio para login/autenticacao.");
          const view = await session.getView(session.assistedSession);
          return {
            blocked: true,
            reason: "No TJPI, permaneca no formulario publico de Certidao Unificada. Nao clique em Login ou Certidao Interna.",
            currentView: summarizeToolView(view),
          };
        }
        if (session.uf === "PI" && /(cpf|rg|mae|pai|cep|enderec|bairro|estado civil|municipio|\buf\b|orgao|expedidor)/.test(normalizedLabel)) {
          addMessage(session, "tool", "Clique em rotulo de campo bloqueado no TJPI; use fill/select por rotulo.");
          const view = await session.getView(session.assistedSession);
          return {
            blocked: true,
            reason: "No TJPI, preencha campos com fill_browser_field ou select_browser_field; nao clique no rotulo do campo.",
            currentView: summarizeToolView(view),
          };
        }
        addMessage(session, "tool", `Clique por texto: ${label}${reason ? ` (${reason})` : ""}.`);
        return summarizeToolView(await session.interact(session.assistedSession, { type: "clickText", label, actor: "agent" }));
      },
    }),
    tool({
      name: "fill_browser_field",
      description: "Preenche input, textarea, checkbox, radio ou select identificado por rotulo, name, id, placeholder ou aria-label.",
      parameters: z.object({ label: z.string(), value: z.string(), reason: z.string().optional() }),
      execute: async ({ label, value, reason }) => {
        const safeValue = normalizeToolFieldValue(session, label, value);
        addMessage(session, "tool", `Campo preenchido por rotulo: ${label}${reason ? ` (${reason})` : ""}.`);
        return summarizeToolView(await session.interact(session.assistedSession, { type: "fillField", label, value: safeValue, actor: "agent" }));
      },
    }),
    tool({
      name: "select_browser_field",
      description: "Seleciona uma opcao em select, radio ou checkbox identificado por rotulo/name/id/placeholder.",
      parameters: z.object({ label: z.string(), value: z.string(), reason: z.string().optional() }),
      execute: async ({ label, value, reason }) => {
        addMessage(session, "tool", `Selecao por rotulo: ${label} = ${value}${reason ? ` (${reason})` : ""}.`);
        return summarizeToolView(await session.interact(session.assistedSession, { type: "selectField", label, value, actor: "agent" }));
      },
    }),
    tool({
      name: "click_browser",
      description: "Clica em coordenadas da tela remota quando for seguro e necessario.",
      parameters: z.object({ x: z.number(), y: z.number(), reason: z.string().optional() }),
      execute: async ({ x, y, reason }) => {
        addMessage(session, "tool", `Clique solicitado pelo agente: ${reason || `${x},${y}`}.`);
        return summarizeToolView(await session.interact(session.assistedSession, { type: "click", x, y, actor: "agent" }));
      },
    }),
    tool({
      name: "type_browser",
      description: "Digita texto no campo atualmente focado no navegador.",
      parameters: z.object({ text: z.string(), reason: z.string().optional() }),
      execute: async ({ text, reason }) => {
        addMessage(session, "tool", `Texto enviado ao campo focado: ${reason || "preenchimento"}.`);
        return summarizeToolView(await session.interact(session.assistedSession, { type: "type", text, actor: "agent" }));
      },
    }),
    tool({
      name: "press_browser_key",
      description: "Pressiona uma tecla no navegador assistido.",
      parameters: z.object({ key: z.string(), reason: z.string().optional() }),
      execute: async ({ key, reason }) => {
        addMessage(session, "tool", `Tecla enviada: ${key}${reason ? ` (${reason})` : ""}.`);
        return summarizeToolView(await session.interact(session.assistedSession, { type: "press", key, actor: "agent" }));
      },
    }),
    tool({
      name: "scroll_browser",
      description: "Rola a pagina no navegador assistido.",
      parameters: z.object({ deltaY: z.number(), reason: z.string().optional() }),
      execute: async ({ deltaY, reason }) => {
        addMessage(session, "tool", `Rolagem solicitada: ${deltaY}${reason ? ` (${reason})` : ""}.`);
        return summarizeToolView(await session.interact(session.assistedSession, { type: "scroll", deltaY, actor: "agent" }));
      },
    }),
    tool({
      name: "ask_user",
      description: "Pede ao usuario um dado indispensavel que nao esta disponivel.",
      parameters: z.object({ question: z.string(), field: z.string().optional() }),
      execute: async ({ question, field }) => {
        session.status = "waiting_user_input";
        session.nextAction = "user_message";
        addMessage(session, "assistant", question, { field: field || "" });
        return { status: "waiting_user_input", question, field };
      },
    }),
    tool({
      name: "handoff_human",
      description: "Pausa para o humano assumir CAPTCHA, login, certificado, confirmacao sensivel ou ambiguidade.",
      parameters: z.object({ reason: z.string(), instructions: z.string() }),
      execute: async ({ reason, instructions }) => {
        session.status = "waiting_user_action";
        session.nextAction = "human_handoff";
        addMessage(session, "assistant", `${reason}\n${instructions}`);
        return { status: "waiting_user_action", reason, instructions };
      },
    }),
    tool({
      name: "capture_result",
      description: "Registra PDF, protocolo, pedido registrado ou resultado textual quando estiver visivel oficialmente.",
      parameters: z.object({ summary: z.string(), protocol: z.string().optional(), resultType: z.string().optional() }),
      execute: async ({ summary, protocol, resultType }) => {
        session.status = "completed";
        session.nextAction = "inspect_result";
        session.result = { summary, protocol: protocol || "", resultType: resultType || "textual" };
        addMessage(session, "assistant", summary);
        return { status: "completed", result: session.result };
      },
    }),
  ];
}
