"use client";
import { ToolGuide } from "./tool-guide";
import { LanguageSwitcher } from "./language";
import { useLanguage } from "@/components/language";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowRight, AudioLines, BookOpen, GraduationCap, Home, Library, LogOut, MessageCircle, MessagesSquare, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { browserSupabase } from "@/lib/supabase/browser";
import { SCHOOL_TIMEZONE } from "@/lib/domain";

const links = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/ask", label: "Anonymous Q&A", icon: MessageCircle },
  { href: "/boards", label: "Class boards", icon: BookOpen },
  { href: "/library", label: "Library Table", icon: Library },
  { href: "/debate", label: "Debate Room", icon: MessagesSquare },
  { href: "/noise", label: "Noise Monitor", icon: AudioLines },
];
export function Brand() { return <span className="brand"><span className="brand-icon"><BookOpen size={22} strokeWidth={1.7} /></span>school<span className="brand-light">hub</span><span className="brand-dot">.</span></span>; }
export function AppShell({ children }: { children: React.ReactNode }) {
  const { t, formatDate } = useLanguage();
  const pathname = usePathname(); const router = useRouter();
  const [roleDialog, setRoleDialog] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [armPreview, setArmPreview] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const isTeacher = pathname.startsWith("/teacher") || pathname.startsWith("/admin");
  const standalone = pathname.startsWith("/debate/join/");
  useEffect(() => {
    if (pathname === "/" && !localStorage.getItem("schoolhub-role")) {
      const timer = setTimeout(() => setRoleDialog(true), 500); return () => clearTimeout(timer);
    }
  }, [pathname]);
  useEffect(() => { if (roleDialog) dialog.current?.showModal(); else { dialog.current?.close(); } }, [roleDialog]);
  useEffect(() => { const timer = setTimeout(() => { setArmPreview(false); setConfirmLeave(false); }, 0); return () => clearTimeout(timer); }, [pathname, roleDialog]);
  const choose = (role: string) => {
    localStorage.setItem("schoolhub-role", role); setRoleDialog(false); setConfirmLeave(false); setArmPreview(false);
    router.push(role === "teacher" ? "/teacher" : "/");
  };
  const previewStudent = () => { localStorage.setItem("schoolhub-role", "student"); setArmPreview(false); router.push("/"); };
  const signOut = async () => { await browserSupabase().auth.signOut(); router.push("/"); router.refresh(); };
  const pageName = links.find(l => pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href)))?.label || (isTeacher ? "Teacher workspace" : "SchoolHub");
  if (pathname === "/login" || pathname === "/verify-school") return <>{children}<ToolGuide key={pathname} /></>;
  if (standalone) return <div className="join-shell"><Link href="/" aria-label={t("SchoolHub home")}><Brand /></Link><LanguageSwitcher /><main id="main-content">{children}</main><ToolGuide key={pathname} /><p className="join-footer">{t("A little more connected. A lot more together.")}</p><div className="legal-links join-legal"><Link href="/terms">{t("Terms of service")}</Link><Link href="/privacy">{t("Privacy policy")}</Link></div></div>;
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand-link" aria-label={t("SchoolHub home")}><Brand /></Link>
      <div className="workspace-label"><span className="tiny-dot" /> {t("THE SCHOOL COMMONS")}</div>
      <p className="nav-caption">{t("YOUR WORKSPACE")}</p>
      <nav aria-label={t("Main navigation")}>{links.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return <Link className={`nav-link ${active ? "active" : ""}`} key={href} href={href}><Icon size={19} strokeWidth={1.7} /><span>{t(label)}</span>{active && <span className="nav-active-dot" />}</Link>;
      })}</nav>
      <div className="sidebar-note"><span className="note-spark"><Sparkles size={18} /></span><p>{t("Good things happen")}<br />{t("when we connect.")}</p><span className="note-line">{t("Your school. Your space.")}</span><ArrowDownRight className="note-arrow" size={29} strokeWidth={1.3} /></div>
      <div className="sidebar-bottom">
        <Link className={`nav-link ${isTeacher ? "active" : ""}`} href="/teacher"><GraduationCap size={20} /><span>{t("Teacher workspace")}</span><ArrowRight size={15} /></Link>
        {isTeacher && <button className="nav-link" onClick={signOut}><LogOut size={18} /><span>{t("Sign out")}</span></button>}
        {isTeacher
          ? <button className="role-switch" onClick={() => { if (armPreview) previewStudent(); else setArmPreview(true); }} aria-live="polite" title={t("Preview the student view")}><span className="role-avatar">T</span><span><strong>{armPreview ? t("Tap again to confirm") : t("Teacher space")}</strong><small>{armPreview ? t("Leave for the student view?") : t("Preview the student view")}</small></span><Users size={16} /></button>
          : <button className="role-switch" onClick={() => setRoleDialog(true)}><span className="role-avatar">S</span><span><strong>{t("Student space")}</strong><small>{t("Switch your perspective")}</small></span><Users size={16} /></button>}
      </div>
    </aside>
    <div className="main-column">
      <header className="topbar"><div><span className="breadcrumb">{t("School commons")}</span><span className="breadcrumb-slash">/</span><strong>{t(pageName)}</strong></div><div className="topbar-right"><LanguageSwitcher /><span className="header-date" suppressHydrationWarning>{formatDate(new Date(), { timeZone: SCHOOL_TIMEZONE, weekday: "short", day: "numeric", month: "short" })}</span><span className="header-divider" /><span className="school-badge"><span className="tiny-dot" /> {t("Built for your school")}</span>{isTeacher ? <button className="topbar-signout" onClick={signOut}><LogOut size={15} /><span>{t("Sign out")}</span></button> : <button className="icon-button header-role-switch" onClick={() => setRoleDialog(true)} aria-label={t("Switch Student or Teacher")}><Users size={17} /></button>}</div></header>
      <main id="main-content" className="main-content">{children}</main>
      <ToolGuide key={pathname} /><footer className="app-footer"><span>{t("Small tools. A better school day.")}</span><span><ShieldCheck size={13} /> {t("A space built on trust.")}</span><span className="legal-links"><Link href="/terms">{t("Terms of service")}</Link><Link href="/privacy">{t("Privacy policy")}</Link></span></footer>
    </div>
    <dialog ref={dialog} className="role-dialog" onCancel={() => setRoleDialog(false)} onClick={e => { if (e.target === dialog.current) setRoleDialog(false); }}>
      <button className="dialog-close icon-button" onClick={() => setRoleDialog(false)} aria-label={t("Close role chooser")}><X size={20} /></button>
      <div className="role-dialog-content"><div className="guide-language"><LanguageSwitcher /></div><span className="eyebrow">{t("COME ON IN")}</span><h2>{t("A space for everyone.")}</h2><p>{t("Are you a student or a teacher?")}</p><div className="role-options"><button onClick={() => { if (isTeacher && !confirmLeave) setConfirmLeave(true); else choose("student"); }}><span className="role-option-icon"><BookOpen size={29} /></span><strong>{t("I’m a student")}</strong><span>{isTeacher ? t("Preview the student side.") : t("Ask, connect, and learn together.")}</span><ArrowRight size={19} /></button><button onClick={() => choose("teacher")}><span className="role-option-icon teacher"><GraduationCap size={29} /></span><strong>{t("I’m a teacher")}</strong><span>{t("Listen, guide, and bring class together.")}</span><ArrowRight size={19} /></button></div><p className="role-disclaimer"><ShieldCheck size={14} /> {t("Students can get started without an account.")}</p>{isTeacher && confirmLeave && <div className="inline-confirm" role="alert"><p>{t("You’re in the teacher workspace. Switch to the student view?")}</p><button className="button secondary small" onClick={() => choose("student")}>{t("Yes, show student view")}</button><button className="button ghost small" onClick={() => setConfirmLeave(false)}>{t("Stay here")}</button></div>}</div>
    </dialog>
  </div>;
}
