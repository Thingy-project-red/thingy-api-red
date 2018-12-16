require('dotenv').config();
const log = require('debug')('api');
const Koa = require('koa');
const Router = require('koa-router');
const cors = require('@koa/cors');
const json = require('koa-json');
const bodyParser = require('koa-bodyparser');
const logger = require('koa-logger');
const jwt = require('koa-jwt')({ secret: process.env.JWT_SECRET });
const req = require('require-yml');
const koaSwagger = require('koa2-swagger-ui');
const thingyEndpoints = require('./thingy-endpoints.js');
const userEndpoints = require('./user-endpoints.js');
require('./data-processor.js');

const app = new Koa();
const router = new Router({ prefix: '/api/v1' });
const apiRouter = new Router({ prefix: '/api/v1' });

/*
 * Generator for middleware comparing user rights in JWT with the required ones
 * to determine if the user is authorized to use this endpoint.
 */

function authorize(requiredRights) {
  return async (ctx, next) => {
    // Make sure there is a rights property
    if (!('rights' in ctx.state.user)) {
      ctx.throw(401, 'Invalid JWT, missing rights');
    }
    // Make sure user has all required rights
    if (!requiredRights.every(x => ctx.state.user.rights.includes(x))) {
      ctx.throw(401);
    }

    await next();
  };
}

/*
 * Routes, middlewares, Node.js
 */

router
  .post('/auth', userEndpoints.authenticate)
  .use(jwt, authorize([]))
  .get('/users/:user', userEndpoints.getUser)
  .use(authorize(['admin']))
  .get('/users', userEndpoints.getUsers)
  .post('/users', userEndpoints.addUser)
  .patch('/users/:user', userEndpoints.updateUserData)
  .del('/users/:user', userEndpoints.deleteUser);


apiRouter
  .use(jwt, authorize(['api']))
  .patch('/users/:user/preferences', userEndpoints.updateUserPrefs)
  .get('/devices', thingyEndpoints.getDevices)
  .get('/:device/status', thingyEndpoints.getDeviceStatus)
  .get('/:device/:metric/average/:seconds', thingyEndpoints.getAvgMetricSeconds)
  .get('/:device/:metric/average', thingyEndpoints.getAvgMetric)
  .get('/:device/:metric/:seconds', thingyEndpoints.getMetricSeconds)
  .get('/:device/:metric', thingyEndpoints.getMetric);

app
  .use(bodyParser())
  .use(cors())
  .use(logger())
  .use(json())
  .use(koaSwagger({
    swaggerOptions: {
      spec: req('./openapi.yaml')
    }
  }))
  .use(router.routes())
  .use(router.allowedMethods())
  .use(apiRouter.routes())
  .use(apiRouter.allowedMethods());

const port = 8000;
app.listen(port, () => {
  log(`ready and listening on port ${port}`);
});

module.exports = app;
