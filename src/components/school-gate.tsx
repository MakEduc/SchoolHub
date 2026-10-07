"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { LanguageSwitcher, useLanguage } from "./language";

// A full navigation clears school-scoped component caches when changing membership.
/* eslint-disable @next/next/no-location-assign-relative-destination */
export function SchoolGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { language } = useLanguage();
  const [access, setAccess] = useState<{ schoolName: string } | null>();
  const [error, setError] = useState("");
  const publicPage = ["/verify-school", "/login", "/terms", "/privacy", "/auth"].some(p => pathname === p || pathname.startsWith(`${p}/`));
  useEffect(() => {
    if (publicPage) return;
    let alive = true;
    api<{ schoolName: string } | null>("school/status").then(value => { if (alive) setAccess(value); }).catch(() => { if (alive) setError(language === "bs" ? "Pristup školi trenutno nije dostupan. Pokušajte ponovo." : "School access is currently unavailable. Please try again."); });
    return () => { alive = false; };
  }, [pathname, publicPage, language]);
  if (publicPage) return children;
  if (!access) return <main id="main-content" className="main-content"><LanguageSwitcher /><div className="panel"><h1>{language === "bs" ? "Vaša škola. Vaš prostor." : "Your school. Your space."}</h1>{error ? <p role="alert">{error}</p> : access === undefined ? <p role="status">{language === "bs" ? "Provjeravamo pristup…" : "Checking access…"}</p> : <><p>{language === "bs" ? "Potvrdite školski email da pristupite sadržajima samo svoje škole. Ne pohranjujemo email učenika." : "Verify your school email to access only your school’s content. We do not store student emails."}</p><Link className="button" href="/verify-school" onClick={e => { e.preventDefault(); window.location.assign(`/verify-school#next=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}`); }}>{language === "bs" ? "Potvrdite školu" : "Verify your school"}</Link><p><Link href="/login">{language === "bs" ? "Prijava nastavnika" : "Teacher sign-in"}</Link> · <Link href="/privacy">{language === "bs" ? "Politika privatnosti" : "Privacy policy"}</Link></p></>}</div></main>;
  return <><div className="school-access-bar"><span>{access.schoolName}</span><button className="button ghost small" onClick={async () => { await api("school/leave", {}); const { browserSupabase } = await import("@/lib/supabase/browser"); await browserSupabase().auth.signOut(); window.location.assign("/verify-school"); }}>{language === "bs" ? "Odjava škole" : "Leave school"}</button></div>{children}</>;
}
