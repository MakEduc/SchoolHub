"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, GraduationCap, LockKeyhole } from "lucide-react";
import { browserSupabase } from "@/lib/supabase/browser";
import { ErrorMessage, SubmitButton } from "@/components/ui";
export default function LoginPage() {
  const router = useRouter(); const [email, setEmail] = useState(""), [code, setCode] = useState(""), [sent, setSent] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setPending(true); setError(null);
    try {
      if (!sent) {
        const result = await browserSupabase().auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback` } });
        if (result.error) throw new Error("We couldn’t send a sign-in link. Check your invited school email and try again.");
        setSent(true);
      } else {
        const result = await browserSupabase().auth.verifyOtp({ email, token: code, type: "email" });
        if (result.error) throw new Error("That code is invalid or has expired. Please try again.");
        router.push("/teacher"); router.refresh();
      }
    } catch (e) { setError((e as Error).message); } finally { setPending(false); }
  }
  return <div className="login-wrap"><div className="form-panel"><span className="tool-icon" style={{ background: "#edf2e6", color: "#7d9565" }}><GraduationCap size={24} /></span><h1>A little closer to your class.</h1><p>{sent ? `Check ${email} for a sign-in link. If your school uses email codes, enter the code below.` : "Sign in with your invited school email to open your inbox and classroom tools."}</p><ErrorMessage message={error} /><form onSubmit={submit}>{sent ? <label className="field"><span className="field-label">Email sign-in code</span><input className="input" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} pattern="[0-9]{6,8}" minLength={6} maxLength={8} required placeholder="Enter your email code" /></label> : <label className="field"><span className="field-label">School email</span><input className="input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@school.edu" /></label>}<SubmitButton pending={pending}>{sent ? "Open teacher workspace" : "Send sign-in link"}<ArrowRight size={16} /></SubmitButton>{sent && <button className="button ghost" type="button" style={{ marginTop: 12 }} onClick={() => { setSent(false); setCode(""); }}>Use a different email</button>}</form><span className="auth-help"><LockKeyhole size={13} /> Teacher accounts are invited by your school.</span></div></div>;
}
