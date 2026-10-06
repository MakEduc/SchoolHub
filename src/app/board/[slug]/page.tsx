"use client";
import { useLanguage } from "@/components/language";
import { use } from "react";
import { CheckCheck, Pin } from "lucide-react";
import { BackLink, Empty, ErrorMessage, Loading, PageIntro, useResource } from "@/components/ui";
import { SCHOOL_TIMEZONE } from "@/lib/domain";
type PublicBoard = { title: string; slug: string; questions: { id: string; body: string; status: string; published_at: string; answer: string | null }[] };
export default function BoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { t, formatDate } = useLanguage();
  const { slug } = use(params); const { data, error, loading } = useResource<PublicBoard>(`board/${slug}`, 30000);
  return <div className="public-board"><BackLink href="/boards">{t("All class boards")}</BackLink><PageIntro eyebrow={t("THE PUBLIC CLASS BOARD")} title={data?.title || "Shared with the class."} description={t("Thoughtful questions, chosen by your teacher. A conversation for everyone.")} /><ErrorMessage message={error} />{loading ? <Loading /> : data?.questions.length ? <div className="question-list">{data.questions.map(q => <article className="question-card" key={q.id}><div className="question-meta"><span><Pin size={12} style={{ verticalAlign: "middle", marginRight: 5 }} /> {t("Shared by your teacher")}</span><span>{formatDate(new Date(q.published_at), { timeZone: SCHOOL_TIMEZONE, day: "numeric", month: "short" })}</span></div><p>{q.body}</p>{q.answer && <div className="answer-block"><strong>{t("Teacher’s answer")}</strong><p>{q.answer}</p></div>}{q.status === "answered" && <span className="tag answered"><CheckCheck size={12} /> {t("Answered")}</span>}</article>)}</div> : !error && <Empty icon={<Pin size={28} />} title={t("A conversation is on its way.")}>{t("Your teacher’s published questions will appear here.")}</Empty>}</div>;
}
