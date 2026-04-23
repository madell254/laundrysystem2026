FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV DISABLE_HTTPS=1
ENV PORT=8080

EXPOSE 8080

CMD ["sh", "-c", "node setup-db.mjs && node --enable-source-maps standalone-entry.mjs"]
