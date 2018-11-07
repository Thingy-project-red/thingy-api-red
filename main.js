require('dotenv').config();
const log = require('debug')('api');
const Koa = require('koa');
const Router = require('koa-router');
const cors = require('@koa/cors');
const json = require('koa-json');
const bodyParser = require('koa-bodyparser');
const logger = require('koa-logger');
const mqtt = require('./mqtt.js').connect();
const util = require('./util.js');
const { influx } = require('./influx.js');
const thingyEndpoints = require('./thingy-endpoints.js');
const userEndpoints = require('./user-endpoints.js');

const app = new Koa();
const router = new Router();

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
});

/*
 * Routes, middlewares, Node.js
 */

router
  .get('/api/v1/users', userEndpoints.getUsers)
  .post('/api/v1/users', userEndpoints.addUser)
  .del('/api/v1/users/:user', userEndpoints.deleteUser)
  .post('/api/v1/auth', userEndpoints.authenticate)
  .get('/api/v1/devices', thingyEndpoints.getDevices)
  .get('/api/v1/:device/:metric/:seconds', thingyEndpoints.getMetricSeconds)
  .get('/api/v1/:device/:metric', thingyEndpoints.getMetric);

app
  .use(bodyParser())
  .use(cors())
  .use(logger())
  .use(json())
  .use(router.routes())
  .use(router.allowedMethods());

const port = 8000;
app.listen(port, () => {
  log(`ready and listening on port ${port}`);
});

module.exports = app;
