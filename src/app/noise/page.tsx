"use client";
import { useLanguage } from "@/components/language";
import { useEffect, useRef, useState } from "react";
import { AudioLines, LockKeyhole, Maximize, Mic, MicOff, SlidersHorizontal } from "lucide-react";
import { ErrorMessage, PageIntro } from "@/components/ui";
type Engine = { context: AudioContext; stream: MediaStream; analyser: AnalyserNode; source: MediaStreamAudioSourceNode; frame: number; values: Float32Array<ArrayBuffer> };
export default function NoisePage() {
  const { t } = useLanguage();
  const stage = useRef<HTMLDivElement>(null), engine = useRef<Engine | null>(null), alive = useRef(true), sensitivityRef = useRef(1), baseline = useRef(-65);
  const calibration = useRef<{ until: number; values: number[] } | null>(null);
  const [active, setActive] = useState(false), [starting, setStarting] = useState(false), [level, setLevel] = useState(0), [sensitivity, setSensitivity] = useState(1), [calibrating, setCalibrating] = useState(false), [error, setError] = useState<string | null>(null);
  function release() { const e = engine.current; if (e) { cancelAnimationFrame(e.frame); e.stream.getTracks().forEach(t => t.stop()); e.source.disconnect(); void e.context.close(); engine.current = null; } }
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; const e = engine.current; if (e) { cancelAnimationFrame(e.frame); e.stream.getTracks().forEach(t => t.stop()); e.source.disconnect(); void e.context.close(); engine.current = null; } };
  }, []);
  async function start() {
    setStarting(true); setError(null);
    let acquiredStream: MediaStream | null = null;
    let acquiredContext: AudioContext | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access needs HTTPS or localhost and a supported browser.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
      acquiredStream = stream;
      if (!alive.current) { stream.getTracks().forEach(t => t.stop()); return; }
      const context = new AudioContext();
      acquiredContext = context;
      const analyser = context.createAnalyser(); analyser.fftSize = 2048;
      const source = context.createMediaStreamSource(stream); source.connect(analyser);
      const e: Engine = { context, stream, analyser, source, frame: 0, values: new Float32Array(analyser.fftSize) }; engine.current = e;
      await context.resume();
      if (!alive.current) { release(); return; }
      stream.getAudioTracks().forEach(t => { t.onended = () => { if (alive.current) { release(); calibration.current = null; setCalibrating(false); setActive(false); setLevel(0); setError("The microphone was disconnected. Reconnect it and start again."); } }; });
      setActive(true); let smoothed = 0, lastPaint = 0;
      const sample = () => {
        if (!alive.current || engine.current !== e) return;
        analyser.getFloatTimeDomainData(e.values);
        const rms = Math.sqrt(e.values.reduce((sum, v) => sum + v * v, 0) / e.values.length);
        const dbfs = 20 * Math.log10(Math.max(rms, 0.000001));
        if (calibration.current) {
          calibration.current.values.push(dbfs);
          if (Date.now() >= calibration.current.until) {
            const samples = calibration.current.values.sort((a, b) => a - b);
            baseline.current = Math.min(-25, Math.max(-85, samples[Math.floor(samples.length * .75)]));
            calibration.current = null; setCalibrating(false);
          }
        }
        const target = Math.min(100, Math.max(0, ((dbfs - baseline.current) / 45) * 100 * sensitivityRef.current));
        smoothed = smoothed * .93 + target * .07;
        if (performance.now() - lastPaint > 100) { setLevel(Math.round(smoothed)); lastPaint = performance.now(); }
        e.frame = requestAnimationFrame(sample);
      };
      e.frame = requestAnimationFrame(sample);
    } catch (e) {
      release(); acquiredStream?.getTracks().forEach(t => t.stop());
      if (acquiredContext && acquiredContext.state !== "closed") await acquiredContext.close().catch(() => {});
      if (alive.current) { setActive(false); setError(e instanceof DOMException && e.name === "NotAllowedError" ? "Microphone permission was declined. Allow microphone access in your browser, then try again." : e instanceof DOMException && e.name === "NotFoundError" ? "No microphone was found. Connect one and try again." : (e as Error).message); }
    }
    finally { if (alive.current) setStarting(false); }
  }
  function stop() { release(); calibration.current = null; setActive(false); setLevel(0); setCalibrating(false); }
  const state = level >= 70 ? "red" : level >= 40 ? "yellow" : "green";
  const message = !active ? "A little room to focus." : calibrating ? "Listening to the quiet…" : state === "red" ? "Let’s bring it down a little." : state === "yellow" ? "A little softer, please." : "Just the right kind of quiet.";
  return <><PageIntro eyebrow={t("THE CLASSROOM NOISE MONITOR")} title={t("Make space for focus.")} description={t("A gentle visual reminder. A calmer room for everyone.")} /><ErrorMessage message={error} /><div ref={stage} className={`noise-stage ${state}`}><button className="icon-button fullscreen-button" aria-label={t("Open noise monitor in fullscreen")} onClick={async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await stage.current?.requestFullscreen(); } catch { setError("Fullscreen is unavailable in this browser."); } }}><Maximize size={19} /></button><span className="eyebrow"><AudioLines size={15} /> {active ? t("LISTENING TO YOUR ROOM") : t("A QUIETER CLASSROOM STARTS HERE")}</span><div className="noise-gauge" style={{ "--level": level } as React.CSSProperties}><div className="noise-gauge-inner"><span className="noise-value">{active ? level : "—"}</span><span className="noise-value-label">{t("RELATIVE NOISE LEVEL")}</span></div></div><h2>{t(message)}</h2><p>{calibrating ? t("Keep the room quiet for three seconds. We’ll use this as your starting point.") : active ? t("The gauge follows the sound in your room. Green is calm, yellow is rising, and red is a reminder to reset.") : t("Start the microphone, put this on the board, and let the room find its rhythm.")}</p><div className="noise-buttons">{active ? <button className="button secondary" onClick={stop}><MicOff size={15} /> {t("Stop listening")}</button> : <button className="button primary" disabled={starting} onClick={start}><Mic size={16} />{starting ? t("Opening microphone…") : t("Start noise monitor")}</button>}</div><div className="noise-legend"><span><i className="legend-dot" /> {t("Calm & focused")}</span><span><i className="legend-dot yellow" /> {t("Getting louder")}</span><span><i className="legend-dot red" /> {t("Time to reset")}</span></div></div><div className="noise-settings"><label><SlidersHorizontal size={15} /> {t("Sensitivity")}<input type="range" min={0.5} max={2} step={0.1} value={sensitivity} onChange={e => { const v = Number(e.target.value); sensitivityRef.current = v; setSensitivity(v); }} /><span>{sensitivity.toFixed(1)}×</span></label><button className="button ghost small" disabled={!active || calibrating} onClick={() => { calibration.current = { until: Date.now() + 3000, values: [] }; setCalibrating(true); }}>{t("Calibrate a quiet room")}</button></div><span className="noise-privacy"><LockKeyhole size={13} /> {t("Audio stays in this browser. Nothing is recorded, uploaded, or stored.")}</span><p className="field-help" style={{ textAlign: "center", marginTop: 10 }}>{t("This is a relative classroom indicator, not a calibrated decibel meter.")}</p></>;
}
