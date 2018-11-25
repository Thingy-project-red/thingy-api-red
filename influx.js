const Influx = require('influx');

const influxConfig = {
  host: 'db',
  database: process.env.INFLUXDB_DB,
  schema: [
    {
      measurement: 'light_intensity',
      fields: {
        red: Influx.FieldType.INTEGER,
        green: Influx.FieldType.INTEGER,
        blue: Influx.FieldType.INTEGER
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
};

module.exports = {
  influx: new Influx.InfluxDB(influxConfig),
  influxConfig
};
