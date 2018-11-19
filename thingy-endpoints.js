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

function stripPrefix(obj, prefix) {
  Object.keys(obj).forEach((key) => {
    if (key.startsWith(prefix)) {
      /* eslint-disable no-param-reassign */
      // Modification of argument is intended, creating a copy is unnecessary
      obj[key.substr(prefix.length)] = obj[key];
      delete obj[key];
      /* eslint-enable no-param-reassign */
    }
  });
}

async function getMetricSecondsCommon(ctx, average, interval) {
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

  // Choose appropriate selector based on average or not
  const selector = average ? 'mean(*)' : '*';

  // Modifier: order by time not needed for average.
  // Instead group by time interval if present.
  let modifier = 'ORDER BY time';
  if (average) {
    modifier = interval ? `GROUP BY time(${interval}s)` : '';
  }

  // Get measurements going back the given amount of seconds
  const device = Influx.escape.tag(ctx.params.device);
  const rows = await influx.query(
    `SELECT ${selector} FROM ${metric}
    WHERE device='${device}' AND time > now() - ${seconds}s
    ${modifier}`
  );

  ctx.body = rows;
}

async function getMetricSeconds(ctx) {
  await getMetricSecondsCommon(ctx, false, 0);
}

async function getAvgMetricSeconds(ctx) {
  let interval = 0;
  if ('interval' in ctx.query) {
    // Parse interval to make sure we work with a valid number
    interval = parseInt(ctx.query.interval, 10);
    if (Number.isNaN(interval)) {
      ctx.throw(400, 'Invalid interval');
    }
  }

  await getMetricSecondsCommon(ctx, true, interval);

  // Keep data consistent
  ctx.body.forEach((row) => {
    stripPrefix(row, 'mean_');
    // eslint-disable-next-line no-param-reassign
    row.device = ctx.params.device;
  });
}

async function getMetricCommon(ctx, average, interval) {
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

    // Choose appropriate selector based on average or not
    const selector = average ? 'mean(*)' : '*';

    // Modifier: order by time not needed for average.
    // Instead group by time interval if present.
    let modifier = 'ORDER BY time';
    if (average) {
      modifier = interval ? `GROUP BY time(${interval}s)` : '';
    }

    // Execute time range query
    rows = await influx.query(
      `SELECT ${selector} FROM ${metric}
      WHERE device='${device}' AND ${timeSelection}
      ${modifier}`
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

    // Choose appropriate selector based on average or not
    const selector = average ? 'mean(*)' : `LAST(${field}),*`;

    // If interval present, group by time interval to get averages.
    const modifier = average && interval ? `GROUP BY time(${interval}s)` : '';

    // Execute query
    rows = await influx.query(
      `SELECT ${selector} FROM ${metric}
      WHERE device='${device}'
      ${modifier}`
    );
    // Remove the automatically added 'last' property which is a duplicate
    delete rows[0].last;
  }

  ctx.body = rows;
}

async function getMetric(ctx) {
  await getMetricCommon(ctx, false, 0);
}

async function getAvgMetric(ctx) {
  let interval = 0;
  if ('interval' in ctx.query) {
    // Parse interval to make sure we work with a valid number
    interval = parseInt(ctx.query.interval, 10);
    if (Number.isNaN(interval)) {
      ctx.throw(400, 'Invalid interval');
    }
  }

  await getMetric(ctx, true, interval);

  // Keep data consistent
  ctx.body.forEach((row) => {
    stripPrefix(row, 'mean_');
    // eslint-disable-next-line no-param-reassign
    row.device = ctx.params.device;
  });
}

async function getDevices(ctx) {
  const rows = await influx.query(
    'SHOW TAG VALUES FROM temperature WITH KEY IN ("device");'
  );
  ctx.body = rows.map(obj => obj.value);
}

module.exports = {
  getMetricSeconds,
  getAvgMetricSeconds,
  getMetric,
  getAvgMetric,
  getDevices
};
