FROM nodered/node-red-docker:slim
WORKDIR /data

# Stage 1: install NPM dependencies (only runs when dependencies changed)
COPY package.json .
COPY package-lock.json .
RUN npm install

# Stage 2: copy node-red settings file
COPY settings.js .

# Stage 3: reset workdir and mark data to be initialized on volume creation
WORKDIR /usr/src/node-red
VOLUME /data
