"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Pin } from "lucide-react";
import { Empty, ErrorMessage, Loading, PageIntro, useResource } from "@/components/ui";

export default function BoardsPage() {
  const { data, error, loading } = useResource<{ id: string; title: string; slug: string }[]>("boards", 30000);
  const [search, setSearch] = useState("");
  const boards = (data || []).filter(board => board.title.toLowerCase().includes(search.trim().toLowerCase()));
  return <><PageIntro eyebrow="PUBLIC CLASS BOARDS" title="Shared with your class." description="Find your teacher’s board. Only questions your teacher chooses to pin appear here. No student login needed." />
    <label className="field"><span className="field-label">Find a class board</span><input className="input" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by class or board title" /></label>
    <ErrorMessage message={error} />
    {loading ? <Loading label="Finding your class boards…" /> : !error && (boards.length ? boards.map(board => <Link key={board.id} className="list-row" href={`/board/${board.slug}`}><Pin size={22} /><div><strong>{board.title}</strong><small>View questions shared by your teacher</small></div><ArrowUpRight size={18} /></Link>) : <Empty icon={<Pin size={28} />} title={search ? "No matching boards." : "Your class boards will appear here."}>{search ? "Try another class or board name." : "Your teacher can create a board and pin questions from their inbox."}</Empty>)}
  </>;
}
