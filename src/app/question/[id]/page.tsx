"use client";
import { useLanguage } from "@/components/language";
import { use, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { BackLink, ErrorMessage, Loading, PageIntro } from "@/components/ui";
type Receipt = { id: string; body: string; status: string; visibility: string; answer: string | null };
export default function QuestionReceipt({ params }: { params: Promise<{ id: string }> }) {
  const { t } = useLanguage();
  const { id } = use(params);
  const [question, setQuestion] = useState<Receipt | null>(null), [error, setError] = useState<string | null>(null), [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try { const token = new URLSearchParams(window.location.hash.slice(1)).get("key") || ""; setQuestion(await api<Receipt>("questions/read", { id, token })); setError(null); }
    catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { const first = setTimeout(() => { void refresh(); }, 0); const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 30000); return () => { clearTimeout(first); clearInterval(timer); }; }, [refresh]);
  return <><BackLink href="/ask">{t("Anonymous Q&A")}</BackLink><PageIntro eyebrow={t("YOUR PRIVATE RECEIPT")} title={t("Your question, and its answer.")} description={t("Keep this link private. It requires verified access to your school.")} /><ErrorMessage message={error} />{loading ? <Loading /> : question && <article className="question-card"><span className="tag">{question.visibility === "public" ? t("Public question") : t("Private question")}</span><p>{question.body}</p>{question.answer ? <div className="answer-block"><strong>{t("Teacher’s answer")}</strong><p>{question.answer}</p></div> : <p className="field-help">{question.status === "archived" ? t("This question has been archived.") : t("Your teacher has not answered yet. Check this receipt again later.")}</p>}</article>}<button className="button secondary small" style={{ marginTop: 20 }} onClick={refresh}>{t("Check for an answer")}</button></>;
}
