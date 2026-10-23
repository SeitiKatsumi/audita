// Only approved explanations reach the UI; never forward raw provider errors or URLs.
export function directDataFailureDetail(payload, status) {
  const metadata = payload?.metaDados || payload?.metadados || {};
  const message = String(metadata.mensagem || payload?.mensagem || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  if (/insuficientes|insuficiente/.test(message) && /receita|contribuinte|informac|dados/.test(message)) return 'A fonte informou que os dados cadastrais são insuficientes para emitir a certidão pela Internet. Isso não comprova dívida nem regularidade.';
  if (/ja existe.*cnd.*valida/.test(message)) return 'A fonte informou que já existe uma certidão válida para este titular. Consulte o portal oficial para obter o documento existente.';
  if (/erro.*sistema remoto/.test(message)) return 'O fornecedor informou falha no sistema remoto consultado. Não foi possível confirmar o resultado.';
  if (/nao existem informacoes disponiveis/.test(message)) return 'A fonte não disponibilizou informações para os parâmetros consultados. Isso não comprova ausência de processos ou pendências.';
  if (status === 401) return 'A autenticação da integração foi recusada. A equipe precisa conferir a configuração de acesso.';
  if (status === 403) return 'O fornecedor recusou o acesso. É necessário conferir saldo e permissão desta API.';
  if (status === 429) return 'O fornecedor atingiu o limite de requisições. Aguarde antes de uma nova tentativa.';
  if (status === 400) return 'O fornecedor recusou os parâmetros enviados. A equipe precisa conferir os campos exigidos para esta consulta.';
  if (status >= 500) return 'O fornecedor ou a fonte consultada está indisponível nesta tentativa.';
  return 'A fonte não concluiu a consulta com um resultado válido. Isso não comprova ausência de pendências. A equipe deve conferir o histórico antes de repetir a emissão.';
}
