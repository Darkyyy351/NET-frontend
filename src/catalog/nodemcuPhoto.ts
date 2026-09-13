// LaskaKit product pinout, 615 x 519. Crop x=144..403, rotate -90deg.
export const nodemcuPhoto = {
  src: '/boards/nodemcu-laskakit-pinout.png',
  source: 'https://www.laskakit.cz/iot-esp8266-lua-nodemcu-amica-cp2102-wifi-modul/',
  pins: [
    ...['D0', 'D1', 'D2', 'D3', 'D4', '3V3', 'GND', 'D5', 'D6', 'D7', 'D8', 'RX', 'TX', 'GND', '3V3'].map((label, i) => ({
      id: `right-${i}`, label, x: (74 + i * 25.75) / 519 * 100, y: (403 - 389) / 259 * 100,
    })),
    ...['A0', 'RSV', 'RSV', 'SD3', 'SD2', 'SD1', 'CMD', 'SD0', 'CLK', 'GND', '3V3', 'EN', 'RST', 'GND', 'VIN'].map((label, i) => ({
      id: `left-${i}`, label, x: (74 + i * 25.75) / 519 * 100, y: (403 - 158) / 259 * 100,
    })),
  ],
};

export function profilePinLabel(label: string): string {
  if (['SD3', 'SD2', 'SD1', 'CMD', 'SD0', 'CLK'].includes(label)) return 'SD3 / SD2 / SD1 / CMD / SD0 / CLK';
  if (label === 'GND') return 'GND ×4';
  if (label === '3V3') return '3V3 ×3';
  if (label === 'RSV') return 'RSV ×2';
  if (label === 'EN' || label === 'RST') return 'EN / RST';
  if (label === 'RX') return 'RX / D9';
  if (label === 'TX') return 'TX / D10';
  return label;
}
