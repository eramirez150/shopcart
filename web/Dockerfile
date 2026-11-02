# La misma receta arma la tienda o el panel, según VITE_APP.
# 1. Compila el frontend con Node.
FROM node:24-alpine AS compilacion
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Las variables VITE_* se fijan al compilar: cambiarlas exige reconstruir la imagen.
ARG VITE_APP=tienda
ARG VITE_MODO_DEMO=false
ENV VITE_APP=$VITE_APP
ENV VITE_MODO_DEMO=$VITE_MODO_DEMO
RUN npm run build

# 2. Sirve los archivos estáticos con nginx y reenvía /api al servicio de API_DESTINO.
# nginx reemplaza la variable en la plantilla al arrancar el contenedor.
FROM nginx:1.27-alpine
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=compilacion /app/dist /usr/share/nginx/html
EXPOSE 8080
