require('dotenv').config();
const log = require('debug')('api');
const Koa = require('koa');
const Router = require('koa-router');
const cors = require('@koa/cors');
const Influx = require('influx');
const mqtt = require('./mqtt.js').connect();
const json = require('koa-json')
const bodyParser = require('koa-bodyparser');
const logger = require('koa-logger');

const app = new Koa();
const router = new Router();
const influx = new Influx.InfluxDB({
  host: 'db',
  database: process.env.INFLUXDB_DB,
  schema: [
    {
      measurement: 'light_intensity',
      fields: {
        red: Influx.FieldType.INTEGER,
        green: Influx.FieldType.INTEGER,
        blue: Influx.FieldType.INTEGER,
        clear: Influx.FieldType.INTEGER
      },
      tags: []
    },
    {
      measurement: 'humidity',
      fields: {
        humidity: Influx.FieldType.INTEGER
      },
      tags: []
    },
    {
      measurement: 'temperature',
      fields: {
        temperature: Influx.FieldType.FLOAT
      },
      tags: []
    },
    {
      measurement: 'air_quality',
      fields: {
        eco2: Influx.FieldType.INTEGER,
        tvoc: Influx.FieldType.INTEGER
      },
      tags: []
    }
  ]
});

/*
 * MQTT handlers receiving and storing sensor data
 */

mqtt.on('light_intensity', async (data) => {
  const light = {
    red: data.readUInt16LE(0),
    green: data.readUInt16LE(2),
    blue: data.readUInt16LE(4),
    clear: data.readUInt16LE(6)
  };
  await influx.writePoints([
    {
      measurement: 'light_intensity',
      fields: light,
    }
  ]);
});

mqtt.on('humidity', async (data) => {
  const humidity = data.readUInt8(0);
  await influx.writePoints([
    {
      measurement: 'humidity',
      fields: { humidity }
    }
  ]);
});

mqtt.on('temperature', async (data) => {
  const temperature = data.readInt8(0) + (data.readUInt8(1) / 100);
  await influx.writePoints([
    {
      measurement: 'temperature',
      fields: { temperature }
    }
  ]);
});

mqtt.on('air_quality', async (data) => {
  const airQuality = {
    eco2: data.readUInt16LE(0),
    tvoc: data.readUInt16LE(2)
  };
  await influx.writePoints([
    {
      measurement: 'air_quality',
      fields: airQuality
    }
  ]);
});

/*
 * API endpoints
 */

async function getLight(ctx) {
  const rows = await influx.query('SELECT * FROM light_intensity');
  ctx.body = rows;
}

async function getHumidity(ctx) {
  const rows = await influx.query('SELECT * FROM humidity ORDER BY time DESC LIMIT 1');
  ctx.body = rows;
}

async function getTemperature(ctx) {
  const rows = await influx.query('SELECT * FROM temperature ORDER BY time DESC LIMIT 1');
  ctx.body = rows;
}

async function getAirQuality(ctx) {
  const rows = await influx.query('SELECT * FROM air_quality ORDER BY time DESC LIMIT 1');
  ctx.body = rows;
}

/*
 * Routes, middlewares, Node.js
 */

router
  .get('/api/v1/light', getLight)
  .get('/api/v1/humidity', getHumidity)
  .get('/api/v1/temperature', getTemperature)
  .get('/api/v1/air_quality', getAirQuality);

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
