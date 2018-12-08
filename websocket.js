const log = require('debug')('websocket');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');

function verifyClient(info, cb) {
  // This is an ugly hack. Because the plain WebSocket implementation
  // doesn't let us define custom headers, we need to use an existing
  // one (subprotocol) to pass the token.
  const token = info.req.headers['sec-websocket-protocol'];
  if (!token) {
    // Abort if no token provided
    cb(false, 401, 'Unauthorized');
  } else {
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err || !decoded.rights.includes('api')) {
        cb(false, 401, 'Unauthorized');
      } else {
        cb(true);
      }
    });
  }
}

const ws = new WebSocket.Server({ port: 8080, verifyClient });

/**
 * Broadcasts the object as JSON to all clients, adding
 * - a 'time' property with the current time as a ISO 8601 string
 * - the 'kind' property which is used by the client to more efficiently find
 *   out what kind of measurement this is
 * - the 'device' property
 *
 * @param {string} kind - The kind of measurement
 * @param {string} device - The device name
 * @param {object} object - The object to send
 */
function broadcast(kind, device, object) {
  // Add additional properties to object
  const extendedObject = object;
  const time = new Date().toISOString();
  extendedObject.time = time;
  extendedObject.kind = kind;
  extendedObject.device = device;

  // Broadcast to all clients
  ws.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(extendedObject));
      } catch (err) {
        log('Error sending message to client');
      }
    }
  });
}

module.exports = broadcast;
