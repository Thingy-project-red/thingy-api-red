const mqtt = require('./mqtt.js').getClient();
const mongo = require('./mongo.js');
const util = require('./util.js');

let users = [];
const openDoors = {};

/**
 * Module keeps local copy of users with thresholds to avoid having to query
 * the database for every single value check. Obviously this 'cache' needs to
 * be kept up to date.
 */
async function update() {
  // Get MongoDB connection
  const userdb = await mongo();

  // Only return users with thresholds
  users = await userdb.find(
    { preferences: { $exists: true } },
    { fields: { name: 1, preferences: 1 } }
  ).toArray();
}

async function notify(metric, device, value, user, limit, kind) {
  const unit = util.units[metric];
  const msg = `Attention ${user.name}: `
    + `Threshold for metric '${metric.replace('_', ' ')}' was ${kind}!\n`
    + `${device}: ${value}${unit}. Threshold: ${limit}${unit}`;

  // Send necessary data over mqtt to node-red
  mqtt.publish('notification', JSON.stringify({
    contact: user.preferences.contactData, msg
  }));
}

/**
 * User settings can look like this, with all properties being optional.
 * To get your chatId, write '/start' to @thingy_project_red_bot.
 * user: {
 *   ...
 *   preferences: {
 *     thresholds: {
 *       temperature: {
 *         max: 50,
 *         min: 5,
 *         timeout: seconds
 *       }
 *     },
 *     contactData: {
 *       telegram: chatId,
 *       email: 'email-address'
 *     }
 *   }
 * }
 */
async function check(metric, device, value) {
  users.forEach((user) => {
    if (user.preferences && user.preferences.thresholds) {
      const thres = user.preferences.thresholds[metric];
      if (!thres) return;

      // Default timeout is 60 seconds
      const timeout = 'timeout' in thres ? thres.timeout : 60;
      // Cancel if notification was already triggered within timeout
      if (thres.last && thres.last + timeout * 1000 > Date.now()) return;

      // Handle special case of door metric
      if (metric === 'door_open') {
        if (value) {
          // If open, calculate how long it is already open
          if (device in openDoors) {
            // Replace value with #seconds door is open
            // eslint-disable-next-line no-param-reassign
            value = Math.round((Date.now() - openDoors[device]) / 1000);
          } else {
            openDoors[device] = Date.now();
            return;
          }
        } else {
          delete openDoors[device];
          return;
        }
      }

      if ('max' in thres && value > thres.max) {
        // Value above threshold
        notify(metric, device, value, user, thres.max, 'exceeded');
        thres.last = Date.now();
      } else if ('min' in thres && value < thres.min) {
        // Value below threshold
        notify(metric, device, value, user, thres.min, 'not met');
        thres.last = Date.now();
      }
    }
  });
}

// Initialize users array
update();

module.exports = {
  check,
  update
};
