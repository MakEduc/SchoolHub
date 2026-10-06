import { DebateCreateForm } from "@/components/debate-tools";
import { BackLink, PageIntro } from "@/components/ui";
export default function NewDebate() { return <><BackLink href="/teacher">Teacher workspace</BackLink><PageIntro eyebrow="CLASSROOM CONVERSATIONS" title="Let’s open up the room." description="A prompt, a few perspectives, and a fair place for everyone." /><DebateCreateForm /></>; }
