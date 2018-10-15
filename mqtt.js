const mqtt = require('mqtt');
const config = require('./config.js');

const lookup = (obj, prop) => (prop in obj ? obj[prop] : prop);

module.exports = {
  connect() {
    console.log(`MQTT: connecting to "${config.mqtt.host}"`);
    const client = mqtt.connect(config.mqtt.host, config.mqtt.auth);

    client.on('connect', () => {
      console.log('MQTT: connected');
      const subscribe = ['+/+', '+/+/+'];
      client.subscribe(subscribe, (err) => {
        const subjson = JSON.stringify(subscribe);
        if (err) {
          console.error(`MQTT: error trying to subscribe to ${subjson}`);
        } else {
          console.log(`MQTT: subscribed to ${subjson}`);
        }
      });
    });

    client.on('error', () => {
      console.error(`MQTT: unable to connect to "${config.mqtt.host}"`);
    });

    client.on('message', (topic, message) => {
      const [deviceUri, serviceUUID, charUUID] = topic.split('/');

      // gateway reports connected / disconnected
      if (serviceUUID === 'connected') {
        const connected = message.toString() === 'true';
        const device = lookup(config.thingy.devices, deviceUri);
        console.debug(`MQTT: ${device} ${connected ? '' : 'dis'}connected`);

        // ask for name of newly connected, unknown thingy
        if (connected && device === deviceUri) {
          const confUUID = config.thingy.UUIDS.configuration;
          const nameUUID = config.thingy.UUIDS.name;
          client.publish(`${deviceUri}/${confUUID}/${nameUUID}/read`);
        }
        return;
      }

      // store name of thingy
      if (charUUID === config.thingy.UUIDS.name) {
        const name = message.toString();
        config.thingy.devices[deviceUri] = name;
        console.debug(`MQTT: ${deviceUri} refers to ${name}`);
      }

      const device = lookup(config.thingy.devices, deviceUri);
      const service = lookup(config.thingy.services, serviceUUID);
      const characteristic = lookup(config.thingy.characteristics, charUUID);
      const friendlyTopic = `${device}/${service}/${characteristic}`;

      console.debug(`MQTT#${friendlyTopic}: ${message.toString('hex')}`);
      client.emit(characteristic, message);
    });

    return client;
  },
};
