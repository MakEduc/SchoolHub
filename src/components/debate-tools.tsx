"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Minus, Plus, MessagesSquare } from "lucide-react";
import { api } from "@/lib/api-client";
import type { Debate } from "@/lib/domain";
import { ErrorMessage, SubmitButton } from "./ui";
export function useDebateTimer(debate: Pick<Debate, "timer_deadline" | "timer_remaining" | "prep_seconds"> | null, serverTime?: string) {
  const [clock, setClock] = useState(() => ({ now: Date.now(), offset: 0 }));
  useEffect(() => {
    const offset = serverTime ? Date.parse(serverTime) - Date.now() : 0;
    const tick = () => setClock({ now: Date.now(), offset });
    const first = setTimeout(tick, 0), timer = setInterval(tick, 250);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [serverTime]);
  const seconds = debate?.timer_deadline ? Math.max(0, Math.ceil((Date.parse(debate.timer_deadline) - clock.now - clock.offset) / 1000)) : debate?.timer_remaining ?? debate?.prep_seconds ?? 0;
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
export function DebateCreateForm() {
  const router = useRouter();
  const [stances, setStances] = useState(["For the motion", "Against the motion"]), [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setPending(true); setError(null);
    try {
      const fields = new FormData(e.currentTarget);
      const result = await api<{ id: string }>("debate/create", { prompt: fields.get("prompt"), stances, prepSeconds: Number(fields.get("minutes")) * 60 });
      router.push(`/teacher/debates/${result.id}`);
    } catch (e) { setError((e as Error).message); } finally { setPending(false); }
  }
  return <div className="form-layout"><section className="form-panel"><form onSubmit={submit}><h2>One prompt. Many perspectives.</h2><p className="field-help" style={{ marginBottom: 26 }}>Students join on their phones. The conversation happens in the room.</p><ErrorMessage message={error} />
    <label className="field"><span className="field-label">Debate prompt</span><textarea className="input" name="prompt" placeholder="e.g. Should schools replace exams with project-based assessment?" minLength={5} maxLength={300} rows={4} required /></label>
    <fieldset style={{ border: 0, padding: 0, margin: "0 0 24px" }}><legend className="field-label">Stances <small>2–4 sides</small></legend>{stances.map((s, i) => <div className="stance-field" key={i}><span className={`stance-dot stance-${i}`} /><input className="input" aria-label={`Stance ${i + 1}`} value={s} onChange={e => setStances(stances.map((v, j) => i === j ? e.target.value : v))} required maxLength={80} placeholder={`Stance ${i + 1}`} />{stances.length > 2 && <button type="button" className="icon-button" aria-label={`Remove stance ${i + 1}`} onClick={() => setStances(stances.filter((_, j) => j !== i))}><Minus size={16} /></button>}</div>)}{stances.length < 4 && <button className="button ghost small" type="button" onClick={() => setStances([...stances, ""])}><Plus size={14} /> Add a stance</button>}</fieldset>
    <label className="field"><span className="field-label">Preparation time</span><select className="input" name="minutes" defaultValue="5">{[1, 2, 3, 5, 10, 15, 20, 30, 60].map(n => <option value={n} key={n}>{n} {n === 1 ? "minute" : "minutes"}</option>)}</select></label>
    <div className="form-actions"><span className="privacy-note"><MessagesSquare size={14} /> Everyone gets a place in the conversation.</span><SubmitButton pending={pending}>Open the lobby <ArrowRight size={15} /></SubmitButton></div>
  </form></section><aside className="info-panel"><MessagesSquare size={27} strokeWidth={1.5} /><h3>Different sides.<br />A shared conversation.</h3><p>Let a fair shuffle introduce a new perspective. Groups are balanced automatically, with at most one student difference.</p><div className="info-steps"><div className="info-step"><span className="info-number">01</span><div><strong>Put the QR on the board</strong><p>Students scan, enter their names, and join.</p></div></div><div className="info-step"><span className="info-number">02</span><div><strong>Shuffle the room</strong><p>One click assigns everyone a stance.</p></div></div><div className="info-step"><span className="info-number">03</span><div><strong>Take a moment to prepare</strong><p>Start the timer, then let the real conversation begin.</p></div></div></div><div className="info-panel-foot">Lobbies close to new arrivals after assignment. Reopening clears the assignments so you can shuffle everyone again.</div></aside></div>;
}
type DetectedBarcode = { rawValue: string };
type BarcodeReader = { detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]> };
function barcodeReader(): BarcodeReader | null {
  const Ctor = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => BarcodeReader }).BarcodeDetector;
  if (!Ctor) return null;
  try { return new Ctor({ formats: ["qr_code"] }); } catch { return null; }
}
export function extractDebateCode(text: string): string | null {
  const match = text.match(/\/debate\/join\/([A-Za-z0-9]{6})/i);
  const code = (match ? match[1] : text.trim()).toUpperCase();
  return /^[A-Z0-9]{6}$/.test(code) ? code : null;
}
export function QrScanner({ onScan, onCancel }: { onScan: (code: string) => void; onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    let finished = false;
    const maybeReader = barcodeReader();
    if (!maybeReader) { setError("This browser can’t scan inside the page. Open your phone’s camera app, point it at the QR, and tap the link — or enter the code below."); return; }
    const reader: BarcodeReader = maybeReader;
    async function tick() {
      if (stopped || finished) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        try {
          const codes = await reader.detect(video);
          const text = codes.length ? codes[0].rawValue : "";
          if (text && !finished) {
            const code = extractDebateCode(text);
            if (code) { finished = true; onScan(code); return; }
            setHint("That QR isn’t a debate room. Point at your teacher’s code.");
          }
        } catch { /* keep scanning */ }
      }
      if (!stopped && !finished) raf = requestAnimationFrame(() => { void tick(); });
    }
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) { setError("This device can’t open the camera. Enter the room code instead."); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch { setError("Camera is blocked. Allow camera access, or enter the room code instead."); return; }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      try { await video.play(); } catch { setError("Camera preview couldn’t start. Enter the room code instead."); return; }
      raf = requestAnimationFrame(() => { void tick(); });
    }
    void start();
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()); };
  }, [onScan]);
  return <div className="qr-scanner"><div className="qr-viewfinder"><video ref={videoRef} playsInline muted aria-label="Camera preview for QR scanning" /><span className="qr-frame" aria-hidden="true" /></div><ErrorMessage message={error} />{!error && <p className="field-help" style={{ margin: 0 }}>{hint || "Point your camera at the QR on your teacher’s screen."}</p>}<button className="button ghost small" type="button" onClick={onCancel}>Enter code instead</button></div>;
}
