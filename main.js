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
const mqtt = require('./mqtt.js').connect();
const util = require('./util.js');
const { influx } = require('./influx.js');
const thingyEndpoints = require('./thingy-endpoints.js');
const userEndpoints = require('./user-endpoints.js');
const wsBroadcast = require('./websocket.js');

const app = new Koa();
const router = new Router({ prefix: '/api/v1' });
const apiRouter = new Router({ prefix: '/api/v1' });

/*
 * MQTT handlers receiving and storing sensor data
 */

mqtt.on('light_intensity', async ({ data, device }) => {
  const light = {
    red: data.readUInt16LE(0),
    green: data.readUInt16LE(2),
    blue: data.readUInt16LE(4),
    clear: data.readUInt16LE(6)
  };
  const open = util.isDoorOpen(light);
  const rgb = util.toRgb(light);
  await influx.writePoints([
    {
      measurement: 'light_intensity',
      fields: rgb,
      tags: { device }
    },
    {
      measurement: 'door',
      fields: { open },
      tags: { device }
    }
  ]);
  wsBroadcast('light_intensity', device, rgb);
  wsBroadcast('door', device, { open });
});

mqtt.on('humidity', async ({ data, device }) => {
  const humidity = data.readUInt8(0);
  await influx.writePoints([
    {
      measurement: 'humidity',
      fields: { humidity },
      tags: { device }
    }
  ]);
  wsBroadcast('humidity', device, { humidity });
});

mqtt.on('temperature', async ({ data, device }) => {
  const temperature = data.readInt8(0) + (data.readUInt8(1) / 100);
  await influx.writePoints([
    {
      measurement: 'temperature',
      fields: { temperature },
      tags: { device }
    }
  ]);
  wsBroadcast('temperature', device, { temperature });
});

mqtt.on('air_quality', async ({ data, device }) => {
  const airQuality = {
    eco2: data.readUInt16LE(0),
    tvoc: data.readUInt16LE(2)
  };
  await influx.writePoints([
    {
      measurement: 'air_quality',
      fields: airQuality,
      tags: { device }
    }
  ]);
  wsBroadcast('air_quality', device, airQuality);
});

mqtt.on('battery_level', async ({ data, device }) => {
  const batteryLevel = data.readUInt8(0);
  await influx.writePoints([
    {
      measurement: 'battery_level',
      fields: { battery_level: batteryLevel },
      tags: { device }
    }
  ]);
  wsBroadcast('battery_level', device, { battery_level: batteryLevel });
});

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
  .get('/users/:username', userEndpoints.getUser)
  .use(jwt, authorize(['admin']))
  .get('/users', userEndpoints.getUsers)
  .post('/users', userEndpoints.addUser)
  .patch('/users/rights/:username', userEndpoints.updateRights)
  .del('/users/:user', userEndpoints.deleteUser);


apiRouter
  .use(jwt, authorize(['api']))
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
