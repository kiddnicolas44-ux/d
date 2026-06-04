FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends lua5.4 ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
COPY Prometheus-master ./Prometheus-master
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
