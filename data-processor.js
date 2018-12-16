const mqtt = require('./mqtt.js').getClient();
const util = require('./util.js');
const { influx } = require('./influx.js');
const wsBroadcast = require('./websocket.js');
const prefs = require('./user-thresholds.js');
const led = require('./led.js');

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
  wsBroadcast('light_intensity', device, rgb);
  wsBroadcast('door', device, { open });
  prefs.check('door_open', device, open);
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
  wsBroadcast('humidity', device, { humidity });
  prefs.check('humidity', device, humidity);
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
  wsBroadcast('temperature', device, { temperature });
  prefs.check('temperature', device, temperature);
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
  wsBroadcast('air_quality', device, airQuality);
  prefs.check('eco2', device, airQuality.eco2);
  prefs.check('tvoc', device, airQuality.tvoc);
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
  wsBroadcast('battery_level', device, { battery_level: batteryLevel });
  prefs.check('battery_level', device, batteryLevel);
});

// Indicate battery level on button press
// LED: green (> 40%), yellow (> 20%), and red otherwise
mqtt.on('button', async ({ data, device }) => {
  const pressed = data.readUInt8(0) === 1;
  if (!pressed) return;

  const rows = await influx.query(
    `SELECT LAST(battery_level),* FROM battery_level
    WHERE device='${device}'`
  );
  const level = rows[0].battery_level;

  // eslint-disable-next-line no-nested-ternary
  const color = level > 40 ? led.GREEN : level > 20 ? led.YELLOW : led.RED;
  const buffer = led.oneShot(color);
  mqtt.write(device, 'user_interface', 'led', buffer);
});
