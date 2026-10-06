import { Text } from "@/components/language";
import { BackLink, PageIntro } from "@/components/ui";
import { StudyForm } from "@/components/study-form";
export default async function ManagePage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <><BackLink href="/library"><Text>Back to the table</Text></BackLink><PageIntro eyebrow="YOUR PRIVATE MANAGEMENT LINK" title="Plans can change." description="Keep your session up to date, or take it off the board." /><StudyForm manageId={id} /></>; }
