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
const { influx, influxConfig } = require('./influx.js');
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
 * API endpoints
 */

const metrics = [
  'light_intensity',
  'door',
  'humidity',
  'temperature',
  'air_quality',
  'battery_level'
];

async function getMetricSeconds(ctx) {
  // Parse seconds to make sure we work with a valid number
  const seconds = parseInt(ctx.params.seconds, 10);
  if (Number.isNaN(seconds)) {
    ctx.throw(400, 'Invalid number');
  }

  // Check if queried metric is valid
  const { metric } = ctx.params;
  if (!metrics.includes(metric)) {
    ctx.throw(404, 'Invalid metric');
  }

  // Get measurements going back the given amount of seconds
  const device = Influx.escape.tag(ctx.params.device);
  const rows = await influx.query(
    `SELECT * FROM ${metric}
    WHERE device='${device}' AND time > now() - ${seconds}s ORDER BY time`
  );

  ctx.body = rows;
}

async function getMetric(ctx) {
  // check if queried metric is valid
  const { metric } = ctx.params;
  if (!metrics.includes(metric)) {
    ctx.throw(404, 'Invalid metric');
  }
  // Determine device
  const device = Influx.escape.tag(ctx.params.device);
  // Results will be stored in and returned from here
  let rows;

  if ('from' in ctx.query || 'to' in ctx.query) {
    // If a 'from' or 'to' parameter was given, do a time range query

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

    // Build query depending on whether we have one or two parameters
    const timeSelection = `${conditions.join(' AND ')}`;
    // Execute time range query
    rows = await influx.query(
      `SELECT * FROM ${metric}
      WHERE device='${device}' AND ${timeSelection}
      ORDER BY time`
    );
  } else {
    // If no time range was given, return the latest measurement

    // To get measurements with the correct timestamp from InfluxDB's LAST()
    // selector, we need to supply it with a specific field of the
    // measurement we're interested in (just * won't do). That's why we need
    // to select one from the schema of our measurement.
    // First, find the schema of our metric...
    const schema = influxConfig.schema.find(obj => obj.measurement === metric);
    // ...then select the first field
    const [field] = Object.keys(schema.fields);

    // Execute query
    rows = await influx.query(
      `SELECT LAST(${field}),* FROM ${metric} WHERE device='${device}'`
    );
    // Remove the automatically added 'last' property which is a duplicate
    delete rows[0].last;
  }

  ctx.body = rows;
}

async function getDevices(ctx) {
  const rows = await influx.query(
    'SHOW TAG VALUES FROM temperature WITH KEY IN ("device");'
  );
  ctx.body = rows.map(obj => obj.value);
}

/*
 * Routes, middlewares, Node.js
 */

router
  .get('/api/v1/users', userEndpoints.getUsers)
  .post('/api/v1/users', userEndpoints.addUser)
  .del('/api/v1/users/:user', userEndpoints.deleteUser)
  .post('/api/v1/auth', userEndpoints.authenticate)
  .get('/api/v1/devices', getDevices)
  .get('/api/v1/:device/:metric/:seconds', getMetricSeconds)
  .get('/api/v1/:device/:metric', getMetric);

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
