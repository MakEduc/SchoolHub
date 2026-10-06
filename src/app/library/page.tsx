"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, CalendarDays, Clock3, Library, MapPin, Plus, Users } from "lucide-react";
import { Empty, ErrorMessage, Loading, PageIntro, useResource } from "@/components/ui";
import { GRADES, PROGRAMMES, programmeClass, SCHOOL_TIMEZONE, schoolDate, schoolTime, type Config, type StudySession } from "@/lib/domain";
export default function LibraryPage() {
  const { data, loading, error, refresh } = useResource<StudySession[]>("studies", 30000);
  const { data: config } = useResource<Config>("config");
  const [programme, setProgramme] = useState("All"), [grade, setGrade] = useState(""), [subject, setSubject] = useState(""), [location, setLocation] = useState(""), [date, setDate] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const shown = (data || []).filter(s => new Date(s.ends_at).getTime() > now && (programme === "All" || s.programme === programme)
    && (!grade || s.grade === grade) && (!subject || s.subject.name === subject)
    && (!location || s.location.name === location) && (!date || schoolDate(new Date(s.starts_at)) === date));
  const grades = programme === "All" ? [...new Set(Object.values(GRADES).flat())] : GRADES[programme as keyof typeof GRADES];
  const today = schoolDate(new Date(now));
  const tomorrow = new Date(new Date(`${today}T12:00:00Z`).getTime() + 86400_000).toISOString().slice(0, 10);
  return <><PageIntro eyebrow="THE LIBRARY TABLE" title="Better when we learn together." description="Find a session, pull up a chair, and figure it out together." action={<Link href="/library/new" className="button primary"><Plus size={16} /> Start a session</Link>} />
    <div className="filters-panel"><div className="filter-top">{["All", ...PROGRAMMES].map(p => <button key={p} className={`filter-chip ${programme === p ? "selected" : ""}`} aria-pressed={programme === p} onClick={() => { setProgramme(p); setGrade(""); }}>{p === "National Curriculum" ? "National" : p}</button>)}<span>{shown.length} {shown.length === 1 ? "session" : "sessions"} on the board</span></div><div className="filter-bottom">
      <label><span>GRADE / YEAR</span><select className="input" value={grade} onChange={e => setGrade(e.target.value)}><option value="">Every year</option>{grades.map(g => <option key={g}>{g}</option>)}</select></label>
      <label><span>SUBJECT</span><select className="input" value={subject} onChange={e => setSubject(e.target.value)}><option value="">Every subject</option>{config?.subjects.map(s => <option key={s.id}>{s.name}</option>)}</select></label>
      <label><span>MEETING PLACE</span><select className="input" value={location} onChange={e => setLocation(e.target.value)}><option value="">Anywhere at school</option>{config?.locations.map(l => <option key={l.id}>{l.name}</option>)}</select></label>
      <label><span>DAY</span><select className="input" value={date} onChange={e => setDate(e.target.value)}><option value="">All upcoming</option><option value={today}>Today</option><option value={tomorrow}>Tomorrow</option>{[...new Set((data || []).map(s => schoolDate(new Date(s.starts_at))))].filter(d => d !== today && d !== tomorrow).map(d => <option key={d} value={d}>{d}</option>)}</select></label>
    </div></div>
    <ErrorMessage message={error} />{error && <button className="button secondary small" onClick={refresh}>Try again</button>}
    {loading ? <Loading label="Finding a seat at the table…" /> : !error && !shown.length ? <Empty icon={<Library size={29} />} title={data?.length ? "No sessions match just yet." : "The table is yours to start."}>{data?.length ? <><span>Try another filter, or start a session of your own.</span><br /><button className="button secondary" onClick={() => { setProgramme("All"); setGrade(""); setSubject(""); setLocation(""); setDate(""); }}>Clear filters</button></> : <><span>Choose a subject, a time, and a place. Someone else might be looking for exactly the same thing.</span><br /><Link href="/library/new" className="button primary">Start the first session <Plus size={15} /></Link></>}</Empty> : <div className="study-grid">{shown.map(s => <article className="study-card" key={s.id}><div className="study-card-head"><span className={`tag ${programmeClass(s.programme)}`}>{s.programme === "National Curriculum" ? "National" : s.programme} <span>·</span> {s.grade}</span>{new Date(s.starts_at).getTime() <= now && <span className="tag live"><span className="tiny-dot" /> Happening now</span>}</div><h3>{s.subject.name}</h3><p className="study-focus">{s.focus}</p><div className="study-details"><span className="study-detail"><MapPin size={14} /><strong>{s.custom_location || s.location.name}</strong></span><span className="study-detail"><CalendarDays size={14} />{schoolDate(new Date(s.starts_at)) === schoolDate() ? "Today" : new Intl.DateTimeFormat("en-GB", { timeZone: SCHOOL_TIMEZONE, day: "numeric", month: "short" }).format(new Date(s.starts_at))}</span><span className="study-detail"><Clock3 size={14} />{schoolTime(s.starts_at)}–{schoolTime(s.ends_at)}</span></div><div className="study-card-bottom"><span className="host-info"><span className="host-avatar">{(s.host_name || "S")[0].toUpperCase()}</span>{s.host_name || "A fellow student"}</span><span className="capacity"><Users size={12} />{s.open_spots === null ? "Everyone welcome" : `${s.open_spots} ${s.open_spots === 1 ? "spot" : "spots"} open`}</span></div>{s.contact && <p className="contact-line">Say hello: {s.contact}</p>}</article>)}</div>}
    <div className="board-caption"><span><BookOpen size={12} style={{ verticalAlign: "middle", marginRight: 5 }} /> Open spots are updated by the host. Just show up or get in touch.</span><span>Sessions leave the board when they end. Times: {SCHOOL_TIMEZONE}.</span></div>
  </>;
}
