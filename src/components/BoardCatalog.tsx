import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, ExternalLink, Lock, Cpu, ZoomIn, ZoomOut, Maximize, ArrowLeft } from 'lucide-react';
import type { Device } from '../api/devices';
import { boards, catalogVersion } from '../catalog/boards';
import { nodemcuPhoto, profilePinLabel } from '../catalog/nodemcuPhoto';

const pinStates = { gpio: 'Digitální I/O', restricted: 'Použití s omezením', power: 'Napájecí vývod', reserved: 'Vyhrazený vývod' };
const glossary = [
  ['D / GPIO', 'D1 je označení na desce, GPIO5 číslo vývodu čipu. Nejde o stejné číslování.'],
  ['I/O', 'Vstup čte stav, výstup nastavuje logickou úroveň. Dostupné funkce nejsou současně aktivní.'],
  ['HIGH / LOW', 'Logická jednička / nula. Požadovaný stav při startu není totéž co stav během běhu programu.'],
  ['I²C · SDA / SCL', 'Sběrnice pro komunikaci s periferiemi: SDA přenáší data, SCL hodinový signál.'],
  ['SPI', 'SCLK: hodiny; MOSI: data z řadiče; MISO: data do řadiče; CS: výběr periferie.'],
  ['UART · TX / RX', 'Sériová komunikace. TX vysílá, RX přijímá. Zde je sdílena s USB převodníkem.'],
  ['ADC · A0', 'Analogový vstup převádí napětí na číselnou hodnotu. Povolené napětí ověř podle konkrétní desky.'],
  ['GND / 3V3 / VIN', 'Zem, napájecí větev 3,3 V a napájecí vstup. Nejsou to programovatelné GPIO.'],
  ['Pull-up / pull-down', 'Rezistor drží signál v HIGH / LOW, když jej nic aktivně neřídí.'],
];

export function BoardCatalog({ device, connectionError = false, onBack }: {
  device?: Device | null; connectionError?: boolean; onBack?: () => void;
}) {
  const [boardId, setBoardId] = useState(boards[0].id);
  const [selected, setSelected] = useState('right-9');
  const [hovered, setHovered] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [photoFailed, setPhotoFailed] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const detail = useRef<HTMLElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; above: boolean } | null>(null);
  const matched = device === undefined ? boards.find(item => item.id === boardId) :
    boards.find(item => item.id === device?.boardProfile?.id && item.revision === device?.boardProfile?.revision);
  const board = matched || boards[0];
  const physical = nodemcuPhoto.pins.find(item => item.id === selected)!;
  const pin = board.pins.find(item => item.label === profilePinLabel(physical.label))!;
  const hoverPin = nodemcuPhoto.pins.find(item => item.id === hovered);
  const hoverInfo = board.pins.find(item => item.label === profilePinLabel(hoverPin?.label || ''));
  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = detail.current?.animate(
      [{ opacity: 0.45, transform: 'translateY(3px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 200, easing: 'ease-out' },
    );
    return () => animation?.cancel();
  }, [selected, boardId]);
  useLayoutEffect(() => {
    const target = viewport.current?.querySelector(`[data-physical-id="${hovered}"]`);
    if (!target) { setTooltip(null); return; }
    const rect = target.getBoundingClientRect();
    const above = rect.top > 90;
    setTooltip({ x: Math.max(105, Math.min(window.innerWidth - 105, rect.left + rect.width / 2)), y: above ? rect.top - 10 : rect.bottom + 10, above });
  }, [hovered]);
  useEffect(() => {
    const clear = () => setHovered(null);
    window.addEventListener('scroll', clear, true);
    window.addEventListener('resize', clear);
    return () => { window.removeEventListener('scroll', clear, true); window.removeEventListener('resize', clear); };
  }, []);
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    element.scrollLeft = element.clientWidth * zoom / 100 * physical.x / 100 - element.clientWidth / 2;
    element.scrollTop = element.clientWidth * zoom / 100 * 259 / 519 * physical.y / 100 - element.clientHeight / 2;
    setHovered(null);
  }, [zoom]);
  const fit = () => {
    setZoom(100);
    setHovered(null);
    viewport.current?.scrollTo(0, 0);
  };
  if (!matched) return <section className="view-stack board-catalog">
    <button type="button" className="secondary-button" onClick={onBack}><ArrowLeft size={14} />Zpět na zařízení</button>
    <p role="status">Zařízení nebo jeho přiřazený profil není dostupný. Ověř model v detailu zařízení.</p>
  </section>;
  return <section className="view-stack board-catalog">
    {device && <div className="board-device-context">
      <button type="button" className="icon-button" title="Zpět na zařízení" aria-label="Zpět na zařízení" onClick={onBack}><ArrowLeft size={16} /></button>
      <div><strong>{device.name}</strong><code>{device.id}</code></div>
      <span className={`board-device-status ${connectionError ? 'unknown' : device.status}`}>{connectionError ? 'Stav neověřen' : device.status === 'online' ? 'Online' : device.status === 'offline' ? 'Offline' : 'Stav neznámý'}</span>
    </div>}
    <div className="view-header"><div><h1>Katalog desek</h1><p>Referenční profily · revize {catalogVersion} · bez ovládání hardwaru</p></div>
      {!device && <label className="board-selector">Model desky<select value={boardId} onChange={event => { setBoardId(event.target.value); setSelected('right-9'); setHovered(null); }}>
        {boards.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>}
    </div>
    <header className="board-heading"><Cpu size={24} /><div><h2>{board.name}</h2><span>{board.chip} · 4 MB flash · logika 3,3 V</span></div><code>{board.platformioId}</code></header>
    <div className="board-photo-toolbar"><span>Amica CP2102 · USB vpravo</span><div className="board-zoom-controls">
      <button type="button" title="Oddálit" aria-label="Oddálit" disabled={zoom === 100} onClick={() => setZoom(value => Math.max(100, value - 25))}><ZoomOut size={16} /></button>
      <input aria-label="Přiblížení desky" type="range" min="100" max="300" step="25" value={zoom} onChange={event => setZoom(Number(event.target.value))} /><output>{zoom}%</output>
      <button type="button" title="Přiblížit" aria-label="Přiblížit" disabled={zoom === 300} onClick={() => setZoom(value => Math.min(300, value + 25))}><ZoomIn size={16} /></button>
      <button type="button" title="Celá deska" aria-label="Celá deska" onClick={fit}><Maximize size={16} /></button>
    </div></div>
    <div className="board-workspace">
      <figure className="board-reference">
        {photoFailed ? <p role="alert" className="panel-error">Obrázek desky se nepodařilo načíst. Výběr pinů je nedostupný.</p> : <div className="board-photo-scroll" ref={viewport} onScroll={() => setHovered(null)}>
          <div className="board-photo-stage" style={{ width: `${zoom}%` }} onPointerLeave={() => setHovered(null)}>
            <div className="board-image-crop"><img src={nodemcuPhoto.src} onError={() => setPhotoFailed(true)} alt="NodeMCU Amica CP2102, reference z LaskaKitu, anténa vlevo a USB vpravo" draggable={false} /></div>
            <div className="board-label-mask" aria-hidden="true" />
            {nodemcuPhoto.pins.filter(item => item.id.startsWith('left')).map(item => <span key={`label-${item.id}`} className="board-readable-label" style={{ left: `${item.x}%` }} aria-hidden="true">{item.label}</span>)}
            {nodemcuPhoto.pins.map(item => <button key={item.id} type="button" className="board-hotspot" data-physical-id={item.id}
              style={{ left: `${item.x}%`, top: `${item.y}%` }}
              aria-label={`${item.label}, ${item.id.startsWith('right') ? 'horní' : 'dolní'} řada, vývod ${Number(item.id.split('-')[1]) + 1}`}
              aria-pressed={selected === item.id} aria-describedby={hovered === item.id ? 'pin-hover-info' : undefined}
              onPointerEnter={event => { if (event.pointerType !== 'touch') setHovered(item.id); }}
              onPointerLeave={() => setHovered(current => current === item.id ? null : current)}
              onFocus={() => setHovered(item.id)} onBlur={() => setHovered(null)}
              onKeyDown={event => { if (event.key === 'Escape') setHovered(null); }}
              onClick={() => { setSelected(item.id); setHovered(null); }}><span /></button>)}
            {hoverPin && hoverInfo && tooltip && <div id="pin-hover-info" role="tooltip" className={`board-pin-tooltip ${tooltip.above ? 'above' : 'below'}`} style={{ left: tooltip.x, top: tooltip.y }}>
              <strong>{hoverPin.label}{hoverInfo.gpio !== null ? ` · GPIO${hoverInfo.gpio}` : ''}</strong>
              <span>{hoverInfo.functions.slice(0, 2).join(' · ') || (hoverInfo.kind === 'power' ? 'Napájecí vývod' : 'Rezervovaný vývod')}</span>
            </div>}
          </div>
        </div>}
        <figcaption>Reference produktu <a href={nodemcuPhoto.source} target="_blank" rel="noreferrer">LaskaKit · LA100044<ExternalLink size={11} /></a></figcaption>
      </figure>
      <div className="board-pin-inspector">
        <section ref={detail} className="board-pin-detail" aria-live="polite" aria-atomic="true" aria-label="Detail pinu">
          <div className="board-pin-identity">
          <div className="board-detail-eyebrow">{physical.id.startsWith('right') ? 'Horní' : 'Dolní'} řada · vývod {Number(physical.id.split('-')[1]) + 1}</div>
          <h3>{physical.label}<span>{pin.gpio !== null ? `GPIO${pin.gpio}` : ''}</span></h3>
          <p className={`board-pin-state ${pin.kind}`}>{pin.kind !== 'gpio' && <Lock size={14} />}{pinStates[pin.kind]}</p>
          </div>
          <div className="board-pin-functions"><div className="board-detail-eyebrow">Možné funkce</div>{pin.functions.length > 0 ? <ul>{pin.functions.map(fn => <li key={fn}>{fn}</li>)}</ul> : <p>{pin.kind === 'power' ? (physical.label === 'GND' ? 'Společná zem' : 'Napájení') : 'Vyhrazeno pro funkci desky'}</p>}</div>
          <div className="board-pin-note"><div className="board-detail-eyebrow">Zapojení a omezení</div><p>{pin.note}</p></div>
        </section>
      </div>
    </div>
    <details className="board-glossary"><summary>Vysvětlivky pinů a zkratek</summary><dl>{glossary.map(([term, explanation]) => <div key={term}><dt>{term}</dt><dd>{explanation}</dd></div>)}</dl></details>
    <p className="board-caution"><AlertTriangle size={18} />Profil není automatická identifikace připojeného kusu. Před zapojením porovnej popisky a revizi desky. GPIO nepřipojuj přímo na 5 V.</p>
    <details className="board-sources"><summary>Podklady profilu a původ dat</summary><a href={board.image} target="_blank" rel="noreferrer">Referenční pinmap NodeMCU<ExternalLink size={13} /></a>{board.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.name}<ExternalLink size={13} /></a>)}</details>
  </section>;
}
