import { createHmac } from "node:crypto";
export function schoolEmailDomain(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(normalized) || normalized.length > 254) return null;
  return normalized.split("@")[1];
}
export function verificationHash(challenge: string, code: string, secret: string) {
  return createHmac("sha256", secret).update(`school-verification:${challenge}:${code}`).digest("hex");
}
