"use client";
import { useLanguage } from "@/components/language";
import { AlertCircle, ArrowLeft, ArrowUpRight, Check, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
export function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  const { t } = useLanguage();
  return <div className="page-intro"><div><span className="eyebrow">{t(eyebrow)}</span><h1>{t(title)}</h1><p>{t(description)}</p></div>{action}</div>;
}
export function ErrorMessage({ message }: { message: string | null }) {
  const { t } = useLanguage(); return message ? <div className="error-message" role="alert"><AlertCircle size={18} /><span>{t(message)}</span></div> : null; }
export function Loading({ label = "Getting things ready…" }: { label?: string }) {
  const { t } = useLanguage(); return <div className="loading-state" role="status"><LoaderCircle size={22} className="spin" /><p>{t(label)}</p></div>; }
export function Empty({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  const { t } = useLanguage(); return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{t(title)}</h3><p>{children}</p></div>; }
export function SubmitButton({ pending, disabled, children }: { pending: boolean; disabled?: boolean; children: React.ReactNode }) {
  const { t } = useLanguage(); return <button className="button primary" type="submit" disabled={pending || disabled}>{pending ? <LoaderCircle size={18} className="spin" /> : null}{pending ? t("One moment…") : children}</button>; }
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) { return <Link href={href} className="back-link"><ArrowLeft size={15} />{children}</Link>; }
export function Success({ title, children }: { title: string; children: React.ReactNode }) {
  const { t } = useLanguage(); return <div className="success-state"><div className="success-icon"><Check size={32} /></div><span className="eyebrow">{t("ALL SET")}</span><h2>{t(title)}</h2>{children}</div>; }
export function useResource<T>(path: string, interval?: number) {
  const [data, setData] = useState<T | null>(null), [error, setError] = useState<string | null>(null), [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try { const result = await api<T>(path); setData(result); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { setLoading(false); }
  }, [path]);
  useEffect(() => {
    let alive = true;
    const load = async () => { try { const result = await api<T>(path); if (alive) { setData(result); setError(null); } } catch (e) { if (alive) setError(e instanceof Error ? e.message : "Please try again."); } finally { if (alive) setLoading(false); } };
    void load();
    const timer = interval ? setInterval(() => { if (document.visibilityState === "visible") void load(); }, interval) : null;
    const onFocus = () => { void load(); }; window.addEventListener("focus", onFocus);
    return () => { alive = false; if (timer) clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [path, interval]);
  return { data, error, loading, refresh };
}
export function SmallLink({ href, children }: { href: string; children: React.ReactNode }) { return <Link className="small-link" href={href}>{children}<ArrowUpRight size={15} /></Link>; }
