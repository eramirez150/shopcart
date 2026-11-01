# 1. Compila el frontend con Node.
FROM node:24-alpine AS compilacion
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Las variables VITE_* se fijan al compilar: cambiarlas exige reconstruir la imagen.
ARG VITE_MODO_DEMO=false
ENV VITE_MODO_DEMO=$VITE_MODO_DEMO
RUN npm run build

# 2. Sirve los archivos estáticos con nginx y reenvía /api al contenedor de la API.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=compilacion /app/dist /usr/share/nginx/html
EXPOSE 8080
