# syntax=docker/dockerfile:1.28.0@sha256:bb22d9815c728170f72750f4e5b0d672e06176142e1d602c7e66c050100b7e5b
# Imagen de la aplicación Next.js + Payload para el entorno de pruebas (staging).
# Contexto de build: raíz del repositorio. Ver infra/compose.staging.yaml.
# Fijada por digest; para actualizarla ver "Actualizar imágenes" en docs/INFRA-STAGING.md.
ARG NODE_IMAGE=node:22.23.4-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
ENV NODE_OPTIONS=--max-old-space-size=768
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=768 LOW_MEMORY_BUILD=true
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# El build se hace con el CMS desactivado: no necesita base de datos ni secretos.
# La activación (CMS_ENABLED=true) se decide en tiempo de ejecución.
RUN CMS_ENABLED=false npm run build

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# Se conserva node_modules completo: el CLI de Payload (migraciones) lo necesita.
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "start"]
