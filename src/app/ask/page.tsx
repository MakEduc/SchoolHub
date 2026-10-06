"use client";
import { useState } from "react";
import { ArrowRight, GraduationCap, LockKeyhole, MessageCircle, School, ShieldCheck, Users } from "lucide-react";
import { api } from "@/lib/api-client";
import { type Config } from "@/lib/domain";
import { ErrorMessage, PageIntro, SubmitButton, Success, useResource } from "@/components/ui";
export default function AskPage() {
  const { data: config, error: configError, loading } = useResource<Config>("config");
  const [recipientType, setType] = useState<"teacher" | "department" | "general">("department");
  const [recipientId, setId] = useState(""); const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null), [pending, setPending] = useState(false), [done, setDone] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null);
    try { const fields = new FormData(event.currentTarget); await api("questions", { body, recipientType, recipientId: recipientType === "general" ? null : recipientId, website: fields.get("website") || "" }); setDone(true); }
    catch (e) { setError((e as Error).message); } finally { setPending(false); }
  }
  return <><PageIntro eyebrow="THE OPEN SCHOOL BACKCHANNEL" title="What’s on your mind?" description="A question, an idea, or something we could do better. Your voice belongs here." />
    <div className="form-layout"><section className="form-panel">{done ? <Success title="Your voice has been heard."><p>Your message is in the right inbox. A teacher can review it and choose to share it on a public class board.</p><div className="success-actions"><button className="button secondary" onClick={() => { setDone(false); setBody(""); }}>Ask another question <ArrowRight size={15} /></button></div></Success> : <form onSubmit={submit}>
      <h2>One question. A direct connection.</h2><p className="field-help" style={{ marginBottom: 26 }}>Choose where your message goes. We’ll take it from there.</p>
      <ErrorMessage message={configError || error} />
      <fieldset style={{ border: 0, padding: 0, margin: "0 0 24px" }}><legend className="field-label">Who would you like to reach?</legend><div className="segmented">{([
        ["teacher", "Specific teacher", GraduationCap], ["department", "Department", Users], ["general", "School life", School],
      ] as const).map(([value, label, Icon]) => <button type="button" key={value} className={`segment ${recipientType === value ? "selected" : ""}`} aria-pressed={recipientType === value} onClick={() => { setType(value); setId(""); }}><Icon size={15} />{label}</button>)}</div></fieldset>
      {recipientType !== "general" && <label className="field"><span className="field-label">{recipientType === "teacher" ? "Choose a teacher" : "Choose a department"}</span><select className="input" required value={recipientId} onChange={e => setId(e.target.value)} disabled={loading || !!configError}><option value="">{loading ? "Loading the school directory…" : "Select a recipient"}</option>{recipientType === "teacher" ? config?.teachers.map(t => <option key={t.id} value={t.id}>{t.display_name}</option>) : config?.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>{recipientType === "teacher" && config && !config.teachers.length && <span className="field-help">Your school hasn’t added its teachers yet. You can still write to a department or school life.</span>}</label>}
      <label className="field"><span className="field-label">Your question or suggestion</span><textarea className="input" aria-label="Your question or suggestion" placeholder="I’ve been wondering…" required minLength={3} maxLength={280} value={body} onChange={e => setBody(e.target.value)} rows={6} /><span className="textarea-footer"><span>A little kindness goes a long way.</span><span className={`counter ${body.length >= 270 ? "limit" : ""}`}>{body.length} / 280</span></span></label>
      <label className="honeypot" aria-hidden="true">Leave this empty<input name="website" autoComplete="off" tabIndex={-1} /></label>
      <div className="form-actions"><span className="privacy-note"><LockKeyhole size={14} /> No name, email, or account attached.</span><SubmitButton pending={pending} disabled={loading || !!configError}>Submit anonymously <ArrowRight size={16} /></SubmitButton></div>
    </form>}</section><aside className="info-panel"><ShieldCheck size={26} strokeWidth={1.5} /><h3>Just your voice.<br />Nothing attached.</h3><p>Sometimes the best questions are the ones you’re a little hesitant to ask out loud.</p><div className="info-steps"><div className="info-step"><span className="info-number">01</span><div><strong>Find the right inbox</strong><p>A teacher, a department, or the wider school.</p></div></div><div className="info-step"><span className="info-number">02</span><div><strong>Say what’s on your mind</strong><p>Keep it thoughtful and under 280 characters.</p></div></div><div className="info-step"><span className="info-number">03</span><div><strong>Let the conversation begin</strong><p>Staff can review your question and pin it to a public board.</p></div></div></div><div className="info-panel-foot"><MessageCircle size={14} style={{ verticalAlign: "middle", marginRight: 5 }} /> Messages are private until a teacher chooses to publish them. Please leave personal details out of your question.</div></aside></div>
  </>;
}
