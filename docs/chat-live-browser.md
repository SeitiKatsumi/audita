# Navegador ao vivo no chat

## Escopo

O navegador ao vivo pertence exclusivamente ao fluxo JEC iniciado em `/chat`.
Coletores e sessões de certidões continuam usando o navegador assistido existente.

O portal não é incorporado por `iframe`. A Audita abre um Chrome isolado no
Steel, transmite a página por WebSocket/CDP e exibe o cliente interativo em um
`iframe` da própria Audita. Isso evita bloqueios `X-Frame-Options` e
`frame-ancestors`, mantendo mouse, teclado, rolagem, abas e navegação na mesma
sessão usada pelo agente.

## Controles de segurança

- A URL inicial deve ser HTTPS e pertencer à allowlist do portal JEC.
- A API e o WebSocket do Steel ficam privados; o navegador recebe somente rotas
  autenticadas da Audita.
- A IA não pode protocolar, ajuizar, assinar ou confirmar o envio final.
- Login, CAPTCHA, certificado, pagamento, anexos sensíveis e decisões jurídicas
  ambíguas exigem controle humano.
- Não há resolução ou bypass de CAPTCHA.
- A sessão expira por tempo e é encerrada no Steel.
- Se o Steel não estiver saudável, o fluxo volta automaticamente ao navegador
  assistido por snapshots.

## Configuração da Audita

```env
AUDITA_CHAT_LIVE_BROWSER_ENABLED=true
AUDITA_CHAT_BROWSER_PROVIDER=steel
STEEL_BROWSER_URL=http://steel-browser:3000
AUDITA_CHAT_BROWSER_MAX_SESSIONS=1
AUDITA_CHAT_BROWSER_SESSION_TIMEOUT_MS=900000
```

`STEEL_BROWSER_URL` deve ser um endereço de rede interno. Não publique as portas
`3000` ou `9223` do worker na Internet.

## Worker Steel self-hosted

Para desenvolvimento, o Steel open source pode rodar diretamente com Node.js e
Chrome:

```powershell
git clone https://github.com/steel-dev/steel-browser.git
cd steel-browser
npm.cmd install
$env:CHROME_HEADLESS = "true"
npm.cmd run dev
```

O healthcheck esperado é:

```text
GET http://127.0.0.1:3000/v1/health
```

Em infraestrutura Linux, a opção mais simples para uma POC é a imagem oficial:

```bash
docker run --rm \
  --name audita-steel-browser \
  --network audita-internal \
  --shm-size=2gb \
  ghcr.io/steel-dev/steel-browser
```

Em produção, fixe a imagem por digest, limite CPU/memória, use disco temporário
e hospede o worker na mesma região da Audita. A edição open source atual mantém
uma sessão ativa por instância; portanto, a capacidade deve ser escalada como
um worker/container por sessão concorrente, atrás de um pool.

## Critérios de aceite

O viewer informa os estados `online/offline` ao chat. Em caso de perda da
conexão, a interface oferece reconexão e remove sessões expiradas sem manter um
carregamento infinito. O encerramento envia o corpo JSON exigido pelo endpoint
de release do Steel para evitar browsers órfãos no worker.

1. O portal abre automaticamente ao lado da conversa.
2. A transmissão permanece fluida durante rolagem e digitação.
3. `Assumir controle` interrompe o agente antes de liberar os eventos humanos.
4. `Devolver à IA` bloqueia eventos humanos e retoma o agente no estado atual.
5. Fechar encerra a sessão remota e devolve o chat à largura total.
6. No celular, conversa e navegador alternam em tela cheia.
7. Queda do worker produz fallback explícito, sem quebrar o JEC.
8. Nenhum teste automatizado envia formulário ou protocolo real.

## Limites conhecidos

- A qualidade depende da latência entre usuário, Audita e worker.
- Áudio, WebGL pesado, downloads nativos e uploads de arquivos exigem validação
  específica antes de serem considerados suportados.
- Uma transmissão CDP interativa é um Preview real, mas não é o Chrome pessoal
  do usuário e não reutiliza automaticamente extensões, certificados ou sessões
  locais.
