FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_NET_API_URL=http://localhost:3000/api/v1
ARG VITE_NET_API_TOKEN=
ENV VITE_NET_API_URL=$VITE_NET_API_URL
ENV VITE_NET_API_TOKEN=$VITE_NET_API_TOKEN

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
