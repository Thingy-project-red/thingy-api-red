require('dotenv').config();
const log = require('debug')('api');
const Koa = require('koa');
const Router = require('koa-router');
const cors = require('@koa/cors');
const mqtt = require('./mqtt.js').connect();

const app = new Koa();
const router = new Router();

/*
 * Global variables to store latest values of sensors until we have a DB
 */
const sensorData = {
  lastLight: {},
  lastHumidity: 0,
  lastTemp: {},
  lastAirQuality: {}
};

/*
 * MQTT handlers receiving and storing sensor data
 */

mqtt.on('light_intensity', (data) => {
  sensorData.lastLight = {
    red: data.readUInt16LE(0),
    green: data.readUInt16LE(2),
    blue: data.readUInt16LE(4),
    clear: data.readUInt16LE(6)
  };
});

mqtt.on('humidity', (data) => {
  sensorData.lastHumidity = data.readUInt8(0);
});

mqtt.on('temperature', (data) => {
  sensorData.lastTemp = {
    integer: data.readInt8(0),
    decimal: data.readUInt8(1),
    temperature: data.readInt8(0) + (data.readUInt8(1) / 100)
  };
});

mqtt.on('air_quality', (data) => {
  sensorData.lastAirQuality = {
    eco2: data.readUInt16LE(0),
    tvoc: data.readUInt16LE(2)
  };
});

/*
 * API endpoints
 */

async function getLight(ctx) {
  ctx.body = sensorData.lastLight;
}

async function getHumidity(ctx) {
  ctx.body = sensorData.lastHumidity;
}

async function getTemperature(ctx) {
  ctx.body = sensorData.lastTemp;
}

async function getAirQuality(ctx) {
  ctx.body = sensorData.lastAirQuality;
}

/*
 * Routes, middlewares, Node.js
 */

router
  .get('/api/v1/light/latest', getLight)
  .get('/api/v1/humidity/latest', getHumidity)
  .get('/api/v1/temperature/latest', getTemperature)
  .get('/api/v1/air_quality/latest', getAirQuality);

app
  .use(cors())
  .use(router.routes())
  .use(router.allowedMethods());

const port = 8000;
app.listen(port, () => {
  log(`ready and listening on port ${port}`);
});
