require('dotenv').config();
const log = require('debug')('api');
const Koa = require('koa');
const Router = require('koa-router');
const cors = require('@koa/cors');
const Influx = require('influx');
const json = require('koa-json');
const bodyParser = require('koa-bodyparser');
const logger = require('koa-logger');
const validate = require('vali-date');
const mqtt = require('./mqtt.js').connect();
const util = require('./util.js');

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
      tags: ['device']
    },
    {
      measurement: 'door',
      fields: {
        open: Influx.FieldType.BOOLEAN
      },
      tags: ['device']
    },
    {
      measurement: 'humidity',
      fields: {
        humidity: Influx.FieldType.INTEGER
      },
      tags: ['device']
    },
    {
      measurement: 'temperature',
      fields: {
        temperature: Influx.FieldType.FLOAT
      },
      tags: ['device']
    },
    {
      measurement: 'air_quality',
      fields: {
        eco2: Influx.FieldType.INTEGER,
        tvoc: Influx.FieldType.INTEGER
      },
      tags: ['device']
    },
    {
      measurement: 'battery_level',
      fields: {
        battery_level: Influx.FieldType.INTEGER
      },
      tags: ['device']
    }
  ]
});

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
  await influx.writePoints([
    {
      measurement: 'light_intensity',
      fields: light,
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
 * Middleware that determines the time range of the request and constructs
 * parts of the InfluxDB query based on that.
 */

async function timeSelector(ctx, next) {
  // Array to collect time conditions
  const conditions = [];

  // If present, validate 'from' condition and add to query
  if ('from' in ctx.query) {
    if (!validate(ctx.query.from)) {
      ctx.throw(400, 'Invalid datetime');
    }
    conditions.push(`time >= '${ctx.query.from}'`);
  }
  // If present, validate 'to' condition and add to query
  if ('to' in ctx.query) {
    if (!validate(ctx.query.to)) {
      ctx.throw(400, 'Invalid datetime');
    }
    conditions.push(`time < '${ctx.query.to}'`);
  }

  if (conditions.length > 0) {
    // We have at least one time condition, select all fields in time range
    ctx.fieldSelection = '*';
    ctx.timeSelection = `WHERE ${conditions.join(' AND ')} ORDER BY time`;
  } else {
    // No time condition, select fields of last (most recent) value
    ctx.fieldSelection = 'LAST(*)';
    ctx.timeSelection = '';
  }

  await next();
}

/*
 * API endpoints
 */

async function getLight(ctx) {
  const rows = await influx.query(
    `SELECT ${ctx.fieldSelection} FROM light_intensity ${ctx.timeSelection}`
  );
  ctx.body = rows;
}

async function getDoor(ctx) {
  const rows = await influx.query(
    `SELECT ${ctx.fieldSelection} FROM door ${ctx.timeSelection}`
  );
  ctx.body = rows;
}

async function getHumidity(ctx) {
  const rows = await influx.query(
    `SELECT ${ctx.fieldSelection} FROM humidity ${ctx.timeSelection}`
  );
  ctx.body = rows;
}

async function getTemperature(ctx) {
  const rows = await influx.query(
    `SELECT ${ctx.fieldSelection} FROM temperature ${ctx.timeSelection}`
  );
  ctx.body = rows;
}

async function getAirQuality(ctx) {
  const rows = await influx.query(
    `SELECT ${ctx.fieldSelection} FROM air_quality ${ctx.timeSelection}`
  );
  ctx.body = rows;
}

async function getBatteryLevel(ctx) {
  const rows = await influx.query(
    `SELECT ${ctx.fieldSelection} FROM battery_level ${ctx.timeSelection}`
  );
  ctx.body = rows;
}

/*
 * Routes, middlewares, Node.js
 */

router
  .get('/api/v1/light', getLight)
  .get('/api/v1/door', getDoor)
  .get('/api/v1/humidity', getHumidity)
  .get('/api/v1/temperature', getTemperature)
  .get('/api/v1/air_quality', getAirQuality)
  .get('/api/v1/battery_level', getBatteryLevel);

app
  .use(bodyParser())
  .use(cors())
  .use(logger())
  .use(json())
  .use(timeSelector)
  .use(router.routes())
  .use(router.allowedMethods());

const port = 8000;
app.listen(port, () => {
  log(`ready and listening on port ${port}`);
});

module.exports = app;
