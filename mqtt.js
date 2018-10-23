const log = require('debug')('mqtt');
const debug = require('debug')('mqtt:debug');
const mqtt = require('mqtt');
const config = require('./config.js');

const lookup = (obj, prop) => (prop in obj ? obj[prop] : prop);

const requestName = (client, deviceUri) => {
  const confUUID = config.thingy.UUIDS.configuration;
  const nameUUID = config.thingy.UUIDS.name;
  client.publish(`${deviceUri}/${confUUID}/${nameUUID}/read`);
};

module.exports = {
  connect() {
    log(`connecting to "${process.env.MQTT_HOST}"`);
    const client = mqtt.connect(
      process.env.MQTT_HOST, {
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD
      }
    );

    client.on('connect', () => {
      log('connected');
      const subscribe = ['+/+', '+/+/+'];
      client.subscribe(subscribe, (err) => {
        const subjson = JSON.stringify(subscribe);
        if (err) {
          log(`error trying to subscribe to ${subjson}`);
        } else {
          log(`subscribed to ${subjson}`);
        }
      });
    });

    client.on('error', () => {
      log(`unable to connect to "${process.env.MQTT_HOST}"`);
    });

    client.on('message', (topic, message) => {
      const [deviceUri, serviceUUID, charUUID] = topic.split('/');

      // gateway reports connected / disconnected
      if (serviceUUID === 'connected') {
        const connected = message.toString() === 'true';
        const device = lookup(config.thingy.devices, deviceUri);
        debug(`${device} ${connected ? '' : 'dis'}connected`);
        return;
      }

      // store name of thingy
      if (charUUID === config.thingy.UUIDS.name) {
        const name = message.toString();
        config.thingy.devices[deviceUri] = name;
        debug(`${deviceUri} refers to ${name}`);
      }

      const device = lookup(config.thingy.devices, deviceUri);
      const service = lookup(config.thingy.services, serviceUUID);
      const characteristic = lookup(config.thingy.characteristics, charUUID);
      const friendlyTopic = `${device}/${service}/${characteristic}`;

      // ask for name of unknown thingy
      if (device === deviceUri) {
        requestName(client, deviceUri);
        return;
      }

      debug(`MQTT#${friendlyTopic}: ${message.toString('hex')}`);
      client.emit(characteristic, { data: message, device });
    });

    return client;
  }
};
