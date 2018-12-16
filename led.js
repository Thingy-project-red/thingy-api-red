/**
 * Provides methods to generate buffers for controlling LEDs.
 */

module.exports = {
  // Color codes for breathe/oneShot
  RED: 0x01,
  GREEN: 0x02,
  YELLOW: 0x03,
  BLUE: 0x04,
  PURPLE: 0x05,
  CYAN: 0x06,
  WHITE: 0x07,

  off() {
    return Buffer.from([0]);
  },

  // Turn LED on with given RGB value
  set(red = 255, green = 255, blue = 255) {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt8(1, 0);
    buffer.writeUInt8(red, 1);
    buffer.writeUInt8(green, 2);
    buffer.writeUInt8(blue, 3);

    return buffer;
  },

  // Cycle between on and off
  breathe(color = this.RED, intensity = 10, delay = 3000) {
    const buffer = Buffer.alloc(5);
    buffer.writeUInt8(2, 0);
    buffer.writeUInt8(color, 1);
    buffer.writeUInt8(intensity, 2);
    buffer.writeUInt16LE(delay, 3);

    return buffer;
  },

  // Light up once, then turn off
  oneShot(color = this.RED, intensity = 10) {
    const buffer = Buffer.alloc(3);
    buffer.writeUInt8(3, 0);
    buffer.writeUInt8(color, 1);
    buffer.writeUInt8(intensity, 2);

    return buffer;
  }
};
