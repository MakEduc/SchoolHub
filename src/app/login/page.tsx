"use client";
import { AuthFrame } from "@/components/auth-frame";
import { useLanguage } from "@/components/language";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Mail, Check, LockKeyhole } from "lucide-react";
import { browserSupabase } from "@/lib/supabase/browser";
import { signInErrorMessage } from "@/lib/auth-errors";
import { ErrorMessage, SubmitButton } from "@/components/ui";
export default function LoginPage() {
  const { t, language } = useLanguage();
  const bs = language === "bs";
  const router = useRouter(); const [email, setEmail] = useState(""), [code, setCode] = useState(""), [sent, setSent] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setPending(true); setError(null);
    try {
      if (!sent) {
        const result = await browserSupabase().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback` } });
        if (result.error) throw new Error(signInErrorMessage(result.error));
        setSent(true);
      } else {
        const result = await browserSupabase().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
        if (result.error) throw new Error("That code is invalid or has expired. Please try again.");
        router.push("/teacher"); router.refresh();
      }
    } catch (e) { setError((e as Error).message); } finally { setPending(false); }
  }
  return <AuthFrame role="teacher" step={sent ? 2 : 1} title={sent ? bs ? "Provjerite svoj email." : "Check your inbox." : bs ? "Dobro došli nazad." : "Welcome back."} description={sent ? bs ? "Otvorite link za prijavu u poruci ili unesite email kod ispod." : "Open the sign-in link we emailed you, or enter your email code below." : bs ? "Vaša učionica, na jednom mjestu. Prijavite se školskim emailom na koji ste dobili poziv." : "Your classroom, a little closer. Sign in with the school email your administrator invited."}>
    {sent && <div className="auth-delivery" role="status"><span><Check size={16} /></span><div><strong>{bs ? "Link za prijavu je poslan" : "Sign-in link sent"}</strong><p>{email}</p></div></div>}
    <form onSubmit={submit} className="auth-form" aria-busy={pending}>
      <ErrorMessage message={error} />
      <label className="field"><span className="field-label">{sent ? t("Email sign-in code") : t("School email")}</span><div className={`auth-input-wrap ${sent ? "auth-code-wrap" : ""}`}><Mail size={19} aria-hidden="true" />{sent ? <input className="input auth-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} pattern="[0-9]{6,8}" minLength={6} maxLength={8} required disabled={pending} placeholder="000000" aria-describedby="auth-field-help" /> : <input className="input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={pending} placeholder="you@2gimnazija.edu.ba" aria-describedby="auth-field-help" />}</div><span className="auth-field-help" id="auth-field-help">{sent ? bs ? "Ne vidite poruku? Provjerite i neželjenu poštu." : "Nothing in your inbox? Check your spam folder, too." : bs ? "Koristite email na koji ste dobili poziv škole." : "Use the address your school invited. No password needed."}</span></label>
      <SubmitButton pending={pending}>{sent ? t("Open teacher workspace") : t("Send sign-in link")}<ArrowRight size={17} /></SubmitButton>
      {sent && <button className="auth-text-button" type="button" disabled={pending} onClick={() => { setSent(false); setCode(""); setError(null); }}>{t("Use a different email")}</button>}
    </form>
    <div className="auth-reassurance"><LockKeyhole size={18} /><div><strong>{bs ? "Samo za pozvane nastavnike" : "For invited teachers"}</strong><p>{bs ? "Još nemate pristup? Zatražite poziv od školskog administratora." : "Need access? Ask your school administrator for an invitation."}</p></div></div>
  </AuthFrame>;
}
