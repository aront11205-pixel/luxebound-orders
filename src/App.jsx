import React, { useState, useEffect, useRef, useCallback } from "react";
import { db } from "./firebase";
import { collection, doc, onSnapshot, setDoc, addDoc, deleteDoc, updateDoc } from "firebase/firestore";

const BLUE  = "#5271FF";
const GREEN = "#18B978";
const RED   = "#ef4444";
const GOLD  = "#C9A84C";
const AMBER = "#f59e0b";
const NAVY  = "#0f1f4b";

const DEFAULT_ALBUMS = [
  { id:"a1", name:"Wedding Album",    price:350 },
  { id:"a2", name:"Tenoyim Album",    price:325 },
  { id:"a3", name:"Baby Album",       price:450 },
  { id:"a4", name:"Bar Mitzva Album", price:350 },
  { id:"a5", name:"Family Album",     price:325 },
  { id:"a6", name:"Other Album",      price:0   },
];
const DEFAULT_UPGRADES = [
  { id:"u1", name:"Box Upgrade",           price:50 },
  { id:"u2", name:"Cover Upgrade Leather", price:30 },
  { id:"u3", name:"Cover Upgrade Acrylic", price:40 },
  { id:"u4", name:"USB",                   price:35 },
  { id:"u5", name:"USB + Case",            price:55 },
  { id:"u6", name:"Extra Pages",           price:25 },
];
const DEFAULT_PAYMENTS = ["CC","CC/CASH","CC/QP","CASH","CHECK","QP"];
const DEFAULT_USERS = [
  { id:"user1", email:"zupnickyona@gmail.com", password:"8606", role:"admin", displayName:"Yona" }
];
const STATUSES = [
  "New Order","Sent for First Look","Waiting for Changes","Waiting for Pictures",
  "Waiting for Approval","Waiting to be Ordered","Ordered","In Production",
  "Shipped","Delivered","Order Done",
];
const STATUS_COLORS = {
  "New Order":             { bg:"#e0e7ff", tx:"#3730a3" },
  "Sent for First Look":   { bg:"#dbeafe", tx:"#1d4ed8" },
  "Waiting for Changes":   { bg:"#fef3c7", tx:"#92400e" },
  "Waiting for Pictures":  { bg:"#fef9c3", tx:"#a16207" },
  "Waiting for Approval":  { bg:"#fce7f3", tx:"#9d174d" },
  "Waiting to be Ordered": { bg:"#ede9fe", tx:"#6d28d9" },
  "Ordered":               { bg:"#d1fae5", tx:"#065f46" },
  "In Production":         { bg:"#ccfbf1", tx:"#0f766e" },
  "Shipped":               { bg:"#dcfce7", tx:"#166534" },
  "Delivered":             { bg:"#d1fae5", tx:"#15803d" },
  "Order Done":            { bg:"#bbf7d0", tx:"#14532d" },
};

// ── Utils ─────────────────────────────────────────────────
const todayStr  = () => new Date().toISOString().split("T")[0];
const fmt$      = n  => "$"+(Number(n)||0).toFixed(2);
const fmtD      = d  => { if(!d) return "—"; const [y,m,day]=d.split("-"); return `${m}/${day}/${y}`; };
const uid       = () => `${Date.now()}_${Math.floor(Math.random()*9999)}`;
const lsGet     = k  => { try{ const v=localStorage.getItem(k); return v?JSON.parse(v):null; }catch{ return null; } };
const lsSet     = (k,v) => { try{ localStorage.setItem(k,JSON.stringify(v)); }catch{} };
const daysSince = d  => { if(!d) return 0; return (Date.now()-new Date(d).getTime())/864e5; };
const isSnoozed = o  => { if(!o?.snoozedUntil) return false; return new Date(o.snoozedUntil)>new Date(); };

const fmtPhone = (val) => {
  const d=(val||"").replace(/\D/g,"").slice(0,10);
  if(!d) return "";
  if(d.length<4) return `(${d}`;
  if(d.length<7) return `(${d.slice(0,3)}) ${d.slice(3)}`;
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
};

const fmtDateTime = (iso) => {
  if(!iso) return "";
  try {
    const d=new Date(iso);
    return d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})+" at "+d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
  } catch { return ""; }
};

const clean = (obj) => {
  if(obj===null||obj===undefined) return null;
  if(Array.isArray(obj)) return obj.map(clean);
  if(typeof obj==="object") {
    const out={};
    for(const [k,v] of Object.entries(obj)) { if(v!==undefined) out[k]=clean(v); }
    return out;
  }
  return obj;
};

const buildDiff = (oldO, newO, who) => {
  const ch=[];
  if((oldO.status||"")!==(newO.status||"")) ch.push(`Status: ${oldO.status||"?"} → ${newO.status}`);
  if(!!oldO.paid!==!!newO.paid) ch.push(newO.paid?"Marked as paid":"Marked as unpaid");
  if((oldO.notes||"")!==(newO.notes||"")) ch.push("Notes updated");
  if((Number(oldO.finalTotal)||0)!==(Number(newO.finalTotal)||0)) ch.push(`Total: ${fmt$(oldO.finalTotal||0)} → ${fmt$(newO.finalTotal||0)}`);
  if((oldO.deadline||"")!==(newO.deadline||"")) ch.push("Deadline updated");
  if(!!oldO.priority!==!!newO.priority) ch.push(newO.priority?"Marked as priority":"Priority removed");
  if((oldO.customerName||"")!==(newO.customerName||"")) ch.push("Customer name updated");
  if(!ch.length) return null;
  return { who, when: new Date().toISOString(), summary: ch.join(" · ") };
};

// Smart Reminder templates per status
const REMINDER = {
  "New Order":             { subject:"Your LuxeBound Album — Order Received!", email:"Hi {name},\n\nThank you so much for choosing LuxeBound Albums! We have received your order and are excited to start working on your album.\n\nWe will be in touch soon with updates on your order progress.\n\nWarm regards,\nLuxeBound Albums\nThe Art of Album Making", text:"Hi {name}! Thank you for your order with LuxeBound Albums 😊 We received it and will be in touch soon!" },
  "Sent for First Look":   { subject:"Your LuxeBound Album — First Look Ready!", email:"Hi {name},\n\nGreat news! Your album is ready for its first look.\n\nPlease take a moment to review it and let us know if you would like any changes. We want everything to be absolutely perfect.\n\nLooking forward to hearing your thoughts!\n\nWarm regards,\nLuxeBound Albums\nThe Art of Album Making", text:"Hi {name}! Your LuxeBound album is ready for your first look 😊 Please let us know if you have any changes. Thanks!" },
  "Waiting for Changes":   { subject:"Your LuxeBound Album — Waiting for Your Changes", email:"Hi {name},\n\nJust a friendly follow-up! We are waiting to receive your requested changes so we can continue working on your album.\n\nWhenever you are ready, please send over your feedback and we will get right on it.\n\nWarm regards,\nLuxeBound Albums\nThe Art of Album Making", text:"Hi {name}! Just a reminder — we're waiting on your changes for your LuxeBound album. Send them over whenever you're ready! 😊" },
  "Waiting for Pictures":  { subject:"Your LuxeBound Album — Pictures Needed", email:"Hi {name},\n\nHope you are doing well! We are still waiting to receive your photos so we can get started on your album.\n\nPlease send them over at your earliest convenience.\n\nWarm regards,\nLuxeBound Albums\nThe Art of Album Making", text:"Hi {name}! We're still waiting on your photos to get started on your album. Please send them over when you can! 📸" },
  "Waiting for Approval":  { subject:"Your LuxeBound Album — Ready for Final Approval", email:"Hi {name},\n\nYour album is looking beautiful and is ready for your final approval!\n\nPlease take a look and let us know if you are happy with everything. Once approved we will move forward with the order.\n\nWarm regards,\nLuxeBound Albums\nThe Art of Album Making", text:"Hi {name}! Your LuxeBound album is ready for final approval 🎉 Please let us know if everything looks good!" },
  "Waiting to be Ordered": { subject:"Your LuxeBound Album — Approved and Ready to Order", email:"Hi {name},\n\nWonderful! Your album has been approved and is ready to be ordered.\n\nWe will be placing the order shortly and will keep you updated.\n\nWarm regards,\nLuxeBound Albums\nThe Art of Album Making", text:"Hi {name}! Your album is approved and ready to be ordered 🙌 We'll place it soon and keep you posted!" },
  "Ordered":               { subject:"Your LuxeBound Album — Order Placed!", email:"Hi {name},\n\nGreat news! Your album has been officially ordered and is on its way to production.\n\nWe will keep you updated as it progresses. Thank you for your patience!\n\nWarm regards,\nLuxeBound Albums\nThe Art of Album Making", text:"Hi {name}! Your LuxeBound album has been ordered and is heading to production 🎶 We'll keep you updated!" },
  "In Production":         { subject:"Your LuxeBound Album — Currently in Production", email:"Hi {name},\n\nJust a quick update — your album is currently in production!\n\nOur team is working hard to create something beautiful for you. We will notify you as soon as it is ready to ship.\n\nWarm regards,\nLuxeBound Albums\nThe Art of Album Making", text:"Hi {name}! Your LuxeBound album is currently in production 🔧 We'll let you know as soon as it's on its way!" },
  "Shipped":               { subject:"Your LuxeBound Album — On Its Way!", email:"Hi {name},\n\nExciting news — your album has been shipped and is on its way to you!\n\nWe hope you absolutely love it when it arrives!\n\nWarm regards,\nLuxeBound Albums\nThe Art of Album Making", text:"Hi {name}! Your LuxeBound album has been shipped and is on its way 📦 Can't wait for you to see it!" },
  "Delivered":             { subject:"LuxeBound Albums — Payment Reminder", email:"Hi {name},\n\nWe hope you are enjoying your beautiful new album!\n\nThis is a friendly reminder that your payment is still outstanding. Please let us know when you would like to arrange it at your earliest convenience.\n\nThank you so much!\n\nWarm regards,\nLuxeBound Albums\nThe Art of Album Making", text:"Hi {name}! Hope you're loving your LuxeBound album! Just a friendly reminder that your payment is still outstanding 😊 Thank you!" },
  "Order Done":            { subject:"Thank You — Your LuxeBound Album is Complete!", email:"Hi {name},\n\nThank you so much for choosing LuxeBound Albums! Your order is now complete and we hope you absolutely love your album.\n\nIt was a pleasure working with you and we hope to see you again soon!\n\nWarm regards,\nLuxeBound Albums\nThe Art of Album Making", text:"Hi {name}! Thank you so much for choosing LuxeBound Albums! Your order is complete and we hope you love it! 💛" },
};

// ── Logo ──────────────────────────────────────────────────
const LOGO_B64 = "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";

function Logo({ size=38 }) {
  return <img src={`data:image/jpeg;base64,${LOGO_B64}`} width={size} height={size} style={{flexShrink:0,borderRadius:"50%",objectFit:"cover"}} alt="LuxeBound"/>;
}

const iStyle = th => ({
  width:"100%", padding:"10px 12px", borderRadius:8,
  border:`1.5px solid ${th.border}`, background:th.inp,
  color:th.text, fontSize:14, outline:"none",
  fontFamily:"system-ui,sans-serif", boxSizing:"border-box",
});

function Btn({ children, onClick, variant="primary", sm, full, disabled, style:sx={} }) {
  const v={primary:{background:BLUE,color:"white"},success:{background:GREEN,color:"white"},danger:{background:RED,color:"white"},ghost:{background:"rgba(255,255,255,0.15)",color:"white",border:"1.5px solid rgba(255,255,255,0.4)"},gray:{background:"#e2e8f0",color:"#475569"}};
  return <button onClick={onClick} disabled={disabled} style={{padding:sm?"6px 14px":"10px 20px",borderRadius:8,border:"none",cursor:disabled?"not-allowed":"pointer",fontSize:sm?12:14,fontWeight:600,fontFamily:"system-ui,sans-serif",width:full?"100%":undefined,opacity:disabled?.5:1,whiteSpace:"nowrap",...(v[variant]||v.primary),...sx}}>{children}</button>;
}

function Field({ label, required, children, style:sx={} }) {
  return <div style={{display:"flex",flexDirection:"column",gap:5,...sx}}>{label&&<label style={{fontSize:11,fontWeight:700,letterSpacing:"0.6px",textTransform:"uppercase",color:"#64748b"}}>{label}{required&&<span style={{color:RED}}> *</span>}</label>}{children}</div>;
}

function Badge({ status }) {
  const c=STATUS_COLORS[status]||{bg:"#e5e7eb",tx:"#374151"};
  return <span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,background:c.bg,color:c.tx,fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>{status}</span>;
}

function Toggle({ on, set }) {
  return <div onClick={()=>set(!on)} style={{width:48,height:26,borderRadius:13,cursor:"pointer",background:on?BLUE:"#cbd5e1",position:"relative",transition:"background .2s",flexShrink:0}}><div style={{width:20,height:20,borderRadius:"50%",background:"white",position:"absolute",top:3,left:on?25:3,transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}}/></div>;
}

function NavBar({ title, onBack, actions }) {
  return <div style={{background:NAVY,padding:"0 24px",height:64,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 12px rgba(0,0,0,.2)"}}><div style={{display:"flex",alignItems:"center",gap:12}}>{onBack&&<button onClick={onBack} style={{background:"rgba(255,255,255,0.12)",border:"none",fontSize:18,cursor:"pointer",color:"white",padding:"6px 12px",borderRadius:8}}>←</button>}<span style={{fontWeight:700,fontSize:18,color:"white"}}>{title}</span></div>{actions&&<div style={{display:"flex",gap:8}}>{actions}</div>}</div>;
}

function Avatar({ user, size=36, onClick }) {
  const name=user?.displayName||user?.email||"?";
  const initials=name.includes("@")?name[0].toUpperCase():name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const colors=["#5271FF","#18B978","#f59e0b","#8b5cf6","#ec4899","#06b6d4"];
  const color=colors[(name.charCodeAt(0)||0)%colors.length];
  if(user?.photo) return <img src={user.photo} onClick={onClick} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",flexShrink:0,cursor:onClick?"pointer":"default",border:"2px solid rgba(255,255,255,0.5)",boxShadow:"0 2px 8px rgba(0,0,0,0.2)"}} alt={name}/>;
  return <div onClick={onClick} style={{width:size,height:size,borderRadius:"50%",background:color,color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:size*0.38,flexShrink:0,cursor:onClick?"pointer":"default",border:"2px solid rgba(255,255,255,0.4)",boxShadow:"0 2px 8px rgba(0,0,0,0.2)",userSelect:"none"}}>{initials}</div>;
}

function Loader() {
  return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:`linear-gradient(135deg,${NAVY},#1e3a8a)`,flexDirection:"column",gap:16}}><Logo size={60}/><div style={{fontSize:14,color:"rgba(255,255,255,0.7)",fontFamily:"system-ui,sans-serif"}}>Loading…</div></div>;
}

// ══════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════
function LoginScreen({ users, onLogin }) {
  const [email,setEmail]=useState(""); const [pass,setPass]=useState(""); const [err,setErr]=useState("");
  const login=()=>{const u=users.find(u=>u.email===email&&u.password===pass);if(u)onLogin(u);else setErr("Invalid email or password.");};
  const inp={width:"100%",padding:"12px 14px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#0f172a",fontSize:14,outline:"none",fontFamily:"system-ui,sans-serif",boxSizing:"border-box"};
  return(
    <div style={{minHeight:"100vh",background:`linear-gradient(135deg,${NAVY} 0%,#1e3a8a 50%,#1e40af 100%)`,display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"system-ui,sans-serif"}}>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:16}}><Logo size={80}/></div>
          <div style={{fontSize:30,fontWeight:800,color:"white",letterSpacing:"-0.5px",fontFamily:"Georgia,serif"}}>LuxeBound Albums</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.6)",marginTop:6,letterSpacing:"2px",textTransform:"uppercase"}}>Order Management</div>
        </div>
        <div style={{background:"white",borderRadius:20,padding:32,boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
          <Field label="Email" style={{marginBottom:16}}><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" style={inp} onKeyDown={e=>e.key==="Enter"&&login()}/></Field>
          <Field label="Password" style={{marginBottom:22}}><input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="Enter your password" style={inp} onKeyDown={e=>e.key==="Enter"&&login()}/></Field>
          {err&&<div style={{color:RED,fontSize:13,marginBottom:16,padding:"10px 14px",background:"#fef2f2",borderRadius:10}}>{err}</div>}
          <button onClick={login} style={{width:"100%",padding:"14px",borderRadius:10,border:"none",background:`linear-gradient(135deg,${BLUE},#7c93ff)`,color:"white",fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:"system-ui,sans-serif",boxShadow:"0 4px 15px rgba(82,113,255,0.4)"}}>Sign In</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// STAT CARDS
// ══════════════════════════════════════════════════════════
function StatCards({ orders }) {
  const revenue=orders.reduce((s,o)=>s+(Number(o.finalTotal)||Number(o.total)||0),0);
  const zno=orders.reduce((s,o)=>s+(Number(o.znoCost)||0),0);
  const profit=revenue-zno;
  return(
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:24}}>
      {[
        {icon:"📦",label:"Total Orders",val:orders.length,bg:"linear-gradient(135deg,#5271FF,#7c93ff)",sh:"rgba(82,113,255,0.3)"},
        {icon:"💰",label:"Revenue",val:fmt$(revenue),bg:"linear-gradient(135deg,#0ea5e9,#38bdf8)",sh:"rgba(14,165,233,0.3)"},
        {icon:"📈",label:"Your Profit",val:fmt$(profit),bg:profit>=0?"linear-gradient(135deg,#18B978,#34d399)":"linear-gradient(135deg,#ef4444,#f87171)",sh:profit>=0?"rgba(24,185,120,0.3)":"rgba(239,68,68,0.3)"},
        {icon:"🏭",label:"Zno Costs",val:fmt$(zno),bg:"linear-gradient(135deg,#f59e0b,#fbbf24)",sh:"rgba(245,158,11,0.3)"},
      ].map(c=>(
        <div key={c.label} style={{background:c.bg,borderRadius:16,padding:"20px 22px",boxShadow:`0 8px 24px ${c.sh}`}}>
          <div style={{fontSize:28,marginBottom:8}}>{c.icon}</div>
          <div style={{fontSize:26,fontWeight:800,color:"white",letterSpacing:"-0.5px"}}>{c.val}</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.75)",marginTop:6,fontWeight:600}}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}

function Pipeline({ orders, statusFilter, setStatusFilter }) {
  return(
    <div style={{marginBottom:24,background:"white",borderRadius:16,padding:"18px 20px",boxShadow:"0 4px 16px rgba(0,0,0,0.07)"}}>
      <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:12,textTransform:"uppercase",letterSpacing:"1px"}}>Pipeline</div>
      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
        {STATUSES.map(s=>{
          const count=orders.filter(o=>o.status===s).length;
          const active=statusFilter===s;
          return(
            <div key={s} onClick={()=>setStatusFilter(active?null:s)} style={{flexShrink:0,padding:"10px 14px",borderRadius:12,cursor:"pointer",background:active?BLUE:"#f1f5f9",color:active?"white":"#334155",border:`2px solid ${active?BLUE:"transparent"}`,textAlign:"center",minWidth:90,transition:"all .15s"}}>
              <div style={{fontSize:22,fontWeight:800,color:active?"white":BLUE,lineHeight:1}}>{count}</div>
              <div style={{fontSize:10,marginTop:4,fontWeight:600,opacity:active?1:.8,lineHeight:1.2}}>{s}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// FLAGS SECTION  (always visible, under pipeline)
// ══════════════════════════════════════════════════════════
const FLAG_DEFS = {
  red:    {color:"#dc2626",bg:"#fef2f2",border:"#fecaca",icon:"🔴"},
  orange: {color:"#ea580c",bg:"#fff7ed",border:"#fed7aa",icon:"🟠"},
  yellow: {color:"#ca8a04",bg:"#fefce8",border:"#fef08a",icon:"🟡"},
};

function getFlag(o) {
  // Manual flag takes priority
  if(o.manualFlag && FLAG_DEFS[o.manualFlag]) {
    return {...FLAG_DEFS[o.manualFlag], label: o.manualFlagNote||"Manually flagged"};
  }
  // Auto flags
  if(o.status==="Delivered"&&!o.paid) return {color:"#dc2626",bg:"#fef2f2",border:"#fecaca",icon:"🔴",label:"Unpaid & Delivered"};
  if((o.status==="Ordered"||o.status==="In Production")&&daysSince(o.statusChangedAt||o.dateCreated)>14) return {color:"#ea580c",bg:"#fff7ed",border:"#fed7aa",icon:"🟠",label:"Overdue in production"};
  return {color:"#ca8a04",bg:"#fefce8",border:"#fef08a",icon:"🟡",label:"Sitting too long"};
}

function FlagCard({ order, onEdit, onSnooze }) {
  const [showSnooze,setShowSnooze]=useState(false);
  const f=getFlag(order);
  return(
    <div style={{background:f.bg,border:`1.5px solid ${f.border}`,borderRadius:10,padding:"10px 14px",marginBottom:8}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <div>
          <span>{f.icon} </span>
          <strong style={{color:f.color,fontSize:13}}>{order.customerName}</strong>
          <span style={{fontSize:12,color:"#64748b"}}> · {order.status} · {f.label}</span>
          {isSnoozed(order)&&<div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>🔕 Snoozed until {fmtD(order.snoozedUntil?.split("T")[0])}</div>}
        </div>
        {!showSnooze&&(
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>setShowSnooze(true)} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${f.border}`,background:"white",color:f.color,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>🔕 Snooze</button>
            <button onClick={()=>onEdit(order)} style={{padding:"5px 10px",borderRadius:8,border:"none",background:f.color,color:"white",cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>View</button>
          </div>
        )}
      </div>
      {showSnooze&&(
        <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:11,color:"#64748b",fontFamily:"system-ui,sans-serif"}}>Snooze for:</span>
          {[["1 Day",1],["1 Week",7],["2 Weeks",14],["1 Month",30]].map(([label,days])=>(
            <button key={label} onClick={()=>{onSnooze(order,days);setShowSnooze(false);}} style={{padding:"4px 10px",borderRadius:20,border:`1px solid ${f.border}`,background:"white",color:f.color,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>{label}</button>
          ))}
          <button onClick={()=>setShowSnooze(false)} style={{padding:"4px 10px",borderRadius:20,border:"1.5px solid #e2e8f0",background:"white",color:"#64748b",cursor:"pointer",fontSize:11,fontFamily:"system-ui,sans-serif"}}>Cancel</button>
        </div>
      )}
    </div>
  );
}

function FlagsSection({ orders, onEdit, onSnooze }) {
  const flagged=orders.filter(o=>{
    if(isSnoozed(o)||o.status==="Order Done") return false;
    if(o.manualFlag) return true; // manually flagged always shows
    if(o.status==="Delivered"&&!o.paid) return true;
    if((o.status==="Ordered"||o.status==="In Production")&&daysSince(o.statusChangedAt||o.dateCreated)>14) return true;
    if(daysSince(o.statusChangedAt||o.dateCreated)>30) return true;
    return false;
  });
  return(
    <div style={{background:"white",borderRadius:16,padding:"16px 20px",marginBottom:20,boxShadow:"0 4px 16px rgba(0,0,0,0.07)"}}>
      <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:12,textTransform:"uppercase",letterSpacing:"1px"}}>🚩 Flagged Orders</div>
      {flagged.length===0
        ?<div style={{color:GREEN,fontSize:14,fontWeight:600,padding:"4px 0"}}>✅ No flagged orders</div>
        :flagged.map(o=><FlagCard key={o.id} order={o} onEdit={onEdit} onSnooze={onSnooze}/>)
      }
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// FILTERS  (enhanced)
// ══════════════════════════════════════════════════════════
function Filters({ filters, setFilters, albums, th, onClear, statusFilter, setStatusFilter }) {
  const inp=iStyle(th);
  const has=filters.search||filters.album||filters.paid||filters.vip||filters.priority||filters.pinned||statusFilter;
  return(
    <div style={{marginBottom:16}}>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:10}}>
        <input value={filters.search} onChange={e=>setFilters(f=>({...f,search:e.target.value}))} placeholder="🔍 Search name or phone…" style={{...inp,flex:1,minWidth:160,fontSize:13}}/>
        <select value={filters.album} onChange={e=>setFilters(f=>({...f,album:e.target.value}))} style={{...inp,width:"auto",fontSize:13}}>
          <option value="">All Albums</option>
          {albums.map(a=><option key={a.id} value={a.name}>{a.name}</option>)}
        </select>
        <select value={statusFilter||""} onChange={e=>setStatusFilter(e.target.value||null)} style={{...inp,width:"auto",fontSize:13}}>
          <option value="">All Statuses</option>
          {STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        <select value={filters.paid} onChange={e=>setFilters(f=>({...f,paid:e.target.value}))} style={{...inp,width:"auto",fontSize:12,padding:"7px 10px"}}>
          <option value="">All (Paid/Unpaid)</option>
          <option value="paid">✅ Paid only</option>
          <option value="unpaid">❌ Unpaid only</option>
        </select>
        {[["vip","⭐ VIP",BLUE],["priority","⚡ Priority",AMBER],["pinned","📌 Pinned",GOLD]].map(([key,label,color])=>(
          <label key={key} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#475569",cursor:"pointer",fontFamily:"system-ui,sans-serif",background:"#f8fafc",padding:"7px 12px",borderRadius:8,border:`1.5px solid ${filters[key]?color+"55":"#e2e8f0"}`}}>
            <input type="checkbox" checked={!!filters[key]} onChange={e=>setFilters(f=>({...f,[key]:e.target.checked}))} style={{accentColor:color}}/>{label}
          </label>
        ))}
        {has&&<button onClick={onClear} style={{padding:"7px 14px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"white",color:"#64748b",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Clear ×</button>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ORDER CARD  (V4)
// ══════════════════════════════════════════════════════════
function OrderCard({ order, onEdit, onDelete, onPin }) {
  const finalTotal=(Number(order.finalTotal)||Number(order.total)||0);
  const profit=finalTotal-(Number(order.znoCost)||0);
  const albumList=(order.selectedAlbums||[]).filter(a=>a.albumType);
  const upgList=Object.entries(order.selectedUpgrades||{}).filter(([,q])=>Number(q)>0);
  const hasDiscount=order.discountValue>0;

  return(
    <div style={{background:"white",borderRadius:14,padding:"18px 20px",marginBottom:12,border:`1.5px solid ${order.priority?"#f59e0b44":"#e8ecf0"}`,boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2,flexWrap:"wrap"}}>
            <div style={{fontWeight:700,fontSize:17,color:"#0f172a"}}>{order.customerName}</div>
            {order.priority&&<span style={{fontSize:10,fontWeight:700,background:"#fef3c7",color:"#92400e",padding:"2px 8px",borderRadius:20}}>⚡ PRIORITY</span>}
            {order.vip&&<span style={{fontSize:10,fontWeight:700,background:"#fdf4ff",color:"#7e22ce",padding:"2px 8px",borderRadius:20}}>⭐ VIP</span>}
            {order.manualFlag&&FLAG_DEFS[order.manualFlag]&&<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:FLAG_DEFS[order.manualFlag].bg,color:FLAG_DEFS[order.manualFlag].color,border:`1px solid ${FLAG_DEFS[order.manualFlag].border}`}}>{FLAG_DEFS[order.manualFlag].icon} Flagged</span>}
          </div>
          <div style={{fontSize:12,color:"#64748b"}}>{order.phone}</div>
          {order.deadline&&<div style={{fontSize:11,color:RED,marginTop:3,fontWeight:600}}>🗓 Deadline: {fmtD(order.deadline)}</div>}
          {isSnoozed(order)&&<div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>🔕 Snoozed until {fmtD(order.snoozedUntil?.split("T")[0])}</div>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button onClick={()=>onPin&&onPin(order)} title={order.pinned?"Unpin":"Pin to top"} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,padding:"2px 4px",lineHeight:1,color:order.pinned?GOLD:"#d1d5db",filter:order.pinned?"none":"grayscale(1)",opacity:order.pinned?1:0.5}}>📌</button>
          <Badge status={order.status}/>
        </div>
      </div>

      {/* Order Details */}
      <div style={{background:"#f8fafc",borderRadius:10,padding:"12px 14px",marginBottom:12,border:"1px solid #f1f5f9"}}>
        <div style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:8}}>📋 Order Details</div>
        {albumList.length>0
          ? albumList.map((a,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#334155",marginBottom:5}}><span>📚 {a.albumType}</span><span style={{fontWeight:600,color:BLUE}}>{fmt$(a.albumPrice)}</span></div>)
          : order.albumType
            ? <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#334155",marginBottom:5}}><span>📚 {order.albumType}</span><span style={{fontWeight:600,color:BLUE}}>{fmt$(order.albumPrice)}</span></div>
            : null
        }
        {upgList.map(([id,qty])=>{
          const name=(order.upgradeNames||{})[id]||id;
          const price=(order.upgradePrices||{})[id]||0;
          return <div key={id} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#334155",marginBottom:5}}><span>✨ {name}{Number(qty)>1?` ×${qty}`:""}</span><span style={{fontWeight:600,color:AMBER}}>{fmt$(price*Number(qty))}</span></div>;
        })}
        {hasDiscount&&(
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:RED,marginTop:6,paddingTop:6,borderTop:"1px dashed #e2e8f0"}}>
            <span>🏷️ Discount ({order.discountType==="percent"?`${order.discountValue}%`:`$${order.discountValue}`})</span>
            <span style={{fontWeight:600}}>-{fmt$((Number(order.total)||0)-finalTotal)}</span>
          </div>
        )}
      </div>

      {/* Financials */}
      <div style={{display:"flex",gap:16,marginBottom:12,padding:"10px 14px",background:"#f8fafc",borderRadius:10,flexWrap:"wrap"}}>
        {[{label:"Total",val:fmt$(finalTotal),color:BLUE},{label:"Zno",val:fmt$(order.znoCost),color:AMBER},{label:"Profit",val:fmt$(profit),color:profit>=0?GREEN:RED},{label:"Paid",val:order.paid?"✓ Yes":"✗ No",color:order.paid?GREEN:RED}].map(({label,val,color})=>(
          <div key={label} style={{textAlign:"center"}}>
            <div style={{fontSize:15,fontWeight:800,color}}>{val}</div>
            <div style={{fontSize:10,color:"#94a3b8",marginTop:2,fontWeight:600}}>{label}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{borderTop:"1px solid #f1f5f9",paddingTop:10}}>
        <div style={{fontSize:11,color:"#94a3b8",marginBottom:8}}>
          📅 {fmtD(order.dateCreated)}{order.dateSentToZno&&` · Zno: ${fmtD(order.dateSentToZno)}`}
          {order.createdBy&&<div style={{marginTop:2}}>👤 Created by <strong>{order.createdBy}</strong>{order.createdAt&&` · ${fmtDateTime(order.createdAt)}`}</div>}
          {(order.editHistory||[]).map((e,i)=>(
            <div key={i} style={{marginTop:2,color:"#b0bec5"}}>✏️ <strong>{e.who}</strong> · {fmtDateTime(e.when)}{e.summary&&` · ${e.summary}`}</div>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
          <button onClick={()=>onEdit(order)} style={{padding:"6px 16px",borderRadius:8,border:`1.5px solid ${BLUE}`,background:"transparent",color:BLUE,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Edit</button>
          <button onClick={()=>onDelete(order)} style={{padding:"6px 16px",borderRadius:8,border:"none",background:RED,color:"white",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// EXPORT MODAL
// ══════════════════════════════════════════════════════════
function ExportModal({ orders, onClose, th }) {
  const [step,setStep]=useState(1); const [range,setRange]=useState(null);
  const rl=[["7","Last 7 Days","📅"],["30","Last 30 Days","🗓"],["year","This Year","📆"],["all","All Time","🗃"]];
  const getFilteredData=()=>{
    const now=new Date(); let data=orders;
    if(range==="7") data=orders.filter(o=>o.dateCreated>=new Date(now-7*864e5).toISOString().split("T")[0]);
    if(range==="30") data=orders.filter(o=>o.dateCreated>=new Date(now-30*864e5).toISOString().split("T")[0]);
    if(range==="year") data=orders.filter(o=>(o.dateCreated||"").startsWith(now.getFullYear().toString()));
    return data;
  };
  const doExcelExport=()=>{
    const data=getFilteredData();
    const headers=["Customer","Phone","Email","Albums","Date Created","Date Sent to Zno","Subtotal","Discount","Final Total","Zno","Profit","Paid","Payment","Status","Notes"];
    const rows=data.map(o=>{const names=(o.selectedAlbums||[{albumType:o.albumType}]).map(a=>a.albumType).filter(Boolean).join(", ");const ft=Number(o.finalTotal)||Number(o.total)||0;return[o.customerName,o.phone,o.email,names,o.dateCreated,o.dateSentToZno,o.total,ft<(o.total||0)?`-${fmt$((o.total||0)-ft)}`:"",ft,o.znoCost,ft-(Number(o.znoCost)||0),o.paid?"Yes":"No",o.paymentMethod,o.status,o.notes];});
    const csv=[headers,...rows].map(r=>r.map(c=>`"${(c||"").toString().replace(/"/g,'""')}"`).join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download=`LuxeBound_${todayStr()}.csv`;a.click();onClose();
  };
  const doPdfExport=()=>{
    const data=getFilteredData();
    const rangeLabel=rl.find(r=>r[0]===range)?.[1]||"All";
    const rows=data.map(o=>{const names=(o.selectedAlbums||[{albumType:o.albumType}]).map(a=>a.albumType).filter(Boolean).join(", ");const ft=Number(o.finalTotal)||Number(o.total)||0;const profit=ft-(Number(o.znoCost)||0);return`<tr><td>${o.customerName||""}</td><td>${o.phone||""}</td><td>${names}</td><td>${fmtD(o.dateCreated)}</td><td style="color:#5271FF;font-weight:700">${fmt$(ft)}</td><td style="color:#f59e0b">${fmt$(o.znoCost)}</td><td style="color:${profit>=0?"#18B978":"#ef4444"};font-weight:700">${fmt$(profit)}</td><td style="color:${o.paid?"#18B978":"#ef4444"}">${o.paid?"✓ Paid":"✗ Unpaid"}</td><td>${o.status||""}</td></tr>`;}).join("");
    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>LuxeBound Export</title><style>body{font-family:system-ui,sans-serif;padding:24px;color:#0f172a}h1{color:#0f1f4b;font-size:22px;margin-bottom:4px}p{color:#64748b;margin-bottom:20px;font-size:13px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#0f1f4b;color:white;padding:8px 10px;text-align:left;font-weight:600}td{padding:7px 10px;border-bottom:1px solid #e2e8f0}tr:nth-child(even){background:#f8fafc}@media print{body{padding:10px}}</style></head><body><h1>LuxeBound Albums — Order Report</h1><p>${rangeLabel} · ${data.length} orders · Exported ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</p><table><thead><tr><th>Customer</th><th>Phone</th><th>Albums</th><th>Date</th><th>Total</th><th>Zno</th><th>Profit</th><th>Paid</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
    const w=window.open("","_blank");w.document.write(html);w.document.close();setTimeout(()=>w.print(),400);onClose();
  };
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:th.card,borderRadius:20,padding:24,width:"100%",maxWidth:460,boxShadow:"0 20px 60px rgba(0,0,0,.3)",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><div style={{fontWeight:700,fontSize:18,color:th.text}}>📊 Export Orders</div><button onClick={onClose} style={{background:"none",border:"none",fontSize:24,cursor:"pointer",color:th.subtext,padding:0,lineHeight:1}}>×</button></div>
        {step===1&&(<><div style={{fontSize:14,color:th.subtext,marginBottom:14}}>Select time range:</div><div style={{display:"flex",flexDirection:"column",gap:10}}>{rl.map(([v,l,i])=><button key={v} onClick={()=>{setRange(v);setStep(2);}} style={{padding:"14px 18px",borderRadius:12,border:`1.5px solid ${th.border}`,background:th.inp,color:th.text,cursor:"pointer",textAlign:"left",fontSize:14,fontWeight:600,fontFamily:"system-ui,sans-serif",display:"flex",alignItems:"center",gap:12}}><span style={{fontSize:20}}>{i}</span><span>{l}</span></button>)}</div></>)}
        {step===2&&(<><div style={{fontSize:14,color:th.subtext,marginBottom:16}}>Range: <strong style={{color:th.text}}>{rl.find(r=>r[0]===range)?.[1]}</strong> · Choose format:</div><div style={{display:"flex",flexDirection:"column",gap:12}}><button onClick={doExcelExport} style={{padding:"16px 18px",borderRadius:12,border:"1.5px solid #16a34a",background:"#f0fdf4",color:"#15803d",cursor:"pointer",textAlign:"left",fontSize:15,fontWeight:700,fontFamily:"system-ui,sans-serif",display:"flex",alignItems:"center",gap:14}}><span style={{fontSize:26}}>📗</span><div><div>Excel / CSV</div><div style={{fontSize:11,fontWeight:400,marginTop:3,color:"#16a34a"}}>Open in Excel or Google Sheets</div></div></button><button onClick={doPdfExport} style={{padding:"16px 18px",borderRadius:12,border:"1.5px solid #dc2626",background:"#fef2f2",color:"#dc2626",cursor:"pointer",textAlign:"left",fontSize:15,fontWeight:700,fontFamily:"system-ui,sans-serif",display:"flex",alignItems:"center",gap:14}}><span style={{fontSize:26}}>📕</span><div><div>PDF</div><div style={{fontSize:11,fontWeight:400,marginTop:3,color:"#dc2626"}}>Opens print dialog — save as PDF</div></div></button><button onClick={()=>setStep(1)} style={{padding:"10px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"white",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>← Back</button></div></>)}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// DASHBOARD  (V4)
// ══════════════════════════════════════════════════════════
function Dashboard({ orders,albums,statusFilter,setStatusFilter,onNew,onEdit,onDelete,onPin,onSnooze,onSettings,onSignOut,showExport,setShowExport,currentUser,onBulkStatus,th }) {
  const [filters,setFilters]=useState({search:"",album:"",paid:"",vip:false,priority:false,pinned:false});
  const [ordersOpen,setOrdersOpen]=useState(false);
  const [selectMode,setSelectMode]=useState(false);
  const [selected,setSelected]=useState([]);
  const [bulkStatus,setBulkStatus]=useState("");

  const filtered=orders.filter(o=>{
    if(statusFilter&&o.status!==statusFilter) return false;
    if(filters.album){const names=(o.selectedAlbums||[{albumType:o.albumType}]).map(a=>a.albumType);if(!names.includes(filters.album))return false;}
    if(filters.search){const q=filters.search.toLowerCase();if(!((o.customerName||"").toLowerCase().includes(q)||(o.phone||"").includes(q)))return false;}
    if(filters.paid==="paid"&&!o.paid) return false;
    if(filters.paid==="unpaid"&&o.paid) return false;
    if(filters.vip&&!o.vip) return false;
    if(filters.priority&&!o.priority) return false;
    if(filters.pinned&&!o.pinned) return false;
    return true;
  });

  // Pinned first, then newest first by dateCreated
  const sorted=[...filtered].sort((a,b)=>{
    if(a.pinned&&!b.pinned) return -1;
    if(!a.pinned&&b.pinned) return 1;
    return (b.dateCreated||"").localeCompare(a.dateCreated||"");
  });

  const clearFilters=()=>{setFilters({search:"",album:"",paid:"",vip:false,priority:false,pinned:false});setStatusFilter(null);};
  const toggleSelect=id=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const applyBulk=()=>{if(bulkStatus&&selected.length){onBulkStatus(selected,bulkStatus);setSelected([]);setSelectMode(false);setBulkStatus("");}};

  const displayName=currentUser?.displayName||currentUser?.email?.split("@")[0]||"User";
  const dateStr=new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});

  return(
    <div style={{background:"linear-gradient(160deg,#e8eeff 0%,#f0f7ff 40%,#e8f5ff 100%)",minHeight:"100vh",fontFamily:"system-ui,sans-serif"}}>
      {/* Top Bar */}
      <div style={{background:NAVY,padding:"0 24px",height:68,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 20px rgba(0,0,0,0.25)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <Avatar user={currentUser} size={42} onClick={onSettings}/>
          <div>
            <div style={{fontWeight:700,fontSize:16,color:"white",lineHeight:1.2}}>Hi, {displayName} 👋</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.55)",marginTop:1}}>{dateStr}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <Btn variant="success" sm onClick={onNew} style={{padding:"8px 18px",fontSize:13}}>+ New Order</Btn>
          <Btn variant="ghost" sm onClick={()=>setShowExport(true)} style={{padding:"8px 18px",fontSize:13}}>📊 Export</Btn>
          <Btn variant="ghost" sm onClick={onSettings} style={{padding:"8px 18px",fontSize:13}}>⚙️</Btn>
          <Btn variant="ghost" sm onClick={onSignOut} style={{padding:"8px 18px",fontSize:13}}>Sign Out</Btn>
        </div>
      </div>

      <div style={{padding:"28px 32px",maxWidth:1200,margin:"0 auto"}}>
        <StatCards orders={orders}/>
        <Pipeline orders={orders} statusFilter={statusFilter} setStatusFilter={setStatusFilter}/>
        <FlagsSection orders={orders} onEdit={onEdit} onSnooze={onSnooze}/>

        {/* Collapsible Orders List */}
        <div style={{background:"white",borderRadius:16,boxShadow:"0 4px 16px rgba(0,0,0,0.06)"}}>
          {/* Header */}
          <div style={{padding:"16px 22px",borderBottom:ordersOpen?"1px solid #f1f5f9":"none",display:"flex",justifyContent:"space-between",alignItems:"center",borderRadius:ordersOpen?"16px 16px 0 0":"16px"}}>
            <button onClick={()=>{setOrdersOpen(o=>!o);setSelectMode(false);setSelected([]);}} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontWeight:700,fontSize:15,color:"#0f172a",fontFamily:"system-ui,sans-serif",padding:0}}>
              <span style={{fontSize:16,transition:"transform .2s",display:"inline-block",transform:ordersOpen?"rotate(0deg)":"rotate(-90deg)"}}>▼</span>
              All Orders <span style={{fontWeight:400,color:"#94a3b8",fontSize:13}}>({filtered.length})</span>
            </button>
            {ordersOpen&&(
              <button onClick={()=>{setSelectMode(s=>!s);setSelected([]);setBulkStatus("");}} style={{padding:"6px 14px",borderRadius:8,border:`1.5px solid ${selectMode?BLUE:"#e2e8f0"}`,background:selectMode?"#eff2ff":"white",color:selectMode?BLUE:"#64748b",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>
                {selectMode?"✕ Cancel":"☑ Select Orders"}
              </button>
            )}
          </div>

          {ordersOpen&&(
            <div style={{padding:"16px 22px"}}>
              <Filters filters={filters} setFilters={setFilters} albums={albums} th={th} onClear={clearFilters} statusFilter={statusFilter} setStatusFilter={setStatusFilter}/>

              {/* Bulk status bar */}
              {selectMode&&selected.length>0&&(
                <div style={{background:NAVY,borderRadius:10,padding:"10px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                  <span style={{color:"white",fontSize:13,fontWeight:600,whiteSpace:"nowrap"}}>{selected.length} selected</span>
                  <select value={bulkStatus} onChange={e=>setBulkStatus(e.target.value)} style={{padding:"7px 10px",borderRadius:8,border:"none",fontSize:13,fontFamily:"system-ui,sans-serif",flex:1,minWidth:140,outline:"none"}}>
                    <option value="">Change status to…</option>
                    {STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={applyBulk} disabled={!bulkStatus} style={{padding:"8px 18px",borderRadius:8,border:"none",background:bulkStatus?GREEN:"#94a3b8",color:"white",cursor:bulkStatus?"pointer":"not-allowed",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif",whiteSpace:"nowrap"}}>Apply</button>
                </div>
              )}

              {sorted.length===0
                ?<div style={{textAlign:"center",padding:"40px 20px",color:"#94a3b8",fontSize:15}}>No orders match your filters. <span style={{color:BLUE,cursor:"pointer",fontWeight:600}} onClick={clearFilters}>Clear filters →</span></div>
                :sorted.map(o=>(
                  <div key={o.id} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                    {selectMode&&(
                      <input type="checkbox" checked={selected.includes(o.id)} onChange={()=>toggleSelect(o.id)} style={{marginTop:20,width:18,height:18,accentColor:BLUE,flexShrink:0,cursor:"pointer"}}/>
                    )}
                    <div style={{flex:1}}>
                      <OrderCard order={o} onEdit={onEdit} onDelete={onDelete} onPin={onPin}/>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>
      {showExport&&<ExportModal orders={orders} onClose={()=>setShowExport(false)} th={th}/>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ORDER FORM  (V4)
// ══════════════════════════════════════════════════════════
function AlbumRow({ albums, entry, onChange, onRemove, canRemove, th }) {
  return(
    <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:10,background:"#f8fafc",borderRadius:10,padding:"10px 14px",border:"1px solid #e8ecf0"}}>
      <select value={entry.albumType||""} onChange={e=>{const a=albums.find(a=>a.name===e.target.value);onChange({...entry,albumType:e.target.value,albumPrice:a?a.price:0});}} style={{...iStyle({border:"#e2e8f0",inp:"white",text:"#0f172a"}),flex:2,fontSize:13}}>
        <option value="">Select album…</option>
        {albums.map(a=><option key={a.id} value={a.name}>{a.name} — ${a.price}</option>)}
      </select>
      <div style={{fontWeight:700,color:BLUE,minWidth:55,textAlign:"right",fontSize:13}}>{fmt$(entry.albumPrice||0)}</div>
      {canRemove&&<button onClick={onRemove} style={{background:"none",border:"none",color:RED,cursor:"pointer",fontSize:20,padding:"0 4px",lineHeight:1}}>×</button>}
    </div>
  );
}

function SmartReminder({ order, th }) {
  const [type,setType]=useState(null); // null | "email" | "text"
  const [copied,setCopied]=useState(false);
  const name=order?.customerName||"there";
  const tpl=REMINDER[order?.status]||REMINDER["New Order"];
  const fill=s=>s.replace(/\{name\}/g,name.split(" ")[0]);
  const copy=(txt)=>{navigator.clipboard?.writeText(txt).catch(()=>{});setCopied(true);setTimeout(()=>setCopied(false),2000);};

  if(!type) return(
    <div style={{background:"#f8fafc",borderRadius:10,padding:"12px 14px",border:"1px solid #e8ecf0"}}>
      <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.6px"}}>💌 Smart Reminder</div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>setType("email")} style={{flex:1,padding:"9px",borderRadius:8,border:`1.5px solid ${BLUE}`,background:"#eff2ff",color:BLUE,cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>📧 Email</button>
        <button onClick={()=>setType("text")} style={{flex:1,padding:"9px",borderRadius:8,border:`1.5px solid ${GREEN}`,background:"#f0fdf4",color:GREEN,cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>💬 Text</button>
      </div>
    </div>
  );

  const isEmail=type==="email";
  const content=isEmail?fill(tpl.email):fill(tpl.text);
  const subject=isEmail?tpl.subject:"";

  return(
    <div style={{background:"#f8fafc",borderRadius:10,padding:"14px 16px",border:`1.5px solid ${isEmail?BLUE:GREEN}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:12,fontWeight:700,color:isEmail?BLUE:GREEN}}>{isEmail?"📧 Email Reminder":"💬 Text Reminder"}</div>
        <button onClick={()=>{setType(null);setCopied(false);}} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:18,padding:0,lineHeight:1}}>×</button>
      </div>
      {isEmail&&<div style={{fontSize:12,color:"#64748b",marginBottom:6,background:"white",padding:"8px 10px",borderRadius:6,border:"1px solid #e2e8f0"}}><strong>Subject:</strong> {subject}</div>}
      <div style={{background:"white",borderRadius:8,padding:"10px 12px",fontSize:13,color:"#334155",lineHeight:1.6,whiteSpace:"pre-wrap",border:"1px solid #e2e8f0",marginBottom:10,maxHeight:160,overflowY:"auto"}}>{content}</div>
      <button onClick={()=>copy(isEmail?`Subject: ${subject}\n\n${content}`:content)} style={{width:"100%",padding:"9px",borderRadius:8,border:"none",background:copied?"#16a34a":isEmail?BLUE:GREEN,color:"white",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif",transition:"background .2s"}}>{copied?"✅ Copied!":"📋 Copy"}</button>
    </div>
  );
}

function OrderForm({ order, albums, upgrades, paymentMethods, onSave, onCancel, onDelete, currentUser, customers, onSaveCustomer, th }) {
  const isEdit=!!order?.id;
  const [customerName,setCustomerName]=useState(order?.customerName||"");
  const [phone,setPhone]=useState(order?.phone||"");
  const [email,setEmail]=useState(order?.email||"");
  const [dateCreated,setDateCreated]=useState(order?.dateCreated||todayStr());
  const [deadline,setDeadline]=useState(order?.deadline||"");
  const [priority,setPriority]=useState(order?.priority||false);
  const [vip,setVip]=useState(order?.vip||false);
  const [custNote,setCustNote]=useState(order?.custNote||"");
  const [manualFlag,setManualFlag]=useState(order?.manualFlag||"");
  const [manualFlagNote,setManualFlagNote]=useState(order?.manualFlagNote||"");
  const [nameAC,setNameAC]=useState([]); // autocomplete suggestions

  const initAlbums=order?.selectedAlbums||(order?.albumType?[{id:uid(),albumType:order.albumType,albumPrice:order.albumPrice||0}]:[{id:uid(),albumType:"",albumPrice:0}]);
  const [selAlbums,setSelAlbums]=useState(initAlbums);
  const [selUpg,setSelUpg]=useState(order?.selectedUpgrades||{});
  const [znoCost,setZnoCost]=useState(order?.znoCost??"");
  const [dateSentZno,setDateSentZno]=useState(order?.dateSentToZno||"");
  const [discType,setDiscType]=useState(order?.discountType||"amount");
  const [discVal,setDiscVal]=useState(order?.discountValue||"");
  const [payment,setPayment]=useState(order?.paymentMethod||"");
  const [paid,setPaid]=useState(order?.paid||false);
  const [status,setStatus]=useState(order?.status||"New Order");
  const [notes,setNotes]=useState(order?.notes||"");
  const [err,setErr]=useState(""); const [saving,setSaving]=useState(false);
  const inp=iStyle(th);
  const sec={background:"white",borderRadius:14,padding:20,marginBottom:14,border:"1px solid #e8ecf0",boxShadow:"0 2px 8px rgba(0,0,0,0.05)"};

  // Auto-fill from customer database
  const handleNameChange=(val)=>{
    setCustomerName(val);
    if(val.length>1){
      const matches=(customers||[]).filter(c=>c.name.toLowerCase().startsWith(val.toLowerCase())).slice(0,5);
      setNameAC(matches);
    } else { setNameAC([]); }
  };
  const fillFromCustomer=(c)=>{
    setCustomerName(c.name);
    if(c.phone) setPhone(c.phone);
    if(c.email) setEmail(c.email);
    if(c.vip) setVip(true);
    if(c.note) setCustNote(c.note);
    setNameAC([]);
  };

  // Pre-fill customer note and VIP if we find a match
  useEffect(()=>{
    if(!isEdit) return;
    const match=(customers||[]).find(c=>c.name.toLowerCase()===customerName.toLowerCase());
    if(match) { if(match.vip&&!vip) setVip(true); if(match.note&&!custNote) setCustNote(match.note); }
  },[]);

  const handleStatus=(s)=>{
    // Block Order Done if not paid
    if(s==="Order Done"&&!paid){setErr('Please mark order as Paid before setting it to "Order Done".');return;}
    setErr("");
    setStatus(s);
    if(s==="Ordered"&&!dateSentZno) setDateSentZno(todayStr());
  };

  const albumsTotal=selAlbums.reduce((s,a)=>s+(Number(a.albumPrice)||0),0);
  const upgTotal=upgrades.reduce((s,u)=>{const q=Number(selUpg[u.id]||0);return s+(q>0?u.price*q:0);},0);
  const subtotal=albumsTotal+upgTotal;
  const discAmt=discVal?(discType==="percent"?subtotal*(Number(discVal)||0)/100:Number(discVal)||0):0;
  const finalTotal=Math.max(0,subtotal-discAmt);
  const profit=finalTotal-(Number(znoCost)||0);

  const handleSave=async()=>{
    if(!customerName.trim()){setErr("Customer name is required.");return;}
    if(!phone.trim()){setErr("Phone number is required.");return;}
    if(status==="Order Done"&&!paid){setErr('Please mark order as Paid before setting it to "Order Done".');return;}
    setSaving(true);setErr("");
    try{
      const upgradeNames={};const upgradePrices={};
      upgrades.forEach(u=>{upgradeNames[u.id]=u.name;upgradePrices[u.id]=u.price;});
      const creatorName=currentUser?.displayName||currentUser?.email||"Unknown";
      // Build edit diff
      const editHistory=isEdit?(order.editHistory||[]):[]; 
      if(isEdit){const diff=buildDiff(order,{status,paid,notes,finalTotal,deadline,priority,customerName:customerName.trim()},creatorName);if(diff)editHistory.push(diff);}
      const data=clean({
        customerName:customerName.trim(),phone,email,dateCreated,
        deadline:deadline||"",priority,vip,custNote:custNote||"",
        manualFlag:manualFlag||"",manualFlagNote:manualFlagNote||"",
        selectedAlbums:selAlbums,albumType:selAlbums[0]?.albumType||"",albumPrice:selAlbums[0]?.albumPrice||0,
        selectedUpgrades:selUpg,upgradeNames,upgradePrices,
        total:subtotal,discountType:discType,discountValue:Number(discVal)||0,finalTotal,
        znoCost:Number(znoCost)||0,dateSentToZno:dateSentZno||"",
        paymentMethod:payment,paid,status,notes:notes||"",
        createdBy:isEdit?(order.createdBy||creatorName):creatorName,
        createdAt:isEdit?(order.createdAt||new Date().toISOString()):new Date().toISOString(),
        editHistory,
        statusChangedAt:isEdit&&status!==order?.status?new Date().toISOString():(order?.statusChangedAt||new Date().toISOString()),
      });
      // Save/update customer in customer DB
      if(onSaveCustomer&&customerName.trim()){
        const existing=(customers||[]).find(c=>c.name.toLowerCase()===customerName.trim().toLowerCase());
        if(!existing){
          onSaveCustomer({id:uid(),name:customerName.trim(),phone,email,vip,note:custNote||"",orderCount:(existing?.orderCount||0)+1,lastOrder:dateCreated});
        } else {
          onSaveCustomer({...existing,phone:phone||existing.phone,email:email||existing.email,vip:vip||existing.vip,note:custNote||existing.note,orderCount:(existing.orderCount||0)+(isEdit?0:1),lastOrder:dateCreated});
        }
      }
      await onSave({id:order?.id,...data});
    } catch(e){console.error(e);setErr("Failed to save: "+(e.message||"Please try again."));setSaving(false);}
  };

  return(
    <div style={{background:"linear-gradient(160deg,#e8eeff 0%,#f0f7ff 100%)",minHeight:"100vh",fontFamily:"system-ui,sans-serif"}}>
      <NavBar title={isEdit?"✏️ Edit Order":"📝 New Order"} onBack={onCancel}/>
      <div style={{padding:"24px 28px",maxWidth:700,margin:"0 auto"}}>

        {/* Customer */}
        <div style={sec}>
          <div style={{fontWeight:700,fontSize:15,color:"#0f172a",marginBottom:14,paddingBottom:10,borderBottom:"1px solid #f1f5f9"}}>👤 Customer Info</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Full Name" required style={{gridColumn:"1/-1",position:"relative"}}>
              <input value={customerName} onChange={e=>handleNameChange(e.target.value)} placeholder="Full name" style={inp}/>
              {nameAC.length>0&&(
                <div style={{position:"absolute",top:"100%",left:0,right:0,background:"white",border:"1.5px solid #e2e8f0",borderRadius:10,zIndex:50,boxShadow:"0 8px 24px rgba(0,0,0,0.12)",marginTop:2}}>
                  {nameAC.map(c=>(
                    <div key={c.id} onClick={()=>fillFromCustomer(c)} style={{padding:"10px 14px",cursor:"pointer",fontSize:13,color:"#0f172a",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span><strong>{c.name}</strong> · {c.phone}</span>
                      <span style={{display:"flex",gap:4}}>{c.vip&&<span style={{fontSize:10,background:"#fdf4ff",color:"#7e22ce",padding:"2px 6px",borderRadius:20}}>⭐ VIP</span>}{c.note&&<span style={{fontSize:10,background:"#fff7ed",color:"#ea580c",padding:"2px 6px",borderRadius:20}}>📝 Note</span>}</span>
                    </div>
                  ))}
                </div>
              )}
            </Field>
            <Field label="Phone Number" required>
              <input value={phone} onChange={e=>setPhone(fmtPhone(e.target.value))} placeholder="(718) 111-1111" maxLength={14} style={inp} inputMode="numeric"/>
            </Field>
            <Field label="Email">
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@example.com" style={inp}/>
            </Field>
            <Field label="Date Created" style={{gridColumn:"1/-1"}}>
              <input type="date" value={dateCreated} onChange={e=>setDateCreated(e.target.value)} style={inp}/>
            </Field>
            {/* VIP + Priority toggles */}
            <div style={{gridColumn:"1/-1",display:"flex",gap:12,flexWrap:"wrap"}}>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:"#475569",fontFamily:"system-ui,sans-serif",background:vip?"#fdf4ff":"#f8fafc",padding:"8px 14px",borderRadius:8,border:`1.5px solid ${vip?"#c084fc":"#e2e8f0"}`}}>
                <input type="checkbox" checked={vip} onChange={e=>setVip(e.target.checked)} style={{accentColor:"#8b5cf6",width:16,height:16}}/>
                ⭐ VIP Customer
              </label>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:"#475569",fontFamily:"system-ui,sans-serif",background:priority?"#fffbeb":"#f8fafc",padding:"8px 14px",borderRadius:8,border:`1.5px solid ${priority?"#f59e0b":"#e2e8f0"}`}}>
                <input type="checkbox" checked={priority} onChange={e=>setPriority(e.target.checked)} style={{accentColor:AMBER,width:16,height:16}}/>
                ⚡ Priority Order
              </label>
            </div>
            {custNote&&<div style={{gridColumn:"1/-1",background:"#fff7ed",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#92400e",border:"1px solid #fed7aa"}}>📝 Customer Note: {custNote}</div>}
          </div>
        </div>

        {/* Albums */}
        <div style={sec}>
          <div style={{fontWeight:700,fontSize:15,color:"#0f172a",marginBottom:14,paddingBottom:10,borderBottom:"1px solid #f1f5f9"}}>📚 Albums</div>
          {selAlbums.map((entry,i)=>(
            <AlbumRow key={entry.id||i} albums={albums} entry={entry} onChange={upd=>setSelAlbums(prev=>prev.map((a,idx)=>idx===i?upd:a))} onRemove={()=>setSelAlbums(prev=>prev.filter((_,idx)=>idx!==i))} canRemove={selAlbums.length>1} th={th}/>
          ))}
          <button onClick={()=>setSelAlbums(prev=>[...prev,{id:uid(),albumType:"",albumPrice:0}])} style={{padding:"8px 18px",borderRadius:8,border:`1.5px dashed ${BLUE}`,background:"#eff2ff",color:BLUE,cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif",marginTop:4}}>+ Add Another Album</button>
        </div>

        {/* Add-ons */}
        <div style={sec}>
          <div style={{fontWeight:700,fontSize:15,color:"#0f172a",marginBottom:14,paddingBottom:10,borderBottom:"1px solid #f1f5f9"}}>✨ Add-ons</div>
          {upgrades.map(u=>{
            const checked=(selUpg[u.id]||0)>0;
            return(
              <div key={u.id} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10,padding:"10px 14px",borderRadius:10,background:checked?"#eff2ff":"#f8fafc",border:`1.5px solid ${checked?BLUE+"55":"#e2e8f0"}`}}>
                <input type="checkbox" checked={checked} onChange={e=>setSelUpg(p=>({...p,[u.id]:e.target.checked?1:0}))} style={{width:17,height:17,cursor:"pointer",accentColor:BLUE}}/>
                <div style={{flex:1,fontSize:14,color:"#0f172a",fontWeight:checked?600:400}}>{u.name}<span style={{color:"#94a3b8",fontWeight:400}}> · +${u.price}</span></div>
                {checked&&<input type="number" min={1} value={selUpg[u.id]||1} onChange={e=>setSelUpg(p=>({...p,[u.id]:Number(e.target.value)||0}))} style={{...inp,width:64,textAlign:"center",padding:"6px 8px",fontSize:13}}/>}
              </div>
            );
          })}
        </div>

        {/* Discount */}
        <div style={sec}>
          <div style={{fontWeight:700,fontSize:15,color:"#0f172a",marginBottom:14,paddingBottom:10,borderBottom:"1px solid #f1f5f9"}}>🏷️ Discount (Optional)</div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:"1.5px solid #e2e8f0",flexShrink:0}}>
              {["amount","percent"].map(t=>(
                <button key={t} onClick={()=>setDiscType(t)} style={{padding:"8px 16px",border:"none",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif",background:discType===t?BLUE:"white",color:discType===t?"white":"#64748b",transition:"all .15s"}}>{t==="amount"?"$ Amount":"% Percent"}</button>
              ))}
            </div>
            <input type="number" value={discVal} onChange={e=>setDiscVal(e.target.value)} placeholder={discType==="amount"?"e.g. 100":"e.g. 10"} style={{...inp,flex:1}}/>
            {discVal>0&&<div style={{fontSize:14,fontWeight:700,color:RED,whiteSpace:"nowrap"}}>-{fmt$(discAmt)}</div>}
          </div>
        </div>

        {/* Order Summary */}
        {(selAlbums.some(a=>a.albumType)||Object.values(selUpg).some(q=>q>0))&&(
          <div style={{background:"#f8fafc",borderRadius:14,padding:"14px 18px",marginBottom:14,border:"1px solid #e8ecf0"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:12}}>🧾 Order Summary</div>
            {selAlbums.filter(a=>a.albumType).map((a,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:14,color:"#334155",marginBottom:7}}><span>📚 {a.albumType}</span><span style={{fontWeight:600,color:BLUE}}>{fmt$(a.albumPrice)}</span></div>)}
            {upgrades.filter(u=>(selUpg[u.id]||0)>0).map(u=><div key={u.id} style={{display:"flex",justifyContent:"space-between",fontSize:14,color:"#334155",marginBottom:7}}><span>✨ {u.name}{Number(selUpg[u.id])>1?` ×${selUpg[u.id]}`:""}</span><span style={{fontWeight:600,color:AMBER}}>{fmt$(u.price*Number(selUpg[u.id]))}</span></div>)}
            {discAmt>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:14,color:RED,marginTop:8,paddingTop:8,borderTop:"1px dashed #e2e8f0"}}><span>🏷️ Discount ({discType==="percent"?`${discVal}%`:`$${discVal}`})</span><span style={{fontWeight:600}}>-{fmt$(discAmt)}</span></div>}
            <div style={{display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:700,color:"#0f172a",marginTop:10,paddingTop:10,borderTop:"2px solid #e2e8f0"}}>
              <span>{selAlbums.filter(a=>a.albumType).length+Object.values(selUpg).filter(q=>q>0).length} item(s)</span>
              <span style={{color:BLUE}}>{fmt$(finalTotal)}</span>
            </div>
          </div>
        )}

        {/* Totals Strip */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:14}}>
          {[
            {label:"Customer Total",val:fmt$(finalTotal),color:BLUE,bg:"linear-gradient(135deg,#eff2ff,#e8ecff)",edit:false},
            {label:"Zno Cost",color:AMBER,bg:"linear-gradient(135deg,#fffbeb,#fef3c7)",edit:true},
            {label:"Your Profit",val:fmt$(profit),color:profit>=0?GREEN:RED,bg:profit>=0?"linear-gradient(135deg,#f0fdf4,#dcfce7)":"linear-gradient(135deg,#fef2f2,#fecaca)",edit:false},
          ].map(item=>(
            <div key={item.label} style={{background:item.bg,borderRadius:14,padding:"16px 12px",textAlign:"center",border:`2px solid ${item.color}22`}}>
              <div style={{fontSize:10,color:item.color,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:8}}>{item.label}</div>
              {item.edit?<input type="number" value={znoCost} onChange={e=>setZnoCost(e.target.value)} placeholder="0.00" style={{width:"100%",border:"none",background:"transparent",textAlign:"center",fontSize:18,fontWeight:800,color:AMBER,outline:"none",fontFamily:"system-ui,sans-serif"}}/>:<div style={{fontSize:18,fontWeight:800,color:item.color}}>{item.val}</div>}
            </div>
          ))}
        </div>

        {(znoCost!==""||dateSentZno||STATUSES.indexOf(status)>=STATUSES.indexOf("Ordered"))&&(
          <div style={{...sec,marginBottom:14}}><Field label="Date Sent to Zno"><input type="date" value={dateSentZno} onChange={e=>setDateSentZno(e.target.value)} style={inp}/></Field></div>
        )}

        {/* Deadline */}
        <div style={sec}>
          <Field label="Order Deadline (Optional)">
            <input type="date" value={deadline} onChange={e=>setDeadline(e.target.value)} style={inp}/>
          </Field>
        </div>

        {/* Payment & Status */}
        <div style={sec}>
          <div style={{fontWeight:700,fontSize:15,color:"#0f172a",marginBottom:14,paddingBottom:10,borderBottom:"1px solid #f1f5f9"}}>💳 Payment & Status</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12,marginBottom:16}}>
            <Field label="Payment Method">
              <select value={payment} onChange={e=>setPayment(e.target.value)} style={inp}>
                <option value="">Select…</option>
                {paymentMethods.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label=" ">
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:14,color:"#0f172a",fontWeight:600,padding:"10px 0",whiteSpace:"nowrap"}}>
                <input type="checkbox" checked={paid} onChange={e=>setPaid(e.target.checked)} style={{width:18,height:18,accentColor:GREEN}}/>
                ✅ Paid
              </label>
            </Field>
          </div>
          <Field label="Status">
            <div style={{display:"flex",flexWrap:"wrap",gap:7,marginTop:4}}>
              {STATUSES.map(s=>{
                const isDoneBlock=s==="Order Done"&&!paid;
                return(
                  <button key={s} onClick={()=>handleStatus(s)} title={isDoneBlock?"Mark as Paid first":undefined} style={{padding:"6px 12px",borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"system-ui,sans-serif",background:status===s?BLUE:isDoneBlock?"#f1f5f9":"#f1f5f9",color:status===s?"white":isDoneBlock?"#cbd5e1":"#475569",border:`1.5px solid ${status===s?BLUE:"transparent"}`,opacity:isDoneBlock?.6:1}}>{s}</button>
                );
              })}
            </div>
          </Field>
        </div>

        {/* Notes */}
        <div style={sec}>
          <Field label="Notes"><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any additional notes…" rows={3} style={{...inp,resize:"vertical"}}/></Field>
        </div>

        {/* Manual Flag */}
        <div style={sec}>
          <div style={{fontWeight:700,fontSize:15,color:"#0f172a",marginBottom:14,paddingBottom:10,borderBottom:"1px solid #f1f5f9"}}>🚩 Flag This Order</div>
          <div style={{display:"flex",gap:8,marginBottom:manualFlag?12:0,flexWrap:"wrap"}}>
            {[["","No Flag","#64748b","#f1f5f9","#e2e8f0"],["red","🔴 Red","#dc2626","#fef2f2","#fecaca"],["orange","🟠 Orange","#ea580c","#fff7ed","#fed7aa"],["yellow","🟡 Yellow","#ca8a04","#fefce8","#fef08a"]].map(([val,label,color,bg,border])=>(
              <button key={val} onClick={()=>{setManualFlag(val);if(!val)setManualFlagNote("");}}
                style={{padding:"8px 16px",borderRadius:20,border:`2px solid ${manualFlag===val?color:border}`,background:manualFlag===val?bg:"white",color:manualFlag===val?color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:manualFlag===val?700:500,fontFamily:"system-ui,sans-serif",transition:"all .15s"}}>
                {label}
              </button>
            ))}
          </div>
          {manualFlag&&(
            <input value={manualFlagNote} onChange={e=>setManualFlagNote(e.target.value)} placeholder="Reason for flag (optional)…" style={{...inp,fontSize:13}}/>
          )}
        </div>

        {/* Smart Reminder — only in edit form */}
        {isEdit&&(
          <div style={{marginBottom:14}}>
            <SmartReminder order={{...order,customerName,status}} th={th}/>
          </div>
        )}

        {err&&<div style={{color:RED,fontSize:13,marginBottom:14,padding:"10px 14px",background:"#fef2f2",borderRadius:10,border:"1px solid #fecaca"}}>{err}</div>}

        {/* Buttons */}
        <div style={{display:"flex",gap:12,alignItems:"stretch",paddingBottom:48}}>
          <button onClick={onCancel} style={{flex:1,padding:"14px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"white",color:"#64748b",cursor:"pointer",fontSize:14,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{flex:2,padding:"14px",borderRadius:10,border:"none",background:saving?"#94a3b8":`linear-gradient(135deg,${GREEN},#34d399)`,color:"white",cursor:saving?"not-allowed":"pointer",fontSize:15,fontWeight:700,fontFamily:"system-ui,sans-serif",boxShadow:saving?"none":"0 4px 14px rgba(24,185,120,0.4)"}}>
            {saving?"Saving…":isEdit?"💾 Save Changes":"✅ Create Order"}
          </button>
          {isEdit&&onDelete&&<button onClick={()=>onDelete(order)} style={{flex:1,padding:"14px",borderRadius:10,border:"none",background:RED,color:"white",cursor:"pointer",fontSize:14,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>🗑️ Delete</button>}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// SETTINGS TABS
// ══════════════════════════════════════════════════════════
function ListEditor({ items,onSave,th,placeholder="Name" }) {
  const [list,setList]=useState(items.map(i=>({...i})));
  const [nName,setNN]=useState(""); const [nPrice,setNP]=useState("");
  const [dragIdx,setDragIdx]=useState(null); const [overIdx,setOverIdx]=useState(null);
  const inp=iStyle(th);
  const update=u=>{setList(u);onSave(u);};
  const add=()=>{if(!nName.trim())return;update([...list,{id:uid(),name:nName.trim(),price:Number(nPrice)||0}]);setNN("");setNP("");};
  const remove=id=>update(list.filter(i=>i.id!==id));
  const change=(id,f,v)=>update(list.map(i=>i.id===id?{...i,[f]:f==="price"?Number(v)||0:v}:i));
  const moveUp=idx=>{if(idx===0)return;const u=[...list];[u[idx-1],u[idx]]=[u[idx],u[idx-1]];update(u);};
  const moveDown=idx=>{if(idx===list.length-1)return;const u=[...list];[u[idx],u[idx+1]]=[u[idx+1],u[idx]];update(u);};
  const onDragStart=idx=>setDragIdx(idx);
  const onDragOver=(e,idx)=>{e.preventDefault();setOverIdx(idx);};
  const onDrop=idx=>{if(dragIdx===null||dragIdx===idx){setDragIdx(null);setOverIdx(null);return;}const u=[...list];const[moved]=u.splice(dragIdx,1);u.splice(idx,0,moved);update(u);setDragIdx(null);setOverIdx(null);};
  return(
    <div>
      {list.map((item,idx)=>(
        <div key={item.id} draggable onDragStart={()=>onDragStart(idx)} onDragOver={e=>onDragOver(e,idx)} onDrop={()=>onDrop(idx)} onDragEnd={()=>{setDragIdx(null);setOverIdx(null);}} style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,background:th.card,borderRadius:10,padding:12,border:`1.5px solid ${overIdx===idx&&dragIdx!==idx?BLUE:th.border}`,opacity:dragIdx===idx?.4:1,transition:"border-color .15s",cursor:"grab"}}>
          <div style={{color:"#94a3b8",fontSize:16,cursor:"grab",flexShrink:0,userSelect:"none"}}>⠿</div>
          <div style={{display:"flex",flexDirection:"column",gap:2,flexShrink:0}}>
            <button onClick={()=>moveUp(idx)} disabled={idx===0} style={{background:"none",border:"none",cursor:idx===0?"not-allowed":"pointer",color:idx===0?"#cbd5e1":BLUE,fontSize:12,padding:"1px 4px",lineHeight:1}}>▲</button>
            <button onClick={()=>moveDown(idx)} disabled={idx===list.length-1} style={{background:"none",border:"none",cursor:idx===list.length-1?"not-allowed":"pointer",color:idx===list.length-1?"#cbd5e1":BLUE,fontSize:12,padding:"1px 4px",lineHeight:1}}>▼</button>
          </div>
          <input value={item.name} onChange={e=>change(item.id,"name",e.target.value)} style={{...inp,flex:2,padding:"8px 10px",fontSize:13}}/>
          <input type="number" value={item.price} onChange={e=>change(item.id,"price",e.target.value)} style={{...inp,width:80,padding:"8px 10px",fontSize:13}}/>
          <button onClick={()=>remove(item.id)} style={{padding:"8px 12px",borderRadius:8,border:"none",background:RED,color:"white",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>✕</button>
        </div>
      ))}
      <div style={{display:"flex",gap:8,marginTop:16,alignItems:"center"}}>
        <div style={{width:44,flexShrink:0}}/>
        <input value={nName} onChange={e=>setNN(e.target.value)} placeholder={placeholder} style={{...inp,flex:2,padding:"9px 12px",fontSize:13}}/>
        <input type="number" value={nPrice} onChange={e=>setNP(e.target.value)} placeholder="Price" style={{...inp,width:80,padding:"9px 12px",fontSize:13}}/>
        <button onClick={add} style={{padding:"9px 16px",borderRadius:8,border:"none",background:BLUE,color:"white",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>+ Add</button>
      </div>
    </div>
  );
}

function PaymentsTab({paymentMethods,onSave,th}){
  const [items,setItems]=useState([...paymentMethods]); const [newItem,setNew]=useState("");
  const [dragIdx,setDragIdx]=useState(null); const [overIdx,setOverIdx]=useState(null);
  const inp=iStyle(th);
  const add=()=>{if(!newItem.trim()||items.includes(newItem.trim()))return;const u=[...items,newItem.trim()];setItems(u);onSave(u);setNew("");};
  const remove=i=>{const u=items.filter((_,idx)=>idx!==i);setItems(u);onSave(u);};
  const onDragStart=i=>setDragIdx(i);
  const onDragOver=(e,i)=>{e.preventDefault();setOverIdx(i);};
  const onDrop=i=>{if(dragIdx===null||dragIdx===i){setDragIdx(null);setOverIdx(null);return;}const u=[...items];const[moved]=u.splice(dragIdx,1);u.splice(i,0,moved);setItems(u);onSave(u);setDragIdx(null);setOverIdx(null);};
  return(
    <div>
      {items.map((p,i)=>(
        <div key={i} draggable onDragStart={()=>onDragStart(i)} onDragOver={e=>onDragOver(e,i)} onDrop={()=>onDrop(i)} onDragEnd={()=>{setDragIdx(null);setOverIdx(null);}} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,background:th.card,borderRadius:10,padding:"12px 16px",border:`1.5px solid ${overIdx===i&&dragIdx!==i?BLUE:th.border}`,opacity:dragIdx===i?.4:1,cursor:"grab",transition:"border-color .15s"}}>
          <span style={{color:"#94a3b8",fontSize:16,userSelect:"none"}}>⠿</span>
          <span style={{flex:1,fontWeight:600,fontSize:14,color:th.text}}>{p}</span>
          <button onClick={()=>remove(i)} style={{padding:"6px 12px",borderRadius:8,border:"none",background:RED,color:"white",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>✕</button>
        </div>
      ))}
      <div style={{display:"flex",gap:8,marginTop:16}}>
        <input value={newItem} onChange={e=>setNew(e.target.value)} placeholder="e.g. VENMO" style={{...inp,flex:1,padding:"9px 12px",fontSize:13}}/>
        <button onClick={add} style={{padding:"9px 16px",borderRadius:8,border:"none",background:BLUE,color:"white",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>+ Add</button>
      </div>
    </div>
  );
}

function UsersTab({users,onSave,th}){
  const [nEmail,setNE]=useState(""); const [nPass,setNP]=useState(""); const [nRole,setNR]=useState("user"); const [err,setErr]=useState("");
  const inp=iStyle(th);
  const add=()=>{
    if(!nEmail.trim()||!nPass.trim()){setErr("Email and password required.");return;}
    if(nPass.length<4||nPass.length>10){setErr("Password must be 4–10 chars.");return;}
    if(users.find(u=>u.email===nEmail.trim())){setErr("User already exists.");return;}
    onSave([...users,{id:uid(),email:nEmail.trim(),password:nPass,role:nRole}]);
    setNE("");setNP("");setNR("user");setErr("");
  };
  const remove=id=>{if(users.find(u=>u.id===id)?.role==="admin"&&users.filter(u=>u.role==="admin").length===1){alert("Cannot remove the last admin.");return;}onSave(users.filter(u=>u.id!==id));};
  const toggleRole=id=>onSave(users.map(u=>u.id===id?{...u,role:u.role==="admin"?"user":"admin"}:u));
  return(
    <div>
      {users.map(u=>(
        <div key={u.id} style={{background:th.card,borderRadius:12,padding:16,marginBottom:10,border:`1px solid ${th.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:12,flex:1}}>
              <Avatar user={u} size={44}/>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14,color:th.text}}>{u.displayName||u.email.split("@")[0]}</div>
                <div style={{fontSize:12,color:th.subtext,marginTop:1}}>{u.email}</div>
                <div style={{fontSize:12,color:th.subtext,marginTop:2}}>Password: <span style={{fontFamily:"monospace"}}>{u.password}</span></div>
                <div style={{display:"flex",alignItems:"center",gap:10,marginTop:10}}>
                  <span style={{fontSize:12,color:th.subtext}}>Role:</span>
                  <span style={{fontSize:12,fontWeight:700,color:u.role==="admin"?BLUE:th.subtext,minWidth:36}}>{u.role}</span>
                  <Toggle on={u.role==="admin"} set={()=>toggleRole(u.id)}/>
                  <span style={{fontSize:11,color:th.subtext}}>Admin</span>
                </div>
              </div>
            </div>
            <button onClick={()=>remove(u.id)} style={{padding:"6px 14px",borderRadius:8,border:"none",background:RED,color:"white",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"system-ui,sans-serif",marginLeft:8,flexShrink:0}}>Remove</button>
          </div>
        </div>
      ))}
      <div style={{background:th.card,borderRadius:14,padding:18,marginTop:16,border:`1px solid ${th.border}`}}>
        <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:14}}>Add New User</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <input type="email" value={nEmail} onChange={e=>setNE(e.target.value)} placeholder="Email" style={{...inp,fontSize:13}}/>
          <input value={nPass} onChange={e=>setNP(e.target.value)} placeholder="Password (4–10 characters)" style={{...inp,fontSize:13}}/>
          <select value={nRole} onChange={e=>setNR(e.target.value)} style={{...inp,fontSize:13}}><option value="user">User</option><option value="admin">Admin</option></select>
          {err&&<div style={{color:RED,fontSize:12}}>{err}</div>}
          <button onClick={add} style={{padding:"10px",borderRadius:10,border:"none",background:BLUE,color:"white",cursor:"pointer",fontSize:14,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Add User</button>
        </div>
      </div>
    </div>
  );
}

// Business Insights Tab
function InsightsTab({ orders, th }) {
  const total=orders.length;
  if(!total) return <div style={{color:th.subtext,fontSize:14,textAlign:"center",padding:"40px 0"}}>No orders yet to analyze.</div>;

  const revenue=orders.reduce((s,o)=>s+(Number(o.finalTotal)||Number(o.total)||0),0);
  const avgVal=revenue/total;
  const paid=orders.filter(o=>o.paid).length;
  const done=orders.filter(o=>o.status==="Order Done");
  const returnCust=orders.reduce((acc,o)=>{const n=(o.customerName||"").toLowerCase();acc[n]=(acc[n]||0)+1;return acc;},{});
  const returning=Object.values(returnCust).filter(c=>c>1).length;
  const totalCust=Object.keys(returnCust).length;
  const returnRate=totalCust>0?Math.round((returning/totalCust)*100):0;

  // Best month
  const byMonth=orders.reduce((acc,o)=>{if(!o.dateCreated)return acc;const m=o.dateCreated.slice(0,7);acc[m]=(acc[m]||0)+1;return acc;},{});
  const bestMonth=Object.entries(byMonth).sort((a,b)=>b[1]-a[1])[0];

  // Most popular album
  const byAlbum=orders.reduce((acc,o)=>{const names=(o.selectedAlbums||[{albumType:o.albumType}]).map(a=>a.albumType).filter(Boolean);names.forEach(n=>{acc[n]=(acc[n]||0)+1;});return acc;},{});
  const topAlbum=Object.entries(byAlbum).sort((a,b)=>b[1]-a[1])[0];

  const card=(icon,label,val,sub)=>(
    <div style={{background:th.card,borderRadius:12,padding:16,border:`1px solid ${th.border}`,marginBottom:12}}>
      <div style={{fontSize:24,marginBottom:6}}>{icon}</div>
      <div style={{fontSize:22,fontWeight:800,color:BLUE}}>{val}</div>
      <div style={{fontSize:13,fontWeight:700,color:th.text,marginTop:2}}>{label}</div>
      {sub&&<div style={{fontSize:11,color:th.subtext,marginTop:3}}>{sub}</div>}
    </div>
  );

  const fmt=(y,m)=>{const d=new Date(y+"-"+m+"-01");return d.toLocaleDateString("en-US",{month:"long",year:"numeric"});};

  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {card("📦","Total Orders",total,`${paid} paid · ${total-paid} unpaid`)}
        {card("💰","Avg Order Value",fmt$(avgVal),`Total revenue: ${fmt$(revenue)}`)}
        {card("🔁","Customer Return Rate",`${returnRate}%`,`${returning} of ${totalCust} customers returned`)}
        {card("🏆","Most Popular Album",topAlbum?topAlbum[0]:"—",topAlbum?`${topAlbum[1]} orders`:"")}
        {card("📅","Best Month",bestMonth?fmt(...bestMonth[0].split("-")):"—",bestMonth?`${bestMonth[1]} orders`:"")}
        {card("✅","Completed Orders",done.length,`${total>0?Math.round((done.length/total)*100):0}% completion rate`)}
      </div>
    </div>
  );
}

// Customer Management Tab
function CustomersTab({ customers, onSave, orders, th }) {
  const [search,setSearch]=useState("");
  const [editing,setEditing]=useState(null);
  const [editName,setEditName]=useState(""); const [editPhone,setEditPhone]=useState(""); const [editEmail,setEditEmail]=useState(""); const [editVip,setEditVip]=useState(false); const [editNote,setEditNote]=useState("");
  const inp=iStyle(th);

  const filtered=(customers||[]).filter(c=>(c.name||"").toLowerCase().includes(search.toLowerCase()));
  const startEdit=c=>{setEditing(c.id);setEditName(c.name);setEditPhone(c.phone||"");setEditEmail(c.email||"");setEditVip(c.vip||false);setEditNote(c.note||"");};
  const saveEdit=()=>{onSave((customers||[]).map(c=>c.id===editing?{...c,name:editName,phone:editPhone,email:editEmail,vip:editVip,note:editNote}:c));setEditing(null);};
  const remove=id=>{if(window.confirm("Remove this customer?")) onSave((customers||[]).filter(c=>c.id!==id));};
  const custOrders=name=>(orders||[]).filter(o=>(o.customerName||"").toLowerCase()===(name||"").toLowerCase());

  return(
    <div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search customers…" style={{...inp,marginBottom:14,fontSize:13}}/>
      {filtered.length===0&&<div style={{color:th.subtext,fontSize:14,textAlign:"center",padding:"40px 0"}}>No customers yet. They are added automatically when you create orders.</div>}
      {filtered.map(c=>{
        const co=custOrders(c.name);
        const isEditing=editing===c.id;
        return(
          <div key={c.id} style={{background:th.card,borderRadius:12,padding:16,marginBottom:10,border:`1px solid ${th.border}`}}>
            {isEditing?(
              <div>
                <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:10}}>
                  <input value={editName} onChange={e=>setEditName(e.target.value)} placeholder="Name" style={{...inp,fontSize:13}}/>
                  <input value={editPhone} onChange={e=>setEditPhone(fmtPhone(e.target.value))} placeholder="Phone" style={{...inp,fontSize:13}}/>
                  <input value={editEmail} onChange={e=>setEditEmail(e.target.value)} placeholder="Email" style={{...inp,fontSize:13}}/>
                  <textarea value={editNote} onChange={e=>setEditNote(e.target.value)} placeholder="Permanent note (shown on new orders)…" rows={2} style={{...inp,resize:"vertical",fontSize:13}}/>
                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:th.text,fontFamily:"system-ui,sans-serif"}}>
                    <input type="checkbox" checked={editVip} onChange={e=>setEditVip(e.target.checked)} style={{accentColor:"#8b5cf6"}}/>⭐ VIP Customer
                  </label>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={saveEdit} style={{flex:1,padding:"9px",borderRadius:8,border:"none",background:GREEN,color:"white",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Save</button>
                  <button onClick={()=>setEditing(null)} style={{flex:1,padding:"9px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"white",color:"#64748b",cursor:"pointer",fontSize:13,fontFamily:"system-ui,sans-serif"}}>Cancel</button>
                </div>
              </div>
            ):(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                      <div style={{fontWeight:700,fontSize:15,color:th.text}}>{c.name}</div>
                      {c.vip&&<span style={{fontSize:10,background:"#fdf4ff",color:"#7e22ce",padding:"2px 7px",borderRadius:20,fontWeight:700}}>⭐ VIP</span>}
                    </div>
                    {c.phone&&<div style={{fontSize:12,color:th.subtext}}>{c.phone}</div>}
                    {c.email&&<div style={{fontSize:12,color:th.subtext}}>{c.email}</div>}
                    {c.note&&<div style={{fontSize:12,color:"#92400e",background:"#fff7ed",padding:"5px 10px",borderRadius:7,marginTop:6,border:"1px solid #fed7aa"}}>📝 {c.note}</div>}
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>startEdit(c)} style={{padding:"5px 12px",borderRadius:8,border:`1.5px solid ${BLUE}`,background:"transparent",color:BLUE,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Edit</button>
                    <button onClick={()=>remove(c.id)} style={{padding:"5px 12px",borderRadius:8,border:"none",background:RED,color:"white",cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>✕</button>
                  </div>
                </div>
                <div style={{fontSize:11,color:th.subtext}}>📦 {co.length} order{co.length!==1?"s":""}{c.lastOrder?` · Last: ${fmtD(c.lastOrder)}`:""}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AccountTab({currentUser,onChangePw,onUpdateDisplayName,onUpdatePhoto,darkMode,onToggleDark,th}){
  const [displayName,setDisplayName]=useState(currentUser?.displayName||"");
  const [dnSaved,setDnSaved]=useState(false);
  const [cur,setCur]=useState(""); const [newPw,setNew]=useState(""); const [conf,setConf]=useState("");
  const [msg,setMsg]=useState(""); const [err,setErr]=useState("");
  const [cropSrc,setCropSrc]=useState(null); const [zoom,setZoom]=useState(1);
  const [offsetX,setOffsetX]=useState(0); const [offsetY,setOffsetY]=useState(0);
  const [saving,setSaving]=useState(false);
  const imgRef=useRef(null); const dragRef=useRef(null); const touchRef=useRef(null);
  const inp=iStyle(th);

  const change=()=>{if(cur!==currentUser.password){setErr("Current password incorrect.");setMsg("");return;}if(newPw.length<4||newPw.length>10){setErr("Must be 4–10 characters.");setMsg("");return;}if(newPw!==conf){setErr("Passwords don't match.");setMsg("");return;}onChangePw(currentUser.email,newPw);setMsg("✓ Password changed!");setErr("");setCur("");setNew("");setConf("");};
  const saveDisplayName=()=>{onUpdateDisplayName(currentUser.email,displayName.trim());setDnSaved(true);setTimeout(()=>setDnSaved(false),2000);};

  const handlePhotoChange=(e)=>{
    const file=e.target.files?.[0];if(!file)return;e.target.value="";
    const img=new Image();const url=URL.createObjectURL(file);
    img.onload=()=>{const MAX=600;const scale=Math.min(1,MAX/Math.max(img.width,img.height));const w=Math.round(img.width*scale);const h=Math.round(img.height*scale);const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d");ctx.drawImage(img,0,0,w,h);URL.revokeObjectURL(url);setCropSrc(canvas.toDataURL("image/jpeg",0.9));setZoom(1);setOffsetX(0);setOffsetY(0);};img.src=url;
  };
  const handleCropSave=()=>{
    const img=imgRef.current;if(!img||!img.complete)return;setSaving(true);
    const SIZE=200;const canvas=document.createElement("canvas");canvas.width=SIZE;canvas.height=SIZE;
    const ctx=canvas.getContext("2d");ctx.beginPath();ctx.arc(SIZE/2,SIZE/2,SIZE/2,0,Math.PI*2);ctx.clip();
    const drawn=SIZE*zoom;const dx=(SIZE-drawn)/2+offsetX;const dy=(SIZE-drawn)/2+offsetY;
    ctx.drawImage(img,dx,dy,drawn,drawn);
    onUpdatePhoto(currentUser.email,canvas.toDataURL("image/jpeg",0.75));setCropSrc(null);setSaving(false);
  };
  const onMouseDown=(e)=>{e.preventDefault();dragRef.current={x:e.clientX,y:e.clientY,ox:offsetX,oy:offsetY};const onMove=(ev)=>{if(!dragRef.current)return;setOffsetX(dragRef.current.ox+(ev.clientX-dragRef.current.x));setOffsetY(dragRef.current.oy+(ev.clientY-dragRef.current.y));};const onUp=()=>{dragRef.current=null;window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};window.addEventListener("mousemove",onMove);window.addEventListener("mouseup",onUp);};
  const onTouchStart=(e)=>{if(e.touches.length===1){dragRef.current={x:e.touches[0].clientX,y:e.touches[0].clientY,ox:offsetX,oy:offsetY};touchRef.current=null;}else if(e.touches.length===2){const dx=e.touches[0].clientX-e.touches[1].clientX;const dy=e.touches[0].clientY-e.touches[1].clientY;touchRef.current={dist:Math.sqrt(dx*dx+dy*dy),zoom};}};
  const onTouchMove=(e)=>{e.preventDefault();if(e.touches.length===1&&dragRef.current){setOffsetX(dragRef.current.ox+(e.touches[0].clientX-dragRef.current.x));setOffsetY(dragRef.current.oy+(e.touches[0].clientY-dragRef.current.y));}else if(e.touches.length===2&&touchRef.current){const dx=e.touches[0].clientX-e.touches[1].clientX;const dy=e.touches[0].clientY-e.touches[1].clientY;const dist=Math.sqrt(dx*dx+dy*dy);setZoom(Math.min(4,Math.max(0.5,touchRef.current.zoom*(dist/touchRef.current.dist))));}};
  const onTouchEnd=()=>{dragRef.current=null;touchRef.current=null;};

  return(
    <div>
      {cropSrc&&(
        <div onClick={e=>{if(e.target===e.currentTarget)setCropSrc(null);}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:"white",borderRadius:20,padding:24,width:"100%",maxWidth:360,boxShadow:"0 20px 60px rgba(0,0,0,.5)"}}>
            <div style={{fontWeight:700,fontSize:17,color:"#0f172a",marginBottom:4,textAlign:"center"}}>📷 Adjust Your Photo</div>
            <div style={{fontSize:12,color:"#64748b",textAlign:"center",marginBottom:16}}>Drag to move · Pinch or slider to zoom</div>
            <div style={{display:"flex",justifyContent:"center",marginBottom:16}}>
              <div style={{width:220,height:220,borderRadius:"50%",overflow:"hidden",border:"3px solid "+GOLD,position:"relative",background:"#f1f5f9",userSelect:"none",cursor:"grab",touchAction:"none"}} onMouseDown={onMouseDown} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
                <img ref={imgRef} src={cropSrc} alt="crop" style={{position:"absolute",width:220*zoom,height:220*zoom,left:(220-220*zoom)/2+offsetX,top:(220-220*zoom)/2+offsetY,pointerEvents:"none",userSelect:"none",draggable:false}}/>
              </div>
            </div>
            <div style={{marginBottom:20}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#64748b",marginBottom:6}}><span>🔍 Zoom</span><span style={{fontWeight:700,color:BLUE}}>{Math.round(zoom*100)}%</span></div>
              <input type="range" min={0.5} max={4} step={0.05} value={zoom} onChange={e=>setZoom(Number(e.target.value))} style={{width:"100%",accentColor:BLUE,height:6}}/>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#cbd5e1",marginTop:3}}><span>← Smaller</span><span>Bigger →</span></div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setCropSrc(null)} style={{flex:1,padding:"12px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"white",color:"#64748b",cursor:"pointer",fontSize:14,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Cancel</button>
              <button onClick={handleCropSave} disabled={saving} style={{flex:2,padding:"12px",borderRadius:10,border:"none",background:saving?"#94a3b8":`linear-gradient(135deg,${GREEN},#34d399)`,color:"white",cursor:saving?"not-allowed":"pointer",fontSize:14,fontWeight:700,fontFamily:"system-ui,sans-serif"}}>{saving?"Saving…":"✅ Save Photo"}</button>
            </div>
          </div>
        </div>
      )}
      <div style={{background:th.card,borderRadius:12,padding:20,border:`1px solid ${th.border}`,marginBottom:12}}>
        <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:14}}>Profile Photo</div>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <Avatar user={currentUser} size={72}/>
          <div>
            <label style={{display:"inline-block",padding:"9px 18px",borderRadius:8,background:BLUE,color:"white",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif",marginBottom:6}}>📷 Upload Photo<input type="file" accept="image/*" onChange={handlePhotoChange} style={{display:"none"}}/></label>
            <div style={{fontSize:11,color:th.subtext,marginTop:4}}>Tap to pick a photo · Then zoom &amp; drag to fit</div>
            {currentUser.photo&&<button onClick={()=>onUpdatePhoto(currentUser.email,null)} style={{display:"block",marginTop:8,background:"none",border:"none",color:RED,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"system-ui,sans-serif",padding:0}}>Remove photo</button>}
          </div>
        </div>
      </div>
      <div style={{background:th.card,borderRadius:12,padding:16,border:`1px solid ${th.border}`,marginBottom:12}}>
        <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:4}}>Logged in as</div>
        <div style={{fontSize:14,color:th.subtext}}>{currentUser.email}</div>
        <div style={{fontSize:12,color:BLUE,fontWeight:700,marginTop:3}}>{currentUser.role}</div>
      </div>
      <div style={{background:th.card,borderRadius:12,padding:16,border:`1px solid ${th.border}`,marginBottom:12}}>
        <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:12}}>Display Name</div>
        <div style={{display:"flex",gap:8}}>
          <input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="e.g. Yona" style={{...inp,flex:1,fontSize:13}}/>
          <button onClick={saveDisplayName} style={{padding:"9px 16px",borderRadius:8,border:"none",background:dnSaved?GREEN:BLUE,color:"white",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif",flexShrink:0}}>{dnSaved?"✓ Saved":"Save"}</button>
        </div>
        <div style={{fontSize:11,color:th.subtext,marginTop:6}}>Shown on order cards as "Created by {displayName||"you"}"</div>
      </div>
      <div style={{background:th.card,borderRadius:12,padding:16,border:`1px solid ${th.border}`,marginBottom:12}}>
        <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:14}}>Change Password</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <input type="password" value={cur} onChange={e=>setCur(e.target.value)} placeholder="Current password" style={{...inp,fontSize:13}}/>
          <input type="password" value={newPw} onChange={e=>setNew(e.target.value)} placeholder="New password (4–10 chars)" style={{...inp,fontSize:13}}/>
          <input type="password" value={conf} onChange={e=>setConf(e.target.value)} placeholder="Confirm new password" style={{...inp,fontSize:13}}/>
          {err&&<div style={{color:RED,fontSize:12}}>{err}</div>}
          {msg&&<div style={{color:GREEN,fontSize:12}}>{msg}</div>}
          <button onClick={change} style={{padding:"10px",borderRadius:10,border:"none",background:BLUE,color:"white",cursor:"pointer",fontSize:14,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Change Password</button>
        </div>
      </div>
      <div style={{background:th.card,borderRadius:12,padding:"14px 16px",border:`1px solid ${th.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontWeight:700,fontSize:14,color:th.text}}>Dark Mode</div><div style={{fontSize:12,color:th.subtext,marginTop:2}}>{darkMode?"On":"Off"}</div></div>
        <Toggle on={darkMode} set={onToggleDark}/>
      </div>
    </div>
  );
}

function SettingsPanel({currentUser,albums,onSaveAlbums,upgrades,onSaveUpgrades,paymentMethods,onSavePayments,users,onSaveUsers,darkMode,onToggleDark,onChangePw,onUpdateDisplayName,onUpdatePhoto,onBack,activeTab,setActiveTab,orders,customers,onSaveCustomer,th}){
  const isAdmin=currentUser.role==="admin";
  const tabs=[
    {id:"albums",icon:"📚",label:"Albums",desc:"Manage album types & prices"},
    {id:"upgrades",icon:"✨",label:"Upgrades",desc:"Manage add-ons & prices"},
    {id:"payments",icon:"💳",label:"Payments",desc:"Payment methods"},
    {id:"customers",icon:"👥",label:"Customers",desc:"Customer database & history"},
    {id:"insights",icon:"📊",label:"Business Insights",desc:"Revenue, trends & analytics"},
    ...(isAdmin?[{id:"users",icon:"🔑",label:"Users",desc:"Manage user accounts"}]:[]),
    {id:"account",icon:"🙋",label:"My Account",desc:"Password & display settings"},
  ];
  if(activeTab){
    const tab=tabs.find(t=>t.id===activeTab);
    const content=()=>{
      switch(activeTab){
        case "albums":    return <ListEditor items={albums} onSave={onSaveAlbums} th={th} placeholder="Album name"/>;
        case "upgrades":  return <ListEditor items={upgrades} onSave={onSaveUpgrades} th={th} placeholder="Upgrade name"/>;
        case "payments":  return <PaymentsTab paymentMethods={paymentMethods} onSave={onSavePayments} th={th}/>;
        case "users":     return <UsersTab users={users} onSave={onSaveUsers} th={th}/>;
        case "account":   return <AccountTab currentUser={currentUser} onChangePw={onChangePw} onUpdateDisplayName={onUpdateDisplayName} onUpdatePhoto={onUpdatePhoto} darkMode={darkMode} onToggleDark={onToggleDark} th={th}/>;
        case "insights":  return <InsightsTab orders={orders} th={th}/>;
        case "customers": return <CustomersTab customers={customers} onSave={onSaveCustomer} orders={orders} th={th}/>;
        default: return null;
      }
    };
    return(
      <div style={{background:"linear-gradient(160deg,#e8eeff 0%,#f0f7ff 100%)",minHeight:"100vh",fontFamily:"system-ui,sans-serif"}}>
        <NavBar title={`${tab?.icon} ${tab?.label}`} onBack={()=>setActiveTab(null)}/>
        <div style={{padding:"24px 28px",maxWidth:680,margin:"0 auto"}}>{content()}</div>
      </div>
    );
  }
  return(
    <div style={{background:"linear-gradient(160deg,#e8eeff 0%,#f0f7ff 100%)",minHeight:"100vh",fontFamily:"system-ui,sans-serif"}}>
      <NavBar title="⚙️ Settings" onBack={onBack}/>
      <div style={{padding:"24px 28px",maxWidth:680,margin:"0 auto"}}>
        {tabs.map(tab=>(
          <div key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{background:"white",borderRadius:14,padding:"18px 22px",marginBottom:12,border:"1px solid #e8ecf0",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
            <div style={{display:"flex",alignItems:"center",gap:16}}>
              <span style={{fontSize:28}}>{tab.icon}</span>
              <div>
                <div style={{fontWeight:700,fontSize:15,color:"#0f172a"}}>{tab.label}</div>
                <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{tab.desc}</div>
              </div>
            </div>
            <span style={{color:"#94a3b8",fontSize:22}}>›</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ROOT APP
// ══════════════════════════════════════════════════════════
export default function App() {
  const [ready,setReady]=useState(false);
  const [currentUser,setCurrentUser]=useState(null);
  const [view,setView]=useState("dashboard");
  const [orders,setOrders]=useState([]);
  const [albums,setAlbums]=useState(DEFAULT_ALBUMS);
  const [upgrades,setUpgrades]=useState(DEFAULT_UPGRADES);
  const [payments,setPayments]=useState(DEFAULT_PAYMENTS);
  const [users,setUsers]=useState(DEFAULT_USERS);
  const [customers,setCustomers]=useState([]);
  const [darkMode,setDarkMode]=useState(false);
  const [editingOrder,setEditingOrder]=useState(null);
  const [statusFilter,setStatusFilter]=useState(null);
  const [settingsTab,setSettingsTab]=useState(null);
  const [showExport,setShowExport]=useState(false);

  useEffect(()=>{
    const saved=lsGet("lb_user");if(saved)setCurrentUser(saved);
    const dm=lsGet("lb_dark");if(dm)setDarkMode(dm);
  },[]);

  useEffect(()=>{
    const unsubs=[];
    unsubs.push(onSnapshot(collection(db,"orders"),snap=>setOrders(snap.docs.map(d=>({id:d.id,...d.data()}))),e=>console.error("orders:",e)));
    unsubs.push(onSnapshot(collection(db,"customers"),snap=>setCustomers(snap.docs.map(d=>({id:d.id,...d.data()}))),e=>console.error("customers:",e)));
    const cfg=(name,setter,fallback)=>unsubs.push(onSnapshot(doc(db,"config",name),snap=>{if(snap.exists())setter(snap.data().items??fallback);else setter(fallback);},e=>console.error(name,e)));
    cfg("albums",setAlbums,DEFAULT_ALBUMS);
    cfg("upgrades",setUpgrades,DEFAULT_UPGRADES);
    cfg("payments",setPayments,DEFAULT_PAYMENTS);
    cfg("users",setUsers,DEFAULT_USERS);
    setReady(true);
    return()=>unsubs.forEach(u=>u());
  },[]);

  const theme={bg:"#f1f5f9",card:"white",text:"#0f172a",subtext:"#64748b",border:"#e2e8f0",inp:"#f8fafc"};
  const saveConfig=async(name,items)=>await setDoc(doc(db,"config",name),{items});

  const saveOrder=async(order)=>{
    const {id,...rawData}=order;
    const data=clean(rawData);
    if(id){await setDoc(doc(db,"orders",id),data);}
    else {await addDoc(collection(db,"orders"),data);}
    setView("dashboard");setEditingOrder(null);
  };

  const deleteOrder=async(order)=>{
    if(window.confirm(`Delete order for ${order.customerName}? This cannot be undone.`)){
      await deleteDoc(doc(db,"orders",order.id));
      setView("dashboard");setEditingOrder(null);
    }
  };

  const pinOrder=async(order)=>{
    await setDoc(doc(db,"orders",order.id),clean({...order,pinned:!order.pinned}));
  };

  const snoozeOrder=async(order,days)=>{
    const until=new Date(Date.now()+days*864e5).toISOString().split("T")[0];
    await setDoc(doc(db,"orders",order.id),clean({...order,snoozedUntil:until}));
  };

  const bulkStatus=async(ids,status)=>{
    const who=currentUser?.displayName||currentUser?.email||"Unknown";
    for(const id of ids){
      const o=orders.find(x=>x.id===id);if(!o)continue;
      const diff=buildDiff(o,{...o,status},who);
      const editHistory=[...(o.editHistory||[]),...(diff?[diff]:[])];
      await setDoc(doc(db,"orders",id),clean({...o,status,statusChangedAt:new Date().toISOString(),editHistory}));
    }
  };

  const saveUsers=async(updated)=>{
    await saveConfig("users",updated);
    if(currentUser){const me=updated.find(u=>u.email===currentUser.email);if(me){setCurrentUser(me);lsSet("lb_user",me);}}
  };

  const saveCustomer=async(customer)=>{
    const existing=customers.find(c=>c.name.toLowerCase()===customer.name.toLowerCase());
    if(existing){await setDoc(doc(db,"customers",existing.id),clean({...customer,id:existing.id}));}
    else{const {id,...rest}=customer;await setDoc(doc(db,"customers",id),clean(rest));}
  };

  const saveCustomersList=async(list)=>{
    for(const c of list){
      const {id,...rest}=c;
      await setDoc(doc(db,"customers",id),clean(rest));
    }
    const toDelete=customers.filter(c=>!list.find(x=>x.id===c.id));
    for(const c of toDelete){await deleteDoc(doc(db,"customers",c.id));}
  };

  const changePw=async(email,pass)=>await saveUsers(users.map(u=>u.email===email?{...u,password:pass}:u));
  const updateDisplayName=async(email,name)=>await saveUsers(users.map(u=>u.email===email?{...u,displayName:name}:u));
  const updatePhoto=async(email,photo)=>await saveUsers(users.map(u=>u.email===email?{...u,photo:photo||null}:u));
  const login=u=>{setCurrentUser(u);lsSet("lb_user",u);};
  const signOut=()=>{setCurrentUser(null);lsSet("lb_user",null);};
  const togDark=()=>{const d=!darkMode;setDarkMode(d);lsSet("lb_dark",d);};

  if(!ready) return <Loader/>;
  if(!currentUser) return <LoginScreen users={users} onLogin={login}/>;

  if(view==="newOrder"||view==="editOrder") return(
    <OrderForm
      order={editingOrder} albums={albums} upgrades={upgrades} paymentMethods={payments}
      onSave={saveOrder} onDelete={deleteOrder}
      onCancel={()=>{setView("dashboard");setEditingOrder(null);}}
      currentUser={currentUser} customers={customers} onSaveCustomer={saveCustomer}
      th={theme}/>
  );

  if(view==="settings") return(
    <SettingsPanel
      currentUser={currentUser}
      albums={albums}           onSaveAlbums={i=>saveConfig("albums",i)}
      upgrades={upgrades}       onSaveUpgrades={i=>saveConfig("upgrades",i)}
      paymentMethods={payments} onSavePayments={i=>saveConfig("payments",i)}
      users={users}             onSaveUsers={saveUsers}
      orders={orders}           customers={customers}
      onSaveCustomer={saveCustomersList}
      darkMode={darkMode}       onToggleDark={togDark}
      onChangePw={changePw}     onUpdateDisplayName={updateDisplayName} onUpdatePhoto={updatePhoto}
      onBack={()=>{setView("dashboard");setSettingsTab(null);}}
      activeTab={settingsTab}   setActiveTab={setSettingsTab}
      th={theme}/>
  );

  return(
    <Dashboard
      orders={orders} albums={albums}
      statusFilter={statusFilter} setStatusFilter={setStatusFilter}
      onNew={()=>{setEditingOrder(null);setView("newOrder");}}
      onEdit={o=>{setEditingOrder(o);setView("editOrder");}}
      onDelete={deleteOrder}
      onPin={pinOrder}
      onSnooze={snoozeOrder}
      onBulkStatus={bulkStatus}
      onSettings={()=>setView("settings")}
      onSignOut={signOut}
      showExport={showExport} setShowExport={setShowExport}
      currentUser={currentUser}
      th={theme}/>
  );
}
