import { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, doc, onSnapshot, setDoc, addDoc, deleteDoc } from "firebase/firestore";

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
  { id:"user1", email:"zupnickyona@gmail.com", password:"8606", role:"admin" }
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

const todayStr = () => new Date().toISOString().split("T")[0];
const fmt$     = n  => "$"+(Number(n)||0).toFixed(2);
const fmtD     = d  => { if(!d) return "—"; const [y,m,day]=d.split("-"); return `${m}/${day}/${y}`; };
const uid      = () => `${Date.now()}_${Math.floor(Math.random()*9999)}`;
const lsGet    = k  => { try{ const v=localStorage.getItem(k); return v?JSON.parse(v):null; }catch{ return null; } };
const lsSet    = (k,v) => { try{ localStorage.setItem(k,JSON.stringify(v)); }catch{} };

// Auto-format phone as user types → 718-307-3333
const fmtPhone = (val) => {
  const d = (val||"").replace(/\D/g,"").slice(0,10);
  if(d.length<=3) return d;
  if(d.length<=6) return `${d.slice(0,3)}-${d.slice(3)}`;
  return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
};

// Strip undefined from objects before saving to Firestore
const clean = (obj) => {
  if(obj===null||obj===undefined) return null;
  if(Array.isArray(obj)) return obj.map(clean);
  if(typeof obj==="object") {
    const out = {};
    for(const [k,v] of Object.entries(obj)) {
      if(v!==undefined) out[k]=clean(v);
    }
    return out;
  }
  return obj;
};

// ── Logo ──────────────────────────────────────────────────
function Logo({ size=38 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{flexShrink:0}}>
      <circle cx="20" cy="20" r="18" fill={BLUE} stroke={GOLD} strokeWidth="2.5"/>
      <text x="20" y="14.5" textAnchor="middle" fill="white" fontSize="7" fontFamily="Georgia,serif" fontWeight="700">Luxe</text>
      <text x="20" y="22"   textAnchor="middle" fill="white" fontSize="7" fontFamily="Georgia,serif" fontWeight="700">Bound</text>
      <text x="20" y="29"   textAnchor="middle" fill={GOLD}  fontSize="3.8" fontFamily="Georgia,serif" letterSpacing="1">ALBUMS</text>
    </svg>
  );
}

const iStyle = th => ({
  width:"100%", padding:"10px 12px", borderRadius:8,
  border:`1.5px solid ${th.border}`, background:th.inp,
  color:th.text, fontSize:14, outline:"none",
  fontFamily:"system-ui,sans-serif", boxSizing:"border-box",
});

function Btn({ children, onClick, variant="primary", sm, full, disabled, style:sx={} }) {
  const v = {
    primary: { background:BLUE,  color:"white" },
    success: { background:GREEN, color:"white" },
    danger:  { background:RED,   color:"white" },
    ghost:   { background:"rgba(255,255,255,0.15)", color:"white", border:"1.5px solid rgba(255,255,255,0.4)" },
    gray:    { background:"#e2e8f0", color:"#475569" },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding:sm?"6px 14px":"10px 20px", borderRadius:8, border:"none",
      cursor:disabled?"not-allowed":"pointer", fontSize:sm?12:14, fontWeight:600,
      fontFamily:"system-ui,sans-serif", width:full?"100%":undefined,
      opacity:disabled?.5:1, whiteSpace:"nowrap",
      ...(v[variant]||v.primary), ...sx,
    }}>{children}</button>
  );
}

function Field({ label, required, children, style:sx={} }) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:5,...sx}}>
      {label&&<label style={{fontSize:11,fontWeight:700,letterSpacing:"0.6px",textTransform:"uppercase",color:"#64748b"}}>
        {label}{required&&<span style={{color:RED}}> *</span>}
      </label>}
      {children}
    </div>
  );
}

function Badge({ status }) {
  const c = STATUS_COLORS[status]||{bg:"#e5e7eb",tx:"#374151"};
  return <span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,background:c.bg,color:c.tx,fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>{status}</span>;
}

function Toggle({ on, set }) {
  return (
    <div onClick={()=>set(!on)} style={{width:48,height:26,borderRadius:13,cursor:"pointer",background:on?BLUE:"#cbd5e1",position:"relative",transition:"background .2s",flexShrink:0}}>
      <div style={{width:20,height:20,borderRadius:"50%",background:"white",position:"absolute",top:3,left:on?25:3,transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}}/>
    </div>
  );
}

function Modal({ title, onClose, children, th }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,padding:16}}>
      <div style={{background:th.card,borderRadius:20,padding:24,width:"100%",maxWidth:460,boxShadow:"0 20px 60px rgba(0,0,0,.3)",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:18,color:th.text}}>{title}</div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:24,cursor:"pointer",color:th.subtext,padding:0,lineHeight:1}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function NavBar({ title, onBack, actions }) {
  return (
    <div style={{background:NAVY,padding:"0 24px",height:64,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 12px rgba(0,0,0,.2)"}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        {onBack&&<button onClick={onBack} style={{background:"rgba(255,255,255,0.12)",border:"none",fontSize:18,cursor:"pointer",color:"white",padding:"6px 12px",borderRadius:8}}>←</button>}
        <span style={{fontWeight:700,fontSize:18,color:"white"}}>{title}</span>
      </div>
      {actions&&<div style={{display:"flex",gap:8}}>{actions}</div>}
    </div>
  );
}

function Loader() {
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:`linear-gradient(135deg,${NAVY},#1e3a8a)`,flexDirection:"column",gap:16}}>
      <Logo size={60}/>
      <div style={{fontSize:14,color:"rgba(255,255,255,0.7)",fontFamily:"system-ui,sans-serif"}}>Loading…</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════
function LoginScreen({ users, onLogin }) {
  const [email,setEmail]=useState("");
  const [pass, setPass] =useState("");
  const [err,  setErr]  =useState("");
  const login = () => {
    const u=users.find(u=>u.email===email&&u.password===pass);
    if(u) onLogin(u); else setErr("Invalid email or password.");
  };
  const inp = {width:"100%",padding:"12px 14px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#0f172a",fontSize:14,outline:"none",fontFamily:"system-ui,sans-serif",boxSizing:"border-box"};
  return (
    <div style={{minHeight:"100vh",background:`linear-gradient(135deg,${NAVY} 0%,#1e3a8a 50%,#1e40af 100%)`,display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"system-ui,sans-serif"}}>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:16}}><Logo size={80}/></div>
          <div style={{fontSize:30,fontWeight:800,color:"white",letterSpacing:"-0.5px",fontFamily:"Georgia,serif"}}>LuxeBound Albums</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.6)",marginTop:6,letterSpacing:"2px",textTransform:"uppercase"}}>Order Management</div>
        </div>
        <div style={{background:"white",borderRadius:20,padding:32,boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
          <Field label="Email" style={{marginBottom:16}}>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" style={inp} onKeyDown={e=>e.key==="Enter"&&login()}/>
          </Field>
          <Field label="Password" style={{marginBottom:22}}>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="Enter your password" style={inp} onKeyDown={e=>e.key==="Enter"&&login()}/>
          </Field>
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
  const zno    =orders.reduce((s,o)=>s+(Number(o.znoCost)||0),0);
  const profit =revenue-zno;
  return (
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
  return (
    <div style={{marginBottom:24,background:"white",borderRadius:16,padding:"18px 20px",boxShadow:"0 4px 16px rgba(0,0,0,0.07)"}}>
      <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:12,textTransform:"uppercase",letterSpacing:"1px"}}>Pipeline</div>
      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
        {STATUSES.map(s=>{
          const count=orders.filter(o=>o.status===s).length;
          const active=statusFilter===s;
          return (
            <div key={s} onClick={()=>setStatusFilter(active?null:s)} style={{flexShrink:0,padding:"10px 14px",borderRadius:12,cursor:"pointer",background:active?BLUE:"#f1f5f9",color:active?"white":"#334155",border:`2px solid ${active?BLUE:"transparent"}`,textAlign:"center",minWidth:90,transition:"all .15s"}}>
              <div style={{fontSize:22,fontWeight:800,color:active?"white":BLUE,lineHeight:1}}>{count}</div>
              <div style={{fontSize:9.5,marginTop:4,lineHeight:1.3,fontWeight:600}}>{s}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryBar({ filtered }) {
  const count  =filtered.length;
  const revenue=filtered.reduce((s,o)=>s+(Number(o.finalTotal)||Number(o.total)||0),0);
  const zno    =filtered.reduce((s,o)=>s+(Number(o.znoCost)||0),0);
  const profit =revenue-zno;
  const paid   =filtered.filter(o=>o.paid).length;
  return (
    <div style={{background:`linear-gradient(135deg,${NAVY},#1e3a8a)`,borderRadius:14,padding:"14px 20px",marginBottom:16,display:"flex",gap:24,overflowX:"auto",flexWrap:"wrap",boxShadow:"0 4px 16px rgba(15,31,75,0.25)"}}>
      {[["Orders",count],["Revenue",fmt$(revenue)],["Zno",fmt$(zno)],["Profit",fmt$(profit)],["Paid",`${paid}/${count}`]].map(([l,v])=>(
        <div key={l} style={{textAlign:"center",minWidth:80}}>
          <div style={{fontSize:16,fontWeight:800,color:"white"}}>{v}</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginTop:2}}>{l}</div>
        </div>
      ))}
    </div>
  );
}

function Filters({ search,setSearch,albumFilter,setAlbumFilter,statusFilter,setStatusFilter,albums,th }) {
  const has=search||albumFilter||statusFilter;
  return (
    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search name, phone..." style={{...iStyle(th),flex:1,minWidth:180,fontSize:13}}/>
      <select value={albumFilter} onChange={e=>setAlbumFilter(e.target.value)} style={{...iStyle(th),width:"auto",fontSize:13}}>
        <option value="">All Albums</option>
        {albums.map(a=><option key={a.id} value={a.name}>{a.name}</option>)}
      </select>
      {has&&<button onClick={()=>{setSearch("");setAlbumFilter("");setStatusFilter(null);}} style={{padding:"10px 16px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"white",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Clear ×</button>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ORDER CARD
// ══════════════════════════════════════════════════════════
function OrderCard({ order, onEdit, onDelete }) {
  const finalTotal=(Number(order.finalTotal)||Number(order.total)||0);
  const profit    =finalTotal-(Number(order.znoCost)||0);
  const albumList =(order.selectedAlbums||[]).filter(a=>a.albumType);
  const upgList   =Object.entries(order.selectedUpgrades||{}).filter(([,q])=>Number(q)>0);
  const hasDiscount=(order.discountValue>0);

  return (
    <div style={{background:"white",borderRadius:14,padding:"18px 20px",marginBottom:12,border:"1px solid #e8ecf0",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div>
          <div style={{fontWeight:700,fontSize:17,color:"#0f172a",marginBottom:2}}>{order.customerName}</div>
          <div style={{fontSize:12,color:"#64748b"}}>{order.phone}</div>
        </div>
        <Badge status={order.status}/>
      </div>

      {/* Order Details */}
      <div style={{background:"#f8fafc",borderRadius:10,padding:"12px 14px",marginBottom:12,border:"1px solid #f1f5f9"}}>
        <div style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:8}}>📋 Order Details</div>
        {albumList.length>0
          ? albumList.map((a,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#334155",marginBottom:5}}>
                <span>📚 {a.albumType}</span>
                <span style={{fontWeight:600,color:BLUE}}>{fmt$(a.albumPrice)}</span>
              </div>
            ))
          : order.albumType
            ? <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#334155",marginBottom:5}}>
                <span>📚 {order.albumType}</span>
                <span style={{fontWeight:600,color:BLUE}}>{fmt$(order.albumPrice)}</span>
              </div>
            : null
        }
        {upgList.map(([id,qty])=>{
          const name =(order.upgradeNames||{})[id]||id;
          const price=(order.upgradePrices||{})[id]||0;
          return (
            <div key={id} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#334155",marginBottom:5}}>
              <span>✨ {name}{Number(qty)>1?` ×${qty}`:""}</span>
              <span style={{fontWeight:600,color:AMBER}}>{fmt$(price*Number(qty))}</span>
            </div>
          );
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
        {[
          {label:"Total",  val:fmt$(finalTotal),color:BLUE},
          {label:"Zno",    val:fmt$(order.znoCost),color:AMBER},
          {label:"Profit", val:fmt$(profit),color:profit>=0?GREEN:RED},
          {label:"Paid",   val:order.paid?"✓ Yes":"✗ No",color:order.paid?GREEN:RED},
        ].map(({label,val,color})=>(
          <div key={label} style={{textAlign:"center"}}>
            <div style={{fontSize:15,fontWeight:800,color}}>{val}</div>
            <div style={{fontSize:10,color:"#94a3b8",marginTop:2,fontWeight:600}}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:11,color:"#94a3b8"}}>📅 {fmtD(order.dateCreated)}{order.dateSentToZno&&` · Zno: ${fmtD(order.dateSentToZno)}`}</div>
        <div style={{display:"flex",gap:8}}>
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
  const [step, setStep] =useState(1);
  const [range,setRange]=useState(null);
  const rl=[["7","Last 7 Days","📅"],["30","Last 30 Days","🗓"],["year","This Year","📆"],["all","All Time","🗃"]];
  const doExport=()=>{
    const now=new Date(); let data=orders;
    if(range==="7")    data=orders.filter(o=>o.dateCreated>=new Date(now-7*864e5).toISOString().split("T")[0]);
    if(range==="30")   data=orders.filter(o=>o.dateCreated>=new Date(now-30*864e5).toISOString().split("T")[0]);
    if(range==="year") data=orders.filter(o=>(o.dateCreated||"").startsWith(now.getFullYear().toString()));
    const headers=["Customer","Phone","Email","Albums","Date Created","Date Sent to Zno","Subtotal","Discount","Final Total","Zno","Profit","Paid","Payment","Status","Notes"];
    const rows=data.map(o=>{
      const names=(o.selectedAlbums||[{albumType:o.albumType}]).map(a=>a.albumType).filter(Boolean).join(", ");
      const ft=Number(o.finalTotal)||Number(o.total)||0;
      return[o.customerName,o.phone,o.email,names,o.dateCreated,o.dateSentToZno,o.total,ft<(o.total||0)?`-${fmt$((o.total||0)-ft)}`:"",ft,o.znoCost,ft-(Number(o.znoCost)||0),o.paid?"Yes":"No",o.paymentMethod,o.status,o.notes];
    });
    const csv=[headers,...rows].map(r=>r.map(c=>`"${(c||"").toString().replace(/"/g,'""')}"`).join(",")).join("\n");
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download=`LuxeBound_${todayStr()}.csv`; a.click(); onClose();
  };
  return (
    <Modal title="📊 Export Orders" onClose={onClose} th={th}>
      {step===1?(
        <>
          <div style={{fontSize:14,color:th.subtext,marginBottom:14}}>Select time range:</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {rl.map(([v,l,i])=>(
              <button key={v} onClick={()=>{setRange(v);setStep(2);}} style={{padding:"14px 18px",borderRadius:12,border:`1.5px solid ${th.border}`,background:th.inp,color:th.text,cursor:"pointer",textAlign:"left",fontSize:14,fontWeight:600,fontFamily:"system-ui,sans-serif",display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:20}}>{i}</span><span>{l}</span>
              </button>
            ))}
          </div>
        </>
      ):(
        <>
          <div style={{fontSize:14,color:th.subtext,marginBottom:14}}>Range: <strong>{rl.find(r=>r[0]===range)?.[1]}</strong></div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <button onClick={doExport} style={{padding:"16px 18px",borderRadius:12,border:"1.5px solid #16a34a",background:"#f0fdf4",color:"#15803d",cursor:"pointer",textAlign:"left",fontSize:15,fontWeight:700,fontFamily:"system-ui,sans-serif",display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:24}}>📗</span><div><div>Excel / CSV</div><div style={{fontSize:11,fontWeight:400,marginTop:2}}>Open in Excel or Google Sheets</div></div>
            </button>
            <button onClick={()=>setStep(1)} style={{padding:"10px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"white",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>← Back</button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════
function Dashboard({ orders,albums,statusFilter,setStatusFilter,search,setSearch,albumFilter,setAlbumFilter,onNew,onEdit,onDelete,onSettings,onSignOut,showExport,setShowExport,th }) {
  const filtered=orders.filter(o=>{
    if(statusFilter&&o.status!==statusFilter) return false;
    if(albumFilter){
      const names=(o.selectedAlbums||[{albumType:o.albumType}]).map(a=>a.albumType);
      if(!names.includes(albumFilter)) return false;
    }
    if(search){
      const q=search.toLowerCase();
      if(!((o.customerName||"").toLowerCase().includes(q)||(o.phone||"").includes(q))) return false;
    }
    return true;
  });
  return (
    <div style={{background:"linear-gradient(160deg,#e8eeff 0%,#f0f7ff 40%,#e8f5ff 100%)",minHeight:"100vh",fontFamily:"system-ui,sans-serif"}}>
      <NavBar title={<div style={{display:"flex",alignItems:"center",gap:14}}><Logo size={42}/><div><div style={{fontWeight:800,fontSize:18,color:"white",fontFamily:"Georgia,serif"}}>LuxeBound Albums</div><div style={{fontSize:11,color:"rgba(255,255,255,0.55)"}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div></div></div>}
        actions={[
          <Btn key="new" variant="success" sm onClick={onNew} style={{padding:"8px 20px",fontSize:13}}>+ New Order</Btn>,
          <Btn key="exp" variant="ghost"   sm onClick={()=>setShowExport(true)} style={{padding:"8px 20px",fontSize:13}}>📊 Export</Btn>,
          <Btn key="set" variant="ghost"   sm onClick={onSettings} style={{padding:"8px 20px",fontSize:13}}>⚙️ Settings</Btn>,
          <Btn key="out" variant="ghost"   sm onClick={onSignOut} style={{padding:"8px 20px",fontSize:13}}>Sign Out</Btn>,
        ]}/>
      <div style={{padding:"28px 32px",maxWidth:1200,margin:"0 auto"}}>
        <StatCards orders={orders}/>
        <Pipeline orders={orders} statusFilter={statusFilter} setStatusFilter={setStatusFilter}/>
        <div style={{background:"white",borderRadius:16,padding:"20px 22px",boxShadow:"0 4px 16px rgba(0,0,0,0.06)"}}>
          <Filters search={search} setSearch={setSearch} albumFilter={albumFilter} setAlbumFilter={setAlbumFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} albums={albums} th={th}/>
          <SummaryBar filtered={filtered}/>
          {filtered.length===0
            ?<div style={{textAlign:"center",padding:"56px 20px",color:"#94a3b8",fontSize:15}}>No orders.{" "}<span style={{color:BLUE,cursor:"pointer",fontWeight:600}} onClick={onNew}>Create first order →</span></div>
            :filtered.map(o=><OrderCard key={o.id} order={o} onEdit={onEdit} onDelete={onDelete}/>)
          }
        </div>
      </div>
      {showExport&&<ExportModal orders={orders} onClose={()=>setShowExport(false)} th={th}/>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ORDER FORM
// ══════════════════════════════════════════════════════════
function AlbumRow({ albums, entry, onChange, onRemove, canRemove, th }) {
  return (
    <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:10,background:"#f8fafc",borderRadius:10,padding:"10px 14px",border:"1px solid #e8ecf0"}}>
      <select value={entry.albumType||""} onChange={e=>{
        const a=albums.find(a=>a.name===e.target.value);
        onChange({...entry,albumType:e.target.value,albumPrice:a?a.price:0});
      }} style={{...iStyle(th),flex:2,fontSize:13}}>
        <option value="">Select album...</option>
        {albums.map(a=><option key={a.id} value={a.name}>{a.name} — ${a.price}</option>)}
      </select>
      <div style={{fontWeight:700,color:BLUE,minWidth:55,textAlign:"right",fontSize:13}}>{fmt$(entry.albumPrice||0)}</div>
      {canRemove&&<button onClick={onRemove} style={{background:"none",border:"none",color:RED,cursor:"pointer",fontSize:20,padding:"0 4px",lineHeight:1}}>×</button>}
    </div>
  );
}

function OrderForm({ order, albums, upgrades, paymentMethods, onSave, onCancel, onDelete, th }) {
  const isEdit=!!order?.id;
  const [customerName,setCustomerName]=useState(order?.customerName||"");
  const [phone,       setPhone]       =useState(order?.phone||"");
  const [email,       setEmail]       =useState(order?.email||"");
  const [dateCreated, setDateCreated] =useState(order?.dateCreated||todayStr());

  const initAlbums=order?.selectedAlbums||(order?.albumType?[{id:uid(),albumType:order.albumType,albumPrice:order.albumPrice||0}]:[{id:uid(),albumType:"",albumPrice:0}]);
  const [selAlbums,setSelAlbums]=useState(initAlbums);

  const [selUpg,    setSelUpg]    =useState(order?.selectedUpgrades||{});
  const [znoCost,   setZnoCost]   =useState(order?.znoCost??"");
  const [dateSentZno,setDateSentZno]=useState(order?.dateSentToZno||"");
  const [znoCostSet,setZnoCostSet]=useState(!!order?.dateSentToZno);
  const [discType,  setDiscType]  =useState(order?.discountType||"amount");
  const [discVal,   setDiscVal]   =useState(order?.discountValue||"");
  const [payment,   setPayment]   =useState(order?.paymentMethod||"");
  const [paid,      setPaid]      =useState(order?.paid||false);
  const [status,    setStatus]    =useState(order?.status||"New Order");
  const [notes,     setNotes]     =useState(order?.notes||"");
  const [err,       setErr]       =useState("");
  const [saving,    setSaving]    =useState(false);

  const albumsTotal=selAlbums.reduce((s,a)=>s+(Number(a.albumPrice)||0),0);
  const upgTotal   =upgrades.reduce((s,u)=>{const q=Number(selUpg[u.id]||0);return s+(q>0?u.price*q:0);},0);
  const subtotal   =albumsTotal+upgTotal;
  const discAmt    =discVal?(discType==="percent"?subtotal*(Number(discVal)||0)/100:Number(discVal)||0):0;
  const finalTotal =Math.max(0,subtotal-discAmt);
  const profit     =finalTotal-(Number(znoCost)||0);

  const handleZno=val=>{setZnoCost(val);if(val&&!znoCostSet){setDateSentZno(todayStr());setZnoCostSet(true);}};

  const handleSave=async()=>{
    if(!customerName.trim()){setErr("Customer name is required.");return;}
    if(!phone.trim()){setErr("Phone number is required.");return;}
    setSaving(true);setErr("");
    try{
      const upgradeNames={};const upgradePrices={};
      upgrades.forEach(u=>{upgradeNames[u.id]=u.name;upgradePrices[u.id]=u.price;});
      const data=clean({
        customerName:customerName.trim(), phone, email, dateCreated,
        selectedAlbums:selAlbums,
        albumType:selAlbums[0]?.albumType||"",
        albumPrice:selAlbums[0]?.albumPrice||0,
        selectedUpgrades:selUpg,
        upgradeNames, upgradePrices,
        total:subtotal,
        discountType:discType,
        discountValue:Number(discVal)||0,
        finalTotal,
        znoCost:Number(znoCost)||0,
        dateSentToZno:dateSentZno||"",
        paymentMethod:payment,
        paid, status,
        notes:notes||"",
      });
      await onSave({id:order?.id,...data});
    }catch(e){
      console.error(e);
      setErr("Failed to save: "+(e.message||"Please try again."));
      setSaving(false);
    }
  };

  const inp=iStyle(th);
  const sec={background:"white",borderRadius:14,padding:20,marginBottom:14,border:"1px solid #e8ecf0",boxShadow:"0 2px 8px rgba(0,0,0,0.05)"};

  return (
    <div style={{background:"linear-gradient(160deg,#e8eeff 0%,#f0f7ff 100%)",minHeight:"100vh",fontFamily:"system-ui,sans-serif"}}>
      <NavBar title={isEdit?"✏️ Edit Order":"📝 New Order"} onBack={onCancel}/>
      <div style={{padding:"24px 28px",maxWidth:700,margin:"0 auto"}}>

        {/* Customer */}
        <div style={sec}>
          <div style={{fontWeight:700,fontSize:15,color:"#0f172a",marginBottom:14,paddingBottom:10,borderBottom:"1px solid #f1f5f9"}}>👤 Customer Info</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Full Name" required style={{gridColumn:"1/-1"}}>
              <input value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Full name" style={inp}/>
            </Field>
            <Field label="Phone Number" required>
              <input value={phone} onChange={e=>setPhone(fmtPhone(e.target.value))} placeholder="718-307-3333" maxLength={12} style={inp} inputMode="numeric"/>
            </Field>
            <Field label="Email">
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@example.com" style={inp}/>
            </Field>
            <Field label="Date Created" style={{gridColumn:"1/-1"}}>
              <input type="date" value={dateCreated} onChange={e=>setDateCreated(e.target.value)} style={inp}/>
            </Field>
          </div>
        </div>

        {/* Albums */}
        <div style={sec}>
          <div style={{fontWeight:700,fontSize:15,color:"#0f172a",marginBottom:14,paddingBottom:10,borderBottom:"1px solid #f1f5f9"}}>📚 Albums</div>
          {selAlbums.map((entry,i)=>(
            <AlbumRow key={entry.id||i} albums={albums} entry={entry}
              onChange={upd=>setSelAlbums(prev=>prev.map((a,idx)=>idx===i?upd:a))}
              onRemove={()=>setSelAlbums(prev=>prev.filter((_,idx)=>idx!==i))}
              canRemove={selAlbums.length>1} th={th}/>
          ))}
          <button onClick={()=>setSelAlbums(prev=>[...prev,{id:uid(),albumType:"",albumPrice:0}])} style={{padding:"8px 18px",borderRadius:8,border:`1.5px dashed ${BLUE}`,background:"#eff2ff",color:BLUE,cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif",marginTop:4}}>
            + Add Another Album
          </button>
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
                <button key={t} onClick={()=>setDiscType(t)} style={{padding:"8px 16px",border:"none",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif",background:discType===t?BLUE:"white",color:discType===t?"white":"#64748b",transition:"all .15s"}}>
                  {t==="amount"?"$ Amount":"% Percent"}
                </button>
              ))}
            </div>
            <input type="number" value={discVal} onChange={e=>setDiscVal(e.target.value)} placeholder={discType==="amount"?"e.g. 100":"e.g. 10"} style={{...inp,flex:1}}/>
            {discVal>0&&<div style={{fontSize:14,fontWeight:700,color:RED,whiteSpace:"nowrap"}}>-{fmt$(discAmt)}</div>}
          </div>
        </div>

        {/* Totals Strip */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:14}}>
          {[
            {label:"Customer Total",val:fmt$(finalTotal),color:BLUE,bg:"linear-gradient(135deg,#eff2ff,#e8ecff)",edit:false},
            {label:"Zno Cost",color:AMBER,bg:"linear-gradient(135deg,#fffbeb,#fef3c7)",edit:true},
            {label:"Your Profit",val:fmt$(profit),color:profit>=0?GREEN:RED,bg:profit>=0?"linear-gradient(135deg,#f0fdf4,#dcfce7)":"linear-gradient(135deg,#fef2f2,#fecaca)",edit:false},
          ].map(item=>(
            <div key={item.label} style={{background:item.bg,borderRadius:14,padding:"16px 12px",textAlign:"center",border:`2px solid ${item.color}22`}}>
              <div style={{fontSize:10,color:item.color,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:8}}>{item.label}</div>
              {item.edit
                ?<input type="number" value={znoCost} onChange={e=>handleZno(e.target.value)} placeholder="0.00" style={{width:"100%",border:"none",background:"transparent",textAlign:"center",fontSize:18,fontWeight:800,color:AMBER,outline:"none",fontFamily:"system-ui,sans-serif"}}/>
                :<div style={{fontSize:18,fontWeight:800,color:item.color}}>{item.val}</div>
              }
            </div>
          ))}
        </div>

        {(znoCost!==""||dateSentZno)&&(
          <div style={{...sec,marginBottom:14}}>
            <Field label="Date Sent to Zno"><input type="date" value={dateSentZno} onChange={e=>setDateSentZno(e.target.value)} style={inp}/></Field>
          </div>
        )}

        {/* Payment & Status */}
        <div style={sec}>
          <div style={{fontWeight:700,fontSize:15,color:"#0f172a",marginBottom:14,paddingBottom:10,borderBottom:"1px solid #f1f5f9"}}>💳 Payment & Status</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12,marginBottom:16}}>
            <Field label="Payment Method">
              <select value={payment} onChange={e=>setPayment(e.target.value)} style={inp}>
                <option value="">Select...</option>
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
              {STATUSES.map(s=>(
                <button key={s} onClick={()=>setStatus(s)} style={{padding:"6px 12px",borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"system-ui,sans-serif",background:status===s?BLUE:"#f1f5f9",color:status===s?"white":"#475569",border:`1.5px solid ${status===s?BLUE:"transparent"}`}}>{s}</button>
              ))}
            </div>
          </Field>
        </div>

        {/* Notes */}
        <div style={sec}>
          <Field label="Notes"><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any additional notes..." rows={3} style={{...inp,resize:"vertical"}}/></Field>
        </div>

        {err&&<div style={{color:RED,fontSize:13,marginBottom:14,padding:"10px 14px",background:"#fef2f2",borderRadius:10}}>{err}</div>}

        {/* Bottom Buttons */}
        <div style={{display:"flex",gap:12,alignItems:"stretch",paddingBottom:48}}>
          <button onClick={onCancel} style={{flex:1,padding:"14px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"white",color:"#64748b",cursor:"pointer",fontSize:14,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{flex:2,padding:"14px",borderRadius:10,border:"none",background:saving?"#94a3b8":`linear-gradient(135deg,${GREEN},#34d399)`,color:"white",cursor:saving?"not-allowed":"pointer",fontSize:15,fontWeight:700,fontFamily:"system-ui,sans-serif",boxShadow:saving?"none":"0 4px 14px rgba(24,185,120,0.4)"}}>
            {saving?"Saving…":isEdit?"💾 Save Changes":"✅ Create Order"}
          </button>
          {isEdit&&onDelete&&(
            <button onClick={()=>onDelete(order)} style={{flex:1,padding:"14px",borderRadius:10,border:"none",background:RED,color:"white",cursor:"pointer",fontSize:14,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>
              🗑️ Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════
function ListEditor({ items,onSave,th,placeholder="Name" }) {
  const [list,setList]=useState(items.map(i=>({...i})));
  const [nName,setNN]=useState(""); const [nPrice,setNP]=useState("");
  const inp=iStyle(th);
  const update=u=>{setList(u);onSave(u);};
  const add=()=>{if(!nName.trim())return;update([...list,{id:uid(),name:nName.trim(),price:Number(nPrice)||0}]);setNN("");setNP("");};
  const remove=id=>update(list.filter(i=>i.id!==id));
  const change=(id,f,v)=>update(list.map(i=>i.id===id?{...i,[f]:f==="price"?Number(v)||0:v}:i));
  return(
    <div>
      {list.map(item=>(
        <div key={item.id} style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,background:th.card,borderRadius:10,padding:12,border:`1px solid ${th.border}`}}>
          <input value={item.name} onChange={e=>change(item.id,"name",e.target.value)} style={{...inp,flex:2,padding:"8px 10px",fontSize:13}}/>
          <input type="number" value={item.price} onChange={e=>change(item.id,"price",e.target.value)} style={{...inp,width:80,padding:"8px 10px",fontSize:13}}/>
          <button onClick={()=>remove(item.id)} style={{padding:"8px 12px",borderRadius:8,border:"none",background:RED,color:"white",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>✕</button>
        </div>
      ))}
      <div style={{display:"flex",gap:8,marginTop:16,alignItems:"center"}}>
        <input value={nName} onChange={e=>setNN(e.target.value)} placeholder={placeholder} style={{...inp,flex:2,padding:"9px 12px",fontSize:13}}/>
        <input type="number" value={nPrice} onChange={e=>setNP(e.target.value)} placeholder="Price" style={{...inp,width:80,padding:"9px 12px",fontSize:13}}/>
        <button onClick={add} style={{padding:"9px 16px",borderRadius:8,border:"none",background:BLUE,color:"white",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>+ Add</button>
      </div>
    </div>
  );
}

function PaymentsTab({paymentMethods,onSave,th}){
  const [items,setItems]=useState([...paymentMethods]); const [newItem,setNew]=useState("");
  const inp=iStyle(th);
  const add=()=>{if(!newItem.trim()||items.includes(newItem.trim()))return;const u=[...items,newItem.trim()];setItems(u);onSave(u);setNew("");};
  const remove=i=>{const u=items.filter((_,idx)=>idx!==i);setItems(u);onSave(u);};
  return(
    <div>
      {items.map((p,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,background:th.card,borderRadius:10,padding:"12px 16px",border:`1px solid ${th.border}`}}>
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
  const remove=id=>{
    if(users.find(u=>u.id===id)?.role==="admin"&&users.filter(u=>u.role==="admin").length===1){alert("Cannot remove the last admin.");return;}
    onSave(users.filter(u=>u.id!==id));
  };
  const toggleRole=id=>onSave(users.map(u=>u.id===id?{...u,role:u.role==="admin"?"user":"admin"}:u));
  return(
    <div>
      {users.map(u=>(
        <div key={u.id} style={{background:th.card,borderRadius:12,padding:16,marginBottom:10,border:`1px solid ${th.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:14,color:th.text}}>{u.email}</div>
              <div style={{fontSize:12,color:th.subtext,marginTop:2}}>Password: <span style={{fontFamily:"monospace"}}>{u.password}</span></div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginTop:10}}>
                <span style={{fontSize:12,color:th.subtext}}>Role:</span>
                <span style={{fontSize:12,fontWeight:700,color:u.role==="admin"?BLUE:th.subtext,minWidth:36}}>{u.role}</span>
                <Toggle on={u.role==="admin"} set={()=>toggleRole(u.id)}/>
                <span style={{fontSize:11,color:th.subtext}}>Admin</span>
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
          <select value={nRole} onChange={e=>setNR(e.target.value)} style={{...inp,fontSize:13}}>
            <option value="user">User</option><option value="admin">Admin</option>
          </select>
          {err&&<div style={{color:RED,fontSize:12}}>{err}</div>}
          <button onClick={add} style={{padding:"10px",borderRadius:10,border:"none",background:BLUE,color:"white",cursor:"pointer",fontSize:14,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Add User</button>
        </div>
      </div>
    </div>
  );
}

function AccountTab({currentUser,onChangePw,darkMode,onToggleDark,th}){
  const [cur,setCur]=useState(""); const [newPw,setNew]=useState(""); const [conf,setConf]=useState(""); const [msg,setMsg]=useState(""); const [err,setErr]=useState("");
  const inp=iStyle(th);
  const change=()=>{
    if(cur!==currentUser.password){setErr("Current password incorrect.");setMsg("");return;}
    if(newPw.length<4||newPw.length>10){setErr("Must be 4–10 characters.");setMsg("");return;}
    if(newPw!==conf){setErr("Passwords don't match.");setMsg("");return;}
    onChangePw(currentUser.email,newPw);setMsg("✓ Password changed!");setErr("");setCur("");setNew("");setConf("");
  };
  return(
    <div>
      <div style={{background:th.card,borderRadius:12,padding:16,border:`1px solid ${th.border}`,marginBottom:12}}>
        <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:4}}>Logged in as</div>
        <div style={{fontSize:14,color:th.subtext}}>{currentUser.email}</div>
        <div style={{fontSize:12,color:BLUE,fontWeight:700,marginTop:3}}>{currentUser.role}</div>
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
        <div>
          <div style={{fontWeight:700,fontSize:14,color:th.text}}>Dark Mode</div>
          <div style={{fontSize:12,color:th.subtext,marginTop:2}}>{darkMode?"On":"Off"}</div>
        </div>
        <Toggle on={darkMode} set={onToggleDark}/>
      </div>
    </div>
  );
}

function SettingsPanel({currentUser,albums,onSaveAlbums,upgrades,onSaveUpgrades,paymentMethods,onSavePayments,users,onSaveUsers,darkMode,onToggleDark,onChangePw,onBack,activeTab,setActiveTab,th}){
  const isAdmin=currentUser.role==="admin";
  const tabs=[
    {id:"albums",icon:"📚",label:"Albums",desc:"Manage album types & prices"},
    {id:"upgrades",icon:"✨",label:"Upgrades",desc:"Manage add-ons & prices"},
    {id:"payments",icon:"💳",label:"Payments",desc:"Payment methods"},
    ...(isAdmin?[{id:"users",icon:"👥",label:"Users",desc:"Manage user accounts"}]:[]),
    {id:"account",icon:"🔑",label:"My Account",desc:"Password & display settings"},
  ];
  if(activeTab){
    const tab=tabs.find(t=>t.id===activeTab);
    const content=()=>{
      switch(activeTab){
        case "albums":   return <ListEditor items={albums} onSave={onSaveAlbums} th={th} placeholder="Album name"/>;
        case "upgrades": return <ListEditor items={upgrades} onSave={onSaveUpgrades} th={th} placeholder="Upgrade name"/>;
        case "payments": return <PaymentsTab paymentMethods={paymentMethods} onSave={onSavePayments} th={th}/>;
        case "users":    return <UsersTab users={users} onSave={onSaveUsers} th={th}/>;
        case "account":  return <AccountTab currentUser={currentUser} onChangePw={onChangePw} darkMode={darkMode} onToggleDark={onToggleDark} th={th}/>;
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
  const [ready,       setReady]       =useState(false);
  const [currentUser, setCurrentUser] =useState(null);
  const [view,        setView]        =useState("dashboard");
  const [orders,      setOrders]      =useState([]);
  const [albums,      setAlbums]      =useState(DEFAULT_ALBUMS);
  const [upgrades,    setUpgrades]    =useState(DEFAULT_UPGRADES);
  const [payments,    setPayments]    =useState(DEFAULT_PAYMENTS);
  const [users,       setUsers]       =useState(DEFAULT_USERS);
  const [darkMode,    setDarkMode]    =useState(false);
  const [editingOrder,setEditingOrder]=useState(null);
  const [statusFilter,setStatusFilter]=useState(null);
  const [search,      setSearch]      =useState("");
  const [albumFilter, setAlbumFilter] =useState("");
  const [settingsTab, setSettingsTab] =useState(null);
  const [showExport,  setShowExport]  =useState(false);

  useEffect(()=>{
    const saved=lsGet("lb_user"); if(saved) setCurrentUser(saved);
    const dm=lsGet("lb_dark"); if(dm) setDarkMode(dm);
  },[]);

  useEffect(()=>{
    const unsubs=[];
    unsubs.push(onSnapshot(collection(db,"orders"),
      snap=>setOrders(snap.docs.map(d=>({id:d.id,...d.data()}))),
      e=>console.error("orders:",e)
    ));
    const cfg=(name,setter,fallback)=>unsubs.push(
      onSnapshot(doc(db,"config",name),
        snap=>{ if(snap.exists()) setter(snap.data().items??fallback); else setter(fallback); },
        e=>console.error(name,e)
      )
    );
    cfg("albums",  setAlbums,  DEFAULT_ALBUMS);
    cfg("upgrades",setUpgrades,DEFAULT_UPGRADES);
    cfg("payments",setPayments,DEFAULT_PAYMENTS);
    cfg("users",   setUsers,   DEFAULT_USERS);
    setReady(true);
    return()=>unsubs.forEach(u=>u());
  },[]);

  const theme={bg:"#f1f5f9",card:"white",text:"#0f172a",subtext:"#64748b",border:"#e2e8f0",inp:"#f8fafc"};

  const saveConfig=async(name,items)=>await setDoc(doc(db,"config",name),{items});

  const saveOrder=async(order)=>{
    const {id,...rawData}=order;
    const data=clean(rawData);
    if(id){ await setDoc(doc(db,"orders",id),data); }
    else  { await addDoc(collection(db,"orders"),data); }
    setView("dashboard"); setEditingOrder(null);
  };

  const deleteOrder=async(order)=>{
    if(window.confirm(`Delete order for ${order.customerName}? This cannot be undone.`)){
      await deleteDoc(doc(db,"orders",order.id));
      setView("dashboard"); setEditingOrder(null);
    }
  };

  const saveUsers=async(updated)=>{
    await saveConfig("users",updated);
    if(currentUser){
      const me=updated.find(u=>u.email===currentUser.email);
      if(me){ setCurrentUser(me); lsSet("lb_user",me); }
    }
  };

  const changePw=async(email,pass)=>await saveUsers(users.map(u=>u.email===email?{...u,password:pass}:u));
  const login   =u=>{setCurrentUser(u);lsSet("lb_user",u);};
  const signOut =()=>{setCurrentUser(null);lsSet("lb_user",null);};
  const togDark =()=>{const d=!darkMode;setDarkMode(d);lsSet("lb_dark",d);};

  if(!ready)      return <Loader/>;
  if(!currentUser) return <LoginScreen users={users} onLogin={login}/>;

  if(view==="newOrder"||view==="editOrder") return(
    <OrderForm
      order={editingOrder} albums={albums} upgrades={upgrades} paymentMethods={payments}
      onSave={saveOrder}
      onDelete={deleteOrder}
      onCancel={()=>{setView("dashboard");setEditingOrder(null);}}
      th={theme}/>
  );

  if(view==="settings") return(
    <SettingsPanel
      currentUser={currentUser}
      albums={albums}         onSaveAlbums={i=>saveConfig("albums",i)}
      upgrades={upgrades}     onSaveUpgrades={i=>saveConfig("upgrades",i)}
      paymentMethods={payments} onSavePayments={i=>saveConfig("payments",i)}
      users={users}           onSaveUsers={saveUsers}
      darkMode={darkMode}     onToggleDark={togDark}
      onChangePw={changePw}
      onBack={()=>{setView("dashboard");setSettingsTab(null);}}
      activeTab={settingsTab} setActiveTab={setSettingsTab}
      th={theme}/>
  );

  return(
    <Dashboard
      orders={orders} albums={albums}
      statusFilter={statusFilter} setStatusFilter={setStatusFilter}
      search={search}             setSearch={setSearch}
      albumFilter={albumFilter}   setAlbumFilter={setAlbumFilter}
      onNew={()=>{setEditingOrder(null);setView("newOrder");}}
      onEdit={o=>{setEditingOrder(o);setView("editOrder");}}
      onDelete={deleteOrder}
      onSettings={()=>setView("settings")}
      onSignOut={signOut}
      showExport={showExport} setShowExport={setShowExport}
      th={theme}/>
  );
}
