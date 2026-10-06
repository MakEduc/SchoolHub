"use client";
import { useLanguage } from "@/components/language";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, CalendarDays, Clock3, Library, MapPin, Plus, Users } from "lucide-react";
import { Empty, ErrorMessage, Loading, PageIntro, useResource } from "@/components/ui";
import { GRADES, PROGRAMMES, programmeClass, SCHOOL_TIMEZONE, schoolDate, schoolTime, type Config, type StudySession } from "@/lib/domain";
export default function LibraryPage() {
  const { t, formatDate } = useLanguage();
  const { data, loading, error, refresh } = useResource<StudySession[]>("studies", 30000);
  const { data: config } = useResource<Config>("config");
  const [programme, setProgramme] = useState("All"), [grade, setGrade] = useState(""), [subject, setSubject] = useState(""), [location, setLocation] = useState(""), [date, setDate] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const shown = (data || []).filter(s => new Date(s.ends_at).getTime() > now && (programme === "All" || s.programme === programme)
    && (!grade || s.grade === grade) && (!subject || s.subject.name === subject)
    && (!location || (s.custom_location || s.location.name).toLowerCase().includes(location.trim().toLowerCase())) && (!date || schoolDate(new Date(s.starts_at)) === date));
  const grades = GRADES;
  return <><PageIntro eyebrow={t("THE LIBRARY TABLE")} title={t("Better when we learn together.")} description={t("Find a session, pull up a chair, and figure it out together.")} action={<Link href="/library/new" className="button primary"><Plus size={16} /> {t("Start a session")}</Link>} />
    <div className="filters-panel"><div className="filter-top">{["All", ...PROGRAMMES].map(p => <button key={p} className={`filter-chip ${programme === p ? "selected" : ""}`} aria-pressed={programme === p} onClick={() => setProgramme(p)}>{t(p)}</button>)}<span>{shown.length} {shown.length === 1 ? t("session") : t("sessions")} {t("on the board")}</span></div><div className="filter-bottom">
      <label><span>{t("GRADE")}</span><select className="input" value={grade} onChange={e => setGrade(e.target.value)}><option value="">{t("Every grade")}</option>{grades.map(g => <option key={g} value={g}>{t(g)}</option>)}</select></label>
      <label><span>{t("SUBJECT")}</span><select className="input" value={subject} onChange={e => setSubject(e.target.value)}><option value="">{t("Every subject")}</option>{config?.subjects.map(s => <option key={s.id} value={s.name}>{t(s.name)}</option>)}</select></label>
      <label><span>{t("MEETING PLACE")}</span><input className="input" value={location} onChange={e => setLocation(e.target.value)} placeholder={t("Search meeting places")} /></label>
      <label><span>{t("DATE")}</span><input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
    </div></div>
    <ErrorMessage message={error} />{error && <button className="button secondary small" onClick={refresh}>{t("Try again")}</button>}
    {loading ? <Loading label={t("Finding a seat at the table…")} /> : !error && !shown.length ? <Empty icon={<Library size={29} />} title={data?.length ? t("No sessions match just yet.") : t("The table is yours to start.")}>{data?.length ? <><span>{t("Try another filter, or start a session of your own.")}</span><br /><button className="button secondary" onClick={() => { setProgramme("All"); setGrade(""); setSubject(""); setLocation(""); setDate(""); }}>{t("Clear filters")}</button></> : <><span>{t("Choose a subject, a time, and a place. Someone else might be looking for exactly the same thing.")}</span><br /><Link href="/library/new" className="button primary">{t("Start the first session")}<Plus size={15} /></Link></>}</Empty> : <div className="study-grid">{shown.map(s => <article className="study-card" key={s.id}><div className="study-card-head"><span className={`tag ${programmeClass(s.programme)}`}>{t(s.programme)} <span>·</span> {t(s.grade)}</span>{new Date(s.starts_at).getTime() <= now && <span className="tag live"><span className="tiny-dot" /> {t("Happening now")}</span>}</div><h3>{t(s.subject.name)}</h3><p className="study-focus">{s.focus}</p><div className="study-details"><span className="study-detail"><MapPin size={14} /><strong>{s.custom_location || s.location.name}</strong></span><span className="study-detail"><CalendarDays size={14} />{schoolDate(new Date(s.starts_at)) === schoolDate() ? t("Today") : formatDate(new Date(s.starts_at), { timeZone: SCHOOL_TIMEZONE, day: "numeric", month: "short" })}</span><span className="study-detail"><Clock3 size={14} />{schoolTime(s.starts_at)}–{schoolTime(s.ends_at)}</span></div><div className="study-card-bottom"><span className="host-info"><span className="host-avatar">{(s.host_name || "S")[0].toUpperCase()}</span>{s.host_name || "A fellow student"}</span><span className="capacity"><Users size={12} />{s.open_spots === null ? t("Everyone welcome") : `${s.open_spots} ${s.open_spots === 1 ? t("spot") : t("spots")} open`}</span></div>{s.contact && <p className="contact-line">{t("Say hello:")}{s.contact}</p>}</article>)}</div>}
    <div className="board-caption"><span><BookOpen size={12} style={{ verticalAlign: "middle", marginRight: 5 }} /> {t("Open spots are updated by the host. Just show up or get in touch.")}</span><span>{t("Sessions leave the board when they end. Times:")}{SCHOOL_TIMEZONE}.</span></div>
  </>;
}
