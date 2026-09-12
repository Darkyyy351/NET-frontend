export type PinKind = 'gpio' | 'restricted' | 'power' | 'reserved';
export interface BoardPin {
  label: string;
  gpio: number | null;
  kind: PinKind;
  functions: string[];
  note: string;
}
export interface BoardProfile {
  id: string;
  revision: number;
  name: string;
  chip: string;
  platformioId: string;
  image: string;
  sources: { name: string; url: string }[];
  pins: BoardPin[];
}

// Hardware capabilities are descriptive, not permission to drive a connected load.
const gpio = (label: string, number: number, functions: string[], note: string, restricted = false): BoardPin =>
  ({ label, gpio: number, functions, note, kind: restricted ? 'restricted' : 'gpio' });
const fixed = (label: string, kind: 'power' | 'reserved', note: string): BoardPin =>
  ({ label, gpio: null, functions: [], note, kind });

export const boards: BoardProfile[] = [{
  id: 'nodemcu-amica-esp12e-cp2102',
  revision: 1,
  name: 'NodeMCU Amica CP2102',
  chip: 'ESP8266 / ESP-12E',
  platformioId: 'nodemcuv2',
  image: '/boards/nodemcu-v1-pinmap.png',
  sources: [
    { name: 'NodeMCU: schéma a pinmap', url: 'https://github.com/nodemcu/nodemcu-devkit-v1.0' },
    { name: 'Arduino ESP8266: mapování pinů', url: 'https://github.com/esp8266/Arduino/blob/master/variants/nodemcu/pins_arduino.h' },
    { name: 'Espressif: podmínky startu', url: 'https://docs.espressif.com/projects/esptool/en/latest/esp8266/advanced-topics/boot-mode-selection.html' },
    { name: 'PlatformIO: nodemcuv2', url: 'https://docs.platformio.org/en/stable/boards/espressif8266/nodemcuv2.html' },
    { name: 'LaskaKit: LA100044', url: 'https://www.laskakit.cz/iot-esp8266-lua-nodemcu-amica-cp2102-wifi-modul/' },
  ],
  pins: [
    gpio('D0', 16, ['Digitální vstup', 'Digitální výstup'], 'Speciální GPIO16, bez běžného GPIO přerušení. Může souviset s probouzením a pomocnou LED desky.', true),
    gpio('D1', 5, ['Digitální vstup', 'Digitální výstup', 'I²C SCL'], 'Výchozí SCL v Arduino profilu NodeMCU. Při použití I²C nesmí současně ovládat jiný výstup.'),
    gpio('D2', 4, ['Digitální vstup', 'Digitální výstup', 'I²C SDA'], 'Výchozí SDA v Arduino profilu NodeMCU. Při použití I²C nesmí současně ovládat jiný výstup.'),
    gpio('D3', 0, ['Digitální I/O', 'Boot / Flash'], 'Při běžném startu musí být HIGH. LOW při resetu aktivuje bootloader. V prvním editoru rezervováno.', true),
    gpio('D4', 2, ['Digitální I/O', 'Vestavěná LED'], 'Při startu musí být HIGH. NET používá vestavěnou LED pro Identify; tento pin nepřidělovat externímu ovládání.', true),
    gpio('D5', 14, ['Digitální vstup', 'Digitální výstup', 'SPI SCLK'], 'Při použití SPI je pin sdílený s hodinovým signálem.'),
    gpio('D6', 12, ['Digitální vstup', 'Digitální výstup', 'SPI MISO'], 'Při použití SPI je pin sdílený s datovým vstupem.'),
    gpio('D7', 13, ['Digitální vstup', 'Digitální výstup', 'SPI MOSI'], 'GPIO13, testovací externí LED. LED vyžaduje sériový odpor; pin není zdroj pro výkonovou zátěž.'),
    gpio('D8', 15, ['Digitální I/O', 'SPI CS'], 'Při startu musí být LOW. Externí pull-up může zabránit spuštění. V prvním editoru rezervováno.', true),
    gpio('RX / D9', 3, ['UART RX'], 'Sdíleno s USB převodníkem CP2102. Rezervováno pro sériovou komunikaci.', true),
    gpio('TX / D10', 1, ['UART TX'], 'Sdíleno s USB převodníkem. Při startu může vysílat boot log; nevhodné pro výstup vyžadující klidný start.', true),
    { label: 'A0', gpio: null, kind: 'restricted', functions: ['Analogový vstup'], note: 'Rozsah na konektoru závisí na děliči konkrétní revize. Nezaměňovat limit ADC čipu s limitem desky; před připojením ověřit schéma skutečného kusu.' },
    fixed('SD3 / SD2 / SD1 / CMD / SD0 / CLK', 'reserved', 'Připojení flash paměti. NET je nepovolí pro uživatelské I/O.'),
    fixed('RSV ×2', 'reserved', 'Rezervované vývody, nepřipojovat.'),
    fixed('EN / RST', 'reserved', 'Povolení čipu a reset. Nejsou běžné uživatelské výstupy.'),
    fixed('3V3 ×3', 'power', 'Napájecí větev 3,3 V, nikoli GPIO. Dostupný proud závisí na regulátoru, napájení a odběru ESP; katalog zatím negarantuje proudový rozpočet.'),
    fixed('GND ×4', 'power', 'Společná zem. Nelze programově měnit její funkci.'),
    fixed('VIN', 'power', 'Napájecí vstup desky, nikoli GPIO. Způsob napájení a souběh s USB ověřit podle schématu konkrétní revize.'),
  ],
}];

export const catalogVersion = 1;
