"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { bosnian } from "@/lib/bosnian";
import { localizedDate } from "@/lib/localization";
export type Language = "en" | "bs";
const LanguageContext = createContext<{ language: Language; setLanguage: (value: Language) => void }>({ language: "en", setLanguage: () => {} });
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  useEffect(() => { const timer = setTimeout(() => { try { if (localStorage.getItem("schoolhub-language") === "bs") setLanguageState("bs"); } catch { /* Preferences are optional. */ } }, 0); return () => clearTimeout(timer); }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  function setLanguage(value: Language) { setLanguageState(value); try { localStorage.setItem("schoolhub-language", value); } catch { /* Continue without persistent storage. */ } }
  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}
export function useLanguage() {
  const context = useContext(LanguageContext);
  return { ...context, formatDate: (value: Date, options: Intl.DateTimeFormatOptions) => localizedDate(context.language, value, options), t: (text: string) => context.language === "bs" ? bosnian[text] || text : text };
}
export function Text({ children }: { children: string }) { const { t } = useLanguage(); return t(children); }
export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  return <label className="language-switch"><span className="sr-only">Language / Jezik</span><select aria-label="Language / Jezik" value={language} onChange={e => setLanguage(e.target.value as Language)}><option value="en">English</option><option value="bs">Bosanski</option></select></label>;
}
