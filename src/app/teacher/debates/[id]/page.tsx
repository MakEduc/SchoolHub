"use client";
import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { ArrowUpRight, Check, Copy, Expand, Maximize, MessagesSquare, Pause, Play, RotateCcw, Shuffle, Users, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { browserSupabase } from "@/lib/supabase/browser";
import type { Debate } from "@/lib/domain";
import { BackLink, Empty, ErrorMessage, Loading, PageIntro, useResource } from "@/components/ui";
import { useDebateTimer } from "@/components/debate-tools";
export default function HostDebate({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, loading, refresh } = useResource<Debate & { serverTime: string }>(`debate/host/${id}`, 3000);
  const [qr, setQr] = useState(""), [actionError, setError] = useState<string | null>(null), [pending, setPending] = useState(false), [copied, setCopied] = useState(false);
  const [confirmation, setConfirmation] = useState<"reopen" | "end" | null>(null);
  const [qrZoom, setQrZoom] = useState(false);
  const projector = useRef<HTMLDivElement>(null); const timer = useDebateTimer(data, data?.serverTime);
  const code = data?.join_code;
  useEffect(() => {
    if (!code) return;
    let active = true;
    QRCode.toDataURL(`${window.location.origin}/debate/join/${code}`, { width: 320, margin: 2, color: { dark: "#254f40", light: "#fffefa" } }).then(image => { if (active) setQr(image); });
    return () => { active = false; };
  }, [code]);
  useEffect(() => {
    if (!qrZoom) return;
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") setQrZoom(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [qrZoom]);
  useEffect(() => {
    const db = browserSupabase();
    const channel = db.channel(`host-debate-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "debate_participants", filter: `session_id=eq.${id}` }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "debate_sessions", filter: `id=eq.${id}` }, refresh).subscribe();
    return () => { void db.removeChannel(channel); };
  }, [id, refresh]);
  async function action(value: string, participantId?: string) {
    setPending(true); setError(null);
    try { await api("debate/action", { id, action: value, participantId }); setConfirmation(null); await refresh(); }
    catch (e) { setError((e as Error).message); } finally { setPending(false); }
  }
  if (loading) return <Loading label="Opening the classroom…" />;
  if (!data) return <><BackLink href="/teacher">Teacher workspace</BackLink><ErrorMessage message={error} /></>;
  const participants = data.participants || [], stances = [...data.stances].sort((a, b) => a.position - b.position);
  return <><BackLink href="/teacher">Teacher workspace</BackLink><PageIntro eyebrow="LIVE CLASSROOM DEBATE" title={data.status === "lobby" ? "Everyone has a place." : data.status === "ended" ? "A conversation well had." : "Meet your perspectives."} description={data.status === "lobby" ? "Put the QR on the board. Let the room fill up." : data.status === "ended" ? "This debate is closed. Start a new conversation whenever you’re ready." : "Stances are set. Give your students a moment to prepare."} action={<button className="button secondary" onClick={async () => { try { await projector.current?.requestFullscreen(); } catch { setError("Fullscreen is unavailable in this browser."); } }}><Maximize size={15} /> Projector view</button>} />
    <div ref={projector} className="projector-board"><ErrorMessage message={error || actionError} /><div className="live-layout"><section><div className="debate-prompt">{data.prompt}</div>{data.status === "lobby" ? <><div className="section-heading"><h2>The waiting room</h2><span className="lobby-count"><Users size={13} style={{ verticalAlign: "middle", marginRight: 5 }} />{participants.length} / 100 joined</span></div>{participants.length ? <div className="lobby-people">{participants.map(p => <span className="person-chip" key={p.id}>{p.display_name}<button className="icon-button" aria-label={`Remove ${p.display_name}`} onClick={() => action("remove", p.id)} disabled={pending}><X size={12} /></button></span>)}</div> : <Empty icon={<Users size={28} />} title="The room is open.">Your students will appear here as they join. Let them scan the QR or enter the code.</Empty>}<div className="host-actions"><button className="button primary" onClick={() => action("assign")} disabled={pending || !participants.length}><Shuffle size={16} /> Assign stances</button><span className="privacy-note">One shuffle. Balanced sides.</span></div></> : <div className="stance-grid">{stances.map((s, i) => <section className={`stance-column stance-${i}`} key={s.id}><span className="eyebrow">PERSPECTIVE {i + 1} · {participants.filter(p => p.stance_id === s.id).length} STUDENTS</span><h3>{s.label}</h3><div className="stance-roster">{participants.filter(p => p.stance_id === s.id).map(p => <span key={p.id}>{p.display_name}</span>)}</div></section>)}</div>}
    </section><aside className="live-side">{data.status === "lobby" && <div className="qr-panel"><span className="eyebrow">SCAN TO JOIN THE ROOM</span>{qr && <button className="qr-image-button" onClick={() => setQrZoom(true)} aria-label={`Enlarge QR code for room ${data.join_code}`} title="Enlarge across the screen"><Image className="qr-image" src={qr} width={185} height={185} unoptimized alt={`QR code to join debate ${data.join_code}`} /></button>}<p>Or enter your room code</p><div className="qr-code">{data.join_code}</div><button className="button ghost small" onClick={() => setQrZoom(true)}><Expand size={13} /> Enlarge QR</button><button className="button ghost small" onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/debate/join/${data.join_code}`); setCopied(true); } catch { setError("Copy the room link below manually."); } }}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copied" : "Copy join link"}</button><br /><Link href={`/debate/join/${data.join_code}`} className="small-link" target="_blank" rel="noreferrer">Open student view <ArrowUpRight size={13} /></Link></div>}
    <div className="timer-panel"><span className="eyebrow">{data.status === "ended" ? "DEBATE CLOSED" : "PREPARATION TIME"}</span><div className="timer-display" aria-label={`${timer} preparation remaining`}>{timer}</div>{data.status === "assigned" && <div className="timer-controls"><button className="button primary" disabled={pending} onClick={() => action(data.timer_deadline ? "pause" : "start")}>{data.timer_deadline ? <Pause size={14} /> : <Play size={14} />}{data.timer_deadline ? "Pause" : "Start"}</button><button className="button secondary" disabled={pending} onClick={() => action("reset")} aria-label="Reset preparation timer"><RotateCcw size={14} /></button></div>}{data.status === "lobby" && <p className="field-help">Assign stances to start the timer.</p>}{data.status === "ended" && <MessagesSquare size={24} style={{ alignSelf: "center", margin: "0 auto" }} />}</div></aside></div>
    {data.status !== "ended" && <div className="host-actions host-danger-bar">{data.status === "assigned" && <button className="button ghost small" disabled={pending} onClick={() => setConfirmation("reopen")}>Reopen lobby & clear assignments</button>}<button className="button danger small" disabled={pending} onClick={() => setConfirmation("end")}>End debate</button></div>}
    {confirmation && <div className="inline-confirm" role="alert"><p>{confirmation === "reopen" ? "This clears every assignment and allows new students to join. Ready to reopen?" : "This closes the debate for everyone. Ready to end?"}</p><button className="button danger small" disabled={pending} onClick={() => action(confirmation)}>Yes, {confirmation === "reopen" ? "reopen" : "end debate"}</button><button className="button ghost small" onClick={() => setConfirmation(null)}>Keep current session</button></div>}
    {qrZoom && <div className="qr-overlay" role="dialog" aria-modal="true" aria-label={`Enlarged QR code for room ${data.join_code}`} onClick={() => setQrZoom(false)}><div className="qr-overlay-card" onClick={e => e.stopPropagation()}><span className="eyebrow">SCAN TO JOIN · {data.join_code}</span>{qr && <Image className="qr-overlay-image" src={qr} width={520} height={520} unoptimized alt={`Large QR code to join debate ${data.join_code}`} />}<div className="qr-code large">{data.join_code}</div><p className="field-help" style={{ margin: 0 }}>Point your phone camera at the code — it opens the room and joins automatically.</p><button className="button secondary" onClick={() => setQrZoom(false)}><X size={15} /> Close</button></div></div>}
    </div></>;
}
