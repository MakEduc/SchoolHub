"use client";
import { use, useState } from "react";
import Link from "next/link";
import { Copy, Pin, Check, ArrowUpRight } from "lucide-react";
import { api } from "@/lib/api-client";
import { BackLink, Empty, ErrorMessage, Loading, PageIntro, SubmitButton, useResource } from "@/components/ui";

type Board = { id: string; title: string; slug: string; questions: { id: string; body: string; status: string }[] };
export default function EditBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, refresh } = useResource<Board>(`teacher/boards/${id}`);
  const [title, setTitle] = useState<string | null>(null), [pending, setPending] = useState(false), [removing, setRemoving] = useState<string | null>(null);
  const [actionError, setError] = useState<string | null>(null), [notice, setNotice] = useState(""), [copied, setCopied] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setPending(true); setError(null); setNotice("");
    try { await api("boards/manage", { id, action: "update", title: title ?? data?.title }); await refresh(); setNotice("Board title saved. Your student link stays the same."); }
    catch (error) { setError((error as Error).message); } finally { setPending(false); }
  }
  async function remove(questionId: string) {
    setRemoving(questionId); setError(null); setNotice("");
    try { await api("boards/manage", { id, action: "unpin", questionId }); await refresh(); setNotice("Question removed from this board. It remains in your inbox."); }
    catch (error) { setError((error as Error).message); } finally { setRemoving(null); }
  }
  if (loading) return <Loading label="Opening your class board…" />;
  return <><BackLink href="/teacher">Teacher workspace</BackLink><PageIntro eyebrow="EDIT YOUR CLASS BOARD" title={data?.title || "Your class board."} description="Rename your board, share its student link, and manage the questions you have pinned." /><ErrorMessage message={error || actionError} />
    {data && <><section className="teacher-panel"><form onSubmit={save}><label className="field"><span className="field-label">Board title</span><input className="input" value={title ?? data.title} onChange={event => setTitle(event.target.value)} minLength={3} maxLength={80} required /></label><SubmitButton pending={pending}>Save board title</SubmitButton></form>
      <p className="field-help" style={{ marginTop: 20 }}>Students can find this board under Class boards or open its link directly.</p><div className="success-actions"><Link className="button secondary small" href={`/board/${data.slug}`} target="_blank" rel="noreferrer">View student board <ArrowUpRight size={14} /></Link><button className="button secondary small" onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/board/${data.slug}`); setCopied(true); } catch { setError("Open the student board and copy its address from your browser."); } }}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Link copied" : "Copy student link"}</button><Link className="button ghost small" href="/teacher/questions">Pin questions from your inbox</Link></div></section>
      {notice && <p className="copy-notice" role="status" style={{ marginTop: 20 }}>{notice}</p>}
      <div className="section-heading" style={{ marginTop: 28 }}><h2>Pinned questions</h2><span className="tag">{data.questions.length}</span></div>
      {data.questions.length ? <div className="question-list">{data.questions.map(question => <article className="question-card" key={question.id}><p>{question.body}</p><div className="question-actions"><span className="tag">{question.status}</span><button className="button secondary small" disabled={removing !== null} onClick={() => remove(question.id)}>{removing === question.id ? "Removing…" : "Remove from board"}</button></div></article>)}</div> : <Empty icon={<Pin size={28} />} title="Choose what your class sees.">Open your inbox, select this board, and pin a question to publish it.</Empty>}
    </>}
  </>;
}
