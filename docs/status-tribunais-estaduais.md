# Status dos tribunais estaduais

Atualizado em: 2026-06-24 19:20 BRT

Objetivo: lista simples para priorizar apresentacao e ajustes do modulo `Tribunais estaduais / Pessoa fisica`.

## Status para apresentacao agora

- **100% automaticos com PDF:** `DF, ES, GO, MT, SE, TO`
- **Assistidos bons para demonstrar:** `AL, AM, BA, CE, MA, MS, PE, SP`
- **Agente IA experimental demonstravel:** `AP, PA, PI, RJ, RS`
- **Nao demonstrar como pronto:** `AC, RN, RO, MG, PB, PR, RR, SC`

## Criterio usado nesta rodada

- **100% automatico:** executa no portal oficial, retorna `success`, `nada_consta` e baixa PDF para todos os tipos testados, sem acao humana.
- **Assistido demonstravel:** abre/preenche o portal oficial e para corretamente em CAPTCHA, reCAPTCHA ou codigo oficial, exigindo humano.
- **Agente IA experimental:** agente preenche campos relevantes e faz handoff humano em validacao/ambiguidade; nao vender como automatico.
- **Problema/nao demonstrar:** exige login/governo, bloqueia por anti-bot, desvia fluxo, nao preenche de forma confiavel ou nao foi validado nesta rodada.

## Prontos para demonstracao

| Status | UFs | Evidencia da rodada |
| --- | --- | --- |
| Automatico com PDF | DF, ES, GO, MT, SE, TO | MT revalidado em 2026-06-24; retornou `success`, `nada_consta` e PDF baixado. TO revalidado em 2026-06-22. DF/ES/GO/SE revalidados em 2026-06-17. |
| Assistido ate validacao oficial | AL, AM, BA, CE, MA, MS, PE, SP | MA revalidado em 2026-06-24: apos CAPTCHA humano, o portal gerou certidao. Demais revalidados em 2026-06-17. |

## Nao demonstrar como pronto

| Status | UFs | Motivo |
| --- | --- | --- |
| Agente IA experimental | AP, PA, PI, RJ, RS | RJ revalidado em 2026-06-24 ate resumo do CJE com reCAPTCHA. Demais fluxos revalidados em 2026-06-17. Usar como demonstracao experimental com humano no loop. |
| Agente IA bloqueado/baixo valor para demo | AC, RN, RO | AC exige gov.br; RN retornou Access Denied; RO bloqueou no STIC/anti-bot. |
| Em investigacao/desenvolvimento | MG, PB, PR, RR, SC | Portal com erro oficial, anti-bot, dado obrigatorio pendente ou fluxo ainda nao validado ponta a ponta nesta rodada. |

## Matriz resumida por UF

| UF | Tribunal | Status atual | Acao na apresentacao |
| --- | --- | --- | --- |
| AL | TJAL | Assistido ate reCAPTCHA | Demonstrar preenchimento e explicar validacao humana. |
| AM | TJAM | Assistido ate reCAPTCHA | Demonstrar apenas se precisar de mais exemplos assistidos. |
| AP | TJAP | Agente IA ate Cloudflare/Turnstile | Demonstrar como agente experimental: preenche Tucujuris e pausa na validacao humana. |
| BA | TJBA | Assistido ate reCAPTCHA | Demonstrar como fluxo assistido. |
| CE | TJCE | Assistido ate reCAPTCHA | Demonstrar apenas se precisar de mais exemplos assistidos. |
| DF | TJDFT | Automatico com PDF | Demonstrar como fluxo 100% automatico. |
| ES | TJES | Automatico com PDF | Demonstrar como fluxo 100% automatico. |
| GO | TJGO | Automatico com PDF | Demonstrar como fluxo 100% automatico. |
| MA | TJMA | Assistido gera certidao apos CAPTCHA | Demonstrar preenchimento; humano resolve CAPTCHA e o portal exibe a certidao. |
| MS | TJMS | Assistido ate reCAPTCHA | Demonstrar preenchimento e explicar validacao humana. |
| PE | TJPE | Assistido ate codigo de seguranca | Demonstrar preenchimento; humano informa codigo. |
| PA | TJPA | Agente IA ate hCaptcha | Demonstrar como agente experimental: preenche CPF/data e pausa no hCaptcha. |
| PI | TJPI | Agente IA ate reCAPTCHA | Demonstrar como agente experimental: preenche campos obrigatorios e pausa no reCAPTCHA. |
| RN | TJRN | Bloqueado por Access Denied | Nao demonstrar como pronto. |
| RS | TJRS | Agente IA ate revisao humana | Demonstrar apenas como experimental: preenche iframe oficial e para em revisao humana. |
| SE | TJSE | Automatico com PDF | Demonstrar como fluxo 100% automatico. |
| SP | TJSP | Assistido ate reCAPTCHA | Demonstrar preenchimento e pedido por e-mail apos validacao humana. |
| MG | TJMG | Agente IA fragil ate reCAPTCHA/codigo | Nao demonstrar como pronto; fluxo desviou e exige intervencao manual. |
| MT | TJMT | Automatico com PDF | Demonstrar como fluxo 100% automatico; validado com PDF oficial salvo e `nada_consta`. |
| PB | TJPB | Bloqueado por Cloudflare no navegador assistido | Abre portal, mas o Cloudflare nao aceita a verificacao no Playwright mesmo com acao humana. Usar navegador local/manual. |
| PR | TJPR | Manual/portal oficial | Nao demonstrar como pronto. |
| RJ | TJRJ | Agente IA ate resumo/reCAPTCHA | Demonstrar como experimental: preenche CJE RJ/Capital, chega ao resumo e pausa na validacao oficial. |
| RR | TJRR | Login Keycloak | Nao demonstrar como pronto. |
| SC | TJSC | Login gov.br | Nao demonstrar como pronto. |
| TO | TJTO | Automatico com PDF | Demonstrar como fluxo 100% automatico. |

## Evidencias locais

### Fluxo da aplicacao

Validados via `createAuditService` em 2026-06-17 20:06 BRT:

| UF | Consulta | Status | Resultado | PDFs |
| --- | --- | --- | --- | --- |
| DF | UI local `301d8e6d-55c6-44f4-ad81-63576a746550` | `success` | `nada_consta` | 4/4, links `/storage/pdfs/...` abrem no navegador |
| DF | `8e4e17a7-540a-471f-b479-d4f308b58fda` | `success` | `nada_consta` | 4/4 |
| DF | `70df979e-c360-42e7-9b29-a0d57eb722c2` | `success` | `nada_consta` | 4/4 |
| ES | `73dbf94e-ad3e-45c1-bef6-0a78fe5332e8` | `success` | `nada_consta` | 1/1 |
| GO | `69eaf092-747b-4de0-83ec-ad9cb45cbcfe` | `success` | `nada_consta` | 1/1 |
| SE | `1a45b871-dfb4-4e80-854e-7f76a5ce90c4` | `success` | `nada_consta` | 1/1 |

### Collector funcional

- `DF`: `output/state-functional/latest-1781790723045.json` - `Criminal`, `Civel`, `Falencia` e `Especial`, 4/4 PDFs baixados em 2026-06-18.
- `DF`: `output/state-functional/latest-1781737853072.json` - `Criminal`, `Civel`, `Falencia` e `Especial`, 4/4 PDFs baixados.
- `ES`: `output/state-functional/latest-1781738003123.json` e `output/state-functional/latest-1781737736312.json` - `Civel`, `Criminal` e `Falencia`, 3/3 PDFs baixados.
- `GO`: `output/state-functional/latest-1781738060031.json` - `Civel` e `Criminal`, 2/2 PDFs baixados.
- `MT`: teste local em 2026-06-24 - `Civel`, `success`, `nada_consta`, PDF salvo em `storage/pdfs/debug-mt-1782317310175-tjdft-tjmt-civil.pdf`.
- `SE`: `output/state-functional/latest-1781738138754.json` - `Civel` e `Criminal`, 2/2 PDFs baixados.
- `MA`: teste manual assistido em 2026-06-24 - apos CAPTCHA humano, JurisConsult gerou certidao estadual online com numero/codigo de validacao.
- `AL/AM/BA/CE/MA/MS/PE/SP`: `output/state-functional/latest-1781738228288.json` - todos pararam corretamente em validacao humana oficial.
- `MA/TO/MT/PB`: `output/state-functional/latest-1782149369391.json` - TO automatico com PDF; MA ate CAPTCHA oficial; MT antes estava pendente no SEC sem aceitar PDF institucional como certidao; PB bloqueado por Cloudflare.

### Agente navegador

- `AP/PA/PI/RS`: `output/state-agent/latest-1781738413949.json` - agentes preencheram campos relevantes e pararam em handoff humano/validacao/revisao.
- `RJ`: teste local em 2026-06-24 - fluxo CJE RJ/Capital mapeado: formulario `Acoes Civeis`, requerente, requerido, finalidade `Informacao pessoal` e resumo com reCAPTCHA.
- `PI`: `output/state-agent/latest-1782146092520.json` - preencheu Tipo Pessoa, Grau, Tipo Certidao, Nome, CPF, RG, Orgao Expeditor, Estado Civil, Pai, Mae, CEP, Endereco, Numero, Bairro, UF e Municipio; parou corretamente no reCAPTCHA.
- `AP`: `output/state-agent/latest-1781734951061.json` - preenche Tucujuris, incluindo genero, e pausa em Cloudflare/Turnstile.
- `RS`: `output/state-agent/latest-1781734224992.json` - preenche iframe oficial do TJRS e para em handoff humano apos `Emitir Documento`.
- `RN`: `output/state-agent/latest-1781730421412.json` - bloqueado por Access Denied.
- `RS`: `output/state-agent/latest-1781730367477.json` - preenche iframe do TJRS e tenta emitir; ainda requer revisao humana.
- `AC/RO`: `output/state-agent/latest-1781731907831.json` - AC exige gov.br; RO bloqueado por STIC/anti-bot.
- `MG/SC`: `output/state-agent/latest-1781732223292.json` - MG fragil/reCAPTCHA-codigo; SC exige gov.br.
- `MT/RR`: `output/state-agent/latest-1781732284316.json` - MT bloqueado por cota reCAPTCHA; RR exige login Keycloak.

### Outros mapeados em investigacao

- `PB/PR/TO`: `output/state-functional/latest-1781732304373.json` - PB e TO chegaram a validacao sem preenchimento util; PR ficou em portal/manual oficial.
