#!/usr/bin/env bash
set -euo pipefail

# Levanta el entorno local completo para hacer una demo: wrangler pages dev
# + stripe listen, en el orden correcto. `wrangler pages dev` solo lee
# .dev.vars al arrancar, así que si STRIPE_WEBHOOK_SECRET se actualiza
# después de que ya está corriendo, los webhooks fallan la verificación de
# firma en silencio y los pedidos se quedan en "Pendiente de pago" aunque
# Stripe sí haya cobrado — esto ya pasó más de una vez probando a mano. Este
# script evita el problema por construcción: arranca stripe listen primero,
# captura el secreto que imprime, lo escribe en .dev.vars, y *después*
# arranca wrangler pages dev — nunca al revés.

cd "$(dirname "$0")"

PORT="${PORT:-8788}"
DEV_VARS=".dev.vars"

if [ ! -f "$DEV_VARS" ]; then
  echo "Falta $DEV_VARS — revisa el README antes de continuar." >&2
  exit 1
fi

if ! grep -q '^STRIPE_SECRET_KEY=.\+' "$DEV_VARS"; then
  echo "STRIPE_SECRET_KEY no está configurado en $DEV_VARS — el checkout no va a funcionar sin una clave de prueba de Stripe." >&2
  exit 1
fi

if ! command -v stripe >/dev/null 2>&1; then
  echo "No se encontró el comando 'stripe' (Stripe CLI) — instálalo y corre 'stripe login' antes de usar este script." >&2
  exit 1
fi

# Libera el puerto si quedó una instancia de wrangler corriendo de una
# sesión anterior (evita el error EADDRINUSE al reintentar la demo).
EXISTING_PID="$(lsof -ti:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [ -n "$EXISTING_PID" ]; then
  echo "Puerto $PORT ocupado por el proceso $EXISTING_PID — deteniéndolo."
  kill "$EXISTING_PID" 2>/dev/null || true
  sleep 1
fi

ORIGINAL_WEBHOOK_SECRET="$(grep '^STRIPE_WEBHOOK_SECRET=' "$DEV_VARS" | cut -d= -f2- || true)"
STRIPE_LOG="$(mktemp)"
WRANGLER_PID=""
STRIPE_PID=""

CLEANED_UP=""
cleanup() {
  # trap está registrado para EXIT/INT/TERM a la vez — sin esta guarda,
  # recibir INT/TERM corre cleanup y *luego* el EXIT que sigue lo vuelve a
  # correr, duplicando la salida ("Deteniendo..." dos veces) aunque sea
  # inofensivo (matar un PID ya muerto o volver a escribir el mismo valor
  # no hace daño, pero confunde en una demo).
  [ -n "$CLEANED_UP" ] && return
  CLEANED_UP=1

  echo ""
  echo "Deteniendo el entorno de demo..."
  [ -n "$WRANGLER_PID" ] && kill "$WRANGLER_PID" 2>/dev/null || true
  [ -n "$STRIPE_PID" ] && kill "$STRIPE_PID" 2>/dev/null || true
  # Restaura STRIPE_WEBHOOK_SECRET a como estaba (normalmente vacío) — un
  # secreto de una sesión de stripe listen que ya terminó no sirve para
  # nada y solo genera confusión si queda ahí.
  sed -i.bak "s/^STRIPE_WEBHOOK_SECRET=.*/STRIPE_WEBHOOK_SECRET=${ORIGINAL_WEBHOOK_SECRET}/" "$DEV_VARS"
  rm -f "$DEV_VARS.bak" "$STRIPE_LOG"
  echo "Listo."
}
trap cleanup EXIT INT TERM

echo "Iniciando stripe listen..."
stripe listen --events checkout.session.completed \
  --forward-to "localhost:${PORT}/api/checkout/webhook" > "$STRIPE_LOG" 2>&1 &
STRIPE_PID=$!

SECRET=""
for _ in $(seq 1 30); do
  SECRET="$(grep -oE 'whsec_[a-zA-Z0-9]+' "$STRIPE_LOG" || true)"
  [ -n "$SECRET" ] && break
  sleep 1
done

if [ -z "$SECRET" ]; then
  echo "No se pudo obtener el webhook secret de stripe listen. Salida:" >&2
  cat "$STRIPE_LOG" >&2
  exit 1
fi

echo "Webhook secret capturado (${SECRET:0:12}...) — escribiendo en $DEV_VARS."
sed -i.bak "s/^STRIPE_WEBHOOK_SECRET=.*/STRIPE_WEBHOOK_SECRET=${SECRET}/" "$DEV_VARS"
rm -f "$DEV_VARS.bak"

echo "Iniciando wrangler pages dev en el puerto $PORT..."
npx wrangler pages dev . --port "$PORT" &
WRANGLER_PID=$!

echo ""
for _ in $(seq 1 30); do
  curl -sf "http://localhost:${PORT}/api/products" >/dev/null 2>&1 && break
  sleep 1
done

cat <<EOF
Entorno de demo listo:
  Tienda:  http://localhost:${PORT}
  Admin:   http://localhost:${PORT}/admin.html

Una compra de prueba (tarjeta 4242 4242 4242 4242) ahora confirma el pago
y descuenta existencias correctamente de principio a fin.

Presiona Ctrl+C para detener todo (esto también limpia STRIPE_WEBHOOK_SECRET).
EOF

wait
