import { useEffect, useMemo, useState } from 'react';
import { Activity, Clock3, Database, MemoryStick, RefreshCw, Wifi } from 'lucide-react';
import { getTelemetryHistory, type Device, type TelemetryHistory, type TelemetrySample } from '../api/devices';

type Range = 1 | 6 | 24;

function formatTime(value?: string) {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function average(samples: TelemetrySample[], key: 'rssi' | 'freeHeapBytes') {
  if (!samples.length) return null;
  return samples.reduce((total, sample) => total + sample[key], 0) / samples.length;
}

function TelemetryChart({
  title,
  detail,
  samples,
  read,
  format,
  tone,
  fixedDomain,
}: {
  title: string;
  detail: string;
  samples: TelemetrySample[];
  read: (sample: TelemetrySample) => number;
  format: (value: number) => string;
  tone: 'signal' | 'memory';
  fixedDomain?: [number, number];
}) {
  const values = samples.map(read);
  const rawMin = values.length ? Math.min(...values) : 0;
  const rawMax = values.length ? Math.max(...values) : 1;
  const padding = rawMin === rawMax ? Math.max(Math.abs(rawMin) * 0.08, 1) : (rawMax - rawMin) * 0.16;
  const min = fixedDomain?.[0] ?? rawMin - padding;
  const max = fixedDomain?.[1] ?? rawMax + padding;
  const span = Math.max(max - min, 1);
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 300 : 18 + index / (values.length - 1) * 564;
    const y = 126 - (value - min) / span * 100;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return <section className={`history-chart ${tone}`}>
    <header><div><span>{title}</span><strong>{values.length ? format(values[values.length - 1]) : 'Čeká na data'}</strong></div><small>{detail}</small></header>
    <div className="history-chart-canvas">
      {values.length ? <svg aria-label={`${title}, ${values.length} vzorků`} preserveAspectRatio="none" role="img" viewBox="0 0 600 145">
        {[26, 76, 126].map(y => <line className="chart-grid-line" key={y} x1="18" x2="582" y1={y} y2={y} />)}
        {values.length > 1 && <polygon className="chart-area" points={`18,126 ${points} 582,126`} />}
        {values.length > 1 && <polyline className="chart-line" fill="none" points={points} />}
        <circle className="chart-endpoint" cx={values.length === 1 ? 300 : 582} cy={126 - (values[values.length - 1] - min) / span * 100} r="4" />
      </svg> : <div className="history-chart-empty"><Activity size={18} /><span>První vzorek vznikne po telemetrickém heartbeat zařízení.</span></div>}
    </div>
    <footer><span>{formatTime(samples[0]?.at)}</span><span>{samples.length === 1 ? 'Další bod za přibližně 1 minutu' : `${samples.length} vzorků`}</span><span>{formatTime(samples[samples.length - 1]?.at)}</span></footer>
  </section>;
}

export function DeviceTelemetryHistory({ devices }: { devices: Device[] }) {
  const [range, setRange] = useState<Range>(6);
  const [selectedId, setSelectedId] = useState('');
  const [history, setHistory] = useState<TelemetryHistory | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!devices.length) { setSelectedId(''); return; }
    if (!devices.some(device => device.id === selectedId)) {
      setSelectedId((devices.find(device => device.status === 'online') || devices[0]).id);
    }
  }, [devices, selectedId]);

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    const load = async (background = false) => {
      if (inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      if (!background) setState('loading');
      try {
        const data = await getTelemetryHistory(range);
        if (!disposed) { setHistory(data); setState('ready'); }
      } catch {
        if (!disposed) setState('error');
      } finally { inFlight = false; }
    };
    void load();
    const timer = window.setInterval(() => void load(true), 60_000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [range, refreshKey]);

  const selectedDevice = devices.find(device => device.id === selectedId);
  const samples = useMemo(() => history?.series.find(series => series.deviceId === selectedId)?.samples || [], [history, selectedId]);
  const availabilityEvents = useMemo(() => history?.series.find(series => series.deviceId === selectedId)?.events || [], [history, selectedId]);
  const latest = samples[samples.length - 1];
  const averageRssi = average(samples, 'rssi');
  const averageHeap = average(samples, 'freeHeapBytes');
  const outageCount = availabilityEvents.filter(event => event.state === 'offline').length;
  const latestAvailability = availabilityEvents[availabilityEvents.length - 1];
  const isCurrentlyOffline = selectedDevice?.status === 'offline' ||
    (selectedDevice?.status !== 'online' && latestAvailability?.state === 'offline');

  return <section className="device-history-panel" aria-label="Historie telemetrie zařízení">
    <header className="device-history-header">
      <div className="device-history-title"><span><Database size={16} /></span><div><small>Perzistentní telemetrie</small><h2>Historie zařízení</h2></div></div>
      <div className="device-history-controls">
        <label>Uzel<select disabled={!devices.length} onChange={event => setSelectedId(event.target.value)} value={selectedId}>
          {devices.map(device => <option key={device.id} value={device.id}>{device.name}</option>)}
        </select></label>
        <div className="history-range" aria-label="Rozsah historie" role="group">
          {([1, 6, 24] as Range[]).map(value => <button aria-pressed={range === value} className={range === value ? 'active' : ''} key={value} onClick={() => setRange(value)} type="button">{value}h</button>)}
        </div>
        <button aria-label="Obnovit historii" className="history-refresh" disabled={state === 'loading'} onClick={() => setRefreshKey(value => value + 1)} type="button"><RefreshCw className={state === 'loading' ? 'checking-spin' : ''} size={14} /></button>
      </div>
    </header>

    {!devices.length ? <div className="device-history-message"><Wifi size={20} /><strong>Žádné zařízení</strong><span>Historie se začne ukládat po připojení prvního schváleného uzlu.</span></div> :
      state === 'error' ? <div className="device-history-message error"><Activity size={20} /><strong>Historie není dostupná</strong><span>Živá telemetrie může pokračovat; ověřte aktualizaci backendu.</span></div> :
      state === 'loading' && !history ? <div className="device-history-message"><RefreshCw className="checking-spin" size={20} /><strong>Načítám historii</strong><span>Čtu poslední telemetrické vzorky z backendu.</span></div> : <>
        <div className="history-summary">
          <div><Clock3 size={14} /><span>Záznamy<strong>{samples.length}</strong><small>z intervalu {range} h</small></span></div>
          <div><Wifi size={14} /><span>Průměr RSSI<strong>{averageRssi === null ? 'N/A' : `${averageRssi.toFixed(0)} dBm`}</strong><small>{selectedDevice?.status === 'online' ? 'online' : selectedDevice?.status === 'offline' ? 'offline' : 'stav neznámý'}</small></span></div>
          <div><MemoryStick size={14} /><span>Průměr volné RAM<strong>{averageHeap === null ? 'N/A' : `${(averageHeap / 1024).toFixed(1)} kB`}</strong><small>poslední {latest ? `${(latest.freeHeapBytes / 1024).toFixed(1)} kB` : 'N/A'}</small></span></div>
          <div><Database size={14} /><span>Retence<strong>{history?.retentionHours || 24} hodin</strong><small>interval {history?.sampleIntervalSeconds || 60} s</small></span></div>
        </div>
        <div className={`history-availability ${isCurrentlyOffline ? 'offline' : 'stable'}`}>
          <span className="history-availability-icon"><Activity size={14} /></span>
          <div><strong>{isCurrentlyOffline ? 'Probíhá výpadek zařízení' : outageCount ? `${outageCount} ${outageCount === 1 ? 'výpadek' : outageCount < 5 ? 'výpadky' : 'výpadků'} v intervalu` : 'Bez zaznamenaného výpadku'}</strong>
            <small>{latestAvailability ? `Poslední změna ${formatTime(latestAvailability.at)} · ${latestAvailability.state}` : 'Přechody online a offline se zaznamenávají automaticky.'}</small></div>
        </div>
        <div className="history-chart-grid">
          <TelemetryChart detail="Síla Wi-Fi signálu" fixedDomain={[-100, -30]} format={value => `${Math.round(value)} dBm`} read={sample => sample.rssi} samples={samples} title="RSSI" tone="signal" />
          <TelemetryChart detail="Paměť dostupná firmwaru" format={value => `${(value / 1024).toFixed(1)} kB`} read={sample => sample.freeHeapBytes} samples={samples} title="Volná paměť" tone="memory" />
        </div>
      </>}
  </section>;
}
