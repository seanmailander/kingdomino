export async function getData<T = unknown>(
  url: string = "",
  _data: Record<string, unknown> = {},
): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    mode: "cors",
    cache: "no-cache",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    redirect: "follow",
    referrerPolicy: "no-referrer",
  });
  return response.json() as Promise<T>;
}

export async function postData<T = unknown>(
  url: string = "",
  data: Record<string, unknown> = {},
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    mode: "cors",
    cache: "no-cache",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    redirect: "follow",
    referrerPolicy: "no-referrer",
    body: JSON.stringify(data),
  });
  return response.json() as Promise<T>;
}
