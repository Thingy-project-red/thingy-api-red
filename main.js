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
    WHERE device='${device}' AND time > now() - ${seconds}s`
  );

  ctx.body = rows;
}

async function getMetric(ctx) {
  // check if queried metric is valid
  const { metric } = ctx.params;
  if (!metrics.includes(metric)) {
    ctx.throw(404, 'Invalid metric');
  }

  // Determine time range if any of the parameters were given
  let fieldSelection = 'LAST(*)';
  let timeSelection = '';
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
    fieldSelection = '*';
    timeSelection = `AND ${conditions.join(' AND ')} ORDER BY time`;
  }

  const device = Influx.escape.tag(ctx.params.device);
  const rows = await influx.query(
    `SELECT ${fieldSelection} FROM ${metric}
    WHERE device='${device}' ${timeSelection}`
  );

  // keep values consistent, remove 'last_...' when selecting last value
  if (rows.length === 1 && ctx.fieldSelection === 'LAST(*)') {
    const data = rows[0];
    Object.keys(data).forEach((key) => {
      if (key.startsWith('last_')) {
        data[key.substr(5)] = data[key];
        delete data[key];
      }
    });
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
