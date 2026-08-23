"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Copy, Play, RefreshCw, RotateCcw, Upload } from "lucide-react";

const EMPTY = { ten:"", loai:"", khach:"", van_de:"", loi_ich:"", khac_biet:"", gia:"", cta:"" };
const FIELDS = [["ten","Tên sản phẩm *"],["loai","Nó là cái gì"],["khach","Bán cho ai"],["van_de","Khách đang khổ vì gì"],["loi_ich","Khách được gì"],["khac_biet","Khác gì thứ ngoài kia"],["gia","Giá và ưu đãi (nếu có)"],["cta","Muốn khách làm gì *"]];
const STEP_TITLES = ["Mổ kịch bản gốc","Ghép sản phẩm vào beat","Dựng kịch bản mới","Nấu lại lời thoại"];
const ACCEPTED = ["txt","srt","vtt","md"];

async function askClaude(prompt, signal) {
  const response = await fetch("/api/generate", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ prompt }), signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Máy chủ AI đang bận. Hãy thử lại.");
  const text = String(data?.text || "").trim();
  if (!text) throw new Error("AI không trả về nội dung. Hãy thử lại.");
  return text;
}

function parseJSON(text) {
  try { const clean=String(text||"").replace(/```(?:json)?|```/gi,"").trim(); const start=clean.indexOf("{"); const end=clean.lastIndexOf("}"); return JSON.parse(start>=0&&end>=start?clean.slice(start,end+1):clean); }
  catch { return null; }
}

export default function XuongCheKichBan() {
  const [kichBan,setKichBan]=useState(""); const [sp,setSp]=useState(EMPTY);
  const [nenTang,setNenTang]=useState("TikTok / Facebook Reels"); const [doDai,setDoDai]=useState("30–60 giây"); const [bamGoc,setBamGoc]=useState("Cân bằng");
  const [dangChay,setDangChay]=useState(false); const [loi,setLoi]=useState(""); const [notice,setNotice]=useState(""); const [steps,setSteps]=useState([]); const [banCuoi,setBanCuoi]=useState("");
  const [artifacts,setArtifacts]=useState(null); const [version,setVersion]=useState(0);
  const runId=useRef(0);
  const requestController=useRef(null);
  const thieu=!kichBan.trim()||!sp.ten.trim()||!sp.cta.trim();
  const productText=()=>FIELDS.map(([key,label])=>`${label.replace(" *","")}: ${sp[key]?.trim()||"KHÔNG ĐƯỢC CUNG CẤP"}`).join("\n");
  const beats=useMemo(()=>parseJSON(steps[1]?.result)?.beats||parseJSON(steps[0]?.result)?.beats||[],[steps]);
  const setStep=(index,patch)=>setSteps(old=>{const next=[...old]; next[index]={title:STEP_TITLES[index],...(next[index]||{}),...patch}; return next;});

  function beginRun() {
    requestController.current?.abort();
    const controller=new AbortController();
    requestController.current=controller;
    return {id:++runId.current,signal:controller.signal};
  }

  async function buildDraftAndVoice(map,id,signal,isVariant=false) {
    setStep(2,{status:"running",result:""});
    const variation=isVariant?`Đây là phiên bản ${version+1}. Hãy thay đổi rõ cách mở hook, cách diễn đạt và cách chốt so với bản trước, nhưng giữ nguyên thứ tự, logic, chức năng và nội dung cốt lõi của bản đồ beat.`:"";
    const raw3=await askClaude(`Viết kịch bản nói thành tiếng cho ${nenTang}, độ dài ${doDai}, từ bản đồ beat dưới đây. Đây là lời thoại video, không phải bài blog. Mỗi đoạn mở bằng [TÊN BEAT · khoảng thời gian], tiếp theo là lời nói và chỉ dẫn hình ảnh ngắn nếu cần. Không markdown, không emoji. Không thêm bất kỳ claim nào ngoài dữ liệu. CTA phải đúng dữ liệu người dùng. ${variation}\n\nBẢN ĐỒ BEAT (không được thay đổi logic):\n${JSON.stringify(map)}\n\nDỮ LIỆU SẢN PHẨM:\n${productText()}`,signal);
    if(id!==runId.current)return; setStep(2,{status:"done",result:raw3}); setStep(3,{status:"running",result:""});
    const raw4=await askClaude(`Biên tập lời thoại sau thành tiếng Việt tự nhiên như người thật nói trước máy quay. Loại văn AI, sáo rỗng, từ thừa, quảng cáo cứng và câu dài khó nói. Giữ logic beat, thời lượng, mọi sự thật sản phẩm; không thêm claim. CTA bắt buộc đúng nguyên ý: ${sp.cta.trim()}. ${isVariant?"Tạo nhịp nói và cách chốt khác bản trước, không đổi bản đồ beat.":""} Chỉ trả bản đọc cuối, không lời dẫn.\n\nBẢN DỰNG:\n${raw3}`,signal);
    if(id!==runId.current)return; setStep(3,{status:"done",result:raw4}); setBanCuoi(raw4); setVersion(old=>old+1);
  }

  async function run() {
    if (thieu||dangChay) return; const {id,signal}=beginRun();
    setDangChay(true); setLoi(""); setNotice(""); setBanCuoi(""); setSteps([]); setArtifacts(null); setVersion(0);
    try {
      setStep(0,{status:"running"});
      const raw1=await askClaude(`Bạn là chuyên gia phân tích kịch bản video ngắn. Phân tích cấu trúc, không viết lại và không sao chép dài dòng. Chỉ trả JSON hợp lệ, không markdown, schema: {"ngon_ngu":"","hook":{"noi_dung":"","co_che_tam_ly":""},"cong_thuc":"","persona":"","giong":"","nhip":"","beats":[{"ten":"","chuc_nang_tam_ly":"","tom_tat_noi_dung":"","giay":3}],"cta":{"noi_dung":"","chuc_nang":""}}.\n\nKỊCH BẢN GỐC:\n${kichBan.trim()}`,signal);
      if(id!==runId.current)return; const khung=parseJSON(raw1)||{phan_tich_raw:raw1}; setStep(0,{status:"done",result:raw1});
      setStep(1,{status:"running"});
      const raw2=await askClaude(`Bạn đang ánh xạ sản phẩm mới vào cấu trúc viral, không phải chatbot. Giữ chức năng tâm lý và nhịp của từng beat, tuyệt đối không sao chép nguyên văn nguồn. Dùng pain point, insight, lợi ích, khác biệt, offer và CTA CHỈ khi dữ liệu sản phẩm có cung cấp. Không suy đoán hay bịa giá, ưu đãi, thông số, tính năng, chính sách, bảo hành, quà, bằng chứng hoặc số liệu.\n\nQUY TẮC MỨC BÁM CẤU TRÚC:\n- Sát khung: giữ đúng thứ tự và đúng số lượng beat của khung nguồn.\n- Cân bằng: giữ flow chính, được gộp hoặc tách tối đa một beat khi thực sự cần.\n- Thoáng: giữ công thức và chức năng tâm lý, nhưng được sắp xếp lại thứ tự beat.\nPhải áp dụng đúng mức được chọn, không chỉ nhắc lại tên mức.\n\nKHUNG NGUỒN:\n${JSON.stringify(khung)}\n\nDỮ LIỆU SẢN PHẨM:\n${productText()}\n\nMỨC ĐƯỢC CHỌN: ${bamGoc}\n\nChỉ trả JSON hợp lệ, không markdown: {"hook_moi":"","beats":[{"ten":"","chuc_nang_tam_ly":"","noi_dung_moi":"","giay":3}],"cta_moi":"","du_lieu_con_thieu":[]}.`,signal);
      if(id!==runId.current)return; const map=parseJSON(raw2)||{anh_xa_raw:raw2}; setStep(1,{status:"done",result:raw2});
      setArtifacts({khung,map}); await buildDraftAndVoice(map,id,signal);
    } catch(error) { if(id===runId.current&&error?.name!=="AbortError"){setLoi(error?.message||"Có lỗi khi chạy AI.");setSteps(old=>old.map(s=>s?.status==="running"?{...s,status:"error"}:s));} }
    finally { if(id===runId.current)setDangChay(false); }
  }

  async function rerunVariant() {
    if(!artifacts?.khung||!artifacts?.map||dangChay)return; const {id,signal}=beginRun();
    setDangChay(true);setLoi("");setNotice("");
    try { await buildDraftAndVoice(artifacts.map,id,signal,true); }
    catch(error){if(id===runId.current&&error?.name!=="AbortError"){setLoi(error?.message||"Có lỗi khi tạo phiên bản khác.");setSteps(old=>old.map(s=>s?.status==="running"?{...s,status:"error"}:s));}}
    finally{if(id===runId.current)setDangChay(false);}
  }

  function readFile(event){const file=event.target.files?.[0];event.target.value="";if(!file)return;const ext=file.name.split(".").pop()?.toLowerCase();if(!ACCEPTED.includes(ext)){setLoi("Định dạng không hỗ trợ. Chỉ nhận TXT, SRT, VTT hoặc MD.");return;}if(file.size>2*1024*1024){setLoi("File quá lớn. Vui lòng dùng file dưới 2 MB.");return;}const reader=new FileReader();reader.onload=()=>{const value=String(reader.result||"");if(!value.trim()){setLoi("File không có nội dung.");return;}setKichBan(value.slice(0,100000));setLoi(value.length>100000?"Transcript đã được rút còn 100.000 ký tự.":"");};reader.onerror=()=>setLoi("Không đọc được file. Hãy thử lại.");reader.readAsText(file,"UTF-8");}
  async function copy(){try{await navigator.clipboard.writeText(banCuoi);setNotice("Đã chép bản đọc vào clipboard.");setTimeout(()=>setNotice(""),2500);}catch{setLoi("Không thể truy cập clipboard. Hãy chọn và sao chép thủ công.");}}
  function reset(){requestController.current?.abort();requestController.current=null;runId.current++;setKichBan("");setSp(EMPTY);setSteps([]);setBanCuoi("");setArtifacts(null);setVersion(0);setLoi("");setNotice("");setDangChay(false);}

  return <main className="app"><div className="shell">
    <header className="hero"><div><div className="eyebrow">XƯỞNG CHẾ KỊCH BẢN</div><h1>Kịch bản người ta,<br/><span className="orange">sản phẩm của mình.</span></h1><p className="lede">Mổ logic của một kịch bản viral, giữ nhịp và chức năng từng beat — rồi thay toàn bộ phần ruột bằng câu chuyện sản phẩm của bạn.</p></div><div className="batch">4 công đoạn · 1 bản đọc</div></header>
    <div className="beatbar" aria-label="Thanh beat">{(beats.length?beats:Array.from({length:5},(_,i)=>({ten:`Beat ${i+1}`}))).map((b,i)=><div className={`beat ${beats.length?"active":""}`} key={`${b.ten}-${i}`} style={{animationDelay:`${i*100}ms`}}><b>{String(i+1).padStart(2,"0")}</b><small>{b.ten||`Beat ${i+1}`}</small></div>)}</div>
    <div className="panels">
      <section className="panel source"><div className="panel-head"><h2>Nguồn · Kịch bản gốc</h2><span className="counter">{kichBan.length.toLocaleString("vi-VN")} / 100.000</span></div><textarea aria-label="Kịch bản gốc" value={kichBan} maxLength={100000} onChange={e=>setKichBan(e.target.value)} placeholder="Dán transcript hoặc kịch bản viral vào đây…"/><label className="upload"><Upload size={16}/>Tải TXT / SRT / VTT / MD<input type="file" accept=".txt,.srt,.vtt,.md,text/plain,text/markdown" onChange={readFile} hidden/></label><span className="upload-note">Tối đa 2 MB</span></section>
      <section className="panel product"><div className="panel-head"><h2>Đích · Sản phẩm của bạn</h2><span className="counter">Không bịa dữ liệu</span></div><div className="fields">{FIELDS.map(([key,label],i)=>["van_de","loi_ich","khac_biet"].includes(key)?<textarea className="field-long" aria-label={label} key={key} value={sp[key]} maxLength={1000} onChange={e=>setSp(old=>({...old,[key]:e.target.value}))} placeholder={label}/>:<input className={i>5?"wide":""} aria-label={label} key={key} value={sp[key]} maxLength={1000} onChange={e=>setSp(old=>({...old,[key]:e.target.value}))} placeholder={label}/>)}</div></section>
    </div>
    <div className="controls"><div className="control"><label>Nền tảng</label><select value={nenTang} onChange={e=>setNenTang(e.target.value)}>{["TikTok / Facebook Reels","YouTube Shorts"].map(x=><option key={x}>{x}</option>)}</select></div><div className="control"><label>Độ dài</label><select value={doDai} onChange={e=>setDoDai(e.target.value)}>{["15–30 giây","30–60 giây","60–90 giây"].map(x=><option key={x}>{x}</option>)}</select></div><div className="control"><label>Mức bám cấu trúc</label><select value={bamGoc} onChange={e=>setBamGoc(e.target.value)}>{["Sát khung","Cân bằng","Thoáng"].map(x=><option key={x}>{x}</option>)}</select></div></div>
    <div className="actions"><button className="btn btn-primary" disabled={dangChay||thieu} onClick={run}><Play size={16}/>{dangChay?"Xưởng đang chạy…":"Chạy xưởng 4 bước"}</button><button className="btn" onClick={reset}><RotateCcw size={16}/>Làm mẻ mới</button></div>
    {thieu&&!dangChay&&<p className="counter">Cần kịch bản nguồn, tên sản phẩm và CTA để bắt đầu.</p>}{loi&&<div className="error" role="alert">{loi}</div>}{notice&&<div className="notice" role="status">{notice}</div>}
    {steps.length>0&&<section className="pipeline"><div className="pipeline-title"><h2>Dây chuyền đang nấu</h2><span>Mở từng công đoạn để xem output</span></div>{steps.map((s,i)=><details className="step" key={i} open={s.status==="running"||s.status==="error"}><summary><span className="step-num">0{i+1}</span>{s.title}{s.status==="done"&&<Check size={15}/>}<span className={`status ${s.status}`}>{s.status==="running"?"Đang xử lý":s.status==="done"?"Hoàn tất":"Có lỗi"}</span></summary>{s.result&&<pre className="result">{s.result}</pre>}</details>)}</section>}
    {banCuoi&&<section className="final"><div className="final-head"><div><div className="eyebrow">THÀNH PHẨM · PHIÊN BẢN {version}</div><h2>Bản đọc cuối</h2></div><div className="final-actions"><button className="btn" onClick={copy}><Copy size={15}/>Copy</button><button className="btn btn-primary" disabled={dangChay||!artifacts?.map} onClick={rerunVariant}><RefreshCw size={15}/>Ra bản khác</button></div></div><div className="script">{banCuoi}</div></section>}
  </div></main>;
}
