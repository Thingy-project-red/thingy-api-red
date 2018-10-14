const config = require('./config.json');

config.thingy.devices = {};
config.thingy.UUIDS = {};
Object.keys(config.thingy.services).forEach((k) => {
  config.thingy.UUIDS[config.thingy.services[k]] = k;
});
Object.keys(config.thingy.characteristics).forEach((k) => {
  config.thingy.UUIDS[config.thingy.characteristics[k]] = k;
});
module.exports = config;
