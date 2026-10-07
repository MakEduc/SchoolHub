"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CircleHelp, X } from "lucide-react";
import { LanguageSwitcher, useLanguage } from "./language";
const guides: Record<string, { title: string; steps: string[] }> = {
  overview: { title: "Welcome to SchoolHub", steps: ["Students verify their school email without creating an account. Teachers sign in with an invited school email.", "Choose a tool from the menu. You can switch between English and Bosnian at any time."] },
  ask: { title: "A guide to anonymous questions", steps: ["Choose a teacher, department, or school life and write your question.", "Choose Private to keep it with authorized staff, or Public to share it anonymously with other students.", "Save your private receipt link after submitting. Open it later to read the teacher’s answer. Public questions and replies also appear below the form."] },
  boards: { title: "A guide to class boards", steps: ["Find your teacher’s board and open it to read pinned public questions and answers.", "Private questions can never be pinned. No student account is needed."] },
  library: { title: "A guide to Library Table", steps: ["Filter sessions by programme, grade, subject, place, or date.", "To host a session, choose your grade and IB or National programme, type the meeting place, and select a date and start/end hours.", "Save your private management link to edit or cancel your session. Sessions disappear from the active board when they end."] },
  debate: { title: "A guide to debates", steps: ["Your teacher creates the debate. Scan their QR code or enter the six-character room code.", "Enter a name your teacher recognizes. Wait for them to assign balanced stances.", "Your stance appears on your phone. Prepare with your group, then debate in person."] },
  noise: { title: "A guide to the noise monitor", steps: ["Press Start noise monitor and allow microphone access.", "Green means calm, yellow means rising volume, and red is a reminder to quiet down. Adjust sensitivity or calibrate a quiet room.", "Audio is processed only in this browser. Nothing is recorded or uploaded. Stop the monitor to release the microphone."] },
  teacher: { title: "A guide to your teacher workspace", steps: ["Your inbox includes questions sent to you and your assigned departments. Write and save answers directly on question cards.", "Public answers are shared with the school. Private answers are available through the student’s receipt link. Only public questions can be pinned to boards.", "Create debates, share the QR with your class, and assign stances when everyone has joined."] },
  admin: { title: "A guide to school settings", steps: ["Invite teachers using their school email, then assign department and school-life inbox access.", "Review flagged questions and keep the subject and department directory up to date."] },
  receipt: { title: "A guide to your receipt", steps: ["This private link lets you read the teacher’s answer without an account. Keep it somewhere safe.", "This link requires verified access to the same school. Keep it private. Use Check for an answer to refresh it."] },
  login: { title: "A guide to teacher sign-in", steps: ["Use the school email invited by your administrator. Open the emailed sign-in link or enter its code.", "Students verify their school email instead of creating an account."] },
  terms: { title: "About the terms of service", steps: ["Read the school-use rules here. For questions about the service, contact your school administration."] },
  privacy: { title: "About your privacy", steps: ["Read how questions, teacher accounts, study sessions, device permissions, and browser preferences are handled."] },
};
export function ToolGuide() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const key = pathname.startsWith("/teacher") ? "teacher" : pathname.startsWith("/board") ? "boards" : pathname.startsWith("/question/") ? "receipt" : pathname.split("/")[1] || "overview";
  const guide = guides[key];
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!guide) return;
    // Wait for the entry role chooser or another modal to close first.
    const timer = setInterval(() => {
      try {
        if (localStorage.getItem(`schoolhub-guide-${key}`)) { clearInterval(timer); return; }
        if (!document.querySelector("dialog[open]")) { setOpen(true); clearInterval(timer); }
      } catch { clearInterval(timer); /* The help button still works. */ }
    }, 1000);
    return () => { clearInterval(timer); };
  }, [key, guide]);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  function dismiss() { try { localStorage.setItem(`schoolhub-guide-${key}`, "seen"); } catch { /* Optional browser preference. */ } setOpen(false); }
  if (!guide) return null;
  return <><button type="button" className="guide-button" onClick={() => setOpen(true)} aria-label={t("Open this tool’s guide")}><CircleHelp size={18} /><span>{t("Guide")}</span></button><dialog ref={dialog} className="guide-dialog" aria-labelledby={`guide-title-${key}`} onCancel={e => { e.preventDefault(); dismiss(); }} onClick={e => { if (e.target === dialog.current) dismiss(); }}><button className="dialog-close icon-button" aria-label={t("Close")} onClick={dismiss}><X size={20} /></button><div className="guide-language"><LanguageSwitcher /></div><span className="eyebrow">{t("A LITTLE HELP TO GET STARTED")}</span><h2 id={`guide-title-${key}`}>{t(guide.title)}</h2><ol>{guide.steps.map(step => <li key={step}>{t(step)}</li>)}</ol><p className="field-help">{t("This guide appears once per tool in this browser. Open Guide anytime to read it again.")}</p><button className="button primary" onClick={dismiss}>{t("Got it")}</button></dialog></>;
}
