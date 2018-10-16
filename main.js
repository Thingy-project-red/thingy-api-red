const Koa = require('koa');
const Router = require('koa-router');
const mqtt = require('./mqtt.js').connect();

const app = new Koa();
const router = new Router();

/*
 * Global variables to store latest values of sensors until we have a DB
 */
let lastLight = {};

/*
 * MQTT handlers receiving and storing sensor data
 */

mqtt.on('light_intensity', (data) => {
  lastLight = {
    red: data.readUInt16LE(0),
    green: data.readUInt16LE(2),
    blue: data.readUInt16LE(4),
    clear: data.readUInt16LE(6)
  };
});

/*
 * API endpoints
 */

async function getLight(ctx) {
  ctx.body = JSON.stringify(lastLight);
}

/*
 * Routes, middlewares, Node.js
 */

router
  .get('/api/v1/light/latest', getLight);

app
  .use(router.routes())
  .use(router.allowedMethods());

app.listen(8000);
