function toRgb(rawLight) {
  const r = rawLight.red;
  const g = rawLight.green;
  const b = rawLight.blue;
  const c = rawLight.clear;
  const rRatio = r / (r + g + b);
  const gRatio = g / (r + g + b);
  const bRatio = b / (r + g + b);
  const clearAtBlack = 300;
  const clearAtWhite = 400;
  const clearDiff = clearAtWhite - clearAtBlack;

  let clearNormalized = (c - clearAtBlack) / clearDiff;
  if (clearNormalized < 0) {
    clearNormalized = 0;
  }

  let red = rRatio * 255.0 * 3 * clearNormalized;
  if (red > 255) {
    red = 255;
  }

  let green = gRatio * 255.0 * 3 * clearNormalized;
  if (green > 255) {
    green = 255;
  }

  let blue = bRatio * 255.0 * 3 * clearNormalized;
  if (blue > 255) {
    blue = 255;
  }

  return {
    red: Math.round(red),
    green: Math.round(green),
    blue: Math.round(blue)
  };
}

function toGrayscale(rgb) {
  return ((rgb.red + rgb.green + rgb.blue) / 3).toFixed(0);
}

function isDoorOpen(rawLight) {
  const rgb = toRgb(rawLight);
  const grayscale = toGrayscale(rgb);
  return grayscale > 200;
}

module.exports = {
  toRgb,
  toGrayscale,
  isDoorOpen
};
