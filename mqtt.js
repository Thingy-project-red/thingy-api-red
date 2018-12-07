const log = require('debug')('mqtt');
const debug = require('debug')('mqtt:debug');
const mqtt = require('mqtt');
const config = require('./config.js');

let client;

function lookup(obj, prop) {
  return prop in obj ? obj[prop] : prop;
}

// battery value needs to be read periodically
function setupBatteryCheck() {
  setInterval(() => {
    Object.values(config.thingy.devices).forEach((device) => {
      client.read(device, 'battery', 'battery_level');
    });
  }, 5000);
};

function onConnect() {
  log('connected');
  const subscribe = ['+/+', '+/+/+'];
  client.subscribe(subscribe, (err) => {
    const subjson = JSON.stringify(subscribe);
    if (err) {
      log(`error trying to subscribe to ${subjson}`);
    } else {
      log(`subscribed to ${subjson}`);
      // setupBatteryCheck();
    }
  });
}

function onMessage(topic, message) {
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
    config.thingy.IDS[name] = deviceUri;
    debug(`${deviceUri} refers to ${name}`);
  }

  const device = lookup(config.thingy.devices, deviceUri);
  const service = lookup(config.thingy.services, serviceUUID);
  const characteristic = lookup(config.thingy.characteristics, charUUID);
  const friendlyTopic = `${device}/${service}/${characteristic}`;

  // ask for name of unknown thingy
  if (device === deviceUri) {
    client.read(device, 'configuration', 'name');
    return;
  }

  debug(`MQTT#${friendlyTopic}: ${message.toString('hex')}`);
  client.emit(characteristic, { data: message, device });
}

function mqttInit() {
  log(`connecting to "${process.env.MQTT_HOST}"`);
  client = mqtt.connect(
    process.env.MQTT_HOST, {
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD
    }
  );

  client.on('connect', onConnect);

  client.on('error', () => {
    log(`unable to connect to "${process.env.MQTT_HOST}"`);
  });

  client.on('message', onMessage);

  client.read = (device, service, characteristic) => {
    const deviceUri = lookup(config.thingy.IDS, device);
    const serviceUUID = config.thingy.UUIDS[service];
    const charUUID = config.thingy.UUIDS[characteristic];
    client.publish(`${deviceUri}/${serviceUUID}/${charUUID}/read`);
  };

  client.write = (device, service, characteristic, data) => {
    const deviceUri = lookup(config.thingy.IDS, device);
    const serviceUUID = config.thingy.UUIDS[service];
    const charUUID = config.thingy.UUIDS[characteristic];
    client.publish(`${deviceUri}/${serviceUUID}/${charUUID}/write`, data);
  };

  return client;
}

function getClient() {
  if (!client) {
    client = mqttInit();
  }
  return client;
}

module.exports = {
  getClient
};
