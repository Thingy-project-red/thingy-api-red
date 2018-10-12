"use strict";

const mqtt = require("mqtt");
const config = require("./config.json");

module.exports = {
  connect() {
    console.log(`MQTT: connecting to "${config.mqtt.host}"`);
    const client = mqtt.connect(config.mqtt.host, config.mqtt.auth);

    client.on("connect", () => {
      console.log("MQTT: connected");
      const subscribe = "+/+/+";
      client.subscribe(subscribe, (err) => {
        if (err)
          console.err(`MQTT: error trying to subscribe to "${subscribe}"`);
        else
          console.log(`MQTT: subscribed to "${subscribe}"`);
      });
    });

    client.on("error", () =>
      console.err(`MQTT: unable to connect to "${config.mqtt.host}"`)
    );

    client.on("message", (topic, message) => {
      let deviceUri, serviceUUID, characteristicUUID;
      [deviceUri, serviceUUID, characteristicUUID] = topic.split("/");
      const service = config.thingy.services[serviceUUID];
      const characteristic = config.thingy.characteristics[characteristicUUID];

      const friendlyTopic = `${deviceUri}/${service}/${characteristic}`;
      console.debug(`MQTT#${friendlyTopic}: ${message.toString('hex')}`);
      client.emit(characteristic, message);
    });

    return client;
  }
}
