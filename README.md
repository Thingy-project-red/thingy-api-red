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

## Authentication
Certain API endpoints are restricted to authorized users and can only be
accessed by passing along a valid JWT in the authorization header, e.g.
`Authorization: Bearer <token>`.
Such a token is obtained by sending the name and password of a user to the
`/api/v1/auth` endpoint in the body of a POST request:
```
{
    "name": "Alice",
    "password": "not_123"
}
```
Since creating and deleting users requires the token of a user with `admin`
rights, we have a bit of a chicken and egg problem here.
For that reason, `.env` should contain the name and password of a special user
who doesn't really exist in the DB, but will be authenticated and granted
`admin` permission in the auth endpoint. Keep in mind that this username takes
precedence over a user of the same name in the DB.

## Check code with ESLint
This project uses the
[Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript).
With Node.js and NPM installed, run `npm install` to get, among other things,
the ESLint package and dependencies.
Run `npm run eslint` to detect issues and `npm run eslint-fix` to fix those
that are automatically fixable.
