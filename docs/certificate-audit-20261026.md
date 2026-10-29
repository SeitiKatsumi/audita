# Auditoria real de certidões TJ — 26/10/2026

## Lacunas comprovadas na Audita

| UF | Perfil | Documento disponível na Direct, mas não captado corretamente | Causa comprovada |
| --- | --- | --- | --- |
| ES | CPF | Família; execuções fiscais | PDF atual apresenta o cabeçalho geral seguido de FAMÍLIA ou EXECUÇÕES FISCAIS. O catálogo exige os títulos antigos NATUREZA FAMÍLIA e NATUREZA DE EXECUÇÕES FISCAIS; o coletor rejeita com evidence_scope_mismatch. |
| PA | CNPJ | Criminal | Consulta real retornou certidão judicial criminal negativa, com CNPJ, razão social, UF e título correspondentes. O catálogo público permite somente a cível para CNPJ. |
| RR | CPF | Criminal; militar | A API atual retorna criminal com TIPO=Criminal e militar com TIPO=Militar. O catálogo ainda associa Criminal a Cível, Militar a Criminal e Concordata/Falências a Militar. A primeira é rejeitada pelo fornecedor e as demais são recusadas por título divergente. |
| RS | CPF | Criminal | A Direct retorna CERTIDÃO JUDICIAL CRIMINAL NEGATIVA. A opção atual usa o mesmo parâmetro, mas exige ALVARÁ DE FOLHA CORRIDA; o coletor rejeita por escopo. A cível permanece uma opção distinta. |

Os PDFs destas lacunas tiveram identidade, documento, UF e título conferidos. PA, RS, RR e ES/Família também foram renderizados e inspecionados; o cabeçalho fiscal do ES foi verificado no texto integral. Não foi relaxada nenhuma validação do produto nem alterado o catálogo.

## UFs sem nenhuma opção TJ habilitada no catálogo público

- CPF: AC, AL, AM, CE, MA, MG, MS, PB, PR, RJ, RN, RO, SC e SP.
- CNPJ: AC, AL, AM, CE, GO, MA, MG, MS, MT, PB, PR, RJ, RN, RO, RR, SC, SP e TO.

Este é o inventário de ausência de integração habilitada, diferente das quatro lacunas com PDF disponível acima. Não houve PDF válido ignorado comprovado para estes perfis/UFs nesta rodada. MS/CPF permaneceu pendente na última consulta do histórico; não foi classificado como falha definitiva.

## Falhas atuais do fornecedor em opções já habilitadas

| UF | Perfil/tipo testado | Resultado real |
| --- | --- | --- |
| MT | CPF criminal | HTTP503, problemas de processamento, sem PDF. |
| PE | CPF cível, criminal e fins eleitorais; CNPJ cível e criminal | HTTP200, resultadoId9, Sistema Remoto Indisponível, sem PDF. HTTP200 não é emissão. |
| SE | CPF/CNPJ cível e criminal | Após processamento assíncrono, HTTP500/resultadoId21, sem PDF. |
| TO | CPF fiscal e falência/recuperação | HTTP503, sem PDF. A cível e criminal do produto usam portal oficial, não esta API. |
| ES | CPF militar | PDF contém somente 403 Forbidden. Rejeição correta; não é certidão emitida. |

As falhas acima descrevem a rodada e os titulares testados, não impossibilidade permanente nem prova de inexistência da certidão oficial. DF retornou HTTP500 na Direct, mas o catálogo da Audita usa o portal oficial; não foi considerado uma lacuna da integração Direct. Os portais oficiais não tiveram nova emissão executada nesta auditoria.

## Limitações confirmadas na API

- AC, AM, CE, PB e RN: cível e criminal falharam para CPF/CNPJ; tipos adicionais aceitos também falharam. Demais tipos foram rejeitados como não suportados.
- GO, MT e RR: resposta da Direct rejeita CNPJ. Essa é uma limitação observada na API, não uma afirmação de impossibilidade de emissão diretamente no tribunal.
- MG, PR e SC: a própria API informa indisponibilidade de emissão.
- MA, RJ e RO: rejeição de CPF/CNPJ nos parâmetros consultados.
- AL: HTTP500; SP: HTTP503. Ambas continuam fora da oferta pública do fornecedor.
- MS: CNPJ terminou HTTP500; CPF ainda pendente na última verificação gratuita.

## Método e resultados

- Catálogos local e produção consultados por GET: ambos com 36 opções CPF/13 UFs e20 opções CNPJ/9 UFs. Código auditado: main30eb7e5, após fetch; checkout de auditoria codex/auditoria-ufs-20261026, base develop conciliada por fast-forward com main. Alterações locais paralelas preservadas.
- 155 submissões reais autorizadas: cível/criminal nas18 UFs anunciadas; cível por CPF/CNPJ nas nove restantes; demais combinações Direct já habilitadas no produto; outros cinco tipos nas lacunas anunciadas, exceto quando a API rejeitava o perfil inteiro. Sem repetir submissão paga para recuperar resultado demorado.
- Resultado final: 121 falhas do fornecedor,32 PDFs com identidade/UF verificadas, um PDF inválido403 e uma consulta pendente. Os32 PDFs incluem documentos que a Audita rejeita por título ou não oferece. Não são32 novas opções nem prova de nova emissão em todas as consultas; o fornecedor pode devolver documento anteriormente emitido ainda válido.
- Download privado de33 PDFs, leitura independente com pypdf e reprodução das40 combinações Direct habilitadas usando o coletor e parser reais do checkout isolado. Destas,22 passaram,18 não concluíram corretamente; as causas constam em replay-sanitized.json. A leitura do lote usou a razão social cadastral correspondente ao CNPJ, sem o sufixo de matriz/filiais agregado por uma certidão anterior.
- As dependências foram instaladas somente no checkout isolado. Nenhuma alteração funcional, consulta de IA, cobrança Stripe, mudança em banco/chaves/configuração, push ou deploy.
- Estimativa operacional conservadora:155 × R$0,54 = R$83,70; não é fatura ou débito conciliado. O preço público-base é R$0,36; o adicional de50% para PDF é a configuração operacional existente.

Evidências privadas, respostas, PDFs, scripts reproduzíveis e JSON sanitizado: S:/CodexBuilds/Audita-state-audit-20261026. Dados pessoais, URLs privadas e consultaUid ficam fora deste relatório e do Git.

Fontes oficiais conferidas: [catálogo técnico](https://directd.com.br/central-de-ajuda/apis/catalogo/TJCertidaoCivelCriminalFiscal), [oferta de18 UFs](https://www.directd.com.br/apis/tj-certidao-civel-criminal-fiscal), [OpenAPI](https://apiv3.directd.com.br/swagger/v3-scalar/swagger.json). O OpenAPI possui uma rota de emissão TJ; TribunalJustica é consulta processual, não uma segunda rota de certidão.

Próximo passo técnico, não executado: corrigir o mapeamento/título de ES, RR e RS e homologar a opção criminal CNPJ do PA com os PDFs já obtidos, sem novas consultas pagas. Sem alteração nesta auditoria.
