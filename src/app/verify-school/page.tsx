"use client";
import { useState } from "react";
import { ArrowRight, Mail, ShieldCheck, Check } from "lucide-react";
import { AuthFrame } from "@/components/auth-frame";
import { ErrorMessage, SubmitButton } from "@/components/ui";
import { useLanguage } from "@/components/language";
import { api } from "@/lib/api-client";

export default function VerifySchool() {
  const { language } = useLanguage();
  const bs = language === "bs";
  const [email, setEmail] = useState(""), [code, setCode] = useState(""), [sent, setSent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      if (!sent) { await api("school/request-code", { email: email.trim(), language }); setSent(true); }
      else {
        await api("school/verify-code", { email: email.trim(), code });
        const next = new URLSearchParams(window.location.hash.slice(1)).get("next") || "/";
        const target = new URL(next, window.location.origin);
        window.location.assign(target.origin === window.location.origin && !target.pathname.startsWith("/verify-school") ? target.pathname + target.search + target.hash : "/");
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Verification failed. Please try again."); }
    finally { setBusy(false); }
  }
  return <AuthFrame role="student" step={sent ? 2 : 1} title={sent ? bs ? "Provjerite svoj email." : "Check your school inbox." : bs ? "Pronađite svoju školu." : "Find your school space."} description={sent ? bs ? "Otvorite link iz poruke ili unesite email kod ispod da pristupite svojoj školi." : "Open the sign-in link in your school inbox, or enter the email code below to join your school’s space." : bs ? "Potvrdite školski email. Pitanja, termini učenja i vaša školska zajednica čekaju vas." : "Verify your school email to ask questions, find a study table, and connect with your school."}>
    {sent && <div className="auth-delivery" role="status"><span><Check size={16} /></span><div><strong>{bs ? "Email je poslan" : "Check your school inbox"}</strong><p>{bs ? "Koristite link ili kod iz najnovije poruke" : "Use the link or code from the latest email"}</p></div></div>}
    <form className="auth-form" onSubmit={submit} aria-busy={busy}>
      <ErrorMessage message={error || null} />
      <label className="field"><span className="field-label">{sent ? bs ? "Email kod" : "Email sign-in code" : bs ? "Školski email" : "School email"}</span><div className={`auth-input-wrap ${sent ? "auth-code-wrap" : ""}`}><Mail size={19} aria-hidden="true" />{sent ? <input className="input auth-code" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" minLength={6} maxLength={8} value={code} onChange={e => setCode(e.target.value)} disabled={busy} placeholder="000000" aria-describedby="auth-field-help" /> : <input className="input" required type="email" autoComplete="off" placeholder="you@2gimnazija.edu.ba" value={email} onChange={e => setEmail(e.target.value)} disabled={busy} aria-describedby="auth-field-help" />}</div><span className="auth-field-help" id="auth-field-help">{sent ? bs ? "Ne vidite poruku? Provjerite i neželjenu poštu." : "Nothing in your inbox? Check your spam folder, too." : bs ? "Koristite službeni email svoje škole." : "Use the official email address provided by your school."}</span></label>
      <SubmitButton pending={busy}>{sent ? bs ? "Uđi u školski prostor" : "Enter your school space" : bs ? "Pošalji email za prijavu" : "Send sign-in email"}<ArrowRight size={17} /></SubmitButton>
      {sent && <button type="button" className="auth-text-button" disabled={busy} onClick={() => { setSent(false); setCode(""); setError(""); }}>{bs ? "Zatraži novi kod ili promijeni email" : "Request a new code or change email"}</button>}
    </form>
    <div className="auth-reassurance"><ShieldCheck size={19} /><div><strong>{bs ? "Vaša pitanja ostaju anonimna." : "Your questions stay anonymous."}</strong><p>{bs ? "Supabase Auth čuva email za prijavu. Email i račun nisu povezani s vašim pitanjima." : "Supabase Auth stores your email for sign-in. Your email and account are never attached to questions."}</p></div></div>
    <details className="auth-privacy-details"><summary>{bs ? "Kako potvrda štiti privatnost?" : "How does verification protect my privacy?"}</summary><p>{bs ? "Supabase Auth kreira račun i čuva vaš email i podatke prijave radi potvrde škole. Pružalac email usluge također obrađuje adresu. Škola se određuje prema potvrđenoj email domeni. Uz pitanja ne pohranjujemo identitet učenika ili njegov račun. Preglednik čuva kolačiće prijave; odjavite se na zajedničkim uređajima." : "Supabase Auth creates an account and stores your email and sign-in information to verify your school. The email provider also processes your address. Your school comes from your verified email domain. Question records contain no student identity or account ID. Your browser keeps authentication cookies; sign out on shared devices."}</p></details>
  </AuthFrame>;
}
