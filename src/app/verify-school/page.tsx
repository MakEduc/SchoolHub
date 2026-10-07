"use client";
import { useState } from "react";
import Link from "next/link";
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
  return <div className="page-narrow"><span className="eyebrow">SchoolHub</span><h1>{bs ? "Potvrdite svoju školu." : "Verify your school."}</h1><p>{bs ? "Objave, pitanja i debate dostupni su samo potvrđenim učenicima i nastavnicima iste škole." : "Posts, questions, and debates are available only to verified students and teachers of the same school."}</p><form className="panel" onSubmit={submit}><label>{sent ? bs ? "Šestocifreni kod" : "Six-digit code" : bs ? "Školski email" : "School email"}{sent ? <input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value)} /> : <input required type="email" autoComplete="off" placeholder="a@2gimnazija.edu.ba" value={email} onChange={e => setEmail(e.target.value)} />}</label><p>{sent ? bs ? "Provjerite email i neželjenu poštu. Kod vrijedi 10 minuta, uz najviše pet pokušaja." : "Check your inbox and spam folder. The code expires in 10 minutes and allows five attempts." : bs ? "Email služi samo za slanje koda kojim potvrđujete školu. SchoolHub ga ne pohranjuje niti povezuje s objavama. Pružalac email usluge obrađuje adresu radi dostave i može zadržati zapise." : "Your email is used only to deliver a school verification code. SchoolHub does not store it or attach it to posts. The email provider processes the address for delivery and may retain logs."}</p>{error && <p role="alert" className="error-message">{error}</p>}<button className="button" disabled={busy}>{busy ? bs ? "Sačekajte…" : "Please wait…" : sent ? bs ? "Potvrdi školu" : "Verify school" : bs ? "Pošalji kod" : "Send code"}</button>{sent && <button type="button" className="button ghost" disabled={busy} onClick={() => { setSent(false); setCode(""); setError(""); }}>{bs ? "Zatraži novi kod" : "Request a new code"}</button>}</form><p>{bs ? "Pristup traje sedam dana na ovom pregledniku. Pitanja ostaju anonimna. Nastavnici koriste zasebne pozvane račune koji pohranjuju službeni email." : "Access lasts seven days in this browser. Questions remain anonymous. Teachers use separate invited accounts which store their work email."}</p><Link href="/login">{bs ? "Prijava nastavnika" : "Teacher sign-in"}</Link> · <Link href="/privacy">{bs ? "Politika privatnosti" : "Privacy policy"}</Link></div>;
}
