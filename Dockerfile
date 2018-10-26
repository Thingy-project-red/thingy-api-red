FROM node:10-alpine
WORKDIR /thingy-api-red

# Stage 1: install NPM dependencies (only runs when dependencies changed)
COPY package.json /thingy-api-red
COPY package-lock.json /thingy-api-red
RUN npm install

# Stage 2: copy code (only runs when code changed)
COPY . /thingy-api-red

CMD npm start
