const mqtt = require("./mqtt.js").connect();

// example handler
mqtt.on("button", data => {
  const pressed = data.readUInt8(0) === 1;
  console.log(`Button: ${pressed}`);
});
