"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/api-client";
import { AuthFrame } from "./auth-frame";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useLanguage } from "./language";

// A full navigation clears school-scoped component caches when changing membership.
/* eslint-disable @next/next/no-location-assign-relative-destination */
export function SchoolGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { language, t } = useLanguage();
  const [access, setAccess] = useState<{ schoolName: string } | null>();
  const [error, setError] = useState("");
  const publicPage = ["/verify-school", "/login", "/terms", "/privacy", "/auth"].some(p => pathname === p || pathname.startsWith(`${p}/`));
  useEffect(() => {
    if (publicPage) return;
    let alive = true;
    api<{ schoolName: string } | null>("school/status").then(value => { if (alive) { setAccess(value); setError(""); } }).catch(err => {
      if (alive) setError(err instanceof ApiClientError ? err.status === 404 ? "This deployment is missing the school verification API. Deploy the latest SchoolHub version." : err.message : "Could not reach SchoolHub. Check your connection and try again.");
    });
    return () => { alive = false; };
  }, [pathname, publicPage, language]);
  if (publicPage) return children;
  if (!access) return <AuthFrame role="student" title={language === "bs" ? "Dobro došli u svoju školu." : "Welcome to your school."} description={language === "bs" ? "Jedno mjesto za pitanja, zajedničko učenje i bolji školski dan. Prvo potvrdite svoju školu." : "A place for questions, shared study, and a better school day. First, let’s confirm your school."}>
    {error ? <div className="auth-entry-error"><p role="alert">{t(error)}</p><button className="button primary" onClick={() => window.location.reload()}>{language === "bs" ? "Pokušaj ponovo" : "Try again"}<ArrowRight size={17} /></button></div> : access === undefined ? <p className="auth-loading" role="status">{language === "bs" ? "Provjeravamo pristup…" : "Checking access…"}</p> : <>
      <Link className="button primary auth-entry-button" href="/verify-school" onClick={e => { e.preventDefault(); window.location.assign(`/verify-school#next=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}`); }}>{language === "bs" ? "Potvrdite školski email" : "Verify your school email"}<ArrowRight size={17} /></Link>
      <p className="auth-entry-caption">{language === "bs" ? "Prijava bez lozinke, putem školskog emaila." : "Password-free sign-in with your school email."}</p>
      <div className="auth-reassurance"><ShieldCheck size={19} /><div><strong>{language === "bs" ? "Pripada samo vašoj školi." : "Only your school. Only your community."}</strong><p>{language === "bs" ? "Objave su vidljive samo članovima iste škole. Supabase Auth čuva email za prijavu; pitanja ostaju anonimna." : "Posts are visible only to members of the same school. Supabase Auth stores your sign-in email; questions stay anonymous."}</p></div></div>
    </>}
  </AuthFrame>;
  return <><div className="school-access-bar"><span>{access.schoolName}</span><button className="button ghost small" onClick={async () => { await api("school/leave", {}); const { browserSupabase } = await import("@/lib/supabase/browser"); await browserSupabase().auth.signOut(); window.location.assign("/verify-school"); }}>{language === "bs" ? "Odjava škole" : "Leave school"}</button></div>{children}</>;
}
