FROM node:22-alpine

WORKDIR /app

COPY package.json package.json

RUN npm i

COPY . .

EXPOSE 3000

CMD npm run init && npm run start