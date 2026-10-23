# Relatório financeiro judicial

Tarefa Codex em codex/relatorio-judicial, base origin/main. Implementação local concluída, sem push/deploy.
Entrada dentro de Dívidas bancárias; preserva atendimento anterior em seção recolhível.
Duas entradas: manual ou decisão com extração via integração de documentos/chat existente.
Dados extraídos devem ser conferidos. Sem taxa legal predefinida ou certificação de tribunal.
PDF privado gerado sob demanda, sem salvar corpo ou arquivo no diretório público.
API exige sessão, mesma origem e limites de entrada; nenhuma nova chave ou migração.
Arquivos compartilhados: server.mjs, app.js, index.html, styles.css, Dockerfile, docs/STATUS.md.

## Cálculo
- Apenas os seis campos processuais, valor homologado e data da homologação são obrigatórios. Os demais ficam em seção opcional no final. Botão Gerar PDF envia diretamente após confirmação.
- Critérios opcionais incompletos geram relatório documental, com complementos informados e sem totais atualizados. Valores opcionais presentes continuam validados; não são substituídos por zero.
- Valores monetários em centavos; percentuais com até quatro casas, sem separadores de milhar na API.
- Correção acumulada informada sobre o homologado; não busca índices oficiais.
- Juros simples sobre base escolhida (homologado ou corrigido), taxa mensal × dias corridos / 30.
- Datas inicial de juros e final explícitas, sem presumir termo inicial. Honorários sobre principal corrigido + juros.
- Arredondamento por rubrica para centavos; total soma os componentes arredondados. Sem multas, custas ou pagamentos implícitos.
- Limites e datas validados no servidor; PDF recalcula, não aceita totais enviados pelo navegador.

## Acesso e validação
- POST /api/judicial-report/preview e /pdf: sessão e mesma origem; PDF exige confirmed=true. Respostas no-store.
- Extração usa documentos/chat autenticados existentes e respectivas cotas; não cria chave ou libera plano.
- Interface e API testadas com dados fictícios; PDF de duas páginas renderizado e revisado. Seis testes novos aprovados, mais regressões de catálogo e dívida.
- Localhost3000 atualizado. Banco local reporta ECONNREFUSED; sessão autenticada e extração real com IA não homologadas. Nenhum documento do usuário enviado em teste.
