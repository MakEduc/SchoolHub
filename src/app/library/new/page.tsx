import { BackLink, PageIntro } from "@/components/ui";
import { StudyForm } from "@/components/study-form";
export default function NewSessionPage() { return <><BackLink href="/library">Back to the table</BackLink><PageIntro eyebrow="PULL UP A CHAIR" title="Start something together." description="Share what you’re studying. Find someone to study with." /><StudyForm /></>; }
