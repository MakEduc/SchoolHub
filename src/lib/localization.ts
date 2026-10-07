const months: Record<string, string> = { Jan: "jan", Feb: "feb", Mar: "mar", Apr: "apr", May: "maj", Jun: "jun", Jul: "jul", Aug: "aug", Sep: "sep", Oct: "okt", Nov: "nov", Dec: "dec" };
const weekdays: Record<string, string> = { Mon: "pon", Tue: "uto", Wed: "sri", Thu: "čet", Fri: "pet", Sat: "sub", Sun: "ned" };
// Some browsers ship incomplete Bosnian Intl data. Translate explicit date parts
// while keeping timezone and daylight-saving calculations in Intl.
export function localizedDate(language: "en" | "bs", value: Date, options: Intl.DateTimeFormatOptions) {
  const formatter = new Intl.DateTimeFormat("en-GB", options);
  if (language === "en") return formatter.format(value);
  return formatter.formatToParts(value).map(part => part.type === "month" ? months[part.value] || part.value : part.type === "weekday" ? weekdays[part.value] || part.value : part.value).join("");
}
