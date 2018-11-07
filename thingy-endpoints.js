const Influx = require('influx');
const validate = require('vali-date');
const { influx, influxConfig } = require('./influx.js');

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

module.exports = {
  getMetricSeconds,
  getMetric,
  getDevices
};
