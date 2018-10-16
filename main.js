const Koa = require('koa');
const Router = require('koa-router');
const mqtt = require('./mqtt.js').connect();

const app = new Koa();
const router = new Router();

/*
 * Global variables to store latest values of sensors until we have a DB
 */
const sensorData = {
  lastLight: {},
  lastHumidity: 0
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

/*
 * API endpoints
 */

async function getLight(ctx) {
  ctx.body = sensorData.lastLight;
}

async function getHumidity(ctx) {
  ctx.body = sensorData.lastHumidity;
}

/*
 * Routes, middlewares, Node.js
 */

router
  .get('/api/v1/light/latest', getLight)
  .get('/api/v1/humidity/latest', getHumidity);

app
  .use(router.routes())
  .use(router.allowedMethods());

const port = 8000;
app.listen(port, () => {
  console.log(`API:  ready and listening on port ${port}`);
});
