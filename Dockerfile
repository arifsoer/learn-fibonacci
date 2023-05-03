FROM node:16.15.1-alpine

#RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

RUN mkdir -p /app/node_modules && chown -R node:node /app

WORKDIR /app

COPY package*.json ./

RUN apk update && apk upgrade && apk add python3 make g++

RUN yarn install

COPY --chown=node:node . .

# RUN cp .env.prod .env

EXPOSE 3030

ENV TZ=Asia/Jakarta

CMD ["yarn","start:prod"]