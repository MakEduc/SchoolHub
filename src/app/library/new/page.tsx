import { Text } from "@/components/language";
import { BackLink, PageIntro } from "@/components/ui";
import { StudyForm } from "@/components/study-form";
export default function NewSessionPage() { return <><BackLink href="/library"><Text>Back to the table</Text></BackLink><PageIntro eyebrow="PULL UP A CHAIR" title="Start something together." description="Share what you’re studying. Find someone to study with." /><StudyForm /></>; }
