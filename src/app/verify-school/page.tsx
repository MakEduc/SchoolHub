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
      if (!sent) { await api("school/request-code", { email: email.trim(), language }); setEmail(""); setSent(true); }
      else {
        await api("school/verify-code", { code });
        const next = new URLSearchParams(window.location.hash.slice(1)).get("next") || "/";
        const target = new URL(next, window.location.origin);
        window.location.assign(target.origin === window.location.origin && !target.pathname.startsWith("/verify-school") ? target.pathname + target.search + target.hash : "/");
      }
    } catch (err) { setError(bs ? "Potvrda nije uspjela. Provjerite školski email ili kod. Ako se problem nastavi, obratite se školi." : err instanceof Error ? err.message : "Verification failed. Please try again."); }
    finally { setBusy(false); }
  }
  return <AuthFrame role="student" step={sent ? 2 : 1} title={sent ? bs ? "Još samo vaš kod." : "Just one little code." : bs ? "Pronađite svoju školu." : "Find your school space."} description={sent ? bs ? "Poslali smo kod na vaš školski email. Unesite ga da pristupite svojoj školi." : "We sent a code to your school inbox. Enter it below to join your school’s space." : bs ? "Potvrdite školski email. Pitanja, termini učenja i vaša školska zajednica čekaju vas." : "Verify your school email to ask questions, find a study table, and connect with your school."}>
    {sent && <div className="auth-delivery" role="status"><span><Check size={16} /></span><div><strong>{bs ? "Kod je poslan" : "Verification code sent"}</strong><p>{bs ? "Vrijedi 10 minuta · Najviše pet pokušaja" : "Valid for 10 minutes · Up to five attempts"}</p></div></div>}
    <form className="auth-form" onSubmit={submit} aria-busy={busy}>
      <ErrorMessage message={error || null} />
      <label className="field"><span className="field-label">{sent ? bs ? "Šestocifreni kod" : "Six-digit code" : bs ? "Školski email" : "School email"}</span><div className={`auth-input-wrap ${sent ? "auth-code-wrap" : ""}`}><Mail size={19} aria-hidden="true" />{sent ? <input className="input auth-code" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value)} disabled={busy} placeholder="000000" aria-describedby="auth-field-help" /> : <input className="input" required type="email" autoComplete="off" placeholder="you@2gimnazija.edu.ba" value={email} onChange={e => setEmail(e.target.value)} disabled={busy} aria-describedby="auth-field-help" />}</div><span className="auth-field-help" id="auth-field-help">{sent ? bs ? "Ne vidite poruku? Provjerite i neželjenu poštu." : "Nothing in your inbox? Check your spam folder, too." : bs ? "Koristite službeni email svoje škole." : "Use the official email address provided by your school."}</span></label>
      <SubmitButton pending={busy}>{sent ? bs ? "Uđi u školski prostor" : "Enter your school space" : bs ? "Pošalji mi kod" : "Send me a code"}<ArrowRight size={17} /></SubmitButton>
      {sent && <button type="button" className="auth-text-button" disabled={busy} onClick={() => { setSent(false); setCode(""); setError(""); }}>{bs ? "Zatraži novi kod ili promijeni email" : "Request a new code or change email"}</button>}
    </form>
    <div className="auth-reassurance"><ShieldCheck size={19} /><div><strong>{bs ? "Vaša pitanja ostaju anonimna." : "Your questions stay anonymous."}</strong><p>{bs ? "SchoolHub ne pohranjuje vaš email niti ga povezuje s objavama. Račun nije potreban." : "SchoolHub never stores your email or links it to posts. No student account needed."}</p></div></div>
    <details className="auth-privacy-details"><summary>{bs ? "Kako potvrda štiti privatnost?" : "How does verification protect my privacy?"}</summary><p>{bs ? "Email služi samo za dostavu koda. Pružalac email usluge obrađuje adresu i može zadržati zapise dostave. Nakon potvrde čuvamo anonimni školski token, koji vrijedi sedam dana u ovom pregledniku. Nastavnički računi zasebno pohranjuju službeni email." : "Your address is used only to deliver the code. The email provider processes it and may retain delivery logs. After verification, an anonymous school token keeps you connected for seven days in this browser. Separate teacher accounts store their work email."}</p></details>
  </AuthFrame>;
}
