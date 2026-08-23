"use client";

import { useMemo, useState } from "react";
import { Copy, Play, RotateCcw, Upload } from "lucide-react";

const EMPTY = { ten: "", loai: "", khach: "", van_de: "", loi_ich: "", khac_biet: "", gia: "", cta: "" };
const FIELDS = [
  ["ten", "Tên sản phẩm"], ["loai", "Nó là cái gì"], ["khach", "Bán cho ai"],
  ["van_de", "Khách đang khổ vì gì"], ["loi_ich", "Khách được gì"],
  ["khac_biet", "Khác gì thứ ngoài kia"], ["gia", "Giá và ưu đãi"], ["cta", "Muốn khách làm gì"],
];

async function askClaude(prompt) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Máy chủ AI đang bận.");
  return String(data?.text || "").trim();
}

function parseJSON(text) {
  try {
    const c = String(text || "").replace(/```json|```/g, "").trim();
    const s = c.indexOf("{");
    const e = c.lastIndexOf("}");
    return JSON.parse(s >= 0 && e >= s ? c.slice(s, e + 1) : c);
  } catch { return null; }
}

export default function XuongCheKichBan() {
  const [kichBan, setKichBan] = useState("");
  const [sp, setSp] = useState(EMPTY);
  const [nenTang, setNenTang] = useState("TikTok / Reels");
  const [doDai, setDoDai] = useState("30–60 giây");
  const [bamGoc, setBamGoc] = useState("Cân bằng");
  const [dangChay, setDangChay] = useState(false);
  const [loi, setLoi] = useState("");
  const [steps, setSteps] = useState([]);
  const [banCuoi, setBanCuoi] = useState("");

  const thieu = !kichBan.trim() || !sp.ten.trim() || !sp.cta.trim();
  const moTaSanPham = () => FIELDS.map(([k, n]) => `${n}: ${sp[k] || "(chưa điền)"}`).join("\n");
  const beats = useMemo(() => parseJSON(steps[1]?.result)?.beats || parseJSON(steps[0]?.result)?.beats || [], [steps]);

  function setStep(index, patch) {
    setSteps((old) => {
      const next = [...old];
      next[index] = { ...(next[index] || {}), ...patch };
      return next;
    });
  }

  async function run() {
    setDangChay(true); setLoi(""); setBanCuoi(""); setSteps([]);
    try {
      setStep(0, { title: "Mổ kịch bản gốc", status: "running" });
      const raw1 = await askClaude(`Bạn mổ xẻ kịch bản video ngắn. Chỉ trả JSON thuần theo schema: {"ngon_ngu":"","cong_thuc":"","giong":"","nhip":"","hook":"","beats":[{"ten":"","chuc_nang":"","noi_dung":"","giay":3}],"chot":""}.\n\nKỊCH BẢN GỐC:\n${kichBan}`);
      const khung = parseJSON(raw1) || { raw: raw1 };
      setStep(0, { status: "done", result: raw1 });

      setStep(1, { title: "Ghép sản phẩm", status: "running" });
      const raw2 = await askClaude(`Đây là khung kịch bản đang viral:\n${JSON.stringify(khung)}\n\nSẢN PHẨM:\n${moTaSanPham()}\n\nMức bám gốc: ${bamGoc}. Giữ chức năng beat nhưng thay ruột bằng sản phẩm. Hook mới phải chạm nỗi đau, không quảng cáo lộ liễu. Không bịa giá, ưu đãi hoặc thông số chưa được cung cấp. Chỉ trả JSON thuần theo schema {"hook_moi":"","beats":[{"ten":"","chuc_nang":"","noi_dung_moi":"","giay":3}],"chot_moi":"","canh_bao":""}.`);
      const map = parseJSON(raw2) || { raw: raw2 };
      setStep(1, { status: "done", result: raw2 });

      setStep(2, { title: "Dựng bản mới", status: "running" });
      const raw3 = await askClaude(`Viết kịch bản video bán hàng hoàn chỉnh bằng tiếng Việt từ bản đồ beat sau:\n${JSON.stringify(map)}\n\nSản phẩm:\n${moTaSanPham()}\n\nNền tảng: ${nenTang}. Độ dài: ${doDai}. Mỗi beat mở bằng nhãn [TÊN BEAT · 0-3s], dưới là lời thoại. Không markdown, không emoji, không bịa dữ liệu.`);
      setStep(2, { status: "done", result: raw3 });

      setStep(3, { title: "Nấu giọng", status: "running" });
      const raw4 = await askClaude(`Đây là kịch bản vừa dựng:\n${raw3}\n\nNấu lại thành giọng người thật đang nói với máy quay. Tiếng Việt tự nhiên, ưu tiên giọng Bắc; cắt văn AI sáo rỗng; câu ngắn xen câu dài; giữ nhãn beat và độ dài; CTA phải đúng hành động này: ${sp.cta}. Chỉ trả kịch bản cuối.`);
      setStep(3, { status: "done", result: raw4 });
      setBanCuoi(raw4);
    } catch (e) {
      setLoi(e.message || "Có lỗi khi chạy AI.");
    } finally { setDangChay(false); }
  }

  function readFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) return setLoi("File quá lớn. Vui lòng dùng file dưới 2 MB.");
    const r = new FileReader();
    r.onload = () => setKichBan(String(r.result || ""));
    r.onerror = () => setLoi("Không đọc được file.");
    r.readAsText(f, "UTF-8");
  }

  const reset = () => { setKichBan(""); setSp(EMPTY); setSteps([]); setBanCuoi(""); setLoi(""); };

  return (
    <main style={{ minHeight: "100vh", background: "#14101F", color: "#EDE6DA", fontFamily: "Arial,sans-serif" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "42px 22px 80px" }}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: "#9089A3" }}>XƯỞNG CHẾ KỊCH BẢN</div>
        <h1 style={{ fontSize: "clamp(42px,7vw,72px)", lineHeight: .98, margin: "16px 0" }}>Kịch bản người ta,<br/><span style={{ color: "#FF6A2B" }}>sản phẩm của mình.</span></h1>
        <p style={{ color: "#B9B1C7", maxWidth: 620 }}>Đưa kịch bản viral vào, AI bóc cấu trúc và tái dựng theo sản phẩm của bạn qua 4 bước.</p>

        <div style={{ display: "flex", gap: 6, margin: "24px 0 34px", minHeight: 52 }}>
          {(beats.length ? beats : Array.from({ length: 5 }, (_, i) => ({ ten: `Beat ${i + 1}` }))).map((b, i) => <div key={i} style={{ flex: 1, minWidth: 0, border: "1px solid #2F2742", borderRadius: 6, padding: 8, color: beats.length ? "#5FD3D6" : "#6B6480", overflow: "hidden" }}>{String(i + 1).padStart(2,"0")}<br/><small>{b.ten}</small></div>)}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 }}>
          <section style={{ background: "#1C1629", border: "1px solid #2F2742", borderRadius: 10, padding: 18 }}>
            <h3 style={{ color: "#5FD3D6" }}>Nguồn · kịch bản gốc</h3>
            <textarea value={kichBan} maxLength={120000} onChange={(e)=>setKichBan(e.target.value)} placeholder="Dán transcript hoặc kịch bản viral..." style={{ width: "100%", height: 300, background: "#221A31", color: "#EDE6DA", border: "1px solid #2F2742", borderRadius: 7, padding: 12, boxSizing: "border-box" }}/>
            <label style={{ display: "inline-flex", gap: 8, alignItems: "center", marginTop: 10, cursor: "pointer" }}><Upload size={15}/> Tải TXT/SRT/VTT/MD<input type="file" accept=".txt,.srt,.vtt,.md" onChange={readFile} hidden/></label>
          </section>

          <section style={{ background: "#1C1629", border: "1px solid #2F2742", borderRadius: 10, padding: 18 }}>
            <h3 style={{ color: "#FF6A2B" }}>Đích · sản phẩm của bạn</h3>
            <div style={{ display: "grid", gap: 8 }}>{FIELDS.map(([k,n]) => <input key={k} value={sp[k]} onChange={(e)=>setSp({...sp,[k]:e.target.value})} placeholder={n} style={{ background: "#221A31", color: "#EDE6DA", border: "1px solid #2F2742", borderRadius: 7, padding: 11 }}/>)}</div>
          </section>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
          <select value={nenTang} onChange={(e)=>setNenTang(e.target.value)}>{["TikTok / Reels","YouTube Shorts","Video dài"].map(x=><option key={x}>{x}</option>)}</select>
          <select value={doDai} onChange={(e)=>setDoDai(e.target.value)}>{["15–30 giây","30–60 giây","60–90 giây"].map(x=><option key={x}>{x}</option>)}</select>
          <select value={bamGoc} onChange={(e)=>setBamGoc(e.target.value)}>{["Sát khung","Cân bằng","Thoáng"].map(x=><option key={x}>{x}</option>)}</select>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button disabled={dangChay || thieu} onClick={run} style={{ background: "#FF6A2B", border: 0, borderRadius: 8, padding: "13px 20px", fontWeight: 800, cursor: "pointer" }}><Play size={16} style={{ verticalAlign: "middle", marginRight: 7 }}/>{dangChay ? "Đang chạy…" : "Chạy 4 bước"}</button>
          <button onClick={reset} style={{ background: "transparent", color: "#EDE6DA", border: "1px solid #2F2742", borderRadius: 8, padding: "11px 16px" }}><RotateCcw size={15} style={{ verticalAlign: "middle", marginRight: 7 }}/>Làm mẻ mới</button>
        </div>

        {loi && <div style={{ marginTop: 18, color: "#FFB3C0" }}>{loi}</div>}
        <div style={{ marginTop: 36 }}>{steps.map((s,i)=><details key={i} open={s.status==="running"}><summary style={{ padding: "12px 0", cursor: "pointer" }}>{String(i+1).padStart(2,"0")} · {s.title} · {s.status}</summary>{s.result && <pre style={{ whiteSpace: "pre-wrap", background: "#221A31", padding: 14, borderRadius: 8 }}>{s.result}</pre>}</details>)}</div>

        {banCuoi && <section style={{ marginTop: 36 }}><div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}><h2>Bản đọc</h2><button onClick={()=>navigator.clipboard?.writeText(banCuoi)} style={{ padding:"9px 13px" }}><Copy size={14} style={{ verticalAlign:"middle", marginRight:6 }}/>Chép kịch bản</button></div><pre style={{ whiteSpace:"pre-wrap", lineHeight:1.8, background:"#1C1629", border:"1px solid #2F2742", borderRadius:10, padding:20 }}>{banCuoi}</pre></section>}
      </div>
    </main>
  );
}
