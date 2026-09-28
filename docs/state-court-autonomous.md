# Certidões estaduais autônomas

Validação: 28/09/2026. Versão consolidada no main local, em `http://localhost:3000/#analise-vendedor`. Sem commit, push ou deploy desta rodada.

## Acompanhamento por UF

A aba [Cobertura por UF](https://docs.google.com/spreadsheets/d/1myQG7FETZWMqPXPcaDNkYYPEWU3KJRRkX0QketehcnY/edit?gid=1830460901#gid=1830460901) é a visão principal consolidada da análise do vendedor, com uma linha por UF e colunas separadas para CPF e CNPJ. Ela reúne estes documentos dos TJs e a [ampliação fiscal, federal, trabalhista e de outras fontes](seller-document-coverage.md). A aba [Cobertura de documentos](https://docs.google.com/spreadsheets/d/1myQG7FETZWMqPXPcaDNkYYPEWU3KJRRkX0QketehcnY/edit?gid=1989173279#gid=1989173279) conserva o detalhe por fonte e produto.

A fonte da visão principal é [seller-uf-coverage.csv](seller-uf-coverage.csv), gerada por [`scripts/export-seller-uf-coverage.mjs`](../scripts/export-seller-uf-coverage.mjs) a partir dos catálogos validados. Cada opção nacional conta uma vez por UF e perfil; as regionais contam somente em sua jurisdição. As municipais dependem da cidade explicitamente validada, sem cobertura automática de toda a UF. CPF e CNPJ não compartilham homologação. Os totais de **301 ocorrências para CPF e 152 para CNPJ** somam a cobertura geográfica das linhas, **não produtos distintos**.

Após cada validação ou mudança de disponibilidade, atualize o catálogo aceito, gere novamente o CSV e atualize a planilha. Editar a planilha não habilita cobertura no sistema. A liberação depende da validação do PDF, atualização do catálogo executável e conferência do ambiente de entrega.

## Cobertura dos tribunais estaduais liberada localmente

O recorte dos tribunais estaduais abaixo reúne **30 PDFs em 10 UFs**, obtidos e conferidos usando uma pessoa física autorizada. Esses números não representam toda a cobertura consolidada por UF. O fluxo consulta os portais oficiais e a API da Direct Data, salva os PDFs na área privada e apresenta falhas individualmente. Não depende de CAPTCHA ou intervenção humana nas emissões validadas.

| UF | Portal oficial, sem tarifa da Direct Data | API Direct Data | Total |
| --- | --- | --- | ---: |
| AP | — | Cível; criminal | 2 |
| DF | Cível; criminal; falência e recuperação judicial; especial cível/criminal | — | 4 |
| ES | Cível; criminal; falência e recuperação judicial | Família; fiscal; militar | 6 |
| GO | — | Cível; criminal | 2 |
| PA | — | Cível; criminal | 2 |
| PE | — | Cível; criminal; judicial para fins eleitorais | 3 |
| PI | — | Cível e execução cível; criminal e auditoria militar; unificada para fins eleitorais | 3 |
| RR | — | Criminal; militar; concordata e falências | 3 |
| RS | — | Alvará de folha corrida | 1 |
| TO | Cível; criminal | Fiscal; falência e recuperação judicial | 4 |
| **Total** | **9** | **21** | **30** |

A matriz executável fica em `data/state-court-autonomous.json`. A cobertura pública considera a configuração e as UFs habilitadas da API; se o provedor estiver desabilitado, o sistema oferece apenas os portais nativos validados. O teste é de PF; CNPJ e variações de dados, resultados positivos e todas as instâncias/comarcas não foram homologados nesta rodada. A abrangência jurídica é a declarada em cada PDF.

## Conferência do documento

Cada emissão só entra como obtida depois de baixar um PDF, extrair texto e conferir nome, CPF, estado e título esperado. Sucesso HTTP ou resposta JSON do provedor não basta. PDF ausente, identidade divergente, título divergente ou texto ilegível deixam a emissão indisponível. Uma falha preserva os outros PDFs e impede apresentar o lote inteiro como nada consta.

- **RR:** o provedor retornou criminal ao pedir Cível, militar ao pedir Criminal e concordata/falências ao pedir Militar. O catálogo mostra o documento efetivamente recebido e mantém o parâmetro observado separado. Se o provedor mudar esse comportamento, a validação do título interrompe a emissão divergente.
- **RS:** cinco tipos solicitados retornaram o mesmo alvará de folha corrida. Só esse documento foi habilitado, uma única vez. Ele não equivale a uma certidão cível nem a uma pesquisa de todos os processos criminais.
- **PI:** o documento solicitado para fins eleitorais tem título unificado cível, execução cível, criminal e auditoria militar. Não é certidão de quitação eleitoral do TSE.
- **GO:** o portal nativo retornou arquivos sem texto extraível neste ambiente. A cobertura atual usa os PDFs legíveis da API.
- **ES:** falência falhou na API, mas foi emitida e validada no portal oficial.

## Tribunais estaduais ainda não liberados

Foram testadas cível e criminal nas 27 UFs. Estes resultados descrevem as tentativas de 28/09, não indisponibilidade permanente:

| UFs | Resultado da API | Próximo passo |
| --- | --- | --- |
| AC, AM, BA, CE, MT, PB, RN, SP | HTTP 503 / indisponibilidade temporária | Retestar após recuperação do serviço; avaliar emissão oficial sem desafios humanos. |
| AL | HTTP 500 | Retestar após correção do provedor. |
| MA, MG, PR, RJ, RO, SC | HTTP 400 / parâmetros rejeitados | Confirmar requisitos e cobertura efetiva com o provedor antes de liberar. |
| MS, SE | Tempo limite excedido | Retestar disponibilidade. |

O portal oficial de **MT** também apresentou aviso de manutenção por incidente de segurança. Em **SE**, o fluxo nativo precisa do município/UF de domicílio; faltou esse dado para validar nova emissão. Portais com CAPTCHA, login ou desafio anti-bot continuam fora desta modalidade autônoma. O fluxo assistido anterior segue separado.

## Custos e uso

O painel da Direct Data mostrava R$ 0,36 por consulta, com adicional de 50% para PDF: **R$ 0,54 por documento**. As 21 consultas pagas da seleção completa estimam até **R$ 11,34**, mais R$ 0,36 pela consulta cadastral quando faltar o nome da mãe. O formulário mostra a seleção e pede a concordância com o custo. Os valores devem ser reconferidos se o provedor alterar a tarifa.

Saldo observado no painel durante a rodada: R$ 47,86 → R$ 27,72, diferença de **R$ 20,14**. Isso é a variação observada do saldo, sem conciliação de faturamento por chamada. Não houve recarga nem contratação de plano.

O fluxo reutiliza autenticação, isolamento e histórico de auditorias existentes. O cache de requisições da API distingue cliente e usuário e retém tentativas já enviadas para evitar nova cobrança pelo mesmo identificador durante a vida do processo. Reiniciar o processo ou criar outra consulta pode gerar nova cobrança.

## Evidências e validação

- 104 combinações de UF/tipo consultadas na API: 54 cível/criminal, mais 50 tipos adicionais em dez UFs.
- Portais DF, ES, GO, MT, SE e TO retestados. Lote real pelo coletor integrado concluiu oito emissões em DF/ES/TO; falência do ES foi emitida adicionalmente pelo portal.
- Os 30 PDFs reais foram reproduzidos pelo coletor integrado com os bytes originais, passando pelas verificações de identidade, estado e título, sem novas chamadas pagas.
- Suíte completa: 455 testes passaram com PostgreSQL embarcado isolado. Verificações posteriores do módulo, interface desktop/celular, custo, resultado parcial e autenticação foram executadas no checkout principal.
- Arquivos de teste reais e PDFs ficam em diretórios privados ignorados pelo Git. O pacote entregue localmente é `output/certidoes-validadas-2026-09-28.zip`. Não expor esses arquivos por rotas estáticas.

A análise de risco por IA ainda não está ativa nesta tela. Esta entrega amplia a obtenção dos documentos; não conclui toda a diligência imobiliária. Produção e GitHub ainda não receberam estas alterações.
