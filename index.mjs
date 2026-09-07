import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { FileStore, FirebaseStore } from "./store.mjs";
import { emptyState } from "./demo.mjs";
import { scopedState, applyAction } from "./service.mjs";
import { publicProjection, DomainError } from "./engine.mjs";
const root = path.dirname(fileURLToPath(import.meta.url));
const demo = process.argv.includes("--demo"),
  production =
    process.argv.includes("--production") ||
    process.env.NODE_ENV === "production";
if (demo && production)
  throw new Error("النسخة التجريبية لا تعمل في وضع الإنتاج.");
let config = {};
try {
  config = JSON.parse(process.env.FIREBASE_WEB_CONFIG || "{}");
} catch {
  throw new Error("راجع JSON في FIREBASE_WEB_CONFIG.");
}
const configured = !!(config.apiKey && config.projectId && config.authDomain),
  owner = (process.env.OWNER_EMAIL || "").trim().toLowerCase();
let store = null,
  auth = null;
if (demo) {
  store = new FileStore(process.env.DEMO_DATA_DIR || path.join(root, ".demo"));
  await store.init();
} else if (configured) {
  const credential = process.env.FIREBASE_SERVICE_ACCOUNT
    ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
    : applicationDefault();
  initializeApp({ credential, projectId: config.projectId });
  store = new FirebaseStore(getFirestore());
  auth = getAuth();
  await store.init();
}
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "X-Robots-Tag": "noindex, nofollow",
  });
  if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
  next();
});
async function actor(req) {
  if (demo && req.headers.authorization === "Bearer demo-admin")
    return {
      email: "demo@example.invalid",
      role: "manager",
      groups: ["cubs", "leaders"],
    };
  if (demo) throw new DomainError("سجل الدخول إلى الإدارة التجريبية.", 401);
  if (!auth)
    throw new DomainError(
      "يحتاج الموقع إلى إعداد Firebase قبل دخول المشرفين.",
      503,
    );
  const bearer = req.headers.authorization || "";
  if (!bearer.startsWith("Bearer "))
    throw new DomainError("سجل الدخول بحساب المشرف.", 401);
  let token;
  try {
    token = await auth.verifyIdToken(bearer.slice(7), true);
  } catch {
    throw new DomainError(
      "انتهت الجلسة أو تعذر التحقق منها. سجل الدخول مجددًا.",
      401,
    );
  }
  if (!token.email_verified || !token.email)
    throw new DomainError("استخدم حسابًا ببريد إلكتروني موثق.", 403);
  const email = token.email.toLowerCase();
  if (owner && email === owner)
    return { email, role: "manager", groups: ["cubs", "leaders"] };
  const roles = (await store.load()).roles,
    role = roles.find((r) => r.email === email && r.role !== "disabled");
  if (!role)
    throw new DomainError(
      "هذا الحساب غير معتمد. اطلب إضافته من مدير البرنامج.",
      403,
    );
  return { email, role: role.role, groups: role.groups };
}
app.get("/api/config", (req, res) =>
  res.json({ demo, configured, firebase: configured ? config : null }),
);
app.get("/api/public", async (req, res) => {
  if (!store)
    return res.json({
      setupRequired: true,
      seasons: [],
      companies: [],
      meetings: [],
      rules: emptyState().rules[0],
    });
  const state = await store.loadForPublic();
  res.json(
    publicProjection(
      state,
      String(req.query.season || state.seasons.at(-1)?.id),
      String(req.query.group || "cubs"),
      req.query.meeting ? String(req.query.meeting) : undefined,
    ),
  );
});
app.get("/api/admin", async (req, res) => {
  const user = await actor(req);
  res.json(scopedState(await store.load(), user));
});
app.get("/api/admin/audit", async (req, res) => {
  const user = await actor(req);
  if (user.role !== "manager")
    throw new DomainError("هذه الصفحة للمدير فقط.", 403);
  res.json(await store.audit());
});
app.get("/api/admin/backup", async (req, res) => {
  const user = await actor(req);
  if (user.role !== "manager")
    throw new DomainError("النسخ الاحتياطي للمدير فقط.", 403);
  res.json({
    format: "labeeb-backup-v1",
    exportedAt: new Date().toISOString(),
    data: await store.load(),
  });
});
app.post("/api/admin/action", async (req, res) => {
  const user = await actor(req);
  if (!Number.isInteger(req.body.expectedRevision))
    throw new DomainError("إصدار الرصد غير صحيح.");
  const next = await store.mutate(
    req.body.expectedRevision,
    user,
    req.body.action,
    (s) => applyAction(s, user, req.body),
  );
  res.json(scopedState(next, user));
});
app.use("/api", (req, res) =>
  res.status(404).json({ error: "المسار غير موجود." }),
);
if (production) {
  app.use(express.static(path.join(root, "dist")));
  app.get("*all", (req, res) =>
    res.sendFile(path.join(root, "dist", "index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error("Request failed:", err.message);
  res.status(status).json({
    error:
      status >= 500
        ? "تعذر إتمام العملية. راجع الاتصال وإعداد الخادم."
        : err.message,
  });
});
const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () =>
  console.log("Labeeb ready on port " + port + (demo ? " (DEMO DATA)" : "")),
);
