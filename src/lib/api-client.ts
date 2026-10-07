export class ApiClientError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function api<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new ApiClientError(data.error || "Something went wrong. Please try again.", response.status);
  return data as T;
}
