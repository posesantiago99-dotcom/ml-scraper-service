FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.js ./

ENV PORT=3001
EXPOSE 3001

CMD ["npm", "start"]
