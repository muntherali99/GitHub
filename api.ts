import type { AppConfig } from "./types";
let tokenReader: () => Promise<string | null> = async () => null;
let authClient: import("firebase/auth").Auth | null = null;
export async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await tokenReader();
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error("تعذر الاتصال. تحقق من الإنترنت ثم حاول مجددًا.");
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "تعذر إتمام العملية.");
  return data;
}
export async function configureAuth(
  config: AppConfig,
  onChange: (email: string | null) => void,
) {
  if (config.demo) {
    tokenReader = async () =>
      sessionStorage.getItem("labeeb-demo-login") === "1" ? "demo-admin" : null;
    onChange(
      sessionStorage.getItem("labeeb-demo-login") === "1"
        ? "demo@example.invalid"
        : null,
    );
    return () => {};
  }
  if (!config.configured || !config.firebase) return () => {};
  const [{ initializeApp, getApps }, { getAuth, onAuthStateChanged }] =
    await Promise.all([import("firebase/app"), import("firebase/auth")]);
  const app = getApps()[0] || initializeApp(config.firebase);
  authClient = getAuth(app);
  tokenReader = async () =>
    authClient?.currentUser ? authClient.currentUser.getIdToken() : null;
  return onAuthStateChanged(authClient, (u) => onChange(u?.email || null));
}
export async function signIn(config: AppConfig) {
  if (config.demo) {
    sessionStorage.setItem("labeeb-demo-login", "1");
    location.reload();
    return;
  }
  if (!authClient) throw new Error("أكمل إعداد Firebase أولًا.");
  const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
  try {
    await signInWithPopup(authClient, new GoogleAuthProvider());
  } catch {
    throw new Error(
      "تعذر تسجيل الدخول. افتح الموقع في نافذة مستقلة وتحقق من إعداد Google Sign-in والنطاق المصرح به.",
    );
  }
}
export async function signOut(config: AppConfig) {
  if (config.demo) {
    sessionStorage.removeItem("labeeb-demo-login");
    location.reload();
    return;
  }
  if (authClient) {
    const { signOut } = await import("firebase/auth");
    await signOut(authClient);
  }
}
export function download(
  name: string,
  content: Blob | string,
  mime = "text/plain;charset=utf-8",
) {
  const blob =
    typeof content === "string" ? new Blob([content], { type: mime }) : content;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export function csvExport(rows: string[][]) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map(
            (value) =>
              '"' +
              (/^[=+\-@]/.test(value) ? "'" + value : value).replaceAll(
                '"',
                '""',
              ) +
              '"',
          )
          .join(","),
      )
      .join("\r\n")
  );
}
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') {
      if (quoted && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("ملف CSV يحتوي على اقتباس غير مكتمل.");
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
