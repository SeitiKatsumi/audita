# Validacao de tribunais estaduais

Data da ultima rodada: 2026-06-24

## Criterios

- **100% funcional**: collector emite/baixa evidencia oficial, extrai texto quando aplicavel e retorna resultado conclusivo (`nada_consta` ou `consta`) sem intervencao humana.
- **Assistido funcional**: Audita abre/preenche o portal oficial e pausa corretamente em CAPTCHA, reCAPTCHA, Cloudflare, login ou confirmacao oficial. Nao fecha a consulta sem evidencia final.
- **Parcial / mapeamento pendente**: portal carrega, mas campos nao sao preenchidos de forma confiavel, ou o fluxo ainda depende de seletores especificos.
- **Manual**: catalogado, mas sem adapter confiavel.

Os testes praticos usaram dados autorizados informados pelo usuario na sessao, com CPF mascarado nesta documentacao.

## Matriz atual

| UF | Tribunal | Status atual | Evidencia do teste | Proximo ajuste |
| --- | --- | --- | --- | --- |
| DF | TJDFT | 100% funcional | PDF oficial baixado, texto extraido, `nada_consta` identificado. | Validar demais tipos de certidao em lote. |
| ES | TJES | 100% funcional | Portal consultado automaticamente, PDF/texto com `nada_consta`. | Validar CPF/CNPJ e naturezas adicionais. |
| GO | TJGO | 100% funcional | Projudi consultado automaticamente, resultado `nada_consta`. | Validar criminal e variacoes de comarca/finalidade. |
| AL | TJAL | Assistido funcional | ESAJ seleciona modelo correto, preenche campos e pausa em reCAPTCHA oficial. | Validacao humana e captura do PDF pos-CAPTCHA. |
| AM | TJAM | Assistido funcional | Corrigido modelo ESAJ por UF; preenche 20 campos e pausa em reCAPTCHA. | Validacao humana e captura do PDF pos-CAPTCHA. |
| MS | TJMS | Assistido funcional | Corrigido modelo ESAJ por UF; preenche campos e pausa em reCAPTCHA. | Completar campos opcionais e captura pos-CAPTCHA. |
| SP | TJSP | Assistido funcional | ESAJ preenche fluxo e pausa em reCAPTCHA oficial. | Validacao humana e captura do PDF pos-CAPTCHA. |
| AP | TJAP | Bloqueado por Cloudflare | Agente navegador preencheu os campos corretamente, mas a validacao Cloudflare/Turnstile falhou no navegador automatizado mesmo com acao humana. | Retestar com fluxo de navegador confiavel/externo ou registrar bloqueio atual do portal. |
| CE | TJCE | Assistido funcional / CAPTCHA | Formulario SIRECE carrega e aceita preenchimento; ao confirmar, retorna "Selecione o Captcha!". | Manter pausa assistida e mapear captura do protocolo/PDF apos validacao humana. |
| RJ | TJRJ | Agente assistido experimental | Catalogo possui aliases/defaults e navegacao inicial para Capital/Acoes Civeis/tipo de pessoa. | Validar agente navegador com humano no loop. |
| MA | TJMA | Assistido funcional | JurisConsult preencheu campos, pausou no CAPTCHA oficial e, apos validacao humana, gerou certidao estadual online. | Capturar PDF/protocolo pelo botao do portal ou por "Inspecionar resultado". |
| MG | TJMG | Agente assistido experimental | Catalogo possui aliases/defaults para instancia, comarca, finalidade e dados pessoais. | Validar agente navegador com humano no loop. |
| PR | TJPR | Mapeado assistido | Formulario publico de 2 grau possui aliases/defaults para pessoa fisica, contato e natureza. | Mapear envio/download conclusivo e separar 1 grau, que exige contato com distribuidor. |
| RN | TJRN | Mapeado assistido | Catalogo agora possui aliases para documento, nome, filiacao, contato e tipo de certidao. | Revalidar seletores reais do formulario. |
| TO | TJTO | 100% funcional | eproc 1 grau consultado automaticamente; PDF oficial baixado e `nada_consta` identificado em `output/state-functional/latest-1782149369391.json`. | Validar outros tipos/instancias antes de ampliar escopo. |
| PB | TJPB | Bloqueado por Cloudflare no navegador assistido | Portal abre, mas a validacao Cloudflare nao aceita o ambiente Playwright/assistido mesmo com clique humano. | Usar navegador local/manual e anexar resultado; sem bypass anti-bot. |
| SC | TJSC | Agente assistido experimental | Catalogo possui aliases/defaults para formulario e validacao. | Validar agente navegador com humano no loop. |
| RR | TJRR | Agente assistido experimental | Catalogo possui aliases/defaults para Projudi TJRR. | Validar agente navegador com humano no loop. |
| MT | TJMT | 100% funcional | SEC2 consultado automaticamente; PDF oficial baixado, texto extraido e `nada_consta` identificado no teste local de 2026-06-24. | Revalidar em lote e confirmar outros tipos de certidao. |
| SE | TJSE | 100% funcional | Portal consultado automaticamente; certidao existente localizada pelo protocolo, PDF baixado, texto extraido e `nada_consta` identificado. | Validar natureza criminal e novas emissoes sem certidao preexistente. |
| BA | TJBA | Adapter especifico / falha de acesso | Adapter ja preenche tipo de pessoa/modelo/participacao e pausa no reCAPTCHA; catalogo ganhou aliases/defaults. | Revalidar disponibilidade do portal e rota de rede antes de captura pos-CAPTCHA. |
| AC | TJAC | Manual | Catalogado sem adapter Playwright ativo. | Mapear portal. |
| PA | TJPA | Manual | Catalogado sem adapter Playwright ativo. | Mapear portal. |
| PE | TJPE | Manual | Catalogado sem adapter Playwright ativo. | Mapear portal. |
| PI | TJPI | Manual | Catalogado sem adapter Playwright ativo. | Mapear portal. |
| RS | TJRS | Manual | Catalogado sem adapter Playwright ativo. | Mapear portal. |
| RO | TJRO | Manual | Catalogado sem adapter Playwright ativo. | Mapear portal. |

## Correcoes feitas nesta rodada

- Corrigido parser de PDF para carregar `pdf-parse/lib/pdf-parse.js` via `createRequire`; isso corrigiu a extracao dos PDFs do TJDFT no Node atual.
- Corrigido mapeamento de modelos ESAJ por UF para AL, AM, MS e SP.
- Corrigida agregacao de resultado para fluxos estaduais que retornavam `success` mas eram marcados como `indisponivel`.
- Ajustada classificacao do fallback generico: portal carregado com zero campos preenchidos e sem CAPTCHA/login agora vira `manual_required`/`mapeamento_pendente`, nao "assistido funcional".
- Adicionados aliases/defaults declarativos para RJ, MA, MG, PR, RN, TO, PB, SC, RR, MT e BA, permitindo que o preenchimento generico reconheca campos e selects desses portais.
- Adicionado adapter TJTO/eproc para emissao automatica com PDF.
- Ajustado TJMT para emissao/captura de PDF oficial do SEC2 e validacao do texto extraido antes de salvar.

## Validacao em producao

- Deploy CapRover validado em `https://auditainteligente.com.br` no commit `b6184e0b94ddf4224e629e5b2f4125d10924c27c`.
- `/api/health` retornou `status: ok`, banco `ready: true` e `auth.required: true`.
- `/data/state-courts.json` em producao retornou TJPR apontando para `https://www.tjpr.jus.br/certidao-de-2-grau-para-pessoa-fisica`.
- `POST /api/audits` e `GET /api/audits` em producao retornaram `401 authentication_required` sem sessao autenticada. Portanto, execucao pratica de consulta em producao precisa ser feita por usuario autenticado na interface ou com credencial/sessao valida.
