import { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection, doc, onSnapshot,
  setDoc, addDoc, deleteDoc
} from "firebase/firestore";

const BLUE  = "#5271FF";
const GREEN = "#18B978";
const RED   = "#ef4444";
const GOLD  = "#C9A84C";
const AMBER = "#f59e0b";

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

// ── Logo ──────────────────────────────────────────────────
function Logo({ size=38 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{flexShrink:0}}>
      <circle cx="20" cy="20" r="18" fill={BLUE} stroke={GOLD} strokeWidth="2.5"/>
      <text x="20" y="15" textAnchor="middle" fill="white" fontSize="8"
        fontFamily="Georgia,serif" fontWeight="700" letterSpacing="-0.5">LB</text>
      <text x="20" y="24.5" textAnchor="middle" fill={GOLD} fontSize="4"
        fontFamily="Georgia,serif" letterSpacing="1.5">ALBUMS</text>
    </svg>
  );
}

const iStyle = th => ({
  width:"100%", padding:"9px 12px", borderRadius:8,
  border:`1.5px solid ${th.border}`, background:th.inp,
  color:th.text, fontSize:13, outline:"none",
  fontFamily:"system-ui,sans-serif", boxSizing:"border-box",
});

function Btn({ children, onClick, variant="primary", sm, full, disabled, style:sx={} }) {
  const v = {
    primary:{ background:BLUE,  color:"white" },
    success:{ background:GREEN, color:"white" },
    danger: { background:RED,   color:"white" },
    ghost:  { background:"transparent", color:BLUE, border:`1.5px solid ${BLUE}` },
    gray:   { background:"#e2e8f0", color:"#475569" },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding:sm?"5px 12px":"9px 18px", borderRadius:8, border:"none",
      cursor:disabled?"not-allowed":"pointer", fontSize:sm?12:14, fontWeight:600,
      fontFamily:"system-ui,sans-serif", width:full?"100%":undefined,
      opacity:disabled?.5:1, whiteSpace:"nowrap", transition:"opacity .15s",
      ...(v[variant]||v.primary), ...sx,
    }}>{children}</button>
  );
}

function Field({ label, required, children, style:sx={} }) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:5,...sx}}>
      {label && <label style={{fontSize:11,fontWeight:700,letterSpacing:"0.6px",
        textTransform:"uppercase",color:"#64748b"}}>
        {label}{required&&<span style={{color:RED}}> *</span>}
      </label>}
      {children}
    </div>
  );
}

function Badge({ status }) {
  const c = STATUS_COLORS[status]||{bg:"#e5e7eb",tx:"#374151"};
  return <span style={{display:"inline-block",padding:"3px 9px",borderRadius:20,
    background:c.bg,color:c.tx,fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>{status}</span>;
}

function Toggle({ on, set }) {
  return (
    <div onClick={()=>set(!on)} style={{width:48,height:26,borderRadius:13,cursor:"pointer",
      background:on?BLUE:"#cbd5e1",position:"relative",transition:"background .2s",flexShrink:0}}>
      <div style={{width:20,height:20,borderRadius:"50%",background:"white",position:"absolute",
        top:3,left:on?25:3,transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}}/>
    </div>
  );
}

function Modal({ title, onClose, children, th }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",
      alignItems:"center",justifyContent:"center",zIndex:500,padding:16}}>
      <div style={{background:th.card,borderRadius:18,padding:22,width:"100%",maxWidth:420,
        boxShadow:"0 12px 40px rgba(0,0,0,.25)",maxHeight:"88vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div style={{fontWeight:700,fontSize:17,color:th.text}}>{title}</div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,
            cursor:"pointer",color:th.subtext,padding:0}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function BackHeader({ title, onBack, actions, th }) {
  return (
    <div style={{background:th.card,borderBottom:`1px solid ${th.border}`,padding:"0 16px",
      height:60,display:"flex",alignItems:"center",justifyContent:"space-between",
      position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 6px rgba(0,0,0,.06)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <button onClick={onBack} style={{background:"none",border:"none",fontSize:20,
          cursor:"pointer",color:th.text,padding:"4px 8px 4px 0"}}>←</button>
        <span style={{fontWeight:700,fontSize:17,color:th.text}}>{title}</span>
      </div>
      {actions&&<div style={{display:"flex",gap:8}}>{actions}</div>}
    </div>
  );
}

// ── Loading Spinner ───────────────────────────────────────
function Loader() {
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
      background:"#f1f5f9",flexDirection:"column",gap:16}}>
      <Logo size={56}/>
      <div style={{fontSize:14,color:"#64748b",fontFamily:"system-ui,sans-serif"}}>Loading…</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════
function LoginScreen({ users, onLogin }) {
  const [email,setEmail] = useState("");
  const [pass, setPass]  = useState("");
  const [err,  setErr]   = useState("");
  const th = {card:"white",inp:"#f8fafc",border:"#e2e8f0",text:"#0f172a",subtext:"#64748b"};
  const login = () => {
    const u = users.find(u=>u.email===email&&u.password===pass);
    if(u) onLogin(u); else setErr("Invalid email or password.");
  };
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#f0f4ff 0%,#fafbff 60%,#f0fff8 100%)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"system-ui,sans-serif"}}>
      <div style={{width:"100%",maxWidth:380}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:14}}><Logo size={70}/></div>
          <div style={{fontSize:26,fontWeight:800,color:"#0f172a",letterSpacing:"-0.5px",fontFamily:"Georgia,serif"}}>LuxeBound Albums</div>
          <div style={{fontSize:12,color:"#64748b",marginTop:5,letterSpacing:"1.5px",textTransform:"uppercase"}}>Order Management</div>
        </div>
        <div style={{background:"white",borderRadius:18,padding:28,
          boxShadow:"0 8px 40px rgba(82,113,255,.12)",border:"1px solid #e8ecff"}}>
          <Field label="Email" style={{marginBottom:14}}>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="your@email.com" style={iStyle(th)}
              onKeyDown={e=>e.key==="Enter"&&login()}/>
          </Field>
          <Field label="Password" style={{marginBottom:18}}>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)}
              placeholder="••••" style={iStyle(th)} onKeyDown={e=>e.key==="Enter"&&login()}/>
          </Field>
          {err&&<div style={{color:RED,fontSize:13,marginBottom:14,padding:"8px 12px",
            background:"#fef2f2",borderRadius:8}}>{err}</div>}
          <Btn onClick={login} full style={{padding:"12px",fontSize:15}}>Sign In</Btn>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// TOP BAR
// ══════════════════════════════════════════════════════════
function TopBar({ onNew, onExport, onSettings, onSignOut, th }) {
  const dateStr = new Date().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
  return (
    <div style={{background:th.card,borderBottom:`1px solid ${th.border}`,padding:"0 14px",
      height:60,display:"flex",alignItems:"center",justifyContent:"space-between",
      position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 8px rgba(0,0,0,.07)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <Logo size={36}/>
        <div>
          <div style={{fontWeight:800,fontSize:14,color:th.text,fontFamily:"Georgia,serif",lineHeight:1.2}}>LuxeBound Albums</div>
          <div style={{fontSize:10,color:th.subtext}}>{dateStr}</div>
        </div>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
        <Btn sm variant="success" onClick={onNew}>+ New</Btn>
        <Btn sm variant="ghost"   onClick={onExport}>Export</Btn>
        <Btn sm variant="ghost"   onClick={onSettings}>⚙️</Btn>
        <Btn sm variant="gray"    onClick={onSignOut}>Sign Out</Btn>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// STAT CARDS
// ══════════════════════════════════════════════════════════
function StatCards({ orders, th }) {
  const revenue = orders.reduce((s,o)=>s+(Number(o.total)||0),0);
  const zno     = orders.reduce((s,o)=>s+(Number(o.znoCost)||0),0);
  const profit  = revenue-zno;
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
      {[
        {icon:"📦",label:"Total Orders",val:orders.length,color:BLUE},
        {icon:"💰",label:"Revenue",val:fmt$(revenue),color:BLUE},
        {icon:"📈",label:"Your Profit",val:fmt$(profit),color:profit>=0?GREEN:RED},
        {icon:"🏭",label:"Zno Costs",val:fmt$(zno),color:AMBER},
      ].map(c=>(
        <div key={c.label} style={{background:th.card,borderRadius:14,padding:"14px 16px",
          boxShadow:"0 1px 8px rgba(0,0,0,.06)",border:`1px solid ${th.border}`}}>
          <div style={{fontSize:22,marginBottom:4}}>{c.icon}</div>
          <div style={{fontSize:20,fontWeight:800,color:c.color,letterSpacing:"-0.5px"}}>{c.val}</div>
          <div style={{fontSize:11,color:th.subtext,marginTop:2}}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// PIPELINE
// ══════════════════════════════════════════════════════════
function Pipeline({ orders, statusFilter, setStatusFilter, th }) {
  return (
    <div style={{marginBottom:16}}>
      <div style={{fontSize:11,fontWeight:700,color:th.subtext,marginBottom:8,
        textTransform:"uppercase",letterSpacing:"1px"}}>Pipeline</div>
      <div style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:6}}>
        {STATUSES.map(s=>{
          const count=orders.filter(o=>o.status===s).length;
          const active=statusFilter===s;
          return (
            <div key={s} onClick={()=>setStatusFilter(active?null:s)} style={{
              flexShrink:0,padding:"8px 11px",borderRadius:11,cursor:"pointer",
              background:active?BLUE:th.card,color:active?"white":th.text,
              border:`1.5px solid ${active?BLUE:th.border}`,
              textAlign:"center",minWidth:80,transition:"all .15s",
            }}>
              <div style={{fontSize:19,fontWeight:800,color:active?"white":BLUE}}>{count}</div>
              <div style={{fontSize:9.5,marginTop:2,lineHeight:1.3,fontWeight:600}}>{s}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// SUMMARY BAR
// ══════════════════════════════════════════════════════════
function SummaryBar({ filtered, th }) {
  const count   = filtered.length;
  const revenue = filtered.reduce((s,o)=>s+(Number(o.total)||0),0);
  const zno     = filtered.reduce((s,o)=>s+(Number(o.znoCost)||0),0);
  const profit  = revenue-zno;
  const paid    = filtered.filter(o=>o.paid).length;
  return (
    <div style={{background:`linear-gradient(135deg,${BLUE},#7c93ff)`,borderRadius:11,
      padding:"10px 14px",marginBottom:12,display:"flex",gap:16,overflowX:"auto",flexWrap:"wrap"}}>
      {[["Orders",count],["Revenue",fmt$(revenue)],["Zno",fmt$(zno)],
        ["Profit",fmt$(profit)],["Paid",`${paid}/${count}`]].map(([l,v])=>(
        <div key={l} style={{textAlign:"center",minWidth:65}}>
          <div style={{fontSize:13,fontWeight:800,color:"white"}}>{v}</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,.7)"}}>{l}</div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// FILTERS
// ══════════════════════════════════════════════════════════
function Filters({ search,setSearch,albumFilter,setAlbumFilter,statusFilter,setStatusFilter,albums,th }) {
  const hasFilter = search||albumFilter||statusFilter;
  return (
    <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
      <input value={search} onChange={e=>setSearch(e.target.value)}
        placeholder="🔍 Search name, phone..."
        style={{...iStyle(th),flex:1,minWidth:140,fontSize:13}}/>
      <select value={albumFilter} onChange={e=>setAlbumFilter(e.target.value)}
        style={{...iStyle(th),width:"auto",fontSize:13}}>
        <option value="">All Albums</option>
        {albums.map(a=><option key={a.id} value={a.name}>{a.name}</option>)}
      </select>
      {hasFilter&&<Btn sm variant="gray"
        onClick={()=>{setSearch("");setAlbumFilter("");setStatusFilter(null);}}>Clear ×</Btn>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ORDER CARD
// ══════════════════════════════════════════════════════════
function OrderCard({ order, onEdit, onDelete, th }) {
  const profit   = (Number(order.total)||0)-(Number(order.znoCost)||0);
  const upgCount = Object.values(order.selectedUpgrades||{}).filter(q=>q>0).length;
  return (
    <div style={{background:th.card,borderRadius:13,padding:14,marginBottom:9,
      border:`1px solid ${th.border}`,boxShadow:"0 1px 6px rgba(0,0,0,.05)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:15,color:th.text,marginBottom:2}}>{order.customerName}</div>
          <div style={{fontSize:12,color:th.subtext}}>
            {order.albumType}{upgCount>0?` + ${upgCount} add-on${upgCount>1?"s":""}` :""}
          </div>
          {order.phone&&<div style={{fontSize:11,color:th.subtext,marginTop:1}}>{order.phone}</div>}
        </div>
        <Badge status={order.status}/>
      </div>
      <div style={{display:"flex",gap:14,marginBottom:10,flexWrap:"wrap"}}>
        {[
          {label:"Total",  val:fmt$(order.total),  color:BLUE},
          {label:"Zno",    val:fmt$(order.znoCost), color:AMBER},
          {label:"Profit", val:fmt$(profit),        color:profit>=0?GREEN:RED},
          {label:"Paid",   val:order.paid?"✓ Yes":"✗ No",color:order.paid?GREEN:RED},
        ].map(({label,val,color})=>(
          <div key={label} style={{textAlign:"center"}}>
            <div style={{fontSize:14,fontWeight:700,color}}>{val}</div>
            <div style={{fontSize:10,color:th.subtext}}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:10,color:th.subtext}}>
          📅 {fmtD(order.dateCreated)}
          {order.dateSentToZno&&` · Zno: ${fmtD(order.dateSentToZno)}`}
        </div>
        <div style={{display:"flex",gap:6}}>
          <Btn sm variant="ghost"  onClick={()=>onEdit(order)}>Edit</Btn>
          <Btn sm variant="danger" onClick={()=>onDelete(order)}>Delete</Btn>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// EXPORT
// ══════════════════════════════════════════════════════════
function ExportModal({ orders, onClose, th }) {
  const doExport = range => {
    const now = new Date();
    let data = orders;
    if(range==="7")    data=orders.filter(o=>o.dateCreated>=new Date(now-7*864e5).toISOString().split("T")[0]);
    if(range==="30")   data=orders.filter(o=>o.dateCreated>=new Date(now-30*864e5).toISOString().split("T")[0]);
    if(range==="year") data=orders.filter(o=>(o.dateCreated||"").startsWith(now.getFullYear().toString()));
    const headers=["Customer","Phone","Email","Album","Date Created","Date Sent to Zno","Total","Zno Cost","Profit","Paid","Payment","Status","Notes"];
    const rows=data.map(o=>[o.customerName,o.phone,o.email,o.albumType,o.dateCreated,o.dateSentToZno,
      o.total,o.znoCost,(Number(o.total)||0)-(Number(o.znoCost)||0),o.paid?"Yes":"No",o.paymentMethod,o.status,o.notes]);
    const csv=[headers,...rows].map(r=>r.map(c=>`"${(c||"").toString().replace(/"/g,'""')}"`).join(",")).join("\n");
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download=`LuxeBound_${todayStr()}.csv`; a.click(); onClose();
  };
  return (
    <Modal title="📊 Export Orders" onClose={onClose} th={th}>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {[["7","Last 7 Days","📅"],["30","Last 30 Days","🗓"],["year","This Year","📆"],["all","All Time","🗃"]].map(([v,l,i])=>(
          <button key={v} onClick={()=>doExport(v)} style={{padding:"13px 16px",borderRadius:10,
            border:`1.5px solid ${th.border}`,background:th.inp,color:th.text,cursor:"pointer",
            textAlign:"left",fontSize:14,fontWeight:600,fontFamily:"system-ui,sans-serif",
            display:"flex",alignItems:"center",gap:10}}>
            <span>{i}</span><span>{l}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════
function Dashboard({ orders,albums,statusFilter,setStatusFilter,search,setSearch,
  albumFilter,setAlbumFilter,onNew,onEdit,onDelete,onSettings,onSignOut,
  showExport,setShowExport,th }) {
  const filtered = orders.filter(o=>{
    if(statusFilter&&o.status!==statusFilter) return false;
    if(albumFilter&&o.albumType!==albumFilter) return false;
    if(search){
      const q=search.toLowerCase();
      if(!((o.customerName||"").toLowerCase().includes(q)||(o.phone||"").includes(q)||(o.albumType||"").toLowerCase().includes(q))) return false;
    }
    return true;
  });
  return (
    <div style={{background:th.bg,minHeight:"100vh",fontFamily:"system-ui,sans-serif"}}>
      <TopBar onNew={onNew} onExport={()=>setShowExport(true)} onSettings={onSettings} onSignOut={onSignOut} th={th}/>
      <div style={{padding:"16px 14px",maxWidth:860,margin:"0 auto"}}>
        <StatCards orders={orders} th={th}/>
        <Pipeline orders={orders} statusFilter={statusFilter} setStatusFilter={setStatusFilter} th={th}/>
        <Filters search={search} setSearch={setSearch} albumFilter={albumFilter}
          setAlbumFilter={setAlbumFilter} statusFilter={statusFilter}
          setStatusFilter={setStatusFilter} albums={albums} th={th}/>
        <SummaryBar filtered={filtered} th={th}/>
        {filtered.length===0
          ? <div style={{textAlign:"center",padding:"48px 20px",color:th.subtext,fontSize:14}}>
              No orders.{" "}<span style={{color:BLUE,cursor:"pointer",fontWeight:600}} onClick={onNew}>Create first order →</span>
            </div>
          : filtered.map(o=><OrderCard key={o.id} order={o} onEdit={onEdit} onDelete={onDelete} th={th}/>)
        }
      </div>
      {showExport&&<ExportModal orders={orders} onClose={()=>setShowExport(false)} th={th}/>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ORDER FORM
// ══════════════════════════════════════════════════════════
function OrderForm({ order, albums, upgrades, paymentMethods, onSave, onCancel, th }) {
  const isEdit = !!order?.id;
  const [customerName,setCustomerName] = useState(order?.customerName||"");
  const [phone,       setPhone]        = useState(order?.phone||"");
  const [email,       setEmail]        = useState(order?.email||"");
  const [dateCreated, setDateCreated]  = useState(order?.dateCreated||todayStr());
  const [albumType,   setAlbumType]    = useState(order?.albumType||"");
  const [albumPrice,  setAlbumPrice]   = useState(order?.albumPrice||0);
  const [selUpg,      setSelUpg]       = useState(order?.selectedUpgrades||{});
  const [znoCost,     setZnoCost]      = useState(order?.znoCost??"");
  const [dateSentZno, setDateSentZno]  = useState(order?.dateSentToZno||"");
  const [znoCostSet,  setZnoCostSet]   = useState(!!order?.dateSentToZno);
  const [payment,     setPayment]      = useState(order?.paymentMethod||"");
  const [paid,        setPaid]         = useState(order?.paid||false);
  const [status,      setStatus]       = useState(order?.status||"New Order");
  const [notes,       setNotes]        = useState(order?.notes||"");
  const [err,         setErr]          = useState("");
  const [saving,      setSaving]       = useState(false);

  const upgTotal = upgrades.reduce((s,u)=>{const q=Number(selUpg[u.id]||0);return s+(q>0?u.price*q:0);},0);
  const total    = albumPrice+upgTotal;
  const profit   = total-(Number(znoCost)||0);

  const handleAlbum = name => { setAlbumType(name); const a=albums.find(a=>a.name===name); setAlbumPrice(a?a.price:0); };
  const handleZno   = val  => { setZnoCost(val); if(val&&!znoCostSet){setDateSentZno(todayStr());setZnoCostSet(true);} };

  const handleSave = async () => {
    if(!customerName.trim()){ setErr("Customer name is required."); return; }
    setSaving(true);
    try {
      await onSave({ id:order?.id, customerName:customerName.trim(), phone, email,
        dateCreated, albumType, albumPrice, selectedUpgrades:selUpg, total,
        znoCost:Number(znoCost)||0, dateSentToZno:dateSentZno,
        paymentMethod:payment, paid, status, notes });
    } catch(e) { setErr("Failed to save. Try again."); setSaving(false); }
  };

  const inp = iStyle(th);
  const sec = {background:th.card,borderRadius:13,padding:16,marginBottom:12,border:`1px solid ${th.border}`};

  return (
    <div style={{background:th.bg,minHeight:"100vh",fontFamily:"system-ui,sans-serif"}}>
      <BackHeader title={isEdit?"✏️ Edit Order":"📝 New Order"} onBack={onCancel} th={th}
        actions={[<Btn key="s" sm variant="success" onClick={handleSave} disabled={saving}>
          {saving?"Saving…":isEdit?"Save":"Create"}
        </Btn>]}/>
      <div style={{padding:"16px 14px",maxWidth:600,margin:"0 auto"}}>

        <div style={sec}>
          <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:12}}>👤 Customer</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="Name" required style={{gridColumn:"1/-1"}}>
              <input value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Full name" style={inp}/>
            </Field>
            <Field label="Phone">
              <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(555) 555-5555" style={inp}/>
            </Field>
            <Field label="Email">
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@example.com" style={inp}/>
            </Field>
            <Field label="Date Created" style={{gridColumn:"1/-1"}}>
              <input type="date" value={dateCreated} onChange={e=>setDateCreated(e.target.value)} style={inp}/>
            </Field>
          </div>
        </div>

        <div style={sec}>
          <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:12}}>📚 Album</div>
          <Field label="Album Type">
            <select value={albumType} onChange={e=>handleAlbum(e.target.value)} style={inp}>
              <option value="">Select album...</option>
              {albums.map(a=><option key={a.id} value={a.name}>{a.name} — ${a.price}</option>)}
            </select>
          </Field>
        </div>

        <div style={sec}>
          <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:12}}>✨ Add-ons</div>
          {upgrades.map(u=>{
            const checked=(selUpg[u.id]||0)>0;
            return (
              <div key={u.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,
                padding:"8px 12px",borderRadius:9,background:th.inp,
                border:`1px solid ${checked?BLUE+"44":th.border}`}}>
                <input type="checkbox" checked={checked}
                  onChange={e=>setSelUpg(p=>({...p,[u.id]:e.target.checked?1:0}))}
                  style={{width:16,height:16,cursor:"pointer",accentColor:BLUE}}/>
                <div style={{flex:1,fontSize:13,color:th.text,fontWeight:checked?600:400}}>
                  {u.name}<span style={{color:th.subtext,fontWeight:400}}> · +${u.price}</span>
                </div>
                {checked&&<input type="number" min={1} value={selUpg[u.id]||1}
                  onChange={e=>setSelUpg(p=>({...p,[u.id]:Number(e.target.value)||0}))}
                  style={{...inp,width:56,textAlign:"center",padding:"5px 8px",fontSize:13}}/>}
              </div>
            );
          })}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:9,marginBottom:12}}>
          {[
            {label:"Customer Total",val:fmt$(total),color:BLUE,bg:"#eff2ff",edit:false},
            {label:"Zno Cost",val:"",color:AMBER,bg:"#fffbeb",edit:true},
            {label:"Your Profit",val:fmt$(profit),color:profit>=0?GREEN:RED,bg:profit>=0?"#f0fdf4":"#fef2f2",edit:false},
          ].map(item=>(
            <div key={item.label} style={{background:item.bg,borderRadius:11,padding:"12px 10px",
              textAlign:"center",border:`1.5px solid ${item.color}33`}}>
              <div style={{fontSize:9.5,color:item.color,fontWeight:700,textTransform:"uppercase",
                letterSpacing:"0.6px",marginBottom:6}}>{item.label}</div>
              {item.edit
                ? <input type="number" value={znoCost} onChange={e=>handleZno(e.target.value)}
                    placeholder="0.00" style={{width:"100%",border:"none",background:"transparent",
                    textAlign:"center",fontSize:16,fontWeight:700,color:AMBER,outline:"none",
                    fontFamily:"system-ui,sans-serif"}}/>
                : <div style={{fontSize:16,fontWeight:800,color:item.color}}>{item.val}</div>
              }
            </div>
          ))}
        </div>

        {(znoCost!==""||dateSentZno)&&(
          <div style={{...sec,marginBottom:12}}>
            <Field label="Date Sent to Zno">
              <input type="date" value={dateSentZno} onChange={e=>setDateSentZno(e.target.value)} style={inp}/>
            </Field>
          </div>
        )}

        <div style={sec}>
          <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:12}}>💳 Payment & Status</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,marginBottom:14}}>
            <Field label="Payment Method">
              <select value={payment} onChange={e=>setPayment(e.target.value)} style={inp}>
                <option value="">Select...</option>
                {paymentMethods.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label=" ">
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",
                fontSize:13,color:th.text,fontWeight:600,padding:"9px 0",whiteSpace:"nowrap"}}>
                <input type="checkbox" checked={paid} onChange={e=>setPaid(e.target.checked)}
                  style={{width:17,height:17,accentColor:GREEN}}/>
                ✅ Paid
              </label>
            </Field>
          </div>
          <Field label="Status">
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:2}}>
              {STATUSES.map(s=>(
                <button key={s} onClick={()=>setStatus(s)} style={{
                  padding:"5px 10px",borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:600,
                  fontFamily:"system-ui,sans-serif",transition:"all .15s",
                  background:status===s?BLUE:th.inp,color:status===s?"white":th.text,
                  border:`1.5px solid ${status===s?BLUE:th.border}`}}>{s}</button>
              ))}
            </div>
          </Field>
        </div>

        <div style={sec}>
          <Field label="Notes">
            <textarea value={notes} onChange={e=>setNotes(e.target.value)}
              placeholder="Any additional notes..." rows={3} style={{...inp,resize:"vertical"}}/>
          </Field>
        </div>

        {err&&<div style={{color:RED,fontSize:13,marginBottom:12,padding:"9px 12px",
          background:"#fef2f2",borderRadius:8}}>{err}</div>}

        <div style={{display:"flex",gap:10,paddingBottom:40}}>
          <Btn onClick={onCancel} variant="gray" style={{flex:1}}>Cancel</Btn>
          <Btn onClick={handleSave} variant="success" disabled={saving} style={{flex:2}}>
            {saving?"Saving…":isEdit?"Save Changes":"Create Order"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// SETTINGS TABS
// ══════════════════════════════════════════════════════════
function ListEditor({ items, onSave, th, placeholder="Name" }) {
  const [list,setList] = useState(items.map(i=>({...i})));
  const [nName,setNN]  = useState("");
  const [nPrice,setNP] = useState("");
  const inp = iStyle(th);
  const update = u => { setList(u); onSave(u); };
  const add    = () => { if(!nName.trim()) return; update([...list,{id:uid(),name:nName.trim(),price:Number(nPrice)||0}]); setNN(""); setNP(""); };
  const remove = id => update(list.filter(i=>i.id!==id));
  const change = (id,f,v) => update(list.map(i=>i.id===id?{...i,[f]:f==="price"?Number(v)||0:v}:i));
  return (
    <div>
      {list.map(item=>(
        <div key={item.id} style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,
          background:th.card,borderRadius:10,padding:11,border:`1px solid ${th.border}`}}>
          <input value={item.name} onChange={e=>change(item.id,"name",e.target.value)}
            style={{...inp,flex:2,padding:"7px 10px",fontSize:13}}/>
          <input type="number" value={item.price} onChange={e=>change(item.id,"price",e.target.value)}
            style={{...inp,width:76,padding:"7px 10px",fontSize:13}}/>
          <Btn sm variant="danger" onClick={()=>remove(item.id)}>✕</Btn>
        </div>
      ))}
      <div style={{display:"flex",gap:8,marginTop:14,alignItems:"center"}}>
        <input value={nName} onChange={e=>setNN(e.target.value)} placeholder={placeholder}
          style={{...inp,flex:2,padding:"8px 10px",fontSize:13}}/>
        <input type="number" value={nPrice} onChange={e=>setNP(e.target.value)} placeholder="Price"
          style={{...inp,width:76,padding:"8px 10px",fontSize:13}}/>
        <Btn sm onClick={add}>+ Add</Btn>
      </div>
    </div>
  );
}

function PaymentsTab({ paymentMethods, onSave, th }) {
  const [items,setItems] = useState([...paymentMethods]);
  const [newItem,setNew] = useState("");
  const inp = iStyle(th);
  const add    = () => { if(!newItem.trim()||items.includes(newItem.trim())) return; const u=[...items,newItem.trim()]; setItems(u); onSave(u); setNew(""); };
  const remove = i => { const u=items.filter((_,idx)=>idx!==i); setItems(u); onSave(u); };
  return (
    <div>
      {items.map((p,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,
          background:th.card,borderRadius:10,padding:"11px 14px",border:`1px solid ${th.border}`}}>
          <span style={{flex:1,fontWeight:600,fontSize:14,color:th.text}}>{p}</span>
          <Btn sm variant="danger" onClick={()=>remove(i)}>✕</Btn>
        </div>
      ))}
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <input value={newItem} onChange={e=>setNew(e.target.value)} placeholder="e.g. VENMO"
          style={{...inp,flex:1,padding:"8px 10px",fontSize:13}}/>
        <Btn sm onClick={add}>+ Add</Btn>
      </div>
    </div>
  );
}

function UsersTab({ users, onSave, th }) {
  const [nEmail,setNE] = useState("");
  const [nPass, setNP] = useState("");
  const [nRole, setNR] = useState("user");
  const [err,   setErr]= useState("");
  const inp = iStyle(th);
  const add = () => {
    if(!nEmail.trim()||!nPass.trim()){ setErr("Email and password required."); return; }
    if(nPass.length<4||nPass.length>10){ setErr("Password must be 4–10 chars."); return; }
    if(users.find(u=>u.email===nEmail.trim())){ setErr("User already exists."); return; }
    onSave([...users,{id:uid(),email:nEmail.trim(),password:nPass,role:nRole}]);
    setNE(""); setNP(""); setNR("user"); setErr("");
  };
  const remove = id => {
    if(users.find(u=>u.id===id)?.role==="admin"&&users.filter(u=>u.role==="admin").length===1){
      alert("Cannot remove the last admin."); return;
    }
    onSave(users.filter(u=>u.id!==id));
  };
  return (
    <div>
      {users.map(u=>(
        <div key={u.id} style={{background:th.card,borderRadius:11,padding:14,marginBottom:10,border:`1px solid ${th.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontWeight:700,fontSize:14,color:th.text}}>{u.email}</div>
              <div style={{fontSize:12,color:th.subtext,marginTop:3}}>
                Role: <span style={{color:u.role==="admin"?BLUE:th.text,fontWeight:700}}>{u.role}</span>
              </div>
              <div style={{fontSize:12,color:th.subtext,marginTop:2}}>
                Password: <span style={{fontFamily:"monospace",color:th.text}}>{u.password}</span>
              </div>
            </div>
            <Btn sm variant="danger" onClick={()=>remove(u.id)}>Remove</Btn>
          </div>
        </div>
      ))}
      <div style={{background:th.card,borderRadius:13,padding:16,marginTop:16,border:`1px solid ${th.border}`}}>
        <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:12}}>Add New User</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <input type="email" value={nEmail} onChange={e=>setNE(e.target.value)} placeholder="Email" style={{...inp,fontSize:13}}/>
          <input value={nPass} onChange={e=>setNP(e.target.value)} placeholder="Password (4–10 chars)" style={{...inp,fontSize:13}}/>
          <select value={nRole} onChange={e=>setNR(e.target.value)} style={{...inp,fontSize:13}}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          {err&&<div style={{color:RED,fontSize:12}}>{err}</div>}
          <Btn onClick={add} full>Add User</Btn>
        </div>
      </div>
    </div>
  );
}

function AccountTab({ currentUser, onChangePw, darkMode, onToggleDark, th }) {
  const [cur,  setCur]  = useState("");
  const [newPw,setNew]  = useState("");
  const [conf, setConf] = useState("");
  const [msg,  setMsg]  = useState("");
  const [err,  setErr]  = useState("");
  const inp = iStyle(th);
  const change = () => {
    if(cur!==currentUser.password){ setErr("Current password incorrect."); setMsg(""); return; }
    if(newPw.length<4||newPw.length>10){ setErr("Must be 4–10 characters."); setMsg(""); return; }
    if(newPw!==conf){ setErr("Passwords don't match."); setMsg(""); return; }
    onChangePw(currentUser.email,newPw);
    setMsg("✓ Password changed!"); setErr(""); setCur(""); setNew(""); setConf("");
  };
  return (
    <div>
      <div style={{background:th.card,borderRadius:12,padding:16,border:`1px solid ${th.border}`,marginBottom:12}}>
        <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:4}}>Logged in as</div>
        <div style={{fontSize:14,color:th.subtext}}>{currentUser.email}</div>
        <div style={{fontSize:12,color:BLUE,fontWeight:700,marginTop:3}}>{currentUser.role}</div>
      </div>
      <div style={{background:th.card,borderRadius:12,padding:16,border:`1px solid ${th.border}`,marginBottom:12}}>
        <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:12}}>Change Password</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <input type="password" value={cur} onChange={e=>setCur(e.target.value)} placeholder="Current password" style={{...inp,fontSize:13}}/>
          <input type="password" value={newPw} onChange={e=>setNew(e.target.value)} placeholder="New password (4–10 chars)" style={{...inp,fontSize:13}}/>
          <input type="password" value={conf} onChange={e=>setConf(e.target.value)} placeholder="Confirm new password" style={{...inp,fontSize:13}}/>
          {err&&<div style={{color:RED,fontSize:12}}>{err}</div>}
          {msg&&<div style={{color:GREEN,fontSize:12}}>{msg}</div>}
          <Btn onClick={change} full>Change Password</Btn>
        </div>
      </div>
      <div style={{background:th.card,borderRadius:12,padding:"14px 16px",border:`1px solid ${th.border}`,
        display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontWeight:700,fontSize:14,color:th.text}}>Dark Mode</div>
          <div style={{fontSize:12,color:th.subtext,marginTop:2}}>{darkMode?"On":"Off"}</div>
        </div>
        <Toggle on={darkMode} set={onToggleDark}/>
      </div>
    </div>
  );
}

function SettingsPanel({ currentUser,albums,onSaveAlbums,upgrades,onSaveUpgrades,
  paymentMethods,onSavePayments,users,onSaveUsers,
  darkMode,onToggleDark,onChangePw,onBack,activeTab,setActiveTab,th }) {
  const isAdmin = currentUser.role==="admin";
  const tabs = [
    {id:"albums",  icon:"📚",label:"Albums",    desc:"Manage album types & prices"},
    {id:"upgrades",icon:"✨",label:"Upgrades",  desc:"Manage add-ons & prices"},
    {id:"payments",icon:"💳",label:"Payments",  desc:"Payment methods"},
    ...(isAdmin?[{id:"users",icon:"👥",label:"Users",desc:"Manage user accounts"}]:[]),
    {id:"account", icon:"🔑",label:"My Account",desc:"Password & display settings"},
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
    return (
      <div style={{background:th.bg,minHeight:"100vh",fontFamily:"system-ui,sans-serif"}}>
        <BackHeader title={`${tab?.icon} ${tab?.label}`} onBack={()=>setActiveTab(null)} th={th}/>
        <div style={{padding:"16px 14px",maxWidth:600,margin:"0 auto"}}>{content()}</div>
      </div>
    );
  }
  return (
    <div style={{background:th.bg,minHeight:"100vh",fontFamily:"system-ui,sans-serif"}}>
      <BackHeader title="⚙️ Settings" onBack={onBack} th={th}/>
      <div style={{padding:"16px 14px",maxWidth:600,margin:"0 auto"}}>
        {tabs.map(tab=>(
          <div key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{
            background:th.card,borderRadius:13,padding:"15px 18px",marginBottom:10,
            border:`1px solid ${th.border}`,display:"flex",alignItems:"center",
            justifyContent:"space-between",cursor:"pointer",
            boxShadow:"0 1px 5px rgba(0,0,0,.05)"}}>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <span style={{fontSize:24}}>{tab.icon}</span>
              <div>
                <div style={{fontWeight:700,fontSize:14,color:th.text}}>{tab.label}</div>
                <div style={{fontSize:12,color:th.subtext,marginTop:1}}>{tab.desc}</div>
              </div>
            </div>
            <span style={{color:th.subtext,fontSize:20}}>›</span>
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
  const [ready,        setReady]        = useState(false);
  const [currentUser,  setCurrentUser]  = useState(null);
  const [view,         setView]         = useState("dashboard");
  const [orders,       setOrders]       = useState([]);
  const [albums,       setAlbums]       = useState(DEFAULT_ALBUMS);
  const [upgrades,     setUpgrades]     = useState(DEFAULT_UPGRADES);
  const [payments,     setPayments]     = useState(DEFAULT_PAYMENTS);
  const [users,        setUsers]        = useState(DEFAULT_USERS);
  const [darkMode,     setDarkMode]     = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [search,       setSearch]       = useState("");
  const [albumFilter,  setAlbumFilter]  = useState("");
  const [settingsTab,  setSettingsTab]  = useState(null);
  const [showExport,   setShowExport]   = useState(false);

  // ── Load session from localStorage ──
  useEffect(() => {
    const saved = lsGet("lb_user");
    if(saved) setCurrentUser(saved);
    const dm = lsGet("lb_dark");
    if(dm) setDarkMode(dm);
  }, []);

  // ── Subscribe to Firestore ──
  useEffect(() => {
    const unsubs = [];

    // Orders
    unsubs.push(onSnapshot(collection(db,"orders"), snap => {
      setOrders(snap.docs.map(d=>({id:d.id,...d.data()})));
    }));

    // Config docs
    const cfgDoc = (name, setter, fallback) => {
      unsubs.push(onSnapshot(doc(db,"config",name), snap => {
        if(snap.exists()) setter(snap.data().items ?? fallback);
        else setter(fallback);
      }));
    };
    cfgDoc("albums",   setAlbums,   DEFAULT_ALBUMS);
    cfgDoc("upgrades", setUpgrades, DEFAULT_UPGRADES);
    cfgDoc("payments", setPayments, DEFAULT_PAYMENTS);
    cfgDoc("users",    setUsers,    DEFAULT_USERS);

    setReady(true);
    return () => unsubs.forEach(u=>u());
  }, []);

  const theme = {
    bg:      darkMode ? "#0f172a" : "#f1f5f9",
    card:    darkMode ? "#1e293b" : "#ffffff",
    text:    darkMode ? "#f1f5f9" : "#0f172a",
    subtext: darkMode ? "#94a3b8" : "#64748b",
    border:  darkMode ? "#334155" : "#e2e8f0",
    inp:     darkMode ? "#0f172a" : "#f8fafc",
  };

  // ── Firestore savers ──
  const saveConfig = async (name, items) => {
    await setDoc(doc(db,"config",name),{items});
  };

  const saveOrder = async (order) => {
    if(order.id) {
      const {id,...data} = order;
      await setDoc(doc(db,"orders",id), data);
    } else {
      await addDoc(collection(db,"orders"), order);
    }
    setView("dashboard");
    setEditingOrder(null);
  };

  const deleteOrder = async (order) => {
    if(window.confirm(`Delete order for ${order.customerName}? This cannot be undone.`)) {
      await deleteDoc(doc(db,"orders",order.id));
    }
  };

  const saveUsers = async (updated) => {
    await saveConfig("users", updated);
    // Update session if current user's password changed
    if(currentUser) {
      const me = updated.find(u=>u.email===currentUser.email);
      if(me) { setCurrentUser(me); lsSet("lb_user",me); }
    }
  };

  const changePw = async (email, pass) => {
    const updated = users.map(u=>u.email===email?{...u,password:pass}:u);
    await saveUsers(updated);
  };

  const login   = u => { setCurrentUser(u); lsSet("lb_user",u); };
  const signOut = () => { setCurrentUser(null); lsSet("lb_user",null); };
  const togDark = () => { const d=!darkMode; setDarkMode(d); lsSet("lb_dark",d); };

  if(!ready) return <Loader/>;
  if(!currentUser) return <LoginScreen users={users} onLogin={login}/>;

  if(view==="newOrder"||view==="editOrder") return (
    <OrderForm order={editingOrder} albums={albums} upgrades={upgrades}
      paymentMethods={payments} onSave={saveOrder}
      onCancel={()=>{setView("dashboard");setEditingOrder(null);}} th={theme}/>
  );

  if(view==="settings") return (
    <SettingsPanel currentUser={currentUser}
      albums={albums}   onSaveAlbums={items=>saveConfig("albums",items)}
      upgrades={upgrades} onSaveUpgrades={items=>saveConfig("upgrades",items)}
      paymentMethods={payments} onSavePayments={items=>saveConfig("payments",items)}
      users={users}     onSaveUsers={saveUsers}
      darkMode={darkMode} onToggleDark={togDark}
      onChangePw={changePw}
      onBack={()=>{setView("dashboard");setSettingsTab(null);}}
      activeTab={settingsTab} setActiveTab={setSettingsTab}
      th={theme}/>
  );

  return (
    <Dashboard orders={orders} albums={albums}
      statusFilter={statusFilter} setStatusFilter={setStatusFilter}
      search={search} setSearch={setSearch}
      albumFilter={albumFilter} setAlbumFilter={setAlbumFilter}
      onNew={()=>{setEditingOrder(null);setView("newOrder");}}
      onEdit={o=>{setEditingOrder(o);setView("editOrder");}}
      onDelete={deleteOrder}
      onSettings={()=>setView("settings")}
      onSignOut={signOut}
      showExport={showExport} setShowExport={setShowExport}
      th={theme}/>
  );
}
