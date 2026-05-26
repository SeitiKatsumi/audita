export function calculateRiskScore(results) {
  const motivos = [];
  const relevantResults = Array.isArray(results) ? results : [];

  if (relevantResults.some((result) => result.resultado === "consta")) {
    motivos.push("Uma ou mais fontes retornaram ocorrencia.");
    return { nivel: "alto", motivos };
  }

  const importantSources = new Set(["receita_federal", "pgfn", "cndt", "trf1", "tjdft", "portal_transparencia"]);
  const importantFailures = relevantResults.filter(
    (result) => importantSources.has(result.fonte) && ["failed", "unavailable", "manual_required", "waiting_user_action"].includes(result.status),
  );
  if (importantFailures.length) {
    motivos.push(`Fontes importantes indisponiveis: ${importantFailures.map((result) => result.fonte).join(", ")}.`);
    return { nivel: "indefinido", motivos };
  }

  if (relevantResults.length && relevantResults.every((result) => result.resultado === "nada_consta")) {
    motivos.push("Todas as fontes consultadas retornaram nada consta.");
    return { nivel: "baixo", motivos };
  }

  motivos.push("Consulta parcial sem ocorrencias confirmadas.");
  return { nivel: "medio", motivos };
}

