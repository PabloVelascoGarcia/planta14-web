# syntax=docker/dockerfile:1.28.0@sha256:bb22d9815c728170f72750f4e5b0d672e06176142e1d602c7e66c050100b7e5b
# SOLO PARA PRUEBAS en entornos donde `npm ci` no puede ejecutarse dentro de `docker build`.
# Empaqueta lo compilado en el host (npm ci + npm run build con la misma versión de Node) con la misma
# base, usuario y orden de arranque que infra/app.Dockerfile. No contiene ajustes de red ni de proxy.
# Uso: npm ci && npm run build && docker build -f infra/test/app-prebuilt.Dockerfile -t planta14-app:staging .
ARG NODE_IMAGE=node:22.23.4-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da
FROM ${NODE_IMAGE}
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --chown=node:node . ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "start"]
