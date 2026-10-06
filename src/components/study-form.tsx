"use client";
import { useLanguage } from "@/components/language";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Check, Copy, Library, Users } from "lucide-react";
import { api } from "@/lib/api-client";
import { GRADES, PROGRAMMES, SCHOOL_TIMEZONE, schoolDate, schoolDateTimeToIso, schoolTime, type Config, type Programme } from "@/lib/domain";
import { ErrorMessage, Loading, SubmitButton, Success, useResource } from "./ui";
type ManagedSession = { programme: Programme; grade: string; subject_id: string; focus: string; location_id: string; location?: { name: string }; custom_location: string | null; starts_at: string; ends_at: string; open_spots: number | null; host_name: string | null; contact: string | null; cancelled_at: string | null };
const timeOptions = Array.from({ length: 96 }, (_, index) => `${String(Math.floor(index / 4)).padStart(2, "0")}:${String((index % 4) * 15).padStart(2, "0")}`);
function optionsWithCurrent(current: string) { return timeOptions.includes(current) ? timeOptions : [...timeOptions, current].sort(); }
export function StudyForm({ manageId }: { manageId?: string }) {
  const { t } = useLanguage();
  const { data: config, error: configError, loading } = useResource<Config>("config");
  const [programme, setProgramme] = useState<Programme>("IB"), [grade, setGrade] = useState("Grade I"), [location, setLocation] = useState("");
  const [start, setStart] = useState(""), [end, setEnd] = useState("");
  const [open, setOpen] = useState("anyone"), [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; managementToken: string } | null>(null), [copied, setCopied] = useState(false), [saved, setSaved] = useState(false);
  const [managed, setManaged] = useState<ManagedSession | null>(null), [managementToken, setToken] = useState(""), [cancelled, setCancelled] = useState(false);
  const [manageLoading, setManageLoading] = useState(!!manageId);
  useEffect(() => {
    if (!manageId) return;
    const value = new URLSearchParams(window.location.hash.slice(1)).get("key") || "";
    api<ManagedSession>("studies/manage", { id: manageId, token: value, action: "read" }).then(result => {
      setManaged(result); setProgramme(result.programme); setGrade(result.grade); setLocation(result.custom_location || result.location?.name || "");
      setStart(schoolTime(result.starts_at)); setEnd(schoolTime(result.ends_at));
      setOpen(result.open_spots === null ? "anyone" : "limited"); setCancelled(!!result.cancelled_at); setToken(value);
    }).catch(e => setError(e.message)).finally(() => setManageLoading(false));
  }, [manageId]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null); setSaved(false);
    try {
      if (!location.trim()) throw new Error("Type where you’ll meet.");
      const f = new FormData(event.currentTarget); const date = f.get("date") as string;
      const data = { programme, grade, subjectId: f.get("subject"), focus: f.get("focus"), meetingPlace: location,
        startsAt: schoolDateTimeToIso(`${date}T${f.get("start")}`),
        endsAt: schoolDateTimeToIso(`${date}T${f.get("end")}`), openSpots: open === "anyone" ? null : Number(f.get("spots")),
        hostName: (f.get("host") as string) || null, contact: (f.get("contact") as string) || null, website: f.get("website") || "",
      };
      if (manageId) { await api("studies/manage", { id: manageId, token: managementToken, action: "update", data }); setSaved(true); }
      else setCreated(await api("studies", data));
    } catch (e) { setError((e as Error).message); } finally { setPending(false); }
  }
  const shareLink = created && typeof window !== "undefined" ? `${window.location.origin}/library/manage/${created.id}#key=${created.managementToken}` : "";
  if (manageLoading) return <Loading label={t("Opening your private management link…")} />;
  if (cancelled) return <Success title={t("Session cancelled.")}><p>{t("Your session has been removed from the board.")}</p><Link className="button secondary" href="/library">{t("Back to the table")}<ArrowRight size={15} /></Link></Success>;
  if (manageId && !managed) return <ErrorMessage message={error || "This private management link is unavailable."} />;
  if (created) return <Success title={t("There’s a new seat at the table.")}><p>{t("Your session is on the board. Keep your private management link to edit or cancel it later.")}</p><div className="share-link">{shareLink}</div><div className="success-actions"><button className="button secondary" onClick={async () => { try { await navigator.clipboard.writeText(shareLink); setCopied(true); } catch { setError("Copy the private link above manually."); } }}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? t("Link copied") : t("Copy private link")}</button><Link href="/library" className="button primary">{t("See your session")}<ArrowRight size={15} /></Link></div><ErrorMessage message={error} /><p className="field-help" style={{ marginTop: 20 }}>{t("Anyone with this private link can manage your session. Save it somewhere safe.")}</p></Success>;
  return <div className="form-layout"><section className="form-panel"><form onSubmit={submit}><h2>{manageId ? t("Your session, your details.") : t("Make room for a little teamwork.")}</h2><p className="field-help" style={{ marginBottom: 25 }}>{t("A few details help the right people find you.")}</p><ErrorMessage message={configError || error} />{saved && <div className="copy-notice" role="status">{t("Your session has been updated.")}</div>}
    <div className="field-row"><label className="field"><span className="field-label">{t("Grade")}</span><select className="input" value={grade} onChange={e => setGrade(e.target.value)}>{GRADES.map(g => <option key={g} value={g}>{t(g)}</option>)}</select></label><label className="field"><span className="field-label">{t("Programme")}</span><select className="input" value={programme} onChange={e => setProgramme(e.target.value as Programme)}>{PROGRAMMES.map(p => <option key={p} value={p}>{t(p)}</option>)}</select></label></div>
    <label className="field"><span className="field-label">{t("Subject")}</span><select className="input" name="subject" required defaultValue={managed?.subject_id || ""} disabled={loading}><option value="">{loading ? t("Loading subjects…") : t("Choose a subject")}</option>{config?.subjects.map(s => <option value={s.id} key={s.id}>{t(s.name)}</option>)}</select></label>
    <label className="field"><span className="field-label">{t("What are you working on?")}</span><input className="input" name="focus" placeholder={t("e.g. Kinematics & vectors, or Criterion A essay prep")} minLength={3} maxLength={80} required defaultValue={managed?.focus} /></label>
    <label className="field"><span className="field-label">{t("Meeting place")}</span><input className="input" name="meetingPlace" placeholder={t("e.g. Library, upstairs table or Room 102")} value={location} onChange={e => setLocation(e.target.value)} required maxLength={80} /></label>
    <label className="field"><span className="field-label">{t("Date")}</span><input className="input" type="date" name="date" defaultValue={managed ? schoolDate(new Date(managed.starts_at)) : schoolDate()} min={schoolDate()} required /></label>
    <div className="field-row"><label className="field"><span className="field-label">{t("Meeting starts at")}</span><select className="input" name="start" value={start} onChange={e => { const chosen = e.target.value; setStart(chosen); if (!end || end <= chosen) { const next = Math.min(95, Math.floor((Number(chosen.slice(0, 2)) * 60 + Number(chosen.slice(3)) + 60) / 15)); setEnd(timeOptions[next]); } }} required><option value="">{t("Choose an hour")}</option>{optionsWithCurrent(start).filter(time => time < "23:45").map(time => <option key={time} value={time}>{time}</option>)}</select></label><label className="field"><span className="field-label">{t("Meeting ends at")}</span><select className="input" name="end" value={end} onChange={e => setEnd(e.target.value)} required><option value="">{t("Choose an hour")}</option>{optionsWithCurrent(end).filter(time => !start || time > start).map(time => <option key={time} value={time}>{time}</option>)}</select></label></div><p className="field-help" style={{ marginTop: -12, marginBottom: 20 }}>{t("Choose a start and end hour in")}{SCHOOL_TIMEZONE}{t(". Times are available every 15 minutes.")}</p>
    <div className="field-row"><label className="field"><span className="field-label">{t("Open spots")}</span><select className="input" value={open} onChange={e => setOpen(e.target.value)}><option value="anyone">{t("Open to anyone")}</option><option value="limited">{t("A few seats available")}</option></select></label>{open === "limited" && <label className="field"><span className="field-label">{t("How many spots?")}</span><input className="input" name="spots" type="number" min={1} max={99} required defaultValue={managed?.open_spots || 2} /></label>}</div>
    <div className="field-row"><label className="field"><span className="field-label">{t("Your first name")}<small>{t("optional")}</small></span><input className="input" name="host" placeholder={t("What should people call you?")} maxLength={60} defaultValue={managed?.host_name || ""} /></label><label className="field"><span className="field-label">{t("Contact handle")}<small>{t("optional")}</small></span><input className="input" name="contact" placeholder={t("Instagram / WhatsApp handle")} maxLength={80} defaultValue={managed?.contact || ""} /><span className="field-help">{t("This will be visible on the public board.")}</span></label></div>
    <label className="honeypot" aria-hidden="true">{t("Leave this empty")}<input name="website" autoComplete="off" tabIndex={-1} /></label><div className="form-actions"><span className="privacy-note"><Users size={14} /> {t("Learning is better with company.")}</span><SubmitButton pending={pending} disabled={loading || !!configError}>{manageId ? t("Save changes") : t("Post your session")}<ArrowRight size={15} /></SubmitButton></div>
    {manageId && <div className="board-manage-controls"><button type="button" className="button danger small" disabled={pending} onClick={async () => { setPending(true); try { await api("studies/manage", { id: manageId, token: managementToken, action: "cancel" }); setCancelled(true); } catch (e) { setError((e as Error).message); } finally { setPending(false); } }}>{t("Cancel this session")}</button><Link href="/library" className="button ghost small">{t("Back to board")}</Link></div>}
  </form></section><aside className="info-panel"><Library size={27} strokeWidth={1.5} /><h3>{t("One table.")}<br />{t("Plenty of possibilities.")}</h3><p>{t("Revision partners, a tricky problem set, or just some company while you work. It all belongs here.")}</p><div className="info-steps"><div className="info-step"><span className="info-number"><BookOpen size={12} /></span><div><strong>{t("Be specific")}</strong><p>{t("A clear topic helps people know what to expect.")}</p></div></div><div className="info-step"><span className="info-number">✓</span><div><strong>{t("Make it easy to find you")}</strong><p>{t("Pick a shared school space and a realistic time.")}</p></div></div></div><div className="info-panel-foot">{t("Your session leaves the active board when its end time passes. Keep your private link if plans change.")}</div></aside></div>;
}
