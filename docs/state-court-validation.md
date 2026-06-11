# Validacao de tribunais estaduais

Data da ultima rodada: 2026-06-10

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
| AP | TJAP | Bloqueio oficial | Portal chega em Cloudflare/Azion antes do formulario. | Manter fluxo assistido externo; mapear pos-validacao. |
| CE | TJCE | Assistido funcional / CAPTCHA | Formulario SIRECE carrega e aceita preenchimento; ao confirmar, retorna "Selecione o Captcha!". | Manter pausa assistida e mapear captura do protocolo/PDF apos validacao humana. |
| RJ | TJRJ | Mapeado assistido / wizard | Catalogo agora possui aliases de campos, defaults e navegacao inicial para Capital/Acoes Civeis/tipo de pessoa. | Revalidar wizard final, envio e captura de protocolo/PDF. |
| MA | TJMA | Mapeado assistido / login | Catalogo agora possui aliases e navegacao para entrada Cidadao, mas o portal pode exigir login/controle oficial. | Confirmar fluxo publico sem login e validar campos finais. |
| MG | TJMG | Mapeado assistido / login | Catalogo agora possui aliases/defaults para instancia, comarca, finalidade e dados pessoais. | Validar fluxo publico especifico e checkpoint oficial. |
| PR | TJPR | Mapeado assistido | Formulario publico de 2 grau possui aliases/defaults para pessoa fisica, contato e natureza. | Mapear envio/download conclusivo e separar 1 grau, que exige contato com distribuidor. |
| RN | TJRN | Mapeado assistido | Catalogo agora possui aliases para documento, nome, filiacao, contato e tipo de certidao. | Revalidar seletores reais do formulario. |
| TO | TJTO | Mapeado assistido / eproc | Catalogo agora possui aliases/defaults para eproc 1 grau. | Revalidar captcha/fluxo eproc e retorno final. |
| PB | TJPB | Mapeado assistido / protecao | Catalogo agora possui aliases/defaults; portal pode bloquear por protecao oficial. | Mapear pos-protecao e captura final. |
| SC | TJSC | Mapeado assistido / CAPTCHA | Catalogo agora possui aliases/defaults para formulario e validacao. | Revalidar captcha e download/protocolo. |
| RR | TJRR | Mapeado assistido / Projudi | Catalogo agora possui aliases/defaults para Projudi TJRR. | Revalidar seletores e retorno final. |
| MT | TJMT | Adapter especifico / instavel acesso | Adapter SEC ja preenche documento, nascimento, nome e tipo; catalogo ganhou aliases/defaults. | Revalidar disponibilidade quando o portal parar de retornar `ERR_CONNECTION_RESET`. |
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

## Validacao em producao

- Deploy CapRover validado em `https://auditainteligente.com.br` no commit `b6184e0b94ddf4224e629e5b2f4125d10924c27c`.
- `/api/health` retornou `status: ok`, banco `ready: true` e `auth.required: true`.
- `/data/state-courts.json` em producao retornou TJPR apontando para `https://www.tjpr.jus.br/certidao-de-2-grau-para-pessoa-fisica`.
- `POST /api/audits` e `GET /api/audits` em producao retornaram `401 authentication_required` sem sessao autenticada. Portanto, execucao pratica de consulta em producao precisa ser feita por usuario autenticado na interface ou com credencial/sessao valida.
