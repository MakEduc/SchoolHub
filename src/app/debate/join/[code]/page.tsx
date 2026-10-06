"use client";
import { useLanguage } from "@/components/language";
import { use, useState } from "react";
import { ArrowRight, Check, LoaderCircle, LockKeyhole, MessagesSquare } from "lucide-react";
import { api } from "@/lib/api-client";
import type { Debate, Participant } from "@/lib/domain";
import { ErrorMessage, Loading, SubmitButton, useResource } from "@/components/ui";
import { useDebateTimer } from "@/components/debate-tools";
type Lobby = { session: Debate; participant: Participant | null; count: number; serverTime: string };
export default function JoinDebate({ params }: { params: Promise<{ code: string }> }) {
  const { t } = useLanguage();
  const { code } = use(params);
  const { data, loading, error, refresh } = useResource<Lobby>(`debate/join/${code.toUpperCase()}`, 2000);
  const [name, setName] = useState(""), [pending, setPending] = useState(false), [joinError, setError] = useState<string | null>(null);
  const timer = useDebateTimer(data?.session || null, data?.serverTime);
  async function join(e: React.FormEvent) {
    e.preventDefault(); setPending(true); setError(null);
    try { await api("debate/join", { code: code.toUpperCase(), name }); await refresh(); } catch (e) { setError((e as Error).message); } finally { setPending(false); }
  }
  if (loading) return <Loading label={t("Finding your classroom…")} />;
  if (!data) return <div className="join-card"><h1>{t("Let’s find your room.")}</h1><ErrorMessage message={error} /><a className="button secondary" href="/debate">{t("Check your room code")}<ArrowRight size={16} /></a></div>;
  const { session, participant } = data;
  const sorted = [...session.stances].sort((a, b) => a.position - b.position);
  const stanceIndex = sorted.findIndex(s => s.id === participant?.stance_id);
  return <div className="join-card"><span className="eyebrow">{t("CLASSROOM DEBATE ·")}{session.join_code}</span><h1>{session.prompt}</h1><ErrorMessage message={error || joinError} />{session.status === "ended" ? <div className="join-wait"><Check size={35} /><h2>{t("That’s a wrap.")}</h2><p>{t("This debate has ended. Thanks for bringing your voice.")}</p></div> : participant ? <>{stanceIndex >= 0 ? <div className={`assignment-card stance-${stanceIndex}`}><span className="eyebrow">{participant.display_name}{t(", YOUR PERSPECTIVE IS")}</span><h2>{sorted[stanceIndex].label}</h2><p>{t("Your stance is set. Find your group and make your case.")}</p><div className="timer-display">{timer}</div><span className="eyebrow">{session.timer_deadline ? t("PREPARATION REMAINING") : t("WAITING FOR YOUR TEACHER TO START")}</span></div> : <div className="join-wait"><MessagesSquare size={36} /><h2>{t("You’re in,")}{" "}{participant.display_name}.</h2><p>{data.count} {data.count === 1 ? t("student has") : t("students have")} {t("joined. Your teacher will assign your stance when the class is ready.")}</p><div className="loading-state"><LoaderCircle size={23} className="spin" /><span>{t("Waiting for the shuffle…")}</span></div></div>}<p className="privacy-note" style={{ marginTop: 26, justifyContent: "center" }}><LockKeyhole size={13} /> {t("Your place stays with this browser if you refresh.")}</p></> : session.status !== "lobby" ? <div className="join-wait"><h2>{t("The sides are already set.")}</h2><p>{t("Ask your teacher to reopen the lobby if you need to join.")}</p></div> : <><p>{t("Enter a name your teacher will recognize. We’ll save your place in this browser.")}</p><form onSubmit={join}><label className="field"><span className="field-label">{t("Your name")}</span><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder={t("First name + initial, if needed")} required maxLength={50} autoComplete="off" /></label><SubmitButton pending={pending}>{t("Join the room")}<ArrowRight size={16} /></SubmitButton></form><p className="privacy-note" style={{ marginTop: 20, justifyContent: "center" }}>{t("No email. No account. Just this debate.")}</p></>}</div>;
}
