import OpenAI from "openai";

const DEFAULT_MODEL = "gpt-5-mini";
const MIN_TESTIMONY_LENGTH = 40;
const MAX_TESTIMONY_LENGTH = 5_000;
const TESTIMONY_QUESTIONS = Object.freeze([
  "Como você descobriu a cobrança e quando isso aconteceu? Se a descoberta foi confirmada pelo Relatório Técnico de Auditoria Financeira, informe a data exata ou o mês e o ano.",
  "Qual é o nome exato do lançamento como aparece na fatura ou no extrato, qual era o valor unitário ou total acumulado e quantas cobranças você identificou? Os documentos já enviados serão associados automaticamente ao relato.",
  "Você contratou ou autorizou esses lançamentos? Conte o que sabe sobre a origem da cobrança.",
  "Você reclamou ou buscou atendimento no banco? Se sim, informe o canal, a data, a resposta e o protocolo; se não tiver ou não lembrar, diga isso.",
]);
const MAX_TESTIMONY_QUESTIONS = TESTIMONY_QUESTIONS.length;

export class JecTestimonyError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = "JecTestimonyError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function normalizeJecTestimony(value, maxLength = MAX_TESTIMONY_LENGTH) {
  return String(value || "")
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

function resolveOpenAI(env) {
  const preferred = String(env.JEC_TESTIMONY_API_KEY_SECRET || "AUDITA_OPENAI_API_KEY").trim();
  const secretRef = env[preferred]
    ? preferred
    : env.AUDITA_OPENAI_API_KEY
      ? "AUDITA_OPENAI_API_KEY"
      : env.OPENAI_API_KEY
        ? "OPENAI_API_KEY"
        : preferred;
  const apiKey = env[secretRef];
  return {
    apiKey: apiKey && apiKey !== "change-me" ? apiKey : "",
    secretRef,
    model: String(env.JEC_TESTIMONY_MODEL || env.AUDITA_CHAT_MODEL || DEFAULT_MODEL).trim(),
  };
}

function refinementInstructions() {
  return [
    "Você revisa o relato pessoal de um consumidor brasileiro para inclusão em um Relatório Técnico de Auditoria.",
    "Reescreva em primeira pessoa, com linguagem clara, formal e natural, preservando a individualidade do relato.",
    "Organize os fatos em ordem cronológica e cubra, quando informados: identificação da descoberta e data; descrição, valores e quantidade dos lançamentos; origem e autorização; tentativa de solução e protocolo.",
    "A tentativa de solução é informação opcional. Não trate reclamação prévia ou protocolo como requisito.",
    "Não invente, complete ou presuma datas, valores, produtos, períodos, protocolos, contatos, danos, sentimentos ou consequências.",
    "Não acrescente fundamentos jurídicos, pedidos, acusações ou conclusões que não estejam no relato.",
    "Não transforme dúvida em certeza e não afirme ausência de contratação se o consumidor não tiver dito isso.",
    "Mantenha nomes de produtos e valores exatamente como informados.",
    "Entregue apenas o relato revisado, sem título, notas, listas, markdown ou explicações.",
  ].join("\n");
}

function conversationInstructions() {
  return [
    "Você organiza o relato pessoal de um consumidor brasileiro após uma entrevista dividida em quatro tópicos.",
    "Use as respostas nesta ordem: 1. identificação da descoberta e data; 2. descrição, valores, quantidade e documentos dos lançamentos; 3. origem e autorização; 4. tentativa de solução e protocolo, se houver.",
    "Redija o relato em primeira pessoa, com linguagem clara, formal, natural e em ordem cronológica.",
    "A tentativa de solução é informação opcional. Não trate reclamação prévia ou protocolo como requisito.",
    "Não invente, complete ou presuma datas, valores, produtos, períodos, protocolos, danos, sentimentos ou consequências.",
    "Não acrescente fundamentos jurídicos, pedidos, acusações ou conclusões. Não transforme dúvida em certeza.",
    "Não peça nem inclua senha, número de cartão ou dado bancário.",
    "Entregue apenas o relato revisado, sem título, notas, listas, markdown ou explicações.",
  ].join("\n");
}

function normalizeConversationTurns(turns) {
  return (Array.isArray(turns) ? turns : [])
    .slice(0, MAX_TESTIMONY_QUESTIONS)
    .map((turn) => ({
      question: normalizeJecTestimony(turn?.question, 300),
      answer: normalizeJecTestimony(turn?.answer, 2_000),
    }))
    .filter((turn) => turn.answer.length >= 2);
}

export function createJecTestimonyService({ env = process.env, clientFactory } = {}) {
  return {
    async continueConversation(turns) {
      const normalizedTurns = normalizeConversationTurns(turns);
      if (!normalizedTurns.length) {
        throw new JecTestimonyError(
          "jec_testimony_answer_required",
          "Conte o que aconteceu com suas palavras para continuar.",
        );
      }

      if (normalizedTurns.length < MAX_TESTIMONY_QUESTIONS) {
        return {
          status: "follow_up",
          question: TESTIMONY_QUESTIONS[normalizedTurns.length],
          turns: normalizedTurns,
        };
      }

      const { apiKey, secretRef, model } = resolveOpenAI(env);
      if (!apiKey && !clientFactory) {
        throw new JecTestimonyError(
          "jec_testimony_ai_unavailable",
          "A coleta do depoimento por IA está temporariamente indisponível.",
          503,
        );
      }

      const client = clientFactory
        ? clientFactory({ apiKey, secretRef, model })
        : new OpenAI({ apiKey });
      const response = await client.responses.create({
        model,
        max_output_tokens: 1_000,
        reasoning: { effort: "low" },
        instructions: conversationInstructions(),
        input: normalizedTurns
          .map((turn, index) => `Pergunta ${index + 1}: ${turn.question}\nResposta: ${turn.answer}`)
          .join("\n\n"),
        text: { verbosity: "low" },
      });
      const refined = normalizeJecTestimony(response.output_text);
      if (refined.length < MIN_TESTIMONY_LENGTH) {
        throw new JecTestimonyError(
          "jec_testimony_ai_invalid_output",
          "A IA não conseguiu organizar o depoimento. Tente novamente com mais detalhes.",
          502,
        );
      }

      return {
        status: "complete",
        original: normalizedTurns.map((turn) => turn.answer).join("\n\n"),
        refined,
        turns: normalizedTurns,
        model,
        secretRef,
      };
    },
    async refine(testimony) {
      const original = normalizeJecTestimony(testimony);
      if (original.length < MIN_TESTIMONY_LENGTH) {
        throw new JecTestimonyError(
          "jec_testimony_too_short",
          "Conte um pouco mais sobre a cobrança para que a IA consiga organizar o seu relato.",
        );
      }

      const { apiKey, secretRef, model } = resolveOpenAI(env);
      if (!apiKey && !clientFactory) {
        throw new JecTestimonyError(
          "jec_testimony_ai_unavailable",
          "O ajuste do depoimento por IA está temporariamente indisponível.",
          503,
        );
      }

      const client = clientFactory
        ? clientFactory({ apiKey, secretRef, model })
        : new OpenAI({ apiKey });
      const response = await client.responses.create({
        model,
        max_output_tokens: 1_000,
        reasoning: { effort: "low" },
        instructions: refinementInstructions(),
        input: original,
        text: { verbosity: "low" },
      });
      const refined = normalizeJecTestimony(response.output_text);
      if (refined.length < MIN_TESTIMONY_LENGTH) {
        throw new JecTestimonyError(
          "jec_testimony_ai_invalid_output",
          "A IA não conseguiu organizar o depoimento. Tente novamente com mais detalhes.",
          502,
        );
      }

      return {
        original,
        refined,
        model,
        secretRef,
      };
    },
  };
}
