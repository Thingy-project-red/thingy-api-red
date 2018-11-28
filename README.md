# thingy-api-red
A backend receiving data from Thingy:52 devices via MQTT and providing a REST
API for convenient access to it.

## Documentation
There is an OpenAPI specification of all endpoints in `openapi.yaml`.
The Node.js server hosts SwaggerUI on `/docs` to nicely display it, so when
running the API locally, that would be http://localhost:8000/docs.

While the API is still hosted on AWS for the duration of the project, it's also
available at https://api.thingy-project-red.com/docs.

## Getting started
1. Install Docker & Docker Compose
2. Create and edit `.env`. For reference, see `.env.TEMPLATE`.

## Run
To get everything up and running, use `docker-compose up`.
If you change some source files, do `docker-compose up --build` to rebuild the
image with your changes.
To remove all traces of it from your system, do
`docker-compose down -v --rmi all`.

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

## TLS
If you want to use TLS, you need to configure some things.
First of all, the container where the API is running needs to have access to
the certificates, because they're used in setting up secure WebSockets.
To do this, a simple but not really nice method is to mount the directory
structure containing the certificates inside the container.
To do this with Let's Encrypt, add the following volume definition to
`docker-compose.yml` in the API service.
```
volumes:
  - /etc/letsencrypt:/etc/letsencrypt:ro
```
We need to bind the whole directory structure at the exact same path, because
the folder with the current certificates uses symbolic links to the certificate
archive, which can't be resolved by docker-compose.

Finally, edit `.env` and append the following lines, replacing the host URL.
```
TLS_CERT=/etc/letsencrypt/live/YOUR_HOST_URL/cert.pem
TLS_KEY=/etc/letsencrypt/live/YOUR_HOST_URL/privkey.pem
```
Keep in mind that they refer to the bind mount inside the container. When the
environment variables you've just defined are present, the Node.js application
will read the certificates to create secure WebSockets.

## Check code with ESLint
This project uses the
[Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript).
With Node.js and NPM installed, run `npm install` to get, among other things,
the ESLint package and dependencies.
Run `npm run eslint` to detect issues and `npm run eslint-fix` to fix those
that are automatically fixable.
