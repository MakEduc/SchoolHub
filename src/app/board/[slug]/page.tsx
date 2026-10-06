"use client";
import { use } from "react";
import { CheckCheck, Pin } from "lucide-react";
import { BackLink, Empty, ErrorMessage, Loading, PageIntro, useResource } from "@/components/ui";
import { SCHOOL_TIMEZONE } from "@/lib/domain";
type PublicBoard = { title: string; slug: string; questions: { id: string; body: string; status: string; published_at: string }[] };
export default function BoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params); const { data, error, loading } = useResource<PublicBoard>(`board/${slug}`, 30000);
  return <div className="public-board"><BackLink href="/">Back to the commons</BackLink><PageIntro eyebrow="THE PUBLIC CLASS BOARD" title={data?.title || "Shared with the class."} description="Thoughtful questions, chosen by your teacher. A conversation for everyone." /><ErrorMessage message={error} />{loading ? <Loading /> : data?.questions.length ? <div className="question-list">{data.questions.map(q => <article className="question-card" key={q.id}><div className="question-meta"><span><Pin size={12} style={{ verticalAlign: "middle", marginRight: 5 }} /> Shared by your teacher</span><span>{new Intl.DateTimeFormat("en-GB", { timeZone: SCHOOL_TIMEZONE, day: "numeric", month: "short" }).format(new Date(q.published_at))}</span></div><p>{q.body}</p>{q.status === "answered" && <span className="tag answered"><CheckCheck size={12} /> Answered in class</span>}</article>)}</div> : !error && <Empty icon={<Pin size={28} />} title="A conversation is on its way.">Your teacher’s published questions will appear here.</Empty>}</div>;
}
