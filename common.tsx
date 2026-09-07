import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { Company } from "../types";
import { GROUPS } from "../../shared/rules.mjs";
import { download } from "../api";
export const number = (n: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(n);
export const signed = (n: number) => (n > 0 ? "+" : "") + number(n);
export const date = (s: string | null) =>
  s
    ? new Intl.DateTimeFormat("ar-SA", {
        calendar: "gregory",
        day: "numeric",
        month: "long",
        timeZone: "Asia/Riyadh",
      }).format(new Date(s))
    : "—";
export const groupLabel = (id: string) =>
  GROUPS.find((g) => g.id === id)?.label || id;
export function Notice({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={"notice " + (error ? "error" : "")}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
export function Trend({
  value,
  percent,
}: {
  value: number;
  percent?: number | null;
}) {
  return (
    <span
      className={
        "trend " + (value < 0 ? "negative" : value > 0 ? "positive" : "neutral")
      }
    >
      {value < 0 ? (
        <ArrowDownRight size={15} />
      ) : value > 0 ? (
        <ArrowUpRight size={15} />
      ) : null}
      <b dir="ltr">{signed(value)}</b>
      {percent !== undefined && (
        <span dir="ltr">{percent === null ? "—" : signed(percent) + "%"}</span>
      )}
    </span>
  );
}
export function Movement({ value }: { value: number | null }) {
  return (
    <span
      className={
        "movement " +
        (value && value > 0
          ? "positive"
          : value && value < 0
            ? "negative"
            : "neutral")
      }
    >
      {value === null ? (
        "جديد"
      ) : value === 0 ? (
        "ثابت"
      ) : value > 0 ? (
        <>
          <ArrowUpRight size={14} />
          {number(value)} مراكز
        </>
      ) : (
        <>
          <ArrowDownRight size={14} />
          {number(Math.abs(value))} مراكز
        </>
      )}
    </span>
  );
}
export function BalanceChart({ company }: { company: Company }) {
  const values = [100, ...company.history.map((h) => h.balance)],
    lo = Math.max(0, Math.min(...values) - 20),
    hi = Math.max(...values) + 30;
  const points = values
    .map(
      (v, i) =>
        `${22 + (i * 296) / Math.max(1, values.length - 1)},${122 - ((v - lo) / (hi - lo)) * 95}`,
    )
    .join(" ");
  return (
    <div className="chart">
      <svg
        viewBox="0 0 340 150"
        role="img"
        aria-label={"تطور الرصيد: " + values.join("، ")}
      >
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#b99b55" stopOpacity=".25" />
            <stop offset="1" stopColor="#b99b55" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[30, 70, 110].map((y) => (
          <line
            key={y}
            x1="20"
            x2="320"
            y1={y}
            y2={y}
            stroke="#e5e7ec"
            strokeDasharray="4 5"
          />
        ))}
        <polygon points={`22,132 ${points} 318,132`} fill="url(#chart-fill)" />
        <polyline
          points={points}
          fill="none"
          stroke="#b29349"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {values.map((v, i) => (
          <circle
            key={i}
            cx={22 + (i * 296) / Math.max(1, values.length - 1)}
            cy={122 - ((v - lo) / (hi - lo)) * 95}
            r="4"
            fill="#b29349"
          />
        ))}
        <text x="20" y="148" fill="#7b8494" fontSize="10">
          100
        </text>
        <text x="320" y="148" fill="#7b8494" textAnchor="end" fontSize="10">
          {number(company.balance)}
        </text>
      </svg>
      <div className="chart-labels">
        <span>رصيد البداية</span>
        <span>آخر لقاء معتمد</span>
      </div>
    </div>
  );
}
export async function achievement(c: Company, group: string) {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1500;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#111d34";
  ctx.fillRect(0, 0, 1080, 1500);
  ctx.strokeStyle = "#b79a58";
  ctx.lineWidth = 3;
  ctx.strokeRect(50, 50, 980, 1400);
  ctx.fillStyle = "#fff";
  ctx.fillRect(340, 100, 400, 140);
  const logo = new Image();
  logo.src = "/logo.svg";
  await new Promise<void>((resolve, reject) => {
    logo.onload = () => resolve();
    logo.onerror = () => reject(new Error("تعذر تحميل الشعار."));
  });
  ctx.drawImage(logo, 365, 114, 350, 114);
  ctx.textAlign = "center";
  ctx.direction = "rtl";
  ctx.fillStyle = "#d5bd80";
  ctx.font = "700 72px Cairo";
  ctx.fillText("بورصة لبيب", 540, 370);
  ctx.fillStyle = "#d7deeb";
  ctx.font = "400 36px Cairo";
  ctx.fillText("استثمر في نفسك… وارفع أسهمك", 540, 440);
  let size = 62;
  do {
    ctx.font = `700 ${size--}px Cairo`;
  } while (ctx.measureText(c.name).width > 880 && size > 28);
  ctx.fillStyle = "#fff";
  ctx.fillText(c.name, 540, 625);
  ctx.font = "700 170px Cairo";
  ctx.fillText(number(c.balance), 540, 865);
  ctx.font = "400 44px Cairo";
  ctx.fillStyle = "#d5bd80";
  ctx.fillText("سهم", 540, 945);
  ctx.font = "600 44px Cairo";
  ctx.fillStyle = "#fff";
  ctx.fillText(
    "المركز " + number(c.rank) + " · بورصة " + groupLabel(group),
    540,
    1090,
  );
  ctx.font = "400 34px Cairo";
  ctx.fillStyle = "#c7cfdd";
  ctx.fillText("نمو منذ البداية: " + number(c.growth) + "%", 540, 1175);
  ctx.fillText(date(c.history.at(-1)?.date || null), 540, 1320);
  canvas.toBlob((blob) => {
    if (blob) download("labeeb-" + c.id + ".png", blob);
  });
}

export function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <b>{number(value)}</b>
      <span>{label}</span>
    </div>
  );
}
