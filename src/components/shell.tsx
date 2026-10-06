"use client";
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
  const pathname = usePathname(); const router = useRouter();
  const [roleDialog, setRoleDialog] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const isTeacher = pathname.startsWith("/teacher") || pathname.startsWith("/admin");
  const standalone = pathname.startsWith("/debate/join/");
  useEffect(() => {
    if (pathname === "/" && !localStorage.getItem("schoolhub-role")) {
      const timer = setTimeout(() => setRoleDialog(true), 500); return () => clearTimeout(timer);
    }
  }, [pathname]);
  useEffect(() => { if (roleDialog) dialog.current?.showModal(); else dialog.current?.close(); }, [roleDialog]);
  const choose = (role: string) => {
    localStorage.setItem("schoolhub-role", role); setRoleDialog(false);
    if (role === "teacher") router.push("/teacher");
  };
  const pageName = links.find(l => pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href)))?.label || (isTeacher ? "Teacher workspace" : "SchoolHub");
  if (standalone) return <div className="join-shell"><Link href="/" aria-label="SchoolHub home"><Brand /></Link><main id="main-content">{children}</main><p className="join-footer">A little more connected. A lot more together.</p></div>;
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand-link" aria-label="SchoolHub home"><Brand /></Link>
      <div className="workspace-label"><span className="tiny-dot" /> THE SCHOOL COMMONS</div>
      <p className="nav-caption">YOUR WORKSPACE</p>
      <nav aria-label="Main navigation">{links.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return <Link className={`nav-link ${active ? "active" : ""}`} key={href} href={href}><Icon size={19} strokeWidth={1.7} /><span>{label}</span>{active && <span className="nav-active-dot" />}</Link>;
      })}</nav>
      <div className="sidebar-note"><span className="note-spark"><Sparkles size={18} /></span><p>Good things happen<br />when we connect.</p><span className="note-line">Your school. Your space.</span><ArrowDownRight className="note-arrow" size={29} strokeWidth={1.3} /></div>
      <div className="sidebar-bottom">
        <Link className={`nav-link ${isTeacher ? "active" : ""}`} href="/teacher"><GraduationCap size={20} /><span>Teacher workspace</span><ArrowRight size={15} /></Link>
        {isTeacher && <button className="nav-link" onClick={async () => { await browserSupabase().auth.signOut(); router.push("/"); router.refresh(); }}><LogOut size={18} />Sign out</button>}
        <button className="role-switch" onClick={() => setRoleDialog(true)}><span className="role-avatar">{isTeacher ? "T" : "S"}</span><span><strong>{isTeacher ? "Teacher space" : "Student space"}</strong><small>Switch your perspective</small></span><Users size={16} /></button>
      </div>
    </aside>
    <div className="main-column">
      <header className="topbar"><div><span className="breadcrumb">School commons</span><span className="breadcrumb-slash">/</span><strong>{pageName}</strong></div><div className="topbar-right"><span className="header-date" suppressHydrationWarning>{new Intl.DateTimeFormat("en-GB", { timeZone: SCHOOL_TIMEZONE, weekday: "short", day: "numeric", month: "short" }).format(new Date())}</span><span className="header-divider" /><span className="school-badge"><span className="tiny-dot" /> Built for your school</span><button className="icon-button header-role-switch" onClick={() => setRoleDialog(true)} aria-label="Switch Student or Teacher"><Users size={17} /></button></div></header>
      <main id="main-content" className="main-content">{children}</main>
      <footer className="app-footer"><span>Small tools. A better school day.</span><span><ShieldCheck size={13} /> A space built on trust.</span></footer>
    </div>
    <dialog ref={dialog} className="role-dialog" onCancel={() => setRoleDialog(false)} onClick={e => { if (e.target === dialog.current) setRoleDialog(false); }}>
      <button className="dialog-close icon-button" onClick={() => setRoleDialog(false)} aria-label="Close role chooser"><X size={20} /></button>
      <div className="role-dialog-content"><span className="eyebrow">COME ON IN</span><h2>A space for everyone.</h2><p>Are you a student or a teacher?</p><div className="role-options"><button onClick={() => choose("student")}><span className="role-option-icon"><BookOpen size={29} /></span><strong>I’m a student</strong><span>Ask, connect, and learn together.</span><ArrowRight size={19} /></button><button onClick={() => choose("teacher")}><span className="role-option-icon teacher"><GraduationCap size={29} /></span><strong>I’m a teacher</strong><span>Listen, guide, and bring class together.</span><ArrowRight size={19} /></button></div><p className="role-disclaimer"><ShieldCheck size={14} /> Students can get started without an account.</p></div>
    </dialog>
  </div>;
}
