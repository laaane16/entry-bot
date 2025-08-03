FROM node:22-alpine

WORKDIR /app

COPY package.json package.json

RUN npm i

COPY . .

RUN npm run init

EXPOSE 3000

CMD ["npm", "run", "start"]