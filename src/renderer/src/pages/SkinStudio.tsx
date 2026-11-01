import { useEffect, useRef, useState } from 'react';
import { Glass } from '../components/Glass';
import type { SkinEntry } from '@shared/types';

type Tool = 'pencil' | 'eraser' | 'picker' | 'fill';
const SIZE = 64;
const SCALE = 8;

function floodFill(data: ImageData, x: number, y: number, color: [number, number, number, number]) {
  const { width, height } = data;
  const idx = (x: number, y: number) => (y * width + x) * 4;
  const start = idx(x, y);
  const target = [data.data[start], data.data[start + 1], data.data[start + 2], data.data[start + 3]];
  if (target.every((v, i) => v === color[i])) return;
  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
    const i = idx(cx, cy);
    if (data.data[i] !== target[0] || data.data[i + 1] !== target[1] || data.data[i + 2] !== target[2] || data.data[i + 3] !== target[3]) continue;
    data.data.set(color, i);
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
}

export function SkinStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#92bcf8');
  const [name, setName] = useState('my_skin');
  const [skins, setSkins] = useState<SkinEntry[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ctx = () => canvasRef.current!.getContext('2d', { willReadFrequently: true })!;

  useEffect(() => {
    const c = ctx();
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, SIZE, SIZE);
    void refresh();
  }, []);

  const refresh = () => window.voxel.skins.list().then(setSkins);

  function hexToRgba(hex: string): [number, number, number, number] {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  }

  function pointAt(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const r = canvasRef.current!.getBoundingClientRect();
    return [Math.floor(((e.clientX - r.left) / r.width) * SIZE), Math.floor(((e.clientY - r.top) / r.height) * SIZE)];
  }

  function paint(x: number, y: number) {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    const c = ctx();
    if (tool === 'picker') {
      const [r, g, b, a] = c.getImageData(x, y, 1, 1).data;
      if (a > 0) setColor('#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join(''));
      setTool('pencil');
      return;
    }
    if (tool === 'eraser') c.clearRect(x, y, 1, 1);
    else if (tool === 'pencil') { c.fillStyle = color; c.fillRect(x, y, 1, 1); }
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const [x, y] = pointAt(e);
    if (tool === 'fill') {
      const c = ctx();
      const img = c.getImageData(0, 0, SIZE, SIZE);
      floodFill(img, x, y, hexToRgba(color));
      c.putImageData(img, 0, 0);
      return;
    }
    drawing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    paint(x, y);
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const [x, y] = pointAt(e);
    paint(x, y);
  }

  function clear() {
    ctx().clearRect(0, 0, SIZE, SIZE);
  }

  async function save() {
    setError(null);
    setMsg(null);
    const dataUrl = canvasRef.current!.toDataURL('image/png');
    const res = await window.voxel.skins.save(name, dataUrl);
    if (res.ok) { setMsg(`Сохранено: ${res.data}`); void refresh(); }
    else setError(res.error ?? 'Ошибка сохранения');
  }

  async function load(s: SkinEntry) {
    const img = new Image();
    img.onload = () => {
      const c = ctx();
      c.clearRect(0, 0, SIZE, SIZE);
      c.drawImage(img, 0, 0);
      setName(s.name);
    };
    img.src = s.dataUrl;
  }

  async function importPng() {
    setError(null);
    const res = await window.voxel.skins.import(name);
    if (res.ok) { setMsg(`Импортировано: ${res.data}`); void refresh(); }
    else setError(res.error ?? 'Ошибка импорта');
  }

  const tools: { id: Tool; label: string }[] = [
    { id: 'pencil', label: 'Карандаш' }, { id: 'eraser', label: 'Ластик' },
    { id: 'picker', label: 'Пипетка' }, { id: 'fill', label: 'Заливка' },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--vx-muted)]">Skin Studio</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Редактор скинов</h1>
      </header>

      <div className="grid grid-cols-[auto_1fr] gap-6">
        <Glass className="flex flex-col gap-4 p-5">
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            style={{ width: SIZE * SCALE, height: SIZE * SCALE, imageRendering: 'pixelated' }}
            className="rounded-lg bg-[repeating-conic-gradient(#1b1f27_0%_25%,#141820_0%_50%)] bg-[length:16px_16px] touch-none"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={() => { drawing.current = false; }}
            onPointerLeave={() => { drawing.current = false; }}
          />
          <div className="flex flex-wrap gap-2">
            {tools.map((t) => (
              <button key={t.id} onClick={() => setTool(t.id)} className={`rounded-lg px-3 py-1.5 text-xs ${tool === t.id ? 'bg-[var(--vx-accent)] text-black/80' : 'bg-white/[0.06]'}`}>{t.label}</button>
            ))}
            <button onClick={clear} className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs">Очистить</button>
          </div>
        </Glass>

        <div className="flex flex-col gap-4">
          <Glass className="flex flex-col gap-4 p-5">
            <div className="flex items-center gap-3">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 rounded bg-transparent" />
              <span className="font-mono text-sm">{color}</span>
            </div>
            <label className="flex flex-col gap-1.5 text-xs text-[var(--vx-muted)]">
              Имя скина (латиница, цифры, _ и -)
              <input value={name} maxLength={32} onChange={(e) => setName(e.target.value)} className="rounded-xl border border-white/[0.08] bg-black/25 px-4 py-2 text-sm text-[var(--vx-text)] outline-none" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void save()} className="rounded-xl bg-[var(--vx-accent)] px-4 py-2 text-sm font-medium text-black/80">Сохранить PNG</button>
              <button onClick={() => void importPng()} className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm">Импорт PNG</button>
            </div>
            <p className="text-[11px] text-[var(--vx-muted)]">PNG 64×64 или 64×32 с альфа-каналом, не больше 128 КБ.</p>
            {msg && <p className="text-sm text-[var(--vx-accent)]">{msg}</p>}
            {error && <p className="text-sm text-red-400">{error}</p>}
          </Glass>

          <Glass className="flex flex-col gap-3 p-5">
            <div className="text-sm font-medium">Мои скины</div>
            {skins.length === 0 && <p className="text-sm text-[var(--vx-muted)]">Пока пусто.</p>}
            <div className="grid grid-cols-4 gap-3">
              {skins.map((s) => (
                <div key={s.name} className="flex flex-col items-center gap-2 rounded-xl bg-black/25 p-2">
                  <button onClick={() => void load(s)} title="Открыть в редакторе">
                    <img src={s.dataUrl} alt={s.name} className="h-16 w-16" style={{ imageRendering: 'pixelated' }} />
                  </button>
                  <span className="max-w-full truncate text-[11px]">{s.name}</span>
                  <button onClick={() => void window.voxel.skins.remove(s.name).then(refresh)} className="text-[11px] text-[var(--vx-muted)] underline">удалить</button>
                </div>
              ))}
            </div>
          </Glass>
        </div>
      </div>
    </div>
  );
}
