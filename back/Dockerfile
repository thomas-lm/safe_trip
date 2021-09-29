FROM node:14

RUN mkdir -p /safetrip

WORKDIR /safetrip

COPY package*.json ./
COPY server.js ./

RUN npm ci --only=production

COPY . .

EXPOSE 80

RUN mkdir -p /safetrip/data/db
RUN mkdir -p /safetrip/data/logs

CMD [ "npm", "start" ]