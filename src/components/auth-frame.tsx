"use client";
import Link from "next/link";
import { ArrowUpRight, BookOpen, GraduationCap, MessageCircle, ShieldCheck } from "lucide-react";
import { LanguageSwitcher, useLanguage } from "./language";

export function AuthFrame({ role, title, description, children, step = 1 }: {
  role: "student" | "teacher"; title: string; description: string; children: React.ReactNode; step?: number;
}) {
  const { language } = useLanguage();
  const bs = language === "bs";
  return <div className="auth-page">
    <aside className="auth-welcome">
      <Link href="/" className="auth-brand" aria-label="SchoolHub"><BookOpen size={25} strokeWidth={1.6} /><span>school<span>hub</span><i>.</i></span></Link>
      <div className="auth-welcome-copy"><span className="auth-kicker">{bs ? "ŠKOLSKI PROSTOR" : "THE SCHOOL COMMONS"}</span><h2>{bs ? <>Vaša škola.<br /><em>Vaš prostor.</em></> : <>Your school.<br /><em>Your space.</em></>}</h2><p>{bs ? "Za pitanja koja vrijedi postaviti. Za ideje koje vrijedi podijeliti. Za bolji školski dan." : "For the questions worth asking. The ideas worth sharing. And a better school day, together."}</p></div>
      <div className="auth-notes" aria-hidden="true"><div className="auth-note auth-note-back"><span>01 / {bs ? "POVEŽI SE" : "CONNECT"}</span><BookOpen size={38} strokeWidth={1} /><div className="auth-note-lines"><i /><i /><i /></div></div><div className="auth-note auth-note-front"><MessageCircle size={21} strokeWidth={1.5} /><span>{bs ? "Svako pitanje ima svoje mjesto." : "Every question has a place."}</span><div className="auth-note-rule" /><small>{bs ? "Mali alati. Velike mogućnosti." : "Small tools. More possibilities."}</small><ArrowUpRight size={22} /></div></div>
      <div className="auth-welcome-foot"><span className="tiny-dot" />{bs ? "Malo povezaniji. Mnogo više zajedno." : "A little more connected. A lot more together."}</div>
    </aside>
    <div className="auth-content">
      <header className="auth-top"><Link href="/" className="auth-mobile-brand">schoolhub.</Link><span className="auth-top-caption">{bs ? "DOBRO DOŠLI" : "WELCOME TO YOUR COMMONS"}</span><LanguageSwitcher /></header>
      <main id="main-content" className="auth-main">
        <nav className="auth-role-tabs" aria-label={bs ? "Odaberite ulogu" : "Choose your role"}><Link href="/verify-school" aria-current={role === "student" ? "page" : undefined}><BookOpen size={17} />{bs ? "Učenik" : "Student"}</Link><Link href="/login" aria-current={role === "teacher" ? "page" : undefined}><GraduationCap size={19} />{bs ? "Nastavnik" : "Teacher"}</Link></nav>
        <div className="auth-step"><span>{bs ? "KORAK" : "STEP"} {String(step).padStart(2, "0")} / 02</span><div aria-hidden="true"><i className="active" /><i className={step === 2 ? "active" : ""} /></div></div>
        <h1>{title}</h1><p className="auth-description">{description}</p>
        {children}
        <div className="auth-school-note"><ShieldCheck size={17} strokeWidth={1.6} /><span>{bs ? "Sadržaj vaše škole ostaje u vašoj školi." : "What belongs to your school stays in your school."}</span></div>
      </main>
      <footer className="auth-footer"><span>SchoolHub © {new Date().getFullYear()}</span><div><Link href="/terms">{bs ? "Uslovi korištenja" : "Terms"}</Link><Link href="/privacy">{bs ? "Privatnost" : "Privacy"}</Link></div></footer>
    </div>
  </div>;
}
