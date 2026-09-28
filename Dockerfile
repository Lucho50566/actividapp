# Actividapp — imagen de producción (server Fastify + PWA estática)
# El server NO guarda API keys: cada usuario usa la suya desde su navegador.

# ---- build ----
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY server/package.json server/package.json
COPY web/package.json web/package.json
# instala TODAS las deps (incluye dev: tsx, vite, typescript) para poder compilar
RUN npm install
COPY . .
RUN npm run build

# ---- runtime ----
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["npm", "start"]
