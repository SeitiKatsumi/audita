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
| CE | TJCE | Parcial assistido | Portal carrega e preenche 8 campos; pausa em validacao oficial. | Mapear envio/download conclusivo. |
| RJ | TJRJ | Parcial assistido | Portal carrega e preenche 4 campos. | Mapear seletores e caminho ate emissao. |
| MA | TJMA | Parcial / login | Portal indica login/controle oficial; nenhum campo confiavel preenchido. | Confirmar se ha fluxo publico sem login e mapear formulario. |
| MG | TJMG | Parcial / login | Portal indica login/controle oficial; nenhum campo confiavel preenchido. | Mapear fluxo publico especifico. |
| PR | TJPR | Parcial assistido | Formulario publico de 2º grau carregado; 9 campos preenchidos e pausa em confirmacao oficial. | Mapear envio/download conclusivo e separar 1º grau, que exige contato com distribuidor. |
| RN | TJRN | Mapeamento pendente | Portal carrega, mas nenhum campo confiavel foi preenchido. | Mapear seletores do formulario. |
| TO | TJTO | Mapeamento pendente | Portal carrega, mas nenhum campo confiavel foi preenchido. | Mapear seletores e fluxo eproc. |
| PB | TJPB | Mapeamento pendente / protecao | Portal carrega, mas nenhum campo confiavel foi preenchido. | Mapear pos-protecao e formulario. |
| SC | TJSC | Mapeamento pendente / CAPTCHA | Portal carrega, mas nenhum campo confiavel foi preenchido. | Mapear formulario e validacao. |
| RR | TJRR | Parcial | Portal carrega e preenche 1 campo. | Mapear seletores Projudi TJRR. |
| MT | TJMT | Parcial assistido | SEC abre, mas ainda exige validacao/correcao antes de emitir. | Mapear campos obrigatorios faltantes. |
| SE | TJSE | Instavel / parcial | Uma execucao retornou texto conclusivo; outra parou em validacao/confirmacao. | Estabilizar seletores e evento de emissao. |
| BA | TJBA | Falha de acesso no teste | Timeout/`ERR_CONNECTION_TIMED_OUT` no portal oficial. | Revalidar disponibilidade e aumentar estrategia de espera. |
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
