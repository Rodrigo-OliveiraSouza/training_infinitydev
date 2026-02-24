# Deploy: training.infinity.dev.br

Este projeto roda como uma aplicacao Node unica (frontend + API + WebSocket).

## 1) Publicar no Git

```powershell
git add .
git commit -m "chore: deploy automation for training.infinity.dev.br"
git remote add origin <URL_DO_REPOSITORIO>
git push -u origin master
```

Se o remoto ja existir, pule o `git remote add`.

## 2) Subir backend de forma persistente no Windows

Execute como administrador:

```powershell
cd backend
npm install --omit=dev --no-audit --no-fund
cd ..
.\ops\deploy\install-backend-task.ps1 -StartNow
```

Isso cria uma Task no boot (`TrainingInfinityDevBackend`) que executa `ops/deploy/run-backend.ps1`.

Se sua conta nao tiver permissao de administrador, use o fallback por login de usuario:

```powershell
.\ops\deploy\install-user-startup.ps1 -StartNow
```

## 3) Configurar Cloudflare (Tunnel + DNS)

Crie um API Token no Cloudflare com estes escopos:
- `Account -> Cloudflare Tunnel:Edit`
- `Zone -> DNS:Edit`
- `Zone -> Zone:Read`

Depois execute:

```powershell
$env:CLOUDFLARE_API_TOKEN = "<SEU_TOKEN>"
.\ops\deploy\configure-cloudflare-tunnel.ps1 -Domain "infinity.dev.br" -Subdomain "training" -TunnelName "training-infinity-dev" -OriginUrl "http://localhost:3000"
```

Esse comando:
- cria/atualiza o tunnel `training-infinity-dev`
- configura ingress para `training.infinity.dev.br`
- cria/atualiza o DNS CNAME proxied para `<tunnel-id>.cfargotunnel.com`
- salva token do tunnel em `ops/deploy/.cloudflared-token.txt`

## 4) Instalar cloudflared como servico

Execute como administrador:

```powershell
.\ops\deploy\install-cloudflared-service.ps1
```

Sem administrador, o `install-user-startup.ps1` ja inicia `run-cloudflared.ps1` automaticamente no login.

## 5) Verificar

```powershell
.\ops\deploy\verify-public.ps1 -Hostname "training.infinity.dev.br"
```

Esperado:
- Local `http://127.0.0.1:3000/api/health` com `200`
- Publico `https://training.infinity.dev.br/api/health` com `200`
