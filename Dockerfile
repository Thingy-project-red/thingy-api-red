FROM node:10-alpine
WORKDIR /thingy-api-red
COPY . /thingy-api-red
RUN npm install
CMD npm start
