"use client";
import { useLanguage } from "@/components/language";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useLanguage(); return <div className="error-page"><span className="eyebrow">{t("A SMALL PAUSE")}</span><h1>{t("Let’s give that another try.")}</h1><p>{t("We couldn’t open this page. Please try again in a moment.")}</p><button className="button primary" onClick={reset}>{t("Try again")}</button></div>; }
