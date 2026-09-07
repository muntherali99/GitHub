import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DomainError } from "./engine.mjs";
import { emptyState, demoState } from "./demo.mjs";
export const COLLECTIONS = [
  "seasons",
  "rules",
  "participants",
  "meetings",
  "drafts",
  "published",
  "roles",
];
const clone = (x) => structuredClone(x);
function differences(before, after) {
  return COLLECTIONS.flatMap((key) => {
    const old = new Map(before[key].map((x) => [x.id, x]));
    return after[key]
      .filter((x) => JSON.stringify(x) !== JSON.stringify(old.get(x.id)))
      .map((x) => ({
        collection: key,
        id: x.id,
        before: old.get(x.id) || null,
        after: x,
      }));
  });
}
export class FileStore {
  constructor(directory) {
    this.directory = directory;
    this.file = path.join(directory, "state.json");
    this.queue = Promise.resolve();
  }
  async init() {
    await fs.mkdir(this.directory, { recursive: true });
    try {
      await fs.access(this.file);
    } catch {
      await fs.writeFile(
        this.file,
        JSON.stringify({ ...demoState(), audit: [] }),
      );
    }
  }
  async load() {
    return JSON.parse(await fs.readFile(this.file, "utf8"));
  }
  async loadForPublic() {
    return this.load();
  }
  async audit() {
    return (await this.load()).audit.slice(-80).reverse();
  }
  async mutate(expected, actor, action, fn) {
    const run = this.queue.then(async () => {
      const before = await this.load();
      if (before.revision !== expected)
        throw new DomainError(
          "تغيرت البيانات لدى مشرف آخر. حدّث الصفحة ثم راجع التعديل.",
          409,
        );
      const next = clone(before);
      await fn(next);
      const changes = differences(before, next);
      if (!changes.length) return next;
      next.revision = before.revision + 1;
      next.audit.push({
        id: randomUUID(),
        at: new Date().toISOString(),
        actor: actor.email,
        action,
        revision: next.revision,
        changes,
      });
      const temp = this.file + ".tmp";
      await fs.writeFile(temp, JSON.stringify(next));
      await fs.rename(temp, this.file);
      return next;
    });
    this.queue = run.catch(() => {});
    return run;
  }
}
export class FirebaseStore {
  constructor(db) {
    this.db = db;
    this.root = db.collection("labeeb").doc("main");
    this.publicCache = null;
    this.publicCheckedAt = 0;
    this.publicRefresh = null;
  }
  col(key) {
    return this.root.collection(key);
  }
  async read(transaction) {
    const get = (ref) => (transaction ? transaction.get(ref) : ref.get());
    const [meta, ...docs] = await Promise.all([
      get(this.root),
      ...COLLECTIONS.map((k) => get(this.col(k))),
    ]);
    const s = { revision: meta.data()?.revision ?? 0 };
    COLLECTIONS.forEach((k, i) => {
      s[k] = docs[i].docs.map((d) => d.data());
    });
    for (const key of ["seasons", "rules"])
      s[key].sort(
        (a, b) =>
          (a.createdAt || "").localeCompare(b.createdAt || "") ||
          a.id.localeCompare(b.id),
      );
    return s;
  }
  async init() {
    await this.db.runTransaction(async (t) => {
      const meta = await t.get(this.root);
      if (!meta.exists) {
        const state = emptyState();
        t.set(this.root, { revision: 0 });
        for (const key of COLLECTIONS)
          for (const doc of state[key]) t.set(this.col(key).doc(doc.id), doc);
      }
    });
  }
  async load() {
    return this.db.runTransaction((t) => this.read(t), { readOnly: true });
  }
  // تُحفظ النسخة هنا في ذاكرة الخادم فقط. الاستجابة العامة تمر دائمًا بالإسقاط المنقح.
  // فحص مستند الإصدار يحد من إعادة قراءة جميع السجلات مع كل زيارة.
  async loadForPublic() {
    if (this.publicCache && Date.now() - this.publicCheckedAt < 8000)
      return this.publicCache;
    if (this.publicRefresh) return this.publicRefresh;
    this.publicRefresh = (async () => {
      const revision = (await this.root.get()).data()?.revision;
      if (!this.publicCache || this.publicCache.revision !== revision)
        this.publicCache = await this.load();
      this.publicCheckedAt = Date.now();
      return this.publicCache;
    })();
    try {
      return await this.publicRefresh;
    } finally {
      this.publicRefresh = null;
    }
  }
  async audit() {
    return (
      await this.col("audit").orderBy("at", "desc").limit(80).get()
    ).docs.map((d) => d.data());
  }
  async mutate(expected, actor, action, fn) {
    return this.db.runTransaction(async (t) => {
      const before = await this.read(t);
      if (before.revision !== expected)
        throw new DomainError(
          "تغيرت البيانات لدى مشرف آخر. حدّث الصفحة ثم راجع التعديل.",
          409,
        );
      const next = clone(before);
      await fn(next);
      const changes = differences(before, next);
      if (!changes.length) return next;
      if (changes.length > 400)
        throw new DomainError("قسّم هذه العملية إلى دفعات أصغر من 400 سجل.");
      if (Buffer.byteLength(JSON.stringify(changes), "utf8") > 900000)
        throw new DomainError(
          "حجم سجل التعديل كبير. قلل حجم دفعة الرصد أو طول الملاحظات.",
        );
      next.revision = before.revision + 1;
      for (const change of changes)
        t.set(this.col(change.collection).doc(change.id), change.after);
      t.set(this.root, { revision: next.revision });
      t.set(this.col("audit").doc(randomUUID()), {
        at: new Date().toISOString(),
        actor: actor.email,
        action,
        revision: next.revision,
        changes,
      });
      return next;
    });
  }
}
