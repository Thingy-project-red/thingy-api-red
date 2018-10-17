# thingy-api-red
Backend providing the thingy API

## Getting started
1. Install Docker & Docker Compose
2. Create and edit `.env`.
For reference, see `.env.TEMPLATE`

## Run
To get everything up and running, use `docker-compose up`.
If you change some source files, do `docker-compose up --build` to rebuild the
image with your changes.
To remove all traces of it from your system, do
```
# Remove containers
docker-compose down
# Remove image
docker rmi thingy-api-red_api
# Remove InfluxDB volume
docker volume rm thingy-api-red_influx
```

## Check code with ESLint
This project uses the
[Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript).
With Node.js and NPM installed, run `npm install` to get, among other things,
the ESLint package and dependencies.
Run `npm run eslint` to detect issues and `npm run eslint-fix` to fix those
that are automatically fixable.
