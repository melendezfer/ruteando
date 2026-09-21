#!/usr/bin/env bash
# Levanta todo el stack de desarrollo (Postgres/MinIO vía Docker,
# backend/frontend vía pm2) de forma persistente — no depende de que
# esta terminal se quede abierta — y deja la app alcanzable desde un
# celular en la misma red WiFi que el computador.
#
# Contexto (ver CLAUDE.md sección 24): este entorno corre dentro de
# WSL2 en modo de red NAT (confirmado — no hay .wslconfig con
# `networkingMode=mirrored`), así que WSL2 tiene su propia IP interna
# (172.28.x.x), inalcanzable desde otros dispositivos de la LAN. Un
# celular necesita hablarle a la IP real de Windows (la del adaptador
# WiFi/Ethernet), y para que ese tráfico llegue hasta el servidor
# dentro de WSL2 hace falta reenviar los puertos con
# `netsh interface portproxy` + una regla de Firewall de Windows que
# permita esas conexiones entrantes — eso requiere privilegios de
# Administrador de Windows, que este script (corriendo dentro de
# WSL2 como usuario normal) no tiene: lo máximo que puede hacer es
# generar el `.ps1` con esos comandos y disparar el diálogo de UAC para
# que la persona apruebe la elevación con un clic — no hay forma de
# hacerlo por completo sin esa aprobación humana.
#
# Uso: bash scripts/dev-lan.sh
#      bash scripts/dev-lan.sh --prod-frontend
#
# --prod-frontend: el frontend corre compilado (next build + next
# start) en vez de next dev — sin socket de HMR. Existe por un bug real
# encontrado probando por LAN (ver CLAUDE.md sección 24): el handshake
# de ese socket puede fallar específicamente al acceder por la IP de
# LAN en este entorno (WSL2 NAT + portproxy), y cuando eso pasa React
# nunca llega a hidratar — la app se queda en "Cargando sesión..." para
# siempre, sin ningún fetch de por medio. No es un bug de la
# aplicación (confirmado con el mismo código corriendo en este modo,
# por la misma IP) — es que ese socket no existe en un build de
# producción, así que no hay nada que se pueda colgar. El backend NO
# necesita este modo — ya funciona bien por LAN tal cual, HTTP normal
# sin ningún socket de por medio.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PROD_FRONTEND=0
if [ "${1:-}" = "--prod-frontend" ]; then
  PROD_FRONTEND=1
fi

# 9000: MinIO (ver paso 4/6 más abajo — bug real, fotos rotas al abrir
# la app desde el celular, ver CLAUDE.md) — sin reenviar/permitir este
# puerto también, reescribir STORAGE_PUBLIC_URL a la IP de LAN no
# serviría de nada: el celular nunca llegaría hasta MinIO.
LAN_PORTS=(3000 3001 9000)

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$1"; }

# ---------------------------------------------------------------------
# 1. Detectar IPs (WSL interna y la LAN real de Windows)
# ---------------------------------------------------------------------
log "Detectando IPs (WSL interna y LAN de Windows)"

WSL_IP="$(hostname -I | awk '{print $1}')"
if [ -z "$WSL_IP" ]; then
  echo "No se pudo detectar la IP interna de WSL2." >&2
  exit 1
fi

LAN_IP="$(powershell.exe -NoProfile -Command \
  "(Get-NetIPConfiguration | Where-Object { \$_.IPv4DefaultGateway -ne \$null -and \$_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1 -ExpandProperty IPv4Address).IPAddress" \
  2>/dev/null | tr -d '\r\n')"
if [ -z "$LAN_IP" ]; then
  warn "No se pudo detectar la IP LAN de Windows vía powershell.exe — ¿este entorno es WSL2 con interop habilitado?"
  warn "Seguirá levantando todo igual, pero sin la URL para el celular ni el reenvío de puertos."
fi

echo "IP interna de WSL2:   $WSL_IP"
echo "IP LAN de Windows:    ${LAN_IP:-desconocida}"

# ---------------------------------------------------------------------
# 2. Infraestructura (Postgres + MinIO) — daemon de Docker, ya persiste
#    sola sin depender de esta terminal.
# ---------------------------------------------------------------------
log "Levantando Postgres + MinIO (docker compose up -d)"
docker compose up -d

echo -n "Esperando a que Postgres acepte conexiones"
for _ in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U ruteando >/dev/null 2>&1; then
    echo " listo."
    break
  fi
  echo -n "."
  sleep 1
done

# ---------------------------------------------------------------------
# 3. Migraciones (idempotente — node-pg-migrate no reaplica lo ya
#    aplicado). Necesita DATABASE_URL en el entorno, no lo carga solo
#    (a diferencia del backend/frontend, que leen su propio .env* con
#    dotenv). Corre en un SUBSHELL a propósito: si `set -a; source
#    .env.development` exportara las variables al proceso de ESTE
#    script (en vez de solo al subshell), quedarían pegadas en el
#    entorno del propio script — y como dotenv NO sobrescribe una
#    variable que ya existe en `process.env`, el backend que arranca
#    pm2 más abajo heredaría el CORS_ORIGIN viejo (el de ANTES del
#    paso 4, que todavía no reescribió el archivo) en vez de leer el
#    valor ya actualizado del archivo. Encontrado en vivo: sin este
#    subshell, `pm2 startOrReload` efectivamente ignoraba la reescritura
#    de CORS_ORIGIN del paso 4 — verificado leyendo
#    /proc/<pid>/environ del proceso ya corriendo.
log "Aplicando migraciones pendientes"
(
  set -a
  source .env.development
  set +a
  npm run migrate:up
)

# ---------------------------------------------------------------------
# 4. Apuntar el frontend al backend por la IP LAN (no "localhost" — en
#    el celular "localhost" se referiría a sí mismo) y aceptar ese
#    origen en CORS del backend. Archivos personales/gitignored — se
#    reescriben acá mismo, cada corrida, por si la IP cambió (DHCP).
# ---------------------------------------------------------------------
if [ -n "$LAN_IP" ]; then
  log "Apuntando client/.env.local y CORS_ORIGIN a $LAN_IP"

  API_LINE="NEXT_PUBLIC_API_BASE_URL=http://$LAN_IP:3000"
  if [ -f client/.env.local ] && grep -q '^NEXT_PUBLIC_API_BASE_URL=' client/.env.local; then
    sed -i "s#^NEXT_PUBLIC_API_BASE_URL=.*#$API_LINE#" client/.env.local
  else
    echo "$API_LINE" >>client/.env.local
  fi

  CORS_LINE="CORS_ORIGIN=http://localhost:3001,http://$LAN_IP:3001"
  if grep -q '^CORS_ORIGIN=' .env.development; then
    sed -i "s#^CORS_ORIGIN=.*#$CORS_LINE#" .env.development
  else
    echo "$CORS_LINE" >>.env.development
  fi

  # Bug real, encontrado investigando una foto rota al abrir el perfil de
  # un negocio desde el celular (ver CLAUDE.md): sin STORAGE_PUBLIC_URL,
  # almacenamiento.service.js arma fotos.url con STORAGE_ENDPOINT
  # (http://localhost:9000) — correcto solo para un navegador en ESTE
  # mismo computador; "localhost" en un celular se refiere al celular
  # mismo. Reescribirla acá, a la IP LAN, es el mismo criterio que ya
  # aplica NEXT_PUBLIC_API_BASE_URL arriba — un solo valor (no una
  # lista, a diferencia de CORS_ORIGIN), así que un navegador en este
  # mismo computador también pasa a usar la IP LAN en vez de localhost
  # para las fotos (sigue funcionando: la IP LAN es alcanzable desde
  # este mismo computador). Necesita que el puerto 9000 también esté en
  # LAN_PORTS (ver arriba) para que el reenvío/Firewall del paso 6 lo
  # cubra, o el celular nunca llegaría hasta MinIO aunque la URL ya
  # apunte bien.
  STORAGE_LINE="STORAGE_PUBLIC_URL=http://$LAN_IP:9000"
  if grep -q '^STORAGE_PUBLIC_URL=' .env.development; then
    sed -i "s#^STORAGE_PUBLIC_URL=.*#$STORAGE_LINE#" .env.development
  else
    echo "$STORAGE_LINE" >>.env.development
  fi
fi

# ---------------------------------------------------------------------
# 5. Backend + frontend, persistentes vía pm2 (sobreviven a que se
#    cierre esta terminal; no sobreviven a un `wsl --shutdown` ni a
#    reiniciar Windows — sin systemd de por medio para pm2 en este
#    entorno, hay que volver a correr este script después de eso).
# ---------------------------------------------------------------------
log "Levantando backend + frontend con pm2 (startOrReload, idempotente)"
if [ "$PROD_FRONTEND" -eq 1 ]; then
  echo "Frontend en modo producción (next build + next start, sin HMR) — ver CLAUDE.md sección 24."
  # `pm2 delete` (no solo `stop`): los dos procesos bindean :3001, así
  # que no pueden quedar los dos registrados en pm2 a la vez, ni
  # siquiera uno "detenido" — un `pm2 startOrReload` posterior sin este
  # flag no debe encontrarse este proceso todavía ahí.
  pm2 delete ruteando-frontend >/dev/null 2>&1 || true
  (cd client && npm run build)
  pm2 startOrReload ecosystem.config.cjs --only ruteando-backend,ruteando-frontend-prod
else
  pm2 delete ruteando-frontend-prod >/dev/null 2>&1 || true
  pm2 startOrReload ecosystem.config.cjs --only ruteando-backend,ruteando-frontend
fi
pm2 save >/dev/null

echo -n "Esperando a que el backend responda en :3000/health"
for _ in $(seq 1 30); do
  if curl -sf "http://localhost:3000/health" >/dev/null 2>&1; then
    echo " listo."
    break
  fi
  echo -n "."
  sleep 1
done

echo -n "Esperando a que el frontend responda en :3001"
for _ in $(seq 1 45); do
  if curl -sf "http://localhost:3001/" >/dev/null 2>&1; then
    echo " listo."
    break
  fi
  echo -n "."
  sleep 1
done

# ---------------------------------------------------------------------
# 6. Reenvío de puertos LAN -> WSL2 + regla de Firewall (requiere
#    Administrador de Windows — ver la nota larga al inicio de este
#    archivo). Se regenera el .ps1 en cada corrida por si la IP interna
#    de WSL2 cambió; solo dispara el diálogo de UAC si hace falta.
# ---------------------------------------------------------------------
PORTPROXY_OK=0
if [ -n "$LAN_IP" ]; then
  log "Revisando el reenvío de puertos (netsh portproxy) hacia WSL2"

  CURRENT_PROXY="$(powershell.exe -NoProfile -Command "netsh interface portproxy show v4tov4" 2>/dev/null | tr -d '\r')"
  NEEDS_SETUP=0
  for PORT in "${LAN_PORTS[@]}"; do
    if ! echo "$CURRENT_PROXY" | grep -qE "0\.0\.0\.0[[:space:]]+$PORT[[:space:]]+$WSL_IP[[:space:]]+$PORT"; then
      NEEDS_SETUP=1
    fi
  done

  WIN_USERPROFILE="$(powershell.exe -NoProfile -Command '$env:USERPROFILE' 2>/dev/null | tr -d '\r')"
  WIN_SCRIPT_WIN_PATH="${WIN_USERPROFILE}\\ruteando-lan-setup.ps1"
  WIN_SCRIPT_WSL_PATH="$(wslpath -u "$WIN_SCRIPT_WIN_PATH" 2>/dev/null || true)"

  if [ -n "$WIN_SCRIPT_WSL_PATH" ]; then
    {
      echo "# Generado por scripts/dev-lan.sh — reenvía los puertos $(IFS=,; echo "${LAN_PORTS[*]}") desde la IP LAN de Windows hacia WSL2 ($WSL_IP) y abre el Firewall para esos puertos."
      echo "# Seguro de re-ejecutar (borra la regla anterior antes de crear la nueva)."
      for PORT in "${LAN_PORTS[@]}"; do
        echo "netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=$PORT | Out-Null"
        echo "netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=$PORT connectaddress=$WSL_IP connectport=$PORT"
      done
      echo "Remove-NetFirewallRule -DisplayName 'Ruteando dev (LAN)' -ErrorAction SilentlyContinue"
      echo "New-NetFirewallRule -DisplayName 'Ruteando dev (LAN)' -Direction Inbound -Protocol TCP -LocalPort $(IFS=,; echo "${LAN_PORTS[*]}") -Action Allow | Out-Null"
      echo "netsh interface portproxy show v4tov4"
      echo "Write-Host ''"
      echo "Write-Host 'Listo. Desde el celular: http://$LAN_IP:3001'"
    } >"$WIN_SCRIPT_WSL_PATH"
    echo "Script generado en: $WIN_SCRIPT_WIN_PATH"
  fi

  if [ "$NEEDS_SETUP" -eq 1 ] && [ -n "$WIN_SCRIPT_WSL_PATH" ]; then
    warn "El reenvío de puertos no existe o apunta a una IP de WSL2 vieja — hace falta un permiso de Administrador de Windows que este script NO tiene."
    echo "Va a aparecer un aviso de Windows (UAC) pidiendo permiso — apruébalo para terminar la configuración."
    powershell.exe -NoProfile -Command \
      "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"$WIN_SCRIPT_WIN_PATH\"'" \
      >/dev/null 2>&1 || true

    echo -n "Esperando a que se apruebe el permiso y se apliquen las reglas"
    for _ in $(seq 1 60); do
      CURRENT_PROXY="$(powershell.exe -NoProfile -Command "netsh interface portproxy show v4tov4" 2>/dev/null | tr -d '\r')"
      OK=1
      for PORT in "${LAN_PORTS[@]}"; do
        echo "$CURRENT_PROXY" | grep -qE "0\.0\.0\.0[[:space:]]+$PORT[[:space:]]+$WSL_IP[[:space:]]+$PORT" || OK=0
      done
      if [ "$OK" -eq 1 ]; then
        PORTPROXY_OK=1
        echo " listo."
        break
      fi
      echo -n "."
      sleep 2
    done
    if [ "$PORTPROXY_OK" -eq 0 ]; then
      echo ""
      warn "No se confirmó el reenvío a tiempo — si no viste (o rechazaste) el aviso de Windows, corre manualmente como Administrador:"
      echo "    $WIN_SCRIPT_WIN_PATH"
    fi
  else
    PORTPROXY_OK=1
    echo "El reenvío de puertos ya estaba configurado correctamente hacia $WSL_IP."
  fi
fi

# ---------------------------------------------------------------------
# 7. Resumen
# ---------------------------------------------------------------------
log "Resumen"
pm2 list
echo ""
echo "En este computador:      http://localhost:3001"
if [ -n "$LAN_IP" ]; then
  if [ "$PORTPROXY_OK" -eq 1 ]; then
    echo "Desde el celular (LAN):  http://$LAN_IP:3001"
  else
    echo "Desde el celular (LAN):  http://$LAN_IP:3001  (pendiente de aprobar el permiso de Windows — ver arriba)"
  fi
else
  echo "Desde el celular (LAN):  no se pudo detectar la IP LAN de Windows"
fi
if [ "$PROD_FRONTEND" -eq 1 ]; then
  echo "Frontend: modo producción (sin recarga en vivo) — volvé a correr sin --prod-frontend para recuperar next dev."
else
  echo "Frontend: modo desarrollo (next dev, con recarga en vivo)."
fi
