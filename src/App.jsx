import React, { useState, useEffect, useRef, useCallback } from "react";
import { db, auth } from "./firebase";
import { collection, doc, onSnapshot, setDoc, addDoc, deleteDoc, getDocs } from "firebase/firestore";
import { signInWithEmailAndPassword, signOut as fbSignOut, onAuthStateChanged, updatePassword, updateProfile, sendPasswordResetEmail, createUserWithEmailAndPassword } from "firebase/auth";

const BLUE  = "#5271FF";
const GREEN = "#18B978";
const RED   = "#ef4444";
const GOLD  = "#C9A84C";
const AMBER = "#f59e0b";
const NAVY  = "#0f1f4b";

// V5: Status progress percentages for progress bar
const STATUS_PROGRESS = {
  "New Order":10,"Sent for First Look":18,"Waiting for Changes":27,
  "Waiting for Pictures":36,"Waiting for Approval":45,"Waiting to be Ordered":54,
  "Ordered":63,"In Production":72,"Shipped":81,"Delivered":90,"Order Done":100,
};
// V5: Statuses that trigger the waiting timer
const WAITING_STATUSES = ["Waiting for Changes","Waiting for Pictures","Waiting for Approval"];

// V5: Default customer sources
const DEFAULT_SOURCES = [
  {id:"s1",name:"Family"},{id:"s2",name:"Friend"},{id:"s3",name:"Photographer"},
  {id:"s4",name:"Instagram"},{id:"s5",name:"Facebook"},{id:"s6",name:"Word of Mouth"},
  {id:"s7",name:"Returning Customer"},{id:"s8",name:"Other"},
];

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
// ── V6: Yiddish translations ─────────────────────────────
const YI = {
  // Navigation & general
  "New Order":"נייע באַשטעלונג","Edit Order":"רעדאַקטירן באַשטעלונג","Settings":"סעטינגס",
  "Sign Out":"אויסלאָגן","Export":"עקספּאָרט","All Orders":"אַלע באַשטעלונגען",
  "Save Changes":"ספּייכערן ענדערונגען","Create Order":"שאַפֿן באַשטעלונג","Cancel":"אָפּזאָגן",
  "Delete":"לעשן","Edit":"רעדאַקטירן","Back":"צוריק",
  // Dashboard
  "Total Orders":"אַלע באַשטעלונגען","Revenue":"הכנסה","Your Profit":"אייַער געווין",
  "Zno Costs":"זנא קאָסטן","Outstanding":"אַפֿן שולד","Pipeline":"פּייפּליין",
  "Flagged Orders":"פֿאַנאַנדערגעוויזענע באַשטעלונגען","No flagged orders":"קיין פֿאַנאַנדערגעוויזענע באַשטעלונגען",
  "Upcoming Deadlines":"קומענדיקע טערמינען","No upcoming deadlines":"קיין קומענדיקע טערמינען",
  // Order form sections
  "Customer Info":"קונה אינפֿאָ","Albums":"אַלבאָמען","Add-ons":"צוגאָבן",
  "Discount":"רעדוקציע","Order Summary":"באַשטעלונג סומאַריע","Payment & Status":"צאָלונג & סטאַטוס",
  "Notes":"אָנמערקונגען","Flag This Order":"פֿאַנאַנדערווייַזן דעם באַשטעלונג",
  "Payment History":"צאָלונג היסטאָריע","Attachments":"צוגעלייגטע פֿילן","Refund":"צוריקגאַב",
  // Statuses
  "Sent for First Look":"געשיקט פֿאַר ערשטן קוק",
  "Waiting for Changes":"ווארטן אויף ענדערונגען","Waiting for Pictures":"ווארטן אויף בילדער",
  "Waiting for Approval":"ווארטן אויף גענעמיקונג","Waiting to be Ordered":"ווארטן צו באַשטעלן",
  "Ordered":"באַשטעלט","In Production":"אין פּראָדוקציע","Shipped":"אַוועקגעשיקט",
  "Delivered":"איבערגעגעבן","Order Done":"באַשטעלונג פֿאַרטיק",
  // Settings
  "Albums":"אַלבאָמען","Upgrades":"אַפּגרייד","Payments":"צאָלונגען","Customers":"קונות",
  "Business Insights":"ביזנעס אינסיכטן","Trash":"מיסטקאָרב","Users":"ניצערס",
  "My Account":"מיין חשבון","Lists & Tags":"רשימות & טאַגן","Reminders":"דערמאָנונגען",
  "Keyboard Shortcuts":"קלאַוויאַטור שאָרטקאַץ","Backup & Restore":"באַקאַפּ & ריסטאָר",
  "Company Profile":"פֿירמע פּראָפֿיל",
  // Common
  "Save":"ספּייכערן","Add":"צוגעבן","Remove":"אַראָפּנעמען","Search":"זוכן",
  "Paid":"באַצאָלט","Unpaid":"אומבאַצאָלט","Yes":"יאָ","No":"ניין",
  "Total":"סומע","Profit":"געווין","Balance":"בילאַנס","Invoice":"חשבון",
  "Deadline":"טערמין","Priority":"פּריאָריטעט","VIP":"וויפּ","Pinned":"פֿאַרפּינט",
  "Follow Up":"נאָכפֿאָלגן","Goal":"ציל","Monthly":"מאָנאַטלעך","Yearly":"יערלעך",
  "Dark Mode":"טונקל מאָד","Language":"שפּראַך","Display Name":"אָנוויי נאָמען",
  "Password":"פּאַסוואָרט","Change Password":"ענדערן פּאַסוואָרט","Profile Photo":"פּראָפֿיל בילד",
};

const t = (lang, str) => lang === "yi" && YI[str] ? YI[str] : str;

// ── V6: Hebrew calendar conversion ───────────────────────
function toHebrewDate(dateStr) {
  if(!dateStr) return "";
  try {
    const [y,m,d] = dateStr.split("-").map(Number);
    // Use Intl API for Hebrew calendar
    const date = new Date(y, m-1, d);
    const hebrewFormatter = new Intl.DateTimeFormat("he-IL-u-ca-hebrew", {
      year:"numeric", month:"long", day:"numeric"
    });
    return hebrewFormatter.format(date);
  } catch { return ""; }
}

function DateField({ label, value, onChange, style: sx={}, th, lang }) {
  const inp = iStyle(th);
  const hebrew = toHebrewDate(value);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:5,...sx}}>
      {label&&<label style={{fontSize:11,fontWeight:700,letterSpacing:"0.6px",textTransform:"uppercase",color:"#64748b"}}>{t(lang,label)}</label>}
      <input type="date" value={value} onChange={onChange} style={inp}/>
      {hebrew&&value&&<div style={{fontSize:11,color:"#8b5cf6",marginTop:2}}>🗓 {hebrew}</div>}
    </div>
  );
}

// ── V6: Order number generator ───────────────────────────
function assignInvoiceNumbers(orders) {
  if(!orders||!orders.length) return {};
  const sorted = [...orders].sort((a,b)=>(a.dateCreated||"").localeCompare(b.dateCreated||""));
  const map = {};
  sorted.forEach((o,i) => {
    map[o.id] = `LB-${String(i+1).padStart(6,"0")}`;
  });
  return map;
}


// V8: Default album sizes
const DEFAULT_ALBUM_SIZES = [
  {id:"sz1",name:'6×6'},{id:"sz2",name:'8×8'},{id:"sz3",name:'10×10'},{id:"sz4",name:'12×12'},
];
// V8: Default cover types
const DEFAULT_COVER_TYPES = [
  {id:"ct1",name:"Leather"},{id:"ct2",name:"Acrylic"},{id:"ct3",name:"Velvet"},
  {id:"ct4",name:"Linen"},{id:"ct5",name:"Fabric"},{id:"ct6",name:"Custom"},
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

// V5: Compress image to base64 for photo attachments
// V8: Order age in days
const orderAge = o => {
  if(!o.dateCreated) return 0;
  if(o.status==="Order Done" && o.doneAt) return Math.floor((new Date(o.doneAt)-new Date(o.dateCreated))/864e5);
  return Math.floor((Date.now()-new Date(o.dateCreated).getTime())/864e5);
};

const compressImage = (file, maxPx=700, quality=0.72) => new Promise((resolve, reject) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    resolve(canvas.toDataURL("image/jpeg", quality));
  };
  img.onerror = reject;
  img.src = url;
});

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
const LOGO_B64 = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCADIAMgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD7GooFFABRRS4oASlxS0UAFFFMmligiaWaVIo16s7AAfjSbS1YD6Kw7jxJb7C1hbT3ijrKMRwj/gbYH5Zql/aevXv/AB7eTEp/59oGmP8A3221P51yyxtJO0dX5f1Y1VGXXQ6kUuK5I6Prl0cz316QeokvRGP++Yl/rTR4P8w5mmgJ/wBpppP5yCo+s1n8NP73b9CvZwW8jrsr/eH50uK49vBVvjiS0/8AAd//AI5UTeDJ4zm2u40P+xJPH/JzR7fEren+P/AD2dP+b8DtKK4d9L8X2XNpf3UgHQC5SYflIqn9aZ/wlPiDS8DVbCGVB1LxtbsfxOUP50vr6j/Ei4/LQPYN/C0zu6K5vTfGui3TJHcvJp8rdFuV2q30cZU/nXRoyugdGVlYZBByDXVSr06qvB3M5wlD4kLSYpaK1IExQaWigBtLRRQAlFLRQAlFFKKAACloooAKR2VELuwVQMkk4AFV9QvYLGHzZ2PzHaiKMs7eijuaxHjvNYnIuFXYrf6gnMUR/wBsj/WP/sjgd65q2IUHyxV5djSML6vYnvNceVdumIhQnaLmUHYT6Io5kP04qvDotzeSrcX0ju3UPcgOw/3Y/uJ+O41t2VjDbN5gzJMRgyv1x6Dso9hxVqslhZVferO/l0/r+rle0UdIFKHTLONhI0ZnlHSSY7yPpngfhirmKWiuyMIwVooybb3DFIaWkNUISilooASkYAqVIBB6g9DS0tAGDqfhPRr1X22/2SRurW+FB+q/dP4iuWn0XxR4Yc3Gi3DXFqOWjjUsuP8AaiPT6ofwr0ekrirYGlUfNH3X3WhvDETjo9V5nKeGvHNjqDJbakq2F0x2glsxOfQN2Psea67rXN+KfCWm64jybRbXjD/XIvDf769G/n71ymm63rfgq8TTNcikudPP+rcHcVHqjHqB/dPIrFYmrhny4jWP8y/U0dKFVXp6Pt/kenkUlQ6fe2uoWcd3ZTpPBIMq6ng/59KnIr0k01dHI1bcSkIpaKYDaKU0UAJSigUtABVXUr2OxgDsrSSOdsUS/ekb0H+eKlvLiG0tZLmd9kca5Y/571gWkVzqd+81wGjfGHGf9RGeRGP9thyx7DiubEVnG0IfEzSEL6vYfY2txf3bXU8mX5V5UPCDvHF/V+p7VvQxRwxLFCioijAVRwKWNFjjWONQiKMKoHAFOqqFBUl59xTm5BRRQTW5AUUlFABmkoJpM0ALRmkooAXNGaSigBaKQUuaACquq6fZ6pZPZ30CzQP1B7HsQex9xVrNFKUVJWew02ndHlrx6r8PNX8yIveaRcPyv97/AAkA/Bh+npek6haapp8V9YzCWCVcqw/UH0I9KbqVla6jYy2V5EJYJVwyn+YPYjsa8206a8+H/iV7W6dpdIuW3M2OMZx5oHYjgMB9fSvLV8BO3/Lt/wDkr/yOvTER/vL8f+Ceq0lEbpJGskbBkYAqwOQQe4pTXqnGJRRRQAgpaKzvEF5JaWG23wbq4cQ24/827/QDJ/CoqTUIuT6DiuZ2RmaldPqOqLBbhXjgl2RA8rJOBksfVYxz9cCt2zt0tbdYY9xA5LHqxPJY+5PNZnhqyiih+0R5Me3yoCepQHl/q7Zb6YrZrnwsHrUnuzSpJfCtkLSZoorrMgzSUUhoAUmkzRSYoAWkoxSUAKTSZoyPUUAg9KACig0maAHZozTRS0AOozTaUUALWR4r0WLXNJe1O1Z0+e3kYfcfHf2PQj0Na9FRUhGpFxlsxxk4u6OC+FmsTwSS+GNRDJJBuNoHPzBQcPEfUoenqCK9Brzz4j6fPZajba9pq7bgyKQR/wA91HyZ9nUFD77a7bQtSg1fR7XUrb/VXEYcA9VPcH3ByPwrjwcnTbw83rHbzR0V0pWqLr+ZcNFKaK7zmErldZZ9Q18wRMQIALWMjtJIMyN/wGMH8TXTyyLFE8jnCopZj7AZrl/CAa4lF3IPnKNcPn+/M2R+SKo/GuLF+/KNLv8Ar/V/kbUtE5HTxIkcaxxqFRAFUDsB0p1IvSobokBQDXZsjImLoOrCmmVO38qrZ3DI60dRSuFiwZh/dNNMx7LUOKXB5IBOPahMB5lb1FJvb+8aZRVAO3E9zRSUhoEOzRmm5pRQBIr9m496cahpQxXjqPSgCWlpoIbpSigBwNFJQKAHClpBS0AUtbsE1PSrmxZtvmphW/uMOVb8CAfwrlfhnemK9vtHkXyw4+2Qx/3CWKzIP92QH867euB1ZP7H8d278K8Nzt/657g7H/KRAf+BVw4teznCqumj9Doo+9GUD0Giiiu45zI8YytH4avRGcPKghX6uQv8AWk8OwLFbXDIPla4ZU/3UxGP/AECovGLf6Pp8X3pdRgz9A+7+lWPDmTodox6vH5h+rEt/WuJe9iX5L+vzNtqXzNIGiigVkahQaWijFADaKKDQAlIw4P0paKAMuew0i5JNxpllKT1MkCt/MVka14ct5dK8jQvsum3UjoskVxEJkZR1VkbI2ntjniuqrJ8R6hFp1gHISSac+VBCw4dzyePQAFj7CuSvQjJO8dV1OiFRppSPPPGXg2+0uD+1tBJtZ7UmVHiGBJjvj+8G9Pr3rW8AeNodXeOy1B0t9TjHy4OEuQP4lz/H6r36jtW3cQ/2tZ28l/Kk2mmQSwRS/8tYhyvmnqH9f8A63GR4H8YDUJBp+ofu9VtFMcwdQrSBThZAR1z0bB6V5Sb+rS5v4ctvJ9jqXLXjb7S/M9JopM0V6RxiUUUUAFLRSUAFFFFABSUUUAFFFFABRRSUALSZoooATNJmilxQAmaDRRQAtFFJQAtFJS0AFNd0jjaR2CooLMxOABU1VtRtUvbKe0kZlSaNkLKcEZ7g0pXs7AeaeO/ipb6XLPp+hxrNdxna10/KRH0A7t/IdeopvwpOoXfxE1XVb60uINQvbGM3R8plMrRlhEQ5+ZkK9OMcnpXj00b3FxFbrPEkIl2GRlzsB43YHYdT9K92+H2s6hqepSR3Vx5sI0m3VjgDdLvkDM2PvE7Tk+pPeuLE0aeGk5QVm/0/4B2U5zrJKTuevGim5FLivROUSiiimAUlFLQAlFFFABRS0tACUUUUAB60UUUAFFFFABRRRQAUUUUAQ3VrBdJsniV+mCRyvuD2NZi+H7aORpoZJoS2R8jcCt0CiuWvhKFd3qRTNYVJx0TOXHhu6bfALxlj/AIa4Y3CnjZ+n/wBaq8uheKYv+PXXb1AP+mscn/ocZFdnijFEcJQj8MV9yF7Sq94nHDTfFcH/AB66rdge73QmH5OuaP7T8V2X/H1pkjAdWe0VwPxibNdoRQRR9Xi/hbX3h7V9UjjoPiSafHm6VLH6n+yrpT/6Af6V1dkb82sZvooYrn+NJGJ/9BFWRQBRB04L4b/AImPtXLfoiVJIlRSrqpIIBBGRTZmjjieSVlSNBuZmOAAKkrhtT1L/hL9Sf7PlNJiJWKJh/pDDq7D+77D8etcNKjKrKy2On2kYK7M+8Nl4n1OVrVxLptqwjSRl/1zjq6j+6vC/Xd6VvQ28VvEsUEaxRqMBVGKmrqqVo0oqMNjClBzd5DMUYp2KMUARRW8ULsYolRnOW2jGT60v2e3/wCeEf8A3yKkoxVXEMNKjb+4v5CoL2MR2c8iABljYjA9AafRUsLjbWT7RaxT5H7xA34kVJUNmpW0iB6qv8qlqloJhS4pKKYCYoxTsU2gQmKMU6loAaRRilooAbu9aWiloAbS0UUANxRS4pMUALikxS0UAIRRilooAMUGiigBBS4ooFACgUtFJQAtFFFABRRRQAUUUUAFZHiW8ex0aSeEZnkIhhHrI5Cj9Tn8K16ypeM3l1DFnHlqXT/feQKPxxH+dY4mfJTbNKSvI19FtfsmmRRE/vG/eSt3Z2OWP5k1oorlWVepJJJJznvRXLTjywSNJO7uNqnqSW4s5JLpQ0MZZW55BHQj3B5q5XK6xqkF3cCO0dpo1JWfyyBg9Mgn+L3HSuXEV40Y8zV+xrCDk7Gs01hNPLazOomjIDxkghhjOSPpzWDeP9j1WO8j2hEIKyHpGuN3zf7IBPP0/xq/Y2+mXH2iYLLG0DlZFXhXK8jKn36fhVx9NuBFNFHPBG0p3eZJHv+bPJxkZzXJGrGpqj0IU3BaM5/WtTa80aJGH2d5pvNkUH7kSg7V/Egn8K1dDvTd6bHJJy6AxSH/aU4P8uawPEOnXVpCEHJYF4GY5UyRDkxsO+5cDPf1rT0awaCORy+97qJJpZR3YnkewGMCt42m1bz/r9TOV0tTeopKK6TIWkpKKAFooopgFJRRQAlFFFABRS0UAIKWiimAtFFFABRRRQAUUUUAFFFFABRRRQAUUUUAIaKKKAP/Z";

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
function LoginScreen({ onLogin, companyLogo, companyName }) {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);
  const [resetMode,setResetMode]=useState(false);
  const [resetSent,setResetSent]=useState(false);

  const handleLogin=async(e)=>{
    e&&e.preventDefault();
    if(!email.trim()||!password.trim()){setErr("Please enter email and password.");return;}
    setLoading(true);setErr("");
    try{
      await signInWithEmailAndPassword(auth,email.trim(),password);
    }catch(err){
      const msg=err.code==="auth/invalid-credential"||err.code==="auth/wrong-password"||err.code==="auth/user-not-found"
        ?"Incorrect email or password. Please try again."
        :err.code==="auth/too-many-requests"
        ?"Too many attempts. Please try again later."
        :"Login failed: "+(err.code||err.message);
      setErr(msg);
    }
    setLoading(false);
  };

  const handleReset=async()=>{
    if(!email.trim()){setErr("Please enter your email address first.");return;}
    setLoading(true);setErr("");
    try{
      await sendPasswordResetEmail(auth,email.trim());
      setResetSent(true);
    }catch{
      setErr("Could not send reset email. Please check your email address.");
    }
    setLoading(false);
  };

  return(
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg,#0f1f4b 0%,#1e3a8a 50%,#0f1f4b 100%)`,display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"system-ui,sans-serif"}}>
      <div style={{background:"rgba(255,255,255,0.97)",borderRadius:24,padding:"40px 36px",width:"100%",maxWidth:400,boxShadow:"0 24px 80px rgba(0,0,0,0.4)"}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:32}}>
          {companyLogo
            ?<img src={companyLogo} alt="logo" style={{width:72,height:72,borderRadius:"50%",objectFit:"cover",marginBottom:14,border:"3px solid #e2e8f0"}}/>
            :<div style={{width:72,height:72,borderRadius:"50%",background:"linear-gradient(135deg,#0f1f4b,#1e3a8a)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",boxShadow:"0 8px 24px rgba(15,31,75,0.3)"}}><Logo size={40}/></div>
          }
          <div style={{fontSize:26,fontWeight:800,color:"#0f172a",letterSpacing:"-0.5px",fontFamily:"Georgia,serif"}}>{companyName||"LuxeBound Albums"}</div>
          <div style={{fontSize:12,color:"#94a3b8",marginTop:4,letterSpacing:"2px",textTransform:"uppercase"}}>Order Management</div>
        </div>

        {resetSent?(
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:40,marginBottom:12}}>📧</div>
            <div style={{fontWeight:700,fontSize:16,color:"#0f172a",marginBottom:8}}>Reset Email Sent!</div>
            <div style={{fontSize:13,color:"#64748b",marginBottom:20}}>Check your inbox at {email} for a password reset link.</div>
            <button onClick={()=>{setResetMode(false);setResetSent(false);}} style={{width:"100%",padding:"13px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#0f1f4b,#1e3a8a)",color:"white",cursor:"pointer",fontSize:15,fontWeight:700,fontFamily:"system-ui,sans-serif"}}>Back to Login</button>
          </div>
        ):(
          <div>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.6px",display:"block",marginBottom:6}}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com"
                onKeyDown={e=>e.key==="Enter"&&!resetMode&&handleLogin()}
                style={{width:"100%",padding:"13px 16px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#0f172a",fontSize:15,outline:"none",fontFamily:"system-ui,sans-serif",boxSizing:"border-box",transition:"border-color .15s"}}
                onFocus={e=>e.target.style.borderColor="#5271FF"}
                onBlur={e=>e.target.style.borderColor="#e2e8f0"}
              />
            </div>
            {!resetMode&&(
              <div style={{marginBottom:20}}>
                <label style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.6px",display:"block",marginBottom:6}}>Password</label>
                <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"
                  onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                  style={{width:"100%",padding:"13px 16px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#0f172a",fontSize:15,outline:"none",fontFamily:"system-ui,sans-serif",boxSizing:"border-box",transition:"border-color .15s"}}
                  onFocus={e=>e.target.style.borderColor="#5271FF"}
                  onBlur={e=>e.target.style.borderColor="#e2e8f0"}
                />
              </div>
            )}
            {err&&<div style={{color:"#ef4444",fontSize:13,marginBottom:14,padding:"10px 14px",background:"#fef2f2",borderRadius:8,border:"1px solid #fecaca"}}>{err}</div>}
            {!resetMode?(
              <div>
                <button onClick={handleLogin} disabled={loading}
                  style={{width:"100%",padding:"14px",borderRadius:10,border:"none",background:loading?"#94a3b8":"linear-gradient(135deg,#0f1f4b,#1e3a8a)",color:"white",cursor:loading?"not-allowed":"pointer",fontSize:15,fontWeight:700,fontFamily:"system-ui,sans-serif",boxShadow:"0 4px 14px rgba(15,31,75,0.3)",marginBottom:14}}>
                  {loading?"Signing in…":"Sign In"}
                </button>
                <button onClick={()=>{setResetMode(true);setErr("");}} style={{width:"100%",background:"none",border:"none",color:"#5271FF",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif",padding:"4px 0"}}>
                  Forgot your password?
                </button>
              </div>
            ):(
              <div>
                <button onClick={handleReset} disabled={loading}
                  style={{width:"100%",padding:"14px",borderRadius:10,border:"none",background:loading?"#94a3b8":"linear-gradient(135deg,#0f1f4b,#1e3a8a)",color:"white",cursor:loading?"not-allowed":"pointer",fontSize:15,fontWeight:700,fontFamily:"system-ui,sans-serif",marginBottom:14}}>
                  {loading?"Sending…":"Send Reset Email"}
                </button>
                <button onClick={()=>{setResetMode(false);setErr("");}} style={{width:"100%",background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif",padding:"4px 0"}}>
                  Back to Login
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


function OrderCard({ order, onEdit, onDelete, onPin, onQuickStatus, onEditNote, onViewCustomer }) {
  const finalTotal=(Number(order.finalTotal)||Number(order.total)||0);
  const received=(order.payments||[]).reduce((s,p)=>s+Number(p.amount||0),0);
  const profit=finalTotal-(Number(order.znoCost)||0);
  const albumList=(order.selectedAlbums||[]).filter(a=>a.albumType);
  const upgList=Object.entries(order.selectedUpgrades||{}).filter(([,q])=>Number(q)>0);
  const hasDiscount=order.discountValue>0;
  const progress=STATUS_PROGRESS[order.status]||10;
  const borderColor=STATUS_COLORS[order.status]?.border||"#e2e8f0";
  const waitingDays=WAITING_STATUSES.includes(order.status)?Math.floor(daysSince(order.statusChangedAt||order.dateCreated)):0;
  const [lightbox,setLightbox]=useState(null);

  return(
    <div style={{background:"white",borderRadius:14,marginBottom:12,border:`1.5px solid ${order.priority?"#f59e0b44":"#e8ecf0"}`,boxShadow:"0 2px 12px rgba(0,0,0,0.06)",overflow:"hidden",borderLeft:`4px solid ${borderColor}`}}>

      {/* Progress Bar */}
      <div style={{height:4,background:"#f1f5f9"}}>
        <div style={{height:4,width:`${progress}%`,background:progress===100?GREEN:BLUE,transition:"width .4s"}}/>
      </div>

      <div style={{padding:"14px 16px"}}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2,flexWrap:"wrap"}}>
              <div onClick={e=>{e.stopPropagation();onViewCustomer&&onViewCustomer(order.customerName);}} style={{fontWeight:700,fontSize:16,color:"#0f172a",cursor:onViewCustomer?"pointer":"default",textDecoration:onViewCustomer?"underline":"none",textDecorationStyle:"dotted"}}>{order.customerName}</div>
              {order.invoiceNum&&<span style={{fontSize:10,color:"#94a3b8",fontFamily:"monospace",background:"#f1f5f9",padding:"1px 6px",borderRadius:4}}>{order.invoiceNum}</span>}
              {order.priority&&<span style={{fontSize:10,fontWeight:700,background:"#fef3c7",color:"#92400e",padding:"2px 7px",borderRadius:20}}>⚡ PRIORITY</span>}
              {order.vip&&<span style={{fontSize:10,fontWeight:700,background:"#fdf4ff",color:"#7e22ce",padding:"2px 7px",borderRadius:20}}>⭐ VIP</span>}
              {order.refunded&&<span style={{fontSize:10,fontWeight:700,background:"#fef2f2",color:RED,padding:"2px 7px",borderRadius:20}}>↩️ Refunded</span>}
              {order.manualFlag&&FLAG_DEFS[order.manualFlag]&&<span style={{fontSize:11}}>{FLAG_DEFS[order.manualFlag].icon}</span>}
              <span style={{fontSize:10,fontWeight:700,background:order.status==="Order Done"?"#bbf7d0":"#f1f5f9",color:order.status==="Order Done"?"#14532d":"#64748b",padding:"2px 7px",borderRadius:20}}>⏱ {orderAge(order)}d</span>
            </div>
            <div style={{fontSize:12,color:"#64748b"}}>{order.phone}</div>
            {(order.albumSize||order.coverType)&&(
              <div style={{fontSize:11,color:"#64748b",marginTop:2,display:"flex",gap:8}}>
                {order.albumSize&&<span>📐 {order.albumSize}</span>}
                {order.coverType&&<span>🎨 {order.coverType}</span>}
              </div>
            )}
            {order.deadline&&<div style={{fontSize:11,color:RED,marginTop:2,fontWeight:600}}>🗓 Deadline: {fmtD(order.deadline)}</div>}
            {order.paymentDueDate&&!order.paid&&(
              <div style={{fontSize:11,color:new Date(order.paymentDueDate)<new Date()?RED:AMBER,marginTop:2,fontWeight:600}}>
                💳 Payment due: {fmtD(order.paymentDueDate)}
              </div>
            )}
            {isSnoozed(order)&&<div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>🔕 Snoozed until {fmtD(order.snoozedUntil?.split("T")[0])}</div>}
            {waitingDays>0&&(
              <div style={{fontSize:11,marginTop:2,fontWeight:600,color:waitingDays>=7?RED:waitingDays>=3?AMBER:"#64748b"}}>
                ⏳ Waiting {waitingDays} day{waitingDays!==1?"s":""}
              </div>
            )}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <button onClick={()=>onPin&&onPin(order)} title={order.pinned?"Unpin":"Pin"} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,padding:"2px",lineHeight:1,color:order.pinned?GOLD:"#d1d5db",opacity:order.pinned?1:0.5}}>📌</button>
            <Badge status={order.status}/>
          </div>
        </div>

        {/* Quick status dropdown + Note button */}
        <div style={{marginBottom:8,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <select value={order.status} onChange={e=>onQuickStatus&&onQuickStatus(order,e.target.value)}
            style={{fontSize:11,padding:"5px 10px",borderRadius:20,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#475569",cursor:"pointer",fontFamily:"system-ui,sans-serif",outline:"none"}}>
            {STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={()=>onEditNote&&onEditNote(order)}
            style={{fontSize:11,padding:"5px 12px",borderRadius:20,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#475569",cursor:"pointer",fontFamily:"system-ui,sans-serif",display:"flex",alignItems:"center",gap:4}}>
            📝 {order.notes?"Edit Note":"Add Note"}
          </button>
        </div>

        {/* Order Details */}
        <div style={{background:"#f8fafc",borderRadius:10,padding:"10px 12px",marginBottom:10,border:"1px solid #f1f5f9"}}>
          <div style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:6}}>📋 Order Details</div>
          {albumList.length>0
            ? albumList.map((a,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#334155",marginBottom:4}}><span>📚 {a.albumType}</span><span style={{fontWeight:600,color:BLUE}}>{fmt$(a.albumPrice)}</span></div>)
            : order.albumType
              ? <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#334155",marginBottom:4}}><span>📚 {order.albumType}</span><span style={{fontWeight:600,color:BLUE}}>{fmt$(order.albumPrice)}</span></div>
              : null
          }
          {upgList.map(([id,qty])=>{
            const name=(order.upgradeNames||{})[id]||id;
            const price=(order.upgradePrices||{})[id]||0;
            return <div key={id} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#334155",marginBottom:4}}><span>✨ {name}{Number(qty)>1?` ×${qty}`:""}</span><span style={{fontWeight:600,color:AMBER}}>{fmt$(price*Number(qty))}</span></div>;
          })}
          {hasDiscount&&(
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:RED,marginTop:4,paddingTop:4,borderTop:"1px dashed #e2e8f0"}}>
              <span>🏷️ Discount ({order.discountType==="percent"?`${order.discountValue}%`:`$${order.discountValue}`})</span>
              <span style={{fontWeight:600}}>-{fmt$((Number(order.total)||0)-finalTotal)}</span>
            </div>
          )}
        </div>

        {/* Financials */}
        <div style={{display:"flex",gap:14,marginBottom:10,padding:"8px 12px",background:"#f8fafc",borderRadius:10,flexWrap:"wrap"}}>
          {[
            {label:"Total", val:fmt$(finalTotal),color:BLUE},
            {label:"Zno",   val:fmt$(order.znoCost),color:AMBER},
            {label:"Profit",val:fmt$(profit),color:profit>=0?GREEN:RED},
            {label:"Paid",  val:order.paid?"✓ Yes":"✗ No",color:order.paid?GREEN:RED},
          ].map(({label,val,color})=>(
            <div key={label} style={{textAlign:"center"}}>
              <div style={{fontSize:14,fontWeight:800,color}}>{val}</div>
              <div style={{fontSize:10,color:"#94a3b8",marginTop:1,fontWeight:600}}>{label}</div>
            </div>
          ))}
          {received>0&&received<finalTotal&&(
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:14,fontWeight:800,color:AMBER}}>{fmt$(finalTotal-received)}</div>
              <div style={{fontSize:10,color:"#94a3b8",marginTop:1,fontWeight:600}}>Balance</div>
            </div>
          )}
        </div>

        {/* Payment history mini log */}
        {(order.payments||[]).length>0&&(
          <div style={{marginBottom:8,fontSize:11,color:"#64748b"}}>
            💳 {(order.payments||[]).map((p,i)=>(
              <span key={i}>{fmtD(p.date)} — {fmt$(p.amount)} {p.method}{i<order.payments.length-1?" · ":""}</span>
            ))}
          </div>
        )}

        {/* Photo thumbnails */}
        {(order.photos||[]).length>0&&(
          <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
            {(order.photos||[]).map((ph,i)=>(
              <img key={i} src={ph} alt={`photo ${i+1}`} onClick={()=>setLightbox(ph)}
                style={{width:52,height:52,borderRadius:8,objectFit:"cover",cursor:"pointer",border:"2px solid #e2e8f0"}}/>
            ))}
          </div>
        )}

        {/* Footer - clean, no edit history */}
        <div style={{borderTop:"1px solid #f1f5f9",paddingTop:8}}>
          <div style={{fontSize:11,color:"#94a3b8",marginBottom:6}}>
            📅 {fmtD(order.dateCreated)}{order.dateSentToZno&&` · Zno: ${fmtD(order.dateSentToZno)}`}
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <button onClick={()=>{
              const txt=`Customer: ${order.customerName}\nPhone: ${order.phone||""}\nAlbum: ${(order.selectedAlbums||[]).map(a=>a.albumType).join(", ")||order.albumType||""}\nTotal: ${fmt$(order.finalTotal||order.total)}\nPaid: ${order.paid?"Yes":"No"}\nStatus: ${order.status}${order.notes?`\nNotes: ${order.notes}`:""}`;
              navigator.clipboard?.writeText(txt).catch(()=>{});
            }} style={{padding:"6px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#64748b",cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>📋</button>
            <button onClick={()=>onEdit(order)} style={{padding:"6px 16px",borderRadius:8,border:`1.5px solid ${BLUE}`,background:"transparent",color:BLUE,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Edit</button>
            <button onClick={()=>onDelete(order)} style={{padding:"6px 16px",borderRadius:8,border:"none",background:RED,color:"white",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Delete</button>
          </div>
        </div>
      </div>

      {/* Photo lightbox */}
      {lightbox&&(
        <div onClick={()=>setLightbox(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",cursor:"zoom-out"}}>
          <img src={lightbox} alt="full" style={{maxWidth:"90vw",maxHeight:"90vh",borderRadius:12,boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}/>
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════
// V6: DAILY DIGEST BANNER
// ══════════════════════════════════════════════════════════
function DailyDigest({ orders, onDismiss, displayName }) {
  const flagged = orders.filter(o => {
    if(isSnoozed(o)||o.status==="Order Done") return false;
    if(o.manualFlag) return true;
    return !!getFlag(o);
  });
  const upcoming = orders.filter(o => {
    const d = o.deadline||o.followUpDate;
    if(!d) return false;
    const days = (new Date(d) - new Date()) / 864e5;
    return days >= 0 && days <= 7;
  });
  const outstanding = orders.filter(o=>!o.paid&&o.status!=="Order Done").reduce((s,o)=>{
    const ft=Number(o.finalTotal)||Number(o.total)||0;
    const rec=(o.payments||[]).reduce((ps,p)=>ps+Number(p.amount||0),0);
    return s+(ft-rec);
  },0);
  return(
    <div style={{background:`linear-gradient(135deg,${NAVY},#1e3a8a)`,borderRadius:14,padding:"14px 18px",marginBottom:20,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
      <div style={{color:"white"}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>☀️ Good morning, {displayName}!</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.75)",display:"flex",gap:16,flexWrap:"wrap"}}>
          {flagged.length>0&&<span>🚩 {flagged.length} flagged</span>}
          {upcoming.length>0&&<span>📅 {upcoming.length} upcoming deadline{upcoming.length!==1?"s":""}</span>}
          {outstanding>0&&<span>💸 {fmt$(outstanding)} outstanding</span>}
          {flagged.length===0&&upcoming.length===0&&outstanding===0&&<span>✅ Everything looks great today!</span>}
        </div>
      </div>
      <button onClick={onDismiss} style={{background:"rgba(255,255,255,0.15)",border:"1.5px solid rgba(255,255,255,0.3)",color:"white",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Dismiss ×</button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// V6: UPCOMING DEADLINES SECTION
// ══════════════════════════════════════════════════════════
function UpcomingDeadlines({ orders, onEdit }) {
  const [open, setOpen] = useState(false);
  const upcoming = orders.filter(o => {
    if(o.status==="Order Done") return false;
    const dates = [o.deadline, o.followUpDate].filter(Boolean);
    return dates.some(d => {
      const days = (new Date(d) - new Date()) / 864e5;
      return days >= 0 && days <= 7;
    });
  }).sort((a,b) => {
    const da = Math.min(...[a.deadline,a.followUpDate].filter(Boolean).map(d=>new Date(d).getTime()));
    const db = Math.min(...[b.deadline,b.followUpDate].filter(Boolean).map(d=>new Date(d).getTime()));
    return da - db;
  });

  return(
    <div style={{background:"white",borderRadius:16,marginBottom:20,boxShadow:"0 4px 16px rgba(0,0,0,0.07)"}}>
      <div style={{padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}} onClick={()=>{ const nv=!open; setOpen(nv); try{localStorage.setItem("lb_cal_open",nv?"1":"0");}catch{} }}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16,transition:"transform .2s",display:"inline-block",transform:open?"rotate(0deg)":"rotate(-90deg)"}}>▼</span>
          <span style={{fontWeight:700,fontSize:14,color:"#0f172a"}}>📅 Upcoming Deadlines</span>
          {upcoming.length>0&&<span style={{background:upcoming.length>0?"#fef3c7":"#f1f5f9",color:upcoming.length>0?"#92400e":"#94a3b8",fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20}}>{upcoming.length}</span>}
        </div>
      </div>
      {open&&(
        <div style={{padding:"0 20px 16px"}}>
          {upcoming.length===0
            ?<div style={{color:GREEN,fontSize:13,fontWeight:600,padding:"4px 0"}}>✅ No upcoming deadlines this week</div>
            :upcoming.map(o=>{
              const d = [o.deadline,o.followUpDate].filter(Boolean).sort()[0];
              const days = Math.ceil((new Date(d)-new Date())/864e5);
              return(
                <div key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:"#f8fafc",borderRadius:10,marginBottom:8,border:"1px solid #f1f5f9"}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:13,color:"#0f172a"}}>{o.customerName}</div>
                    <div style={{fontSize:11,color:"#64748b",marginTop:2}}>
                      {o.deadline&&<span>🗓 Deadline: {fmtD(o.deadline)} </span>}
                      {o.followUpDate&&<span>📞 Follow up: {fmtD(o.followUpDate)}</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:11,fontWeight:700,color:days<=1?RED:days<=3?AMBER:BLUE}}>{days===0?"Today!":days===1?"Tomorrow":`${days} days`}</span>
                    <button onClick={()=>onEdit(o)} style={{padding:"5px 12px",borderRadius:8,border:`1.5px solid ${BLUE}`,background:"transparent",color:BLUE,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>View</button>
                  </div>
                </div>
              );
            })
          }
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// V6: WEEKLY SUMMARY POPUP
// ══════════════════════════════════════════════════════════
function WeeklySummary({ orders, onDismiss }) {
  const now = new Date();
  const weekAgo = new Date(now - 7*864e5);
  const weekOrders = orders.filter(o => o.dateCreated && new Date(o.dateCreated) >= weekAgo);
  const completed = weekOrders.filter(o => o.status === "Order Done");
  const revenue = weekOrders.filter(o=>!o.refunded).reduce((s,o)=>s+(Number(o.finalTotal)||0),0);
  const outstanding = orders.filter(o=>!o.paid&&o.status!=="Order Done").reduce((s,o)=>{
    const ft=Number(o.finalTotal)||Number(o.total)||0;
    const rec=(o.payments||[]).reduce((ps,p)=>ps+Number(p.amount||0),0);
    return s+(ft-rec);
  },0);

  const exportSummary = () => {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Weekly Summary</title>
<style>body{font-family:system-ui,sans-serif;padding:40px;color:#0f172a;max-width:500px;margin:0 auto}h1{color:#0f1f4b;font-size:20px}h2{color:#64748b;font-size:13px;text-transform:uppercase;letter-spacing:1px}.card{background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:12px;border:1px solid #e2e8f0}.num{font-size:28px;font-weight:800;color:#5271FF}.label{font-size:12px;color:#64748b;margin-top:4px}</style></head>
<body><h1>📊 LuxeBound Weekly Summary</h1><h2>Week of ${weekAgo.toLocaleDateString("en-US",{month:"long",day:"numeric"})} — ${now.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</h2>
<div class="card"><div class="num">${weekOrders.length}</div><div class="label">Orders Created</div></div>
<div class="card"><div class="num">${completed.length}</div><div class="label">Orders Completed</div></div>
<div class="card"><div class="num" style="color:#18B978">${fmt$(revenue)}</div><div class="label">Revenue This Week</div></div>
<div class="card"><div class="num" style="color:#ef4444">${fmt$(outstanding)}</div><div class="label">Total Outstanding Balance</div></div>
</body></html>`;
    const w = window.open("","_blank");
    w.document.write(html);
    w.document.close();
    setTimeout(()=>w.print(),400);
    onDismiss();
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,padding:16}}>
      <div style={{background:"white",borderRadius:20,padding:28,width:"100%",maxWidth:420,boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:18,color:"#0f172a"}}>📊 Weekly Summary</div>
          <button onClick={onDismiss} style={{background:"none",border:"none",fontSize:24,cursor:"pointer",color:"#94a3b8",padding:0,lineHeight:1}}>×</button>
        </div>
        <div style={{fontSize:12,color:"#64748b",marginBottom:20}}>
          {weekAgo.toLocaleDateString("en-US",{month:"long",day:"numeric"})} — {now.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
          {[
            {label:"Orders Created",val:weekOrders.length,color:BLUE},
            {label:"Completed",val:completed.length,color:GREEN},
            {label:"Revenue",val:fmt$(revenue),color:BLUE},
            {label:"Outstanding",val:fmt$(outstanding),color:RED},
          ].map(({label,val,color})=>(
            <div key={label} style={{background:"#f8fafc",borderRadius:12,padding:14,border:"1px solid #e2e8f0"}}>
              <div style={{fontSize:22,fontWeight:800,color}}>{val}</div>
              <div style={{fontSize:11,color:"#64748b",marginTop:4}}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onDismiss} style={{flex:1,padding:"12px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"white",color:"#64748b",cursor:"pointer",fontSize:14,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Dismiss</button>
          <button onClick={exportSummary} style={{flex:2,padding:"12px",borderRadius:10,border:"none",background:NAVY,color:"white",cursor:"pointer",fontSize:14,fontWeight:700,fontFamily:"system-ui,sans-serif"}}>📄 Export & Print</button>
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════
// V7.2: HEBREW/ENGLISH DUAL CALENDAR (powered by HebCal API)
// ══════════════════════════════════════════════════════════

// American holidays (fixed dates + floating)
function getAmericanHolidays(year) {
  const h = {};
  // Fixed
  h[`${year}-01-01`] = { label:"🎆 New Year's Day", type:"american" };
  h[`${year}-07-04`] = { label:"🇺🇸 Independence Day", type:"american" };
  h[`${year}-11-11`] = { label:"🎖️ Veterans Day", type:"american" };
  h[`${year}-12-24`] = { label:"🎄 Christmas Eve", type:"american" };
  h[`${year}-12-25`] = { label:"🎄 Christmas Day", type:"american" };
  h[`${year}-12-31`] = { label:"🎆 New Year's Eve", type:"american" };
  // MLK Day: 3rd Monday of January
  let d = new Date(year, 0, 1);
  let mondays = 0;
  while(mondays < 3) { if(d.getDay()===1) mondays++; if(mondays<3) d.setDate(d.getDate()+1); }
  h[d.toISOString().split("T")[0]] = { label:"✊ MLK Day", type:"american" };
  // Presidents Day: 3rd Monday of February
  d = new Date(year, 1, 1); mondays = 0;
  while(mondays < 3) { if(d.getDay()===1) mondays++; if(mondays<3) d.setDate(d.getDate()+1); }
  h[d.toISOString().split("T")[0]] = { label:"🏛️ Presidents Day", type:"american" };
  // Memorial Day: last Monday of May
  d = new Date(year, 5, 0);
  while(d.getDay()!==1) d.setDate(d.getDate()-1);
  h[d.toISOString().split("T")[0]] = { label:"🪖 Memorial Day", type:"american" };
  // Labor Day: 1st Monday of September
  d = new Date(year, 8, 1);
  while(d.getDay()!==1) d.setDate(d.getDate()+1);
  h[d.toISOString().split("T")[0]] = { label:"👷 Labor Day", type:"american" };
  // Columbus Day: 2nd Monday of October
  d = new Date(year, 9, 1); mondays = 0;
  while(mondays < 2) { if(d.getDay()===1) mondays++; if(mondays<2) d.setDate(d.getDate()+1); }
  h[d.toISOString().split("T")[0]] = { label:"🔭 Columbus Day", type:"american" };
  // Thanksgiving: 4th Thursday of November
  d = new Date(year, 10, 1); let thursdays = 0;
  while(thursdays < 4) { if(d.getDay()===4) thursdays++; if(thursdays<4) d.setDate(d.getDate()+1); }
  h[d.toISOString().split("T")[0]] = { label:"🦃 Thanksgiving", type:"american" };
  return h;
}

function DualCalendar() {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-based
  const [jewishHolidays, setJewishHolidays] = useState({});
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [open, setOpen] = useState(()=>{ try{ const s=localStorage.getItem("lb_cal_open"); return s===null?false:s==="1"; }catch{return false;} });
  const [tooltip, setTooltip] = useState(null);

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dayNames   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  // Fetch HebCal data when month/year changes
  useEffect(() => {
    setLoadingHolidays(true);
    const url = `https://www.hebcal.com/hebcal?v=1&cfg=json&year=${viewYear}&month=${viewMonth+1}&maj=on&min=on&mod=on&nx=on&mf=on&ss=on&c=off&i=off&lg=s`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        const map = {};
        (data.items || []).forEach(item => {
          if(item.date && item.title) {
            const dateKey = item.date.slice(0, 10);
            // Pick emoji based on category
            let emoji = "✡️";
            const t = item.title.toLowerCase();
            if(t.includes("rosh hashana"))    emoji = "🍎";
            else if(t.includes("yom kippur")) emoji = "🙏";
            else if(t.includes("sukkot")||t.includes("sukkos")) emoji = "🌿";
            else if(t.includes("simchat")||t.includes("shemini")) emoji = "📜";
            else if(t.includes("chanukah")||t.includes("hanukkah")) emoji = "🕎";
            else if(t.includes("purim"))      emoji = "🎭";
            else if(t.includes("pesach")||t.includes("passover")) emoji = "🍷";
            else if(t.includes("shavuot")||t.includes("shavuos")) emoji = "📜";
            else if(t.includes("lag b"))      emoji = "🔥";
            else if(t.includes("tisha"))      emoji = "😢";
            else if(t.includes("fast")||t.includes("tzom")||t.includes("ta'anit")) emoji = "😢";
            else if(t.includes("rosh chodesh")) emoji = "🌙";
            else if(t.includes("tu b"))       emoji = "🌳";
            else if(t.includes("israel")||t.includes("yom ha")) emoji = "🕍";
            // Store — if multiple holidays on same day, append
            if(map[dateKey]) {
              map[dateKey].label += " · " + emoji + " " + item.title;
            } else {
              map[dateKey] = { label: emoji + " " + item.title, type: "jewish", category: item.category };
            }
          }
        });
        setJewishHolidays(map);
        setLoadingHolidays(false);
      })
      .catch(() => setLoadingHolidays(false));
  }, [viewYear, viewMonth]);

  const americanHolidays = getAmericanHolidays(viewYear);

  const prevMonth = () => { if(viewMonth===0){setViewMonth(11);setViewYear(y=>y-1);}else setViewMonth(m=>m-1); };
  const nextMonth = () => { if(viewMonth===11){setViewMonth(0);setViewYear(y=>y+1);}else setViewMonth(m=>m+1); };

  // Build grid
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();
  const days = [];
  for(let i=0; i<firstDay; i++) days.push(null);
  for(let i=1; i<=daysInMonth; i++) days.push(i);
  while(days.length%7!==0) days.push(null);

  const todayStr = today.toISOString().split("T")[0];

  const getHoliday = (dateStr) => {
    if(jewishHolidays[dateStr]) return jewishHolidays[dateStr];
    if(americanHolidays[dateStr]) return americanHolidays[dateStr];
    return null;
  };

  const getHebrewDate = (year, month, day) => {
    try {
      return new Intl.DateTimeFormat("he-IL-u-ca-hebrew", { day:"numeric" }).format(new Date(year, month, day));
    } catch { return ""; }
  };

  const getFullHebrewDate = (year, month, day) => {
    try {
      return new Intl.DateTimeFormat("he-IL-u-ca-hebrew", { day:"numeric", month:"long", year:"numeric" }).format(new Date(year, month, day));
    } catch { return ""; }
  };

  return(
    <div style={{background:"white",borderRadius:16,marginBottom:20,boxShadow:"0 4px 16px rgba(0,0,0,0.07)",overflow:"hidden"}}>
      {/* Collapsible header */}
      <div style={{padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}} onClick={()=>{ const nv=!open; setOpen(nv); try{localStorage.setItem("lb_cal_open",nv?"1":"0");}catch{} }}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16,transition:"transform .2s",display:"inline-block",transform:open?"rotate(0deg)":"rotate(-90deg)"}}>▼</span>
          <span style={{fontWeight:700,fontSize:14,color:"#0f172a"}}>🗓 Hebrew / English Calendar</span>
          {loadingHolidays&&<span style={{fontSize:11,color:"#94a3b8"}}>Loading holidays…</span>}
        </div>
        {!open&&<span style={{fontSize:12,color:"#64748b"}}>{monthNames[viewMonth]} {viewYear}</span>}
      </div>

      {open&&(
        <div style={{padding:"0 16px 18px"}}>
          {/* Month navigation */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,padding:"0 4px"}}>
            <button onClick={prevMonth} style={{background:"#f1f5f9",border:"none",borderRadius:8,width:36,height:36,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>‹</button>
            <div style={{textAlign:"center"}}>
              <div style={{fontWeight:700,fontSize:17,color:"#0f172a"}}>{monthNames[viewMonth]} {viewYear}</div>
              <div style={{fontSize:12,color:"#8b5cf6",marginTop:2}}>
                {(() => {
                  try {
                    return new Intl.DateTimeFormat("he-IL-u-ca-hebrew",{month:"long",year:"numeric"}).format(new Date(viewYear,viewMonth,15));
                  } catch { return ""; }
                })()}
              </div>
            </div>
            <button onClick={nextMonth} style={{background:"#f1f5f9",border:"none",borderRadius:8,width:36,height:36,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>›</button>
          </div>

          {/* Day name headers */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:4}}>
            {dayNames.map(d=>(
              <div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:"#94a3b8",padding:"3px 0"}}>{d}</div>
            ))}
          </div>

          {/* Days */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
            {days.map((day,i)=>{
              if(!day) return <div key={`e-${i}`}/>;
              const dateStr = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const isToday  = dateStr === todayStr;
              const holiday  = getHoliday(dateStr);
              const hebrewDay = getHebrewDate(viewYear, viewMonth, day);
              const isJewish   = holiday?.type === "jewish";
              const isAmerican = holiday?.type === "american";

              return(
                <div key={dateStr}
                  onClick={()=>setTooltip(tooltip===dateStr ? null : dateStr)}
                  style={{
                    borderRadius:8, padding:"5px 3px", textAlign:"center",
                    cursor:"pointer", position:"relative", minHeight:54,
                    background: isToday ? BLUE : isJewish ? "#fdf4ff" : isAmerican ? "#fff7ed" : "#f8fafc",
                    border: isToday ? `2px solid ${BLUE}` : isJewish ? "2px solid #c084fc" : isAmerican ? "2px solid #fbbf24" : "2px solid transparent",
                  }}>
                  <div style={{fontSize:13,fontWeight:700,color:isToday?"white":"#0f172a",lineHeight:1.2}}>{day}</div>
                  <div style={{fontSize:9,color:isToday?"rgba(255,255,255,0.85)":"#8b5cf6",lineHeight:1.1,marginTop:1}}>{hebrewDay}</div>
                  {holiday&&(
                    <div style={{fontSize:8,marginTop:2,lineHeight:1.1,color:isToday?"white":isJewish?"#7e22ce":"#92400e",fontWeight:600,overflow:"hidden",maxHeight:18}}>
                      {holiday.label.length>14 ? holiday.label.slice(0,13)+"…" : holiday.label}
                    </div>
                  )}

                  {/* Tooltip on tap */}
                  {tooltip===dateStr&&(
                    <div style={{position:"absolute",top:"100%",left:"50%",transform:"translateX(-50%)",zIndex:200,background:"#0f172a",color:"white",borderRadius:10,padding:"10px 14px",fontSize:11,whiteSpace:"nowrap",boxShadow:"0 8px 24px rgba(0,0,0,0.3)",marginTop:6,minWidth:160,textAlign:"left",lineHeight:1.6}}>
                      <div style={{fontWeight:700,fontSize:12,marginBottom:4}}>{monthNames[viewMonth]} {day}, {viewYear}</div>
                      <div style={{color:"#c084fc"}}>{getFullHebrewDate(viewYear, viewMonth, day)}</div>
                      {holiday&&<div style={{color:isJewish?"#f0abfc":"#fbbf24",fontWeight:600,marginTop:4}}>{holiday.label}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{display:"flex",gap:16,marginTop:14,paddingTop:12,borderTop:"1px solid #f1f5f9",flexWrap:"wrap"}}>
            {[
              {bg:BLUE,     label:"Today"},
              {bg:"#c084fc", label:"Jewish Holiday"},
              {bg:"#fbbf24", label:"American Holiday"},
            ].map(item=>(
              <div key={item.label} style={{display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:12,height:12,borderRadius:3,background:item.bg}}/>
                <span style={{fontSize:10,color:"#64748b"}}>{item.label}</span>
              </div>
            ))}
            <div style={{marginLeft:"auto",fontSize:10,color:"#94a3b8"}}>Powered by HebCal</div>
          </div>
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════
// V8: THANK YOU MESSAGE POPUP
// ══════════════════════════════════════════════════════════
function ThankYouPopup({ order, lang, onClose }) {
  const [copied, setCopied] = useState(false);
  const name = (order?.customerName||"").split(" ")[0] || "there";
  const msgEN = `Hi ${name}!\n\nThank you so much for choosing LuxeBound Albums! Your order is now complete and we hope you absolutely love your beautiful album.\n\nIt was a pleasure working with you! We would love to have you back for your next album 😊\n\nWarm regards,\nLuxeBound Albums`;
  const msgYI = `שלום ${name}!\n\nא גרויסן דאנק פאר קויפן ביי LuxeBound Albums! אייער באשטעלונג איז פארטיק און מיר האפן אז איר וועט ליבן אייער שיינעם אלבאם.\n\nא פארגעניגן צו ארבעטן מיט אייך! מיר וואלטן גערן זען אייך ווידער 😊\n\nמיט ווארעמע גריסן,\nLuxeBound Albums`;
  const msg = lang==="yi" ? msgYI : msgEN;
  const copy = () => { navigator.clipboard?.writeText(msg).catch(()=>{}); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:600,padding:16}}>
      <div style={{background:"white",borderRadius:20,padding:28,width:"100%",maxWidth:440,boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{textAlign:"center",marginBottom:16}}>
          <div style={{fontSize:40,marginBottom:8}}>🎉</div>
          <div style={{fontWeight:700,fontSize:18,color:"#0f172a"}}>Order Complete!</div>
          <div style={{fontSize:13,color:"#64748b",marginTop:4}}>Send a thank you message to {order?.customerName}</div>
        </div>
        <div style={{background:"#f8fafc",borderRadius:10,padding:"12px 14px",fontSize:13,color:"#334155",lineHeight:1.6,whiteSpace:"pre-wrap",border:"1px solid #e2e8f0",marginBottom:14,maxHeight:180,overflowY:"auto"}}>{msg}</div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:"12px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"white",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Skip</button>
          <button onClick={copy} style={{flex:2,padding:"12px",borderRadius:10,border:"none",background:copied?GREEN:BLUE,color:"white",cursor:"pointer",fontSize:14,fontWeight:700,fontFamily:"system-ui,sans-serif",transition:"background .2s"}}>
            {copied?"✅ Copied!":"📋 Copy Message"}
          </button>
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════
// V8: PRICE CALCULATOR
// ══════════════════════════════════════════════════════════
function PriceCalculator({ albums, upgrades, onClose }) {
  const [selAlbum, setSelAlbum] = useState("");
  const [selUpgrades, setSelUpgrades] = useState({});
  const [discount, setDiscount] = useState("");
  const albumPrice = albums.find(a=>a.name===selAlbum)?.price||0;
  const upgTotal = upgrades.reduce((s,u)=>{const q=Number(selUpgrades[u.id]||0);return s+(q>0?u.price*q:0);},0);
  const subtotal = albumPrice + upgTotal;
  const discAmt = Number(discount)||0;
  const total = Math.max(0, subtotal - discAmt);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,padding:16}}>
      <div style={{background:"white",borderRadius:20,padding:24,width:"100%",maxWidth:440,boxShadow:"0 20px 60px rgba(0,0,0,0.3)",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:18,color:"#0f172a"}}>💰 Price Calculator</div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:24,cursor:"pointer",color:"#94a3b8",padding:0,lineHeight:1}}>×</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.6px"}}>Album</div>
            <select value={selAlbum} onChange={e=>setSelAlbum(e.target.value)} style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#0f172a",fontSize:14,outline:"none",fontFamily:"system-ui,sans-serif"}}>
              <option value="">Select album…</option>
              {albums.map(a=><option key={a.id} value={a.name}>{a.name} — {fmt$(a.price)}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.6px"}}>Add-ons</div>
            {upgrades.map(u=>{
              const checked=(selUpgrades[u.id]||0)>0;
              return(
                <label key={u.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,padding:"8px 12px",borderRadius:8,background:checked?"#eff2ff":"#f8fafc",border:`1.5px solid ${checked?BLUE+"55":"#e2e8f0"}`,cursor:"pointer"}}>
                  <input type="checkbox" checked={checked} onChange={e=>setSelUpgrades(p=>({...p,[u.id]:e.target.checked?1:0}))} style={{accentColor:BLUE,width:16,height:16}}/>
                  <span style={{flex:1,fontSize:13,color:"#0f172a"}}>{u.name}</span>
                  <span style={{fontSize:13,fontWeight:600,color:AMBER}}>{fmt$(u.price)}</span>
                </label>
              );
            })}
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.6px"}}>Discount $</div>
            <input type="number" value={discount} onChange={e=>setDiscount(e.target.value)} placeholder="0" style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#0f172a",fontSize:14,outline:"none",fontFamily:"system-ui,sans-serif",boxSizing:"border-box"}}/>
          </div>
        </div>
        <div style={{marginTop:20,background:`linear-gradient(135deg,${NAVY},#1e3a8a)`,borderRadius:14,padding:"16px 20px"}}>
          {[
            {label:"Subtotal",val:fmt$(subtotal)},
            ...(discAmt>0?[{label:"Discount",val:`-${fmt$(discAmt)}`}]:[]),
          ].map(({label,val})=>(
            <div key={label} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"rgba(255,255,255,0.75)",marginBottom:6}}><span>{label}</span><span>{val}</span></div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",fontSize:20,fontWeight:800,color:"white",borderTop:"1px solid rgba(255,255,255,0.2)",paddingTop:10,marginTop:4}}>
            <span>Total</span><span>{fmt$(total)}</span>
          </div>
        </div>
        <button onClick={onClose} style={{width:"100%",marginTop:14,padding:"12px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"white",color:"#64748b",cursor:"pointer",fontSize:14,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Close</button>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════
// V8: CUSTOMER FULL PROFILE PAGE
// ══════════════════════════════════════════════════════════
function CustomerProfile({ customer, orders, onClose, onEdit, th }) {
  const custOrders = orders.filter(o=>(o.customerName||"").toLowerCase()===(customer?.name||"").toLowerCase());
  const activeOrders = custOrders.filter(o=>o.status!=="Order Done");
  const doneOrders = custOrders.filter(o=>o.status==="Order Done");
  const lifetime = custOrders.filter(o=>!o.refunded).reduce((s,o)=>s+(Number(o.finalTotal)||Number(o.total)||0),0);
  const outstanding = custOrders.filter(o=>!o.paid&&o.status!=="Order Done").reduce((s,o)=>s+(Number(o.finalTotal)||Number(o.total)||0),0);
  const rating = customer?.rating||0;
  const STARS = [1,2,3,4,5];

  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:600,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#f1f5f9",borderRadius:20,width:"100%",maxWidth:500,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        {/* Header */}
        <div style={{background:`linear-gradient(135deg,${NAVY},#1e3a8a)`,borderRadius:"20px 20px 0 0",padding:"24px 24px 20px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontWeight:800,fontSize:22,color:"white"}}>{customer?.name}</div>
              {customer?.phone&&<div style={{fontSize:14,color:"rgba(255,255,255,0.75)",marginTop:4}}>{customer.phone}</div>}
              {customer?.email&&<div style={{fontSize:13,color:"rgba(255,255,255,0.6)",marginTop:2}}>{customer.email}</div>}
              {customer?.source&&<div style={{fontSize:12,color:"rgba(255,255,255,0.55)",marginTop:4}}>📍 {customer.source}</div>}
            </div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"white",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:18,lineHeight:1}}>×</button>
          </div>
          {customer?.vip&&<span style={{display:"inline-block",marginTop:10,fontSize:11,fontWeight:700,background:"rgba(255,255,255,0.2)",color:"white",padding:"3px 10px",borderRadius:20}}>⭐ VIP Customer</span>}
          {/* Star rating */}
          <div style={{display:"flex",gap:4,marginTop:12,alignItems:"center"}}>
            {STARS.map(s=>(
              <button key={s} onClick={()=>onEdit({...customer,rating:s})} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,padding:0,lineHeight:1,color:s<=rating?"#fbbf24":"rgba(255,255,255,0.3)"}}>★</button>
            ))}
            {rating>0&&<span style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginLeft:4}}>{rating}/5 private rating</span>}
          </div>
        </div>
        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,padding:"16px 16px 0"}}>
          {[
            {label:"Total Orders",val:custOrders.length,color:BLUE},
            {label:"Lifetime Value",val:fmt$(lifetime),color:GREEN},
            {label:"Outstanding",val:fmt$(outstanding),color:outstanding>0?RED:"#94a3b8"},
          ].map(({label,val,color})=>(
            <div key={label} style={{background:"white",borderRadius:12,padding:"12px 10px",textAlign:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
              <div style={{fontSize:16,fontWeight:800,color}}>{val}</div>
              <div style={{fontSize:10,color:"#64748b",marginTop:3,fontWeight:600}}>{label}</div>
            </div>
          ))}
        </div>
        {/* Note */}
        {customer?.note&&(
          <div style={{margin:"12px 16px 0",background:"#fff7ed",borderRadius:10,padding:"10px 14px",border:"1px solid #fed7aa"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#92400e",marginBottom:4}}>📝 Note</div>
            <div style={{fontSize:13,color:"#92400e"}}>{customer.note}</div>
          </div>
        )}
        {/* Tags */}
        {(customer?.tags||[]).length>0&&(
          <div style={{margin:"10px 16px 0",display:"flex",gap:6,flexWrap:"wrap"}}>
            {(customer.tags||[]).map(tag=><span key={tag} style={{fontSize:11,background:"#eff2ff",color:BLUE,padding:"3px 10px",borderRadius:20,fontWeight:600}}>{tag}</span>)}
          </div>
        )}
        {/* Active Orders */}
        <div style={{padding:"14px 16px 0"}}>
          <div style={{fontWeight:700,fontSize:13,color:"#0f172a",marginBottom:8}}>📦 Active Orders ({activeOrders.length})</div>
          {activeOrders.length===0&&<div style={{fontSize:12,color:"#94a3b8",padding:"8px 0"}}>No active orders</div>}
          {activeOrders.map(o=>(
            <div key={o.id} style={{background:"white",borderRadius:10,padding:"10px 14px",marginBottom:8,border:"1px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{(o.selectedAlbums||[{albumType:o.albumType}]).map(a=>a.albumType).filter(Boolean).join(", ")}</div>
                <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{fmtD(o.dateCreated)} · <span style={{color:o.paid?GREEN:RED}}>{o.paid?"Paid":"Unpaid"}</span></div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:13,fontWeight:700,color:BLUE}}>{fmt$(o.finalTotal||o.total)}</div>
                <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{o.status}</div>
              </div>
            </div>
          ))}
        </div>
        {/* Done Orders */}
        {doneOrders.length>0&&(
          <div style={{padding:"8px 16px 16px"}}>
            <div style={{fontWeight:700,fontSize:13,color:"#0f172a",marginBottom:8}}>✅ Completed Orders ({doneOrders.length})</div>
            {doneOrders.map(o=>(
              <div key={o.id} style={{background:"white",borderRadius:10,padding:"10px 14px",marginBottom:8,border:"1px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center",opacity:0.8}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{(o.selectedAlbums||[{albumType:o.albumType}]).map(a=>a.albumType).filter(Boolean).join(", ")}</div>
                  <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{fmtD(o.dateCreated)}</div>
                </div>
                <div style={{fontSize:13,fontWeight:700,color:"#64748b"}}>{fmt$(o.finalTotal||o.total)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════
// V6.2: QUICK NOTE MODAL
// ══════════════════════════════════════════════════════════
function QuickNoteModal({ order, onSave, onClose, th }) {
  const [note, setNote] = useState(order?.notes||"");
  const [saving, setSaving] = useState(false);
  const handleSave = async() => {
    setSaving(true);
    await onSave(order, note);
    setSaving(false);
    onClose();
  };
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"white",borderRadius:20,padding:24,width:"100%",maxWidth:460,boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div>
            <div style={{fontWeight:700,fontSize:17,color:"#0f172a"}}>📝 Note</div>
            <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{order?.customerName}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:24,cursor:"pointer",color:"#94a3b8",padding:0,lineHeight:1}}>×</button>
        </div>
        <textarea
          value={note}
          onChange={e=>setNote(e.target.value)}
          placeholder="Add a note about this order…"
          rows={5}
          autoFocus
          style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#0f172a",fontSize:14,outline:"none",fontFamily:"system-ui,sans-serif",resize:"vertical",boxSizing:"border-box",marginBottom:14}}
        />
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:"12px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"white",color:"#64748b",cursor:"pointer",fontSize:14,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{flex:2,padding:"12px",borderRadius:10,border:"none",background:saving?"#94a3b8":"linear-gradient(135deg,#18B978,#34d399)",color:"white",cursor:saving?"not-allowed":"pointer",fontSize:14,fontWeight:700,fontFamily:"system-ui,sans-serif"}}>
            {saving?"Saving…":"💾 Save Note"}
          </button>
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
function Dashboard({ orders,albums,upgrades,customers,onSaveCustomer,statusFilter,setStatusFilter,onNew,onEdit,onDelete,onPin,onSnooze,onSettings,onSignOut,showExport,setShowExport,currentUser,onBulkStatus,onQuickStatus,onEditNote,invoiceMap,activeStatuses,lang,th }) {
  const [filters,setFilters]=useState({search:"",album:"",paid:"",vip:false,priority:false,pinned:false});
  const [quickNoteOrder,setQuickNoteOrder]=useState(null);
  const [showCalc,setShowCalc]=useState(false);
  const [viewCustomer,setViewCustomer]=useState(null);
  // V6: Daily digest + weekly summary
  const [showDigest,setShowDigest]=useState(()=>{
    const key=`lb_digest_${new Date().toDateString()}`;
    return !localStorage.getItem(key);
  });
  const [showWeekly,setShowWeekly]=useState(()=>{
    const today=new Date();
    const isMonday=today.getDay()===1;
    const key=`lb_weekly_${today.toDateString()}`;
    return isMonday&&!localStorage.getItem(key);
  });
  const dismissDigest=()=>{localStorage.setItem(`lb_digest_${new Date().toDateString()}`,"1");setShowDigest(false);};
  const dismissWeekly=()=>{localStorage.setItem(`lb_weekly_${new Date().toDateString()}`,"1");setShowWeekly(false);};
  const [ordersOpen,setOrdersOpen]=useState(()=>{ try{ const s=localStorage.getItem('lb_orders_open'); return s===null?true:s==='1'; }catch{return true;} });
  const [selectMode,setSelectMode]=useState(false);
  const [selected,setSelected]=useState([]);
  const [bulkStatus,setBulkStatus]=useState("");

  const filtered=orders.filter(o=>{
    if(statusFilter&&o.status!==statusFilter) return false;
    if(filters.album){const names=(o.selectedAlbums||[{albumType:o.albumType}]).map(a=>a.albumType);if(!names.includes(filters.album))return false;}
    if(filters.search){const q=filters.search.toLowerCase();const inN=(o.customerName||"").toLowerCase().includes(q);const inP=(o.phone||"").includes(q);const inI=(o.invoiceNum||"").toLowerCase().includes(q);if(!inN&&!inP&&!inI)return false;}
    if(filters.paid==="paid"&&!o.paid) return false;
    if(filters.paid==="unpaid"&&o.paid) return false;
    if(filters.vip&&!o.vip) return false;
    if(filters.priority&&!o.priority) return false;
    if(filters.pinned&&!o.pinned) return false;
    return true;
  });

  // Pinned first, then newest first by dateCreated
  // V6: Enrich orders with invoice numbers
  const enriched=filtered.map(o=>({...o,invoiceNum:invoiceMap?.[o.id]||o.invoiceNum||""}));
  const sorted=[...enriched].sort((a,b)=>{
    if(a.pinned&&!b.pinned) return -1;
    if(!a.pinned&&b.pinned) return 1;
    return (b.dateCreated||"").localeCompare(a.dateCreated||"");
  });

  const clearFilters=()=>{setFilters({search:"",album:"",paid:"",vip:false,priority:false,pinned:false});setStatusFilter(null);};
  const filterUnpaid=()=>{setFilters(f=>({...f,paid:"unpaid"}));setOrdersOpen(true);};
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
          <Btn variant="ghost" sm onClick={()=>setShowCalc(true)} style={{padding:"8px 18px",fontSize:13}}>💰 Calc</Btn>
          <Btn variant="ghost" sm onClick={()=>setShowExport(true)} style={{padding:"8px 18px",fontSize:13}}>📊 Export</Btn>
          <Btn variant="ghost" sm onClick={onSettings} style={{padding:"8px 18px",fontSize:13}}>⚙️</Btn>
          <Btn variant="ghost" sm onClick={onSignOut} style={{padding:"8px 18px",fontSize:13}}>Sign Out</Btn>
        </div>
      </div>

      <div style={{padding:"28px 32px",maxWidth:1440,margin:"0 auto"}}>
        {showDigest&&<DailyDigest orders={orders} onDismiss={dismissDigest} displayName={currentUser?.displayName||currentUser?.email?.split("@")[0]||"User"}/>}
        {showWeekly&&<WeeklySummary orders={orders} onDismiss={dismissWeekly}/>}
        <StatCards orders={orders} onFilterUnpaid={filterUnpaid}/>
        <Pipeline orders={orders} statusFilter={statusFilter} setStatusFilter={setStatusFilter} activeStatuses={activeStatuses}/>
        <FlagsSection orders={orders} onEdit={onEdit} onSnooze={onSnooze}/>
        <UpcomingDeadlines orders={orders} onEdit={onEdit}/>
        <DualCalendar/>

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
                    {(activeStatuses||STATUSES).map(s=><option key={s} value={s}>{s}</option>)}
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
                      <OrderCard order={{...o,invoiceNum:invoiceMap?.[o.id]||o.invoiceNum||""}} onEdit={onEdit} onDelete={onDelete} onPin={onPin} onQuickStatus={onQuickStatus} onEditNote={o=>setQuickNoteOrder(o)} onViewCustomer={name=>setViewCustomer((customers||[]).find(c=>c.name.toLowerCase()===name.toLowerCase())||{name})}/>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>
      {showExport&&<ExportModal orders={orders} onClose={()=>setShowExport(false)} th={th}/>}
      {quickNoteOrder&&<QuickNoteModal order={quickNoteOrder} onSave={onEditNote} onClose={()=>setQuickNoteOrder(null)} th={th}/>}
      {showCalc&&<PriceCalculator albums={albums} upgrades={upgrades} onClose={()=>setShowCalc(false)}/>}
      {viewCustomer&&<CustomerProfile customer={viewCustomer} orders={orders} onClose={()=>setViewCustomer(null)} onEdit={c=>{onSaveCustomer([c,...(customers||[]).filter(x=>x.id!==c.id)]);setViewCustomer(c);}} th={th}/>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// INVOICE GENERATOR  (V5)
// ══════════════════════════════════════════════════════════
function generateInvoice(order) {
  const ft=Number(order.finalTotal)||Number(order.total)||0;
  const received=(order.payments||[]).reduce((s,p)=>s+Number(p.amount||0),0);
  const balance=ft-received;
  const albumLines=(order.selectedAlbums||[{albumType:order.albumType,albumPrice:order.albumPrice}])
    .filter(a=>a.albumType)
    .map(a=>`<tr><td>${a.albumType}</td><td style="text-align:right">${fmt$(a.albumPrice)}</td></tr>`).join("");
  const upgLines=Object.entries(order.selectedUpgrades||{}).filter(([,q])=>Number(q)>0)
    .map(([id,qty])=>{
      const n=(order.upgradeNames||{})[id]||id;
      const p=(order.upgradePrices||{})[id]||0;
      return `<tr><td>✨ ${n}${Number(qty)>1?` ×${qty}`:""}</td><td style="text-align:right">${fmt$(p*Number(qty))}</td></tr>`;
    }).join("");
  const payLines=(order.payments||[]).map(p=>
    `<tr><td>${fmtD(p.date)} — ${p.method||""}</td><td style="text-align:right;color:#18B978">-${fmt$(p.amount)}</td></tr>`
  ).join("");
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice ${order.invoiceNum||""}</title>
<style>
  body{font-family:system-ui,sans-serif;padding:40px;color:#0f172a;max-width:600px;margin:0 auto}
  .hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:40px;padding-bottom:20px;border-bottom:3px solid #0f1f4b}
  .hdr h1{color:#0f1f4b;font-size:24px;margin:0;font-family:Georgia,serif}
  .hdr p{color:#64748b;margin:4px 0 0;font-size:12px;letter-spacing:2px;text-transform:uppercase}
  .inv{text-align:right;font-size:13px;color:#64748b}
  .inv strong{font-size:22px;color:#0f1f4b;display:block;margin-bottom:4px}
  .cust{background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:30px}
  .cust h3{margin:0 0 8px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px}
  .cust p{margin:2px 0;font-size:15px}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  th{background:#0f1f4b;color:white;padding:10px 14px;text-align:left;font-size:12px}
  td{padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:14px}
  .tot td{font-weight:700;font-size:16px;color:#0f1f4b;border-top:2px solid #0f1f4b;border-bottom:none}
  .bal td{font-weight:800;font-size:18px;color:${balance>0?"#ef4444":"#18B978"};background:${balance>0?"#fef2f2":"#f0fdf4"};border-radius:8px}
  .foot{margin-top:40px;text-align:center;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;padding-top:20px}
  @media print{body{padding:20px}}
</style></head><body>
<div class="hdr">
  <div>${order._companyLogo?`<img src="${order._companyLogo}" style="width:50px;height:50px;border-radius:50%;object-fit:cover;margin-bottom:6px;display:block"/>`:""}<h1>${order._companyName||"LuxeBound Albums"}</h1><p>${order._companyTagline||"The Art of Album Making"}</p>${order._companyPhone?`<p style="font-size:12px;color:#64748b">${order._companyPhone}</p>`:""}</div>
  <div class="inv"><strong>INVOICE</strong>${order.invoiceNum?`<span>${order.invoiceNum}</span>`:""}<br/>Date: ${fmtD(order.dateCreated)}</div>
</div>
<div class="cust"><h3>Bill To</h3><p><strong>${order.customerName||""}</strong></p><p>${order.phone||""}</p>${order.email?`<p>${order.email}</p>`:""}</div>
<table><thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
<tbody>
${albumLines}${upgLines}
${order.discountValue>0?`<tr><td>🏷️ Discount</td><td style="text-align:right;color:#ef4444">-${fmt$(Math.abs((Number(order.total)||0)-(Number(order.finalTotal)||0)))}</td></tr>`:""}
<tr class="tot"><td>Total</td><td style="text-align:right">${fmt$(ft)}</td></tr>
${payLines}
<tr class="bal"><td>Balance Due</td><td style="text-align:right">${fmt$(balance)}</td></tr>
</tbody></table>
<div class="foot">
  <div style="margin-bottom:14px;padding:14px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;text-align:left">
    <div style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:6px">Payment Options</div>
    <div style="font-size:12px;color:#475569;margin-bottom:4px">QuickPay: ${order._companyQuickPay||"luxeboundalbums@gmail.com"} &nbsp;·&nbsp; Cash &nbsp;·&nbsp; Credit Card</div>
    <div style="font-size:11px;color:#94a3b8;font-style:italic">A 3% processing fee applies to all credit card payments.</div>
  </div>
  <div style="font-size:12px;color:#475569;font-style:italic;margin-bottom:10px">Please ensure that the full balance is paid at the time of pickup.</div>
  <div style="font-size:11px;color:#94a3b8">Thank you for choosing ${order._companyName||"LuxeBound Albums"} — it is a pleasure serving you!</div>
</div>
</body></html>`;
  const w=window.open("","_blank");
  w.document.write(html);
  w.document.close();
  setTimeout(()=>w.print(),500);
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

function OrderForm({ order, albums, upgrades, paymentMethods, onSave, onCancel, onDelete, onDuplicate, currentUser, customers, onSaveCustomer, sources, companyProfile, activeStatuses, albumSizes, coverTypes, lang, th }) {
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
  // V5 new fields
  const [photos,setPhotos]=useState(order?.photos||[]);
  const [photoUploading,setPhotoUploading]=useState(false);
  const [payments,setPayments]=useState(order?.payments||[]);
  const [paymentDueDate,setPaymentDueDate]=useState(order?.paymentDueDate||"");
  const [refunded,setRefunded]=useState(order?.refunded||false);
  const [refundAmount,setRefundAmount]=useState(order?.refundAmount||"");
  // V6: Follow-up date
  const [followUpDate,setFollowUpDate]=useState(order?.followUpDate||"");
  // V8: Album size + cover type
  const [albumSize,setAlbumSize]=useState(order?.albumSize||"");
  const [coverType,setCoverType]=useState(order?.coverType||"");
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

  // V5: Photo upload
  const handlePhotoUpload=async(e)=>{
    const files=Array.from(e.target.files||[]);
    if(!files.length) return;
    if(photos.length+files.length>4){setErr("Maximum 4 photos per order.");return;}
    setPhotoUploading(true); setErr("");
    try{
      const compressed=await Promise.all(files.slice(0,4-photos.length).map(f=>compressImage(f,800,0.7)));
      setPhotos(prev=>[...prev,...compressed]);
    }catch{setErr("Failed to upload photo.");}
    setPhotoUploading(false); e.target.value="";
  };

  // V5: Payment entry helpers
  const addPayment=()=>setPayments(prev=>[...prev,{id:uid(),amount:"",date:todayStr(),method:""}]);
  const updatePayment=(id,field,val)=>setPayments(prev=>prev.map(p=>p.id===id?{...p,[field]:val}:p));
  const removePayment=id=>setPayments(prev=>prev.filter(p=>p.id!==id));

  const albumsTotal=selAlbums.reduce((s,a)=>s+(Number(a.albumPrice)||0),0);
  const upgTotal=upgrades.reduce((s,u)=>{const q=Number(selUpg[u.id]||0);return s+(q>0?u.price*q:0);},0);
  const subtotal=albumsTotal+upgTotal;
  const discAmt=discVal?(discType==="percent"?subtotal*(Number(discVal)||0)/100:Number(discVal)||0):0;
  const finalTotal=Math.max(0,subtotal-discAmt);
  const profit=finalTotal-(Number(znoCost)||0);

  // V5: Auto-check paid when fully paid via deposits (must be after finalTotal)
  const totalReceived=payments.reduce((s,p)=>s+Number(p.amount||0),0);
  const balance=finalTotal-totalReceived;
  React.useEffect(()=>{
    if(totalReceived>0&&totalReceived>=finalTotal&&finalTotal>0) setPaid(true);
  },[totalReceived,finalTotal]);

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
        photos,
        payments:payments.filter(p=>p.amount),
        paymentDueDate:paymentDueDate||"",
        refunded,refundAmount:refunded?Number(refundAmount)||0:0,
        followUpDate:followUpDate||"",
        albumSize:albumSize||"",
        coverType:coverType||"",
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
      <div style={{padding:"24px 28px",maxWidth:820,margin:"0 auto"}}>

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
              {dateCreated&&<div style={{fontSize:11,color:"#8b5cf6",marginTop:3}}>{toHebrewDate(dateCreated)}</div>}
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
        {/* Album Size + Cover Type */}
        <div style={sec}>
          <div style={{fontWeight:700,fontSize:15,color:"#0f172a",marginBottom:14,paddingBottom:10,borderBottom:"1px solid #f1f5f9"}}>📐 Album Details</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Album Size">
              <select value={albumSize} onChange={e=>setAlbumSize(e.target.value)} style={inp}>
                <option value="">Select size…</option>
                {(albumSizes||DEFAULT_ALBUM_SIZES).map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Cover Type">
              <select value={coverType} onChange={e=>setCoverType(e.target.value)} style={inp}>
                <option value="">Select cover…</option>
                {(coverTypes||DEFAULT_COVER_TYPES).map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </Field>
          </div>
        </div>

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
          <div style={{...sec,marginBottom:14}}>
            <Field label="Date Sent to Zno">
              <input type="date" value={dateSentZno} onChange={e=>setDateSentZno(e.target.value)} style={inp}/>
              {dateSentZno&&<div style={{fontSize:11,color:"#8b5cf6",marginTop:3}}>{toHebrewDate(dateSentZno)}</div>}
            </Field>
          </div>
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
          <Field label="Payment Due Date (Optional)" style={{marginBottom:14}}>
            <input type="date" value={paymentDueDate} onChange={e=>setPaymentDueDate(e.target.value)} style={inp}/>
            {paymentDueDate&&<div style={{fontSize:11,color:"#8b5cf6",marginTop:3}}>{toHebrewDate(paymentDueDate)}</div>}
          </Field>
          <Field label="Status">
            <div style={{display:"flex",flexWrap:"wrap",gap:7,marginTop:4}}>
              {(activeStatuses||STATUSES).map(s=>{
                const isDoneBlock=s===(activeStatuses||STATUSES).slice(-1)[0]&&!paid;
                return(
                  <button key={s} onClick={()=>handleStatus(s)} title={isDoneBlock?"Mark as Paid first":undefined} style={{padding:"6px 12px",borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"system-ui,sans-serif",background:status===s?BLUE:isDoneBlock?"#f1f5f9":"#f1f5f9",color:status===s?"white":isDoneBlock?"#cbd5e1":"#475569",border:`1.5px solid ${status===s?BLUE:"transparent"}`,opacity:isDoneBlock?.6:1}}>{s}</button>
                );
              })}
            </div>
          </Field>
        </div>

        {/* Payment History */}
        <div style={sec}>
          <div style={{fontWeight:700,fontSize:15,color:"#0f172a",marginBottom:14,paddingBottom:10,borderBottom:"1px solid #f1f5f9"}}>
            💰 Payment History
            {finalTotal>0&&<span style={{fontSize:12,fontWeight:400,color:"#64748b",marginLeft:8}}>{fmt$(totalReceived)} received · {fmt$(Math.max(0,finalTotal-totalReceived))} balance</span>}
          </div>
          {payments.map(p=>(
            <div key={p.id} style={{display:"flex",gap:8,marginBottom:10,alignItems:"center",background:"#f8fafc",borderRadius:10,padding:"10px 12px",border:"1px solid #e8ecf0"}}>
              <input type="number" value={p.amount} onChange={e=>updatePayment(p.id,"amount",e.target.value)} placeholder="Amount $" style={{...inp,flex:1,fontSize:13,padding:"8px 10px"}}/>
              <input type="date" value={p.date} onChange={e=>updatePayment(p.id,"date",e.target.value)} style={{...inp,flex:1,fontSize:13,padding:"8px 10px"}}/>
              <select value={p.method} onChange={e=>updatePayment(p.id,"method",e.target.value)} style={{...inp,flex:1,fontSize:13,padding:"8px 10px"}}>
                <option value="">Method…</option>
                {paymentMethods.map(pm=><option key={pm} value={pm}>{pm}</option>)}
              </select>
              <button onClick={()=>removePayment(p.id)} style={{background:"none",border:"none",color:RED,cursor:"pointer",fontSize:20,padding:"0 4px",lineHeight:1,flexShrink:0}}>×</button>
            </div>
          ))}
          <button onClick={addPayment} style={{padding:"8px 18px",borderRadius:8,border:`1.5px dashed ${GREEN}`,background:"#f0fdf4",color:GREEN,cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>+ Add Payment</button>
        </div>

        {/* Refund */}
        <div style={sec}>
          <div style={{fontWeight:700,fontSize:15,color:"#0f172a",marginBottom:14,paddingBottom:10,borderBottom:"1px solid #f1f5f9"}}>↩️ Refund</div>
          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:14,color:"#0f172a",fontWeight:600}}>
            <input type="checkbox" checked={refunded} onChange={e=>setRefunded(e.target.checked)} style={{width:17,height:17,accentColor:RED}}/>
            Refund Issued
          </label>
          {refunded&&(
            <div style={{marginTop:12}}>
              <Field label="Refund Amount">
                <input type="number" value={refundAmount} onChange={e=>setRefundAmount(e.target.value)} placeholder="0.00" style={inp}/>
              </Field>
            </div>
          )}
        </div>

        {/* Photo Attachments */}
        <div style={sec}>
          <div style={{fontWeight:700,fontSize:15,color:"#0f172a",marginBottom:14,paddingBottom:10,borderBottom:"1px solid #f1f5f9"}}>📎 Attachments ({photos.length}/4)</div>
          {photos.length>0&&(
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12}}>
              {photos.map((ph,i)=>(
                <div key={i} style={{position:"relative"}}>
                  <img src={ph} alt={`photo ${i+1}`} style={{width:80,height:80,borderRadius:10,objectFit:"cover",border:"2px solid #e2e8f0"}}/>
                  <button onClick={()=>setPhotos(prev=>prev.filter((_,idx)=>idx!==i))} style={{position:"absolute",top:-6,right:-6,width:20,height:20,borderRadius:"50%",background:RED,border:"2px solid white",color:"white",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,lineHeight:1}}>×</button>
                </div>
              ))}
            </div>
          )}
          {photos.length<4&&(
            <label style={{display:"inline-block",padding:"9px 18px",borderRadius:8,border:`1.5px dashed ${BLUE}`,background:"#eff2ff",color:BLUE,cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>
              {photoUploading?"Uploading…":"📷 Add Photo"}
              <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} style={{display:"none"}} disabled={photoUploading}/>
            </label>
          )}
          <div style={{fontSize:11,color:"#94a3b8",marginTop:8}}>Screenshots, approvals, reference images. Max 4.</div>
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

        {/* Invoice button - edit only */}
        {isEdit&&(
          <div style={{marginBottom:14}}>
            <button onClick={()=>generateInvoice({...order,customerName,finalTotal,payments,paymentDueDate,selectedAlbums:selAlbums,selectedUpgrades:selUpg,upgradeNames:Object.fromEntries(upgrades.map(u=>[u.id,u.name])),upgradePrices:Object.fromEntries(upgrades.map(u=>[u.id,u.price])),_companyName:companyProfile?.name,_companyTagline:companyProfile?.tagline,_companyPhone:companyProfile?.phone,_companyLogo:companyProfile?.logo,_companyQuickPay:companyProfile?.quickPayEmail||"luxeboundalbums@gmail.com"})}
              style={{width:"100%",padding:"12px",borderRadius:10,border:`1.5px solid ${NAVY}`,background:"white",color:NAVY,cursor:"pointer",fontSize:14,fontWeight:700,fontFamily:"system-ui,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              📄 Generate Invoice{order.invoiceNum?` (${order.invoiceNum})`:""}
            </button>
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
          {isEdit&&onDuplicate&&<button onClick={()=>onDuplicate(order)} style={{flex:1,padding:"14px",borderRadius:10,border:`1.5px solid ${BLUE}`,background:"white",color:BLUE,cursor:"pointer",fontSize:14,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>📋 Duplicate</button>}
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

function UsersTab({ users, onSave, th }) {
  const [adding,setAdding]=useState(false);
  const [newEmail,setNewEmail]=useState("");
  const [newName,setNewName]=useState("");
  const [newRole,setNewRole]=useState("user");
  const [newPw,setNewPw]=useState("");
  const [err,setErr]=useState("");
  const [msg,setMsg]=useState("");
  const [loading,setLoading]=useState(false);
  const inp=iStyle(th);

  const addUser=async()=>{
    if(!newEmail.trim()||!newName.trim()||!newPw||newPw.length<6){
      setErr("Please fill in all fields. Password must be at least 6 characters.");return;
    }
    setLoading(true);setErr("");
    try{
      // Create Firebase Auth user
      const cred=await createUserWithEmailAndPassword(auth,newEmail.trim(),newPw);
      await updateProfile(cred.user,{displayName:newName.trim()});
      // Save to Firestore users list
      const newUser={id:uid(),email:newEmail.trim(),name:newName.trim(),role:newRole,createdAt:new Date().toISOString()};
      await onSave([...(users||[]),newUser]);
      setMsg(`✅ User ${newName} created! They can now log in.`);
      setNewEmail("");setNewName("");setNewPw("");setNewRole("user");setAdding(false);
      setTimeout(()=>setMsg(""),4000);
    }catch(e){
      if(e.code==="auth/email-already-in-use") setErr("This email is already registered.");
      else setErr("Failed to create user: "+e.message);
    }
    setLoading(false);
  };

  const changeRole=async(user,role)=>{
    await onSave((users||[]).map(u=>u.id===user.id?{...u,role}:u));
  };

  const removeUser=async(user)=>{
    if(!window.confirm(`Remove ${user.name} from the app? They will no longer be able to log in.`)) return;
    await onSave((users||[]).filter(u=>u.id!==user.id));
  };

  return(
    <div>
      {msg&&<div style={{background:"#f0fdf4",borderRadius:10,padding:"12px 16px",marginBottom:14,fontSize:13,color:GREEN,fontWeight:600,border:"1px solid #bbf7d0"}}>{msg}</div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontSize:13,color:th.subtext}}>{(users||[]).length} user{(users||[]).length!==1?"s":""} in the app</div>
        <button onClick={()=>setAdding(a=>!a)} style={{padding:"9px 18px",borderRadius:8,border:"none",background:BLUE,color:"white",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>{adding?"Cancel":"+ Add User"}</button>
      </div>

      {adding&&(
        <div style={{background:th.card,borderRadius:12,padding:16,border:`2px solid ${BLUE}`,marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:12}}>➕ New User</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Full name" style={{...inp,fontSize:13}}/>
            <input type="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="Email address" style={{...inp,fontSize:13}}/>
            <input type="password" value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="Password (min 6 characters)" style={{...inp,fontSize:13}}/>
            <select value={newRole} onChange={e=>setNewRole(e.target.value)} style={{...inp,fontSize:13}}>
              <option value="user">Regular User</option>
              <option value="admin">Admin</option>
            </select>
            {err&&<div style={{fontSize:12,color:RED}}>{err}</div>}
            <button onClick={addUser} disabled={loading} style={{padding:"11px",borderRadius:8,border:"none",background:loading?"#94a3b8":GREEN,color:"white",cursor:loading?"not-allowed":"pointer",fontSize:14,fontWeight:700,fontFamily:"system-ui,sans-serif"}}>
              {loading?"Creating…":"✅ Create User"}
            </button>
          </div>
        </div>
      )}

      {(users||[]).map(u=>(
        <div key={u.id} style={{background:th.card,borderRadius:12,padding:"14px 16px",marginBottom:10,border:`1px solid ${th.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:th.text}}>{u.name}</div>
            <div style={{fontSize:12,color:th.subtext,marginTop:2}}>{u.email}</div>
            <div style={{marginTop:6}}>
              <select value={u.role||"user"} onChange={e=>changeRole(u,e.target.value)} style={{padding:"4px 10px",borderRadius:6,border:"1.5px solid #e2e8f0",fontSize:12,fontFamily:"system-ui,sans-serif",outline:"none",background:u.role==="admin"?"#fef2f2":"#eff2ff",color:u.role==="admin"?"#dc2626":BLUE,fontWeight:600}}>
                <option value="user">👤 Regular User</option>
                <option value="admin">👑 Admin</option>
              </select>
            </div>
          </div>
          <button onClick={()=>removeUser(u)} style={{padding:"6px 14px",borderRadius:8,border:"none",background:"#fef2f2",color:RED,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Remove</button>
        </div>
      ))}
    </div>
  );
}


function AccountTab({currentUser,darkMode,onToggleDark,lang,onToggleLang,th}){
  const [dispName,setDispName]=useState(currentUser?.displayName||"");
  const [pw,setPw]=useState("");
  const [pw2,setPw2]=useState("");
  const [pwMsg,setPwMsg]=useState("");
  const [nameMsg,setNameMsg]=useState("");
  const [photoUploading,setPhotoUploading]=useState(false);
  const inp=iStyle(th);

  const saveDisplayName=async()=>{
    if(!dispName.trim()){setNameMsg("Please enter a name.");return;}
    try{
      await updateProfile(auth.currentUser,{displayName:dispName.trim()});
      setNameMsg("✅ Name updated!");
      setTimeout(()=>setNameMsg(""),2000);
    }catch{setNameMsg("❌ Failed to update name.");}
  };

  const savePassword=async()=>{
    if(!pw||pw.length<6){setPwMsg("Password must be at least 6 characters.");return;}
    if(pw!==pw2){setPwMsg("Passwords don't match.");return;}
    try{
      await updatePassword(auth.currentUser,pw);
      setPw("");setPw2("");
      setPwMsg("✅ Password updated!");
      setTimeout(()=>setPwMsg(""),2000);
    }catch(e){
      if(e.code==="auth/requires-recent-login") setPwMsg("Please log out and log back in before changing your password.");
      else setPwMsg("❌ Failed to update password.");
    }
  };

  const handlePhoto=async(e)=>{
    const file=e.target.files?.[0];if(!file)return;e.target.value="";
    setPhotoUploading(true);
    try{
      const compressed=await compressImage(file,200);
      await updateProfile(auth.currentUser,{photoURL:compressed});
      setPwMsg("");setNameMsg("✅ Photo updated!");
      setTimeout(()=>setNameMsg(""),2000);
    }catch{setNameMsg("❌ Failed to update photo.");}
    setPhotoUploading(false);
  };

  return(
    <div>
      {/* Profile Card */}
      <div style={{background:th.card,borderRadius:14,padding:20,border:`1px solid ${th.border}`,marginBottom:14,textAlign:"center"}}>
        <div style={{position:"relative",display:"inline-block",marginBottom:12}}>
          {currentUser?.photo||auth.currentUser?.photoURL
            ?<img src={currentUser?.photo||auth.currentUser?.photoURL} alt="profile" style={{width:80,height:80,borderRadius:"50%",objectFit:"cover",border:"3px solid #e2e8f0"}}/>
            :<div style={{width:80,height:80,borderRadius:"50%",background:"linear-gradient(135deg,#5271FF,#7c93ff)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,color:"white",margin:"0 auto"}}>
              {(currentUser?.displayName||"U")[0].toUpperCase()}
            </div>
          }
          <label style={{position:"absolute",bottom:0,right:0,background:BLUE,borderRadius:"50%",width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",border:"2px solid white"}}>
            <span style={{fontSize:12}}>📷</span>
            <input type="file" accept="image/*" onChange={handlePhoto} style={{display:"none"}} disabled={photoUploading}/>
          </label>
        </div>
        <div style={{fontWeight:700,fontSize:16,color:th.text}}>{currentUser?.displayName||"User"}</div>
        <div style={{fontSize:13,color:th.subtext,marginTop:2}}>{currentUser?.email||auth.currentUser?.email}</div>
        <div style={{display:"inline-block",marginTop:6,fontSize:11,fontWeight:700,background:currentUser?.role==="admin"?"#fef2f2":"#eff2ff",color:currentUser?.role==="admin"?"#dc2626":BLUE,padding:"3px 12px",borderRadius:20}}>
          {currentUser?.role==="admin"?"👑 Admin":"👤 User"}
        </div>
        {nameMsg&&<div style={{fontSize:12,color:nameMsg.startsWith("✅")?GREEN:RED,marginTop:8}}>{nameMsg}</div>}
      </div>

      {/* Display Name */}
      <div style={{background:th.card,borderRadius:14,padding:16,border:`1px solid ${th.border}`,marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:12}}>✏️ Display Name</div>
        <div style={{display:"flex",gap:8}}>
          <input value={dispName} onChange={e=>setDispName(e.target.value)} placeholder="Your name" style={{...inp,flex:1,fontSize:13}}/>
          <button onClick={saveDisplayName} style={{padding:"9px 16px",borderRadius:8,border:"none",background:BLUE,color:"white",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif",whiteSpace:"nowrap"}}>Save</button>
        </div>
      </div>

      {/* Change Password */}
      <div style={{background:th.card,borderRadius:14,padding:16,border:`1px solid ${th.border}`,marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:12}}>🔑 Change Password</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="New password (min 6 characters)" style={{...inp,fontSize:13}}/>
          <input type="password" value={pw2} onChange={e=>setPw2(e.target.value)} placeholder="Confirm new password" style={{...inp,fontSize:13}}/>
          {pwMsg&&<div style={{fontSize:12,color:pwMsg.startsWith("✅")?GREEN:RED}}>{pwMsg}</div>}
          <button onClick={savePassword} style={{padding:"10px",borderRadius:8,border:"none",background:BLUE,color:"white",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Update Password</button>
        </div>
      </div>

      {/* Preferences */}
      <div style={{background:th.card,borderRadius:14,padding:16,border:`1px solid ${th.border}`,display:"flex",flexDirection:"column",gap:12}}>
        <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:4}}>⚙️ Preferences</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontWeight:600,fontSize:14,color:th.text}}>Dark Mode</div><div style={{fontSize:12,color:th.subtext}}>{darkMode?"On":"Off"}</div></div>
          <Toggle on={darkMode} set={onToggleDark}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontWeight:600,fontSize:14,color:th.text}}>🌐 Language</div><div style={{fontSize:12,color:th.subtext}}>{lang==="yi"?"אידיש":"English"}</div></div>
          <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:"1.5px solid #e2e8f0"}}>
            {[["en","EN"],["yi","יי"]].map(([l,label])=>(
              <button key={l} onClick={()=>onToggleLang(l)} style={{padding:"7px 14px",border:"none",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif",background:lang===l?BLUE:"white",color:lang===l?"white":"#64748b"}}>{label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


function SettingsPanel({currentUser,albums,onSaveAlbums,upgrades,onSaveUpgrades,paymentMethods,onSavePayments,users,onSaveUsers,darkMode,onToggleDark,lang,onToggleLang,onChangePw,onUpdateDisplayName,onUpdatePhoto,onBack,activeTab,setActiveTab,orders,customers,onSaveCustomer,sources,onSaveSources,customerTags,onSaveCustomerTags,trash,onRestoreOrder,onDeletePermanent,companyProfile,onSaveCompanyProfile,onRestoreBackup,customStatuses,onSaveCustomStatuses,companyNotes,onSaveCompanyNotes,expenses,onSaveExpenses,albumSizes,onSaveAlbumSizes,coverTypes,onSaveCoverTypes,settingOrder,onSaveSettingOrder,th}){
  const isAdmin=currentUser.role==="admin";
  const tabs=[
    {id:"pipeline",icon:"🔄",label:"Pipeline",desc:"Edit order statuses & stages"},
    {id:"notes",icon:"📋",label:"Company Notes",desc:"Shared notes for your whole team"},
    {id:"expenses",icon:"💸",label:"Expenses",desc:"Track business expenses"},
    {id:"albumdetails",icon:"📐",label:"Album Details",desc:"Manage sizes & cover types"},
    {id:"pricelist",icon:"🔖",label:"Price List",desc:"Generate a shareable price list"},
    {id:"albums",icon:"📚",label:"Albums",desc:"Manage album types & prices"},
    {id:"upgrades",icon:"✨",label:"Upgrades",desc:"Manage add-ons & prices"},
    {id:"payments",icon:"💳",label:"Payments",desc:"Payment methods"},
    {id:"lists",icon:"📋",label:"Lists & Tags",desc:"Sources, customer tags"},
    {id:"customers",icon:"👥",label:"Customers",desc:"Customer database & history"},
    {id:"insights",icon:"📊",label:"Business Insights",desc:"Revenue, trends & analytics"},
    {id:"trash",icon:"🗑️",label:"Trash",desc:`${(trash||[]).length} deleted order${(trash||[]).length!==1?"s":""}`},
    {id:"shortcuts",icon:"⌨️",label:"Keyboard Shortcuts",desc:"Customize keyboard shortcuts"},
    {id:"account",icon:"🙋",label:"My Account",desc:"Password, language & display settings"},
  ];
  const adminTabs=[
    {id:"company",icon:"🏢",label:"Company Profile",desc:"Logo, name, contact info for invoices"},
    {id:"backup",icon:"💾",label:"Backup & Restore",desc:"Download or restore your data"},
    {id:"users",icon:"🔑",label:"Users",desc:"Manage user accounts"},
  ];
  const allTabs=[...tabs,...(isAdmin?adminTabs:[])];
  if(activeTab){
    const tab=allTabs.find(t=>t.id===activeTab);
    const content=()=>{
      switch(activeTab){
        case "pipeline":  return <PipelineTab customStatuses={customStatuses} onSave={onSaveCustomStatuses} th={th}/>;
        case "notes":     return <CompanyNotesTab notes={companyNotes} onSave={onSaveCompanyNotes} currentUser={currentUser} th={th}/>;
        case "expenses":  return <ExpenseTab expenses={expenses} onSave={onSaveExpenses} th={th}/>;
        case "albumdetails": return <AlbumDetailsTab albumSizes={albumSizes} onSaveAlbumSizes={onSaveAlbumSizes} coverTypes={coverTypes} onSaveCoverTypes={onSaveCoverTypes} th={th}/>;
        case "pricelist": return <PriceListTab albums={albums} upgrades={upgrades} companyProfile={companyProfile} th={th}/>;
        case "albums":    return <ListEditor items={albums} onSave={onSaveAlbums} th={th} placeholder="Album name"/>;
        case "upgrades":  return <ListEditor items={upgrades} onSave={onSaveUpgrades} th={th} placeholder="Upgrade name"/>;
        case "payments":  return <PaymentsTab paymentMethods={paymentMethods} onSave={onSavePayments} th={th}/>;
        case "users":     return <UsersTab users={users} onSave={onSaveUsers} th={th}/>;
        case "insights":  return <InsightsTab orders={orders} customers={customers} th={th}/>;
        case "customers": return <CustomersTab customers={customers} onSave={onSaveCustomer} orders={orders} sources={sources} customerTags={customerTags} th={th}/>;
        case "lists":     return <ListsTagsTab sources={sources} onSaveSources={onSaveSources} customerTags={customerTags} onSaveCustomerTags={onSaveCustomerTags} th={th}/>;
        case "trash":     return <TrashTab trash={trash} onRestore={onRestoreOrder} onDeletePermanent={onDeletePermanent} th={th}/>;
        case "company":   return <CompanyProfileTab profile={companyProfile} onSave={onSaveCompanyProfile} th={th}/>;
        case "backup":    return <BackupTab orders={orders} customers={customers} albums={albums} upgrades={upgrades} paymentMethods={paymentMethods} users={users} sources={sources} customerTags={customerTags} onRestore={onRestoreBackup} th={th}/>;
        case "shortcuts": return <KeyboardShortcutsTab th={th}/>;
        case "account":   return <AccountTab currentUser={currentUser} darkMode={darkMode} onToggleDark={onToggleDark} lang={lang} onToggleLang={onToggleLang} th={th}/>;
        default: return null;
      }
    };
    return(
      <div style={{background:"linear-gradient(160deg,#e8eeff 0%,#f0f7ff 100%)",minHeight:"100vh",fontFamily:"system-ui,sans-serif"}}>
        <NavBar title={`${tab?.icon} ${tab?.label}`} onBack={()=>setActiveTab(null)}/>
        <div style={{padding:"24px 28px",maxWidth:860,margin:"0 auto"}}>{content()}</div>
      </div>
    );
  }
  // V8: Admin can reorder settings boxes
  const [showReorder,setShowReorder]=useState(false);
  const orderedTabs=settingOrder&&settingOrder.length>0
    ?[...tabs].sort((a,b)=>{
        const oi=settingOrder.indexOf(a.id);
        const bi=settingOrder.indexOf(b.id);
        return(oi===-1?999:oi)-(bi===-1?999:bi);
      })
    :tabs;

  const TAB_COLORS = {
    pipeline:  "linear-gradient(135deg,#667eea,#764ba2)",
    notes:     "linear-gradient(135deg,#f093fb,#f5576c)",
    albums:    "linear-gradient(135deg,#5271FF,#7c93ff)",
    upgrades:  "linear-gradient(135deg,#0ea5e9,#38bdf8)",
    payments:  "linear-gradient(135deg,#18B978,#34d399)",
    lists:     "linear-gradient(135deg,#f59e0b,#fbbf24)",
    customers: "linear-gradient(135deg,#8b5cf6,#a78bfa)",
    insights:  "linear-gradient(135deg,#06b6d4,#22d3ee)",
    trash:     "linear-gradient(135deg,#64748b,#94a3b8)",
    company:   "linear-gradient(135deg,#0f1f4b,#1e3a8a)",
    backup:    "linear-gradient(135deg,#16a34a,#4ade80)",
    users:     "linear-gradient(135deg,#dc2626,#f87171)",
    shortcuts: "linear-gradient(135deg,#374151,#6b7280)",
    expenses:  "linear-gradient(135deg,#ef4444,#f87171)",
    albumdetails: "linear-gradient(135deg,#0ea5e9,#38bdf8)",
    pricelist: "linear-gradient(135deg,#16a34a,#4ade80)",
    account:   "linear-gradient(135deg,#C9A84C,#fbbf24)",
  };

  const renderGrid = (items) => (
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
      {items.map((tab)=>(
        <div key={tab.id} onClick={()=>setActiveTab(tab.id)}
          style={{background:TAB_COLORS[tab.id]||"linear-gradient(135deg,#5271FF,#7c93ff)",
            borderRadius:16,padding:"18px 12px",cursor:"pointer",
            boxShadow:"0 4px 16px rgba(0,0,0,0.15)",
            display:"flex",flexDirection:"column",alignItems:"center",
            textAlign:"center",gap:8,minHeight:110,position:"relative"}}>
          <div style={{fontSize:30,lineHeight:1}}>{tab.icon}</div>
          <div style={{fontWeight:700,fontSize:13,color:"white",lineHeight:1.2}}>{tab.label}</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.8)",lineHeight:1.3}}>{tab.desc}</div>
          {tab.id==="trash"&&(trash||[]).length>0&&(
            <div style={{position:"absolute",top:8,right:8,background:"rgba(255,255,255,0.3)",borderRadius:20,padding:"2px 7px",fontSize:10,color:"white",fontWeight:700}}>{(trash||[]).length}</div>
          )}
        </div>
      ))}
    </div>
  );

  // Reorder page
  if(showReorder&&isAdmin) {
    return <ReorderSettings tabs={orderedTabs} adminTabs={adminTabs} onSave={(newOrder)=>{onSaveSettingOrder(newOrder);setShowReorder(false);}} onBack={()=>setShowReorder(false)} TAB_COLORS={TAB_COLORS}/>;
  }

  return(
    <div style={{background:"linear-gradient(160deg,#e8eeff 0%,#f0f7ff 100%)",minHeight:"100vh",fontFamily:"system-ui,sans-serif"}}>
      <div style={{background:"#0f1f4b",padding:"0 24px",height:64,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 12px rgba(0,0,0,.2)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={onBack} style={{background:"rgba(255,255,255,0.12)",border:"none",fontSize:18,cursor:"pointer",color:"white",padding:"6px 12px",borderRadius:8}}>←</button>
          <span style={{fontWeight:700,fontSize:18,color:"white"}}>⚙️ Settings</span>
        </div>
        {isAdmin&&(
          <button onClick={()=>setShowReorder(true)} title="Reorder settings" style={{background:"rgba(255,255,255,0.15)",border:"1.5px solid rgba(255,255,255,0.3)",borderRadius:8,padding:"6px 14px",cursor:"pointer",color:"white",fontSize:14,fontFamily:"system-ui,sans-serif",display:"flex",alignItems:"center",gap:6}}>
            ✏️ <span style={{fontSize:12,fontWeight:600}}>Reorder</span>
          </button>
        )}
      </div>
      <div style={{padding:"24px",maxWidth:960,margin:"0 auto"}}>
        {renderGrid(orderedTabs)}
        {isAdmin&&(
          <div style={{marginTop:28}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <div style={{height:1,flex:1,background:"#e2e8f0"}}/>
              <div style={{display:"flex",alignItems:"center",gap:6,background:"#fef2f2",border:"1.5px solid #fecaca",borderRadius:20,padding:"4px 14px"}}>
                <span style={{fontSize:14}}>🔐</span>
                <span style={{fontSize:12,fontWeight:700,color:"#dc2626"}}>Admin Only</span>
              </div>
              <div style={{height:1,flex:1,background:"#e2e8f0"}}/>
            </div>
            {renderGrid(adminTabs)}
          </div>
        )}
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
  const [authReady,setAuthReady]=useState(false);

  // V9: Firebase Auth state listener
  useEffect(()=>{
    const unsub=onAuthStateChanged(auth,async(fbUser)=>{
      if(fbUser){
        try{
          const snap=await getDocs(collection(db,"users"));
          const users=snap.docs.map(d=>({id:d.id,...d.data()}));
          const match=users.find(u=>u.email?.toLowerCase()===fbUser.email?.toLowerCase());
          setCurrentUser({
            uid:fbUser.uid,
            email:fbUser.email,
            displayName:fbUser.displayName||match?.name||fbUser.email?.split("@")[0]||"User",
            role:match?.role||"user",
            photo:fbUser.photoURL||match?.photo||null,
          });
        }catch{
          setCurrentUser({
            uid:fbUser.uid,
            email:fbUser.email,
            displayName:fbUser.displayName||fbUser.email?.split("@")[0]||"User",
            role:"user",
            photo:fbUser.photoURL||null,
          });
        }
      }else{
        setCurrentUser(null);
      }
      setAuthReady(true);
    });
    return()=>unsub();
  },[]);
  const [view,setView]=useState("dashboard");
  const [orders,setOrders]=useState([]);
  const [albums,setAlbums]=useState(DEFAULT_ALBUMS);
  const [upgrades,setUpgrades]=useState(DEFAULT_UPGRADES);
  const [payments,setPayments]=useState(DEFAULT_PAYMENTS);
  const [users,setUsers]=useState(DEFAULT_USERS);
  const [customers,setCustomers]=useState([]);
  const [trash,setTrash]=useState([]);
  const [sources,setSources]=useState(DEFAULT_SOURCES);
  const [customerTags,setCustomerTags]=useState([]);
  const [companyProfile,setCompanyProfile]=useState(null);
  const [customStatuses,setCustomStatuses]=useState(null);
  const [companyNotes,setCompanyNotes]=useState([]);
  const [settingOrder,setSettingOrder]=useState([]);
  const [expenses,setExpenses]=useState([]);
  const [albumSizes,setAlbumSizes]=useState(DEFAULT_ALBUM_SIZES);
  const [coverTypes,setCoverTypes]=useState(DEFAULT_COVER_TYPES); // null = use defaults
  const [lang,setLang]=useState(()=>lsGet("lb_lang")||"en");
  const [darkMode,setDarkMode]=useState(false);
  const [invoiceMap,setInvoiceMap]=useState({});
  const [editingOrder,setEditingOrder]=useState(null);
  const [statusFilter,setStatusFilter]=useState(null);
  const [settingsTab,setSettingsTab]=useState(null);
  const [showExport,setShowExport]=useState(false);

  useEffect(()=>{
    const dm=lsGet("lb_dark");if(dm)setDarkMode(dm);
  },[]);

  useEffect(()=>{
    if(!currentUser) return; // Wait for authentication before loading data
    const unsubs=[];
    unsubs.push(onSnapshot(collection(db,"orders"),snap=>setOrders(snap.docs.map(d=>({id:d.id,...d.data()}))),e=>console.error("orders:",e)));
    unsubs.push(onSnapshot(collection(db,"customers"),snap=>setCustomers(snap.docs.map(d=>({id:d.id,...d.data()}))),e=>console.error("customers:",e)));
    unsubs.push(onSnapshot(collection(db,"trash"),snap=>setTrash(snap.docs.map(d=>({id:d.id,...d.data()}))),e=>console.error("trash:",e)));
    const cfg=(name,setter,fallback)=>unsubs.push(onSnapshot(doc(db,"config",name),snap=>{if(snap.exists())setter(snap.data().items??fallback);else setter(fallback);},e=>console.error(name,e)));
    cfg("albums",setAlbums,DEFAULT_ALBUMS);
    cfg("upgrades",setUpgrades,DEFAULT_UPGRADES);
    cfg("payments",setPayments,DEFAULT_PAYMENTS);
    cfg("users",setUsers,DEFAULT_USERS);
    cfg("sources",setSources,DEFAULT_SOURCES);
    cfg("customerTags",setCustomerTags,[]);
    cfg("albumSizes",setAlbumSizes,DEFAULT_ALBUM_SIZES);
    cfg("coverTypes",setCoverTypes,DEFAULT_COVER_TYPES);
    unsubs.push(onSnapshot(doc(db,"config","companyProfile"),snap=>{
      if(snap.exists()) setCompanyProfile(snap.data());
    },e=>console.error("companyProfile:",e)));
    unsubs.push(onSnapshot(doc(db,"config","customStatuses"),snap=>{
      if(snap.exists()&&snap.data().items?.length>0) setCustomStatuses(snap.data().items);
      else setCustomStatuses(null);
    },e=>console.error("customStatuses:",e)));
    unsubs.push(onSnapshot(doc(db,"config","companyNotes"),snap=>{
      if(snap.exists()) setCompanyNotes(snap.data().items||[]);
      else setCompanyNotes([]);
    },e=>console.error("companyNotes:",e)));
    unsubs.push(onSnapshot(doc(db,"config","settingOrder"),snap=>{
      if(snap.exists()&&snap.data().order?.length>0) setSettingOrder(snap.data().order);
      else setSettingOrder([]);
    },e=>console.error("settingOrder:",e)));
    // Set ready after short delay even if some listeners fail
    setTimeout(()=>setReady(true), 2000);
    return()=>unsubs.forEach(u=>u());
  },[currentUser]);

  // V6: Auto-assign invoice numbers sorted by date
  useEffect(()=>{
    if(orders.length>0) setInvoiceMap(assignInvoiceNumbers(orders));
  },[orders]);

  // V5: Auto-cleanup trash older than 30 days
  useEffect(()=>{
    trash.forEach(async o=>{
      if(o.deletedAt&&daysSince(o.deletedAt)>30){
        await deleteDoc(doc(db,"trash",o.id));
      }
    });
  },[trash]);

  const theme={bg:"#f1f5f9",card:"white",text:"#0f172a",subtext:"#64748b",border:"#e2e8f0",inp:"#f8fafc"};
  const saveConfig=async(name,items)=>await setDoc(doc(db,"config",name),{items});

  const saveOrder=async(order)=>{
    const {id,...rawData}=order;
    const data=clean(rawData);
    if(id){await setDoc(doc(db,"orders",id),data);}
    else {await addDoc(collection(db,"orders"),data);}
    if(data.status==="Order Done") setShowThankYouOrder({...data,id});
    setView("dashboard");setEditingOrder(null);
  };

  const deleteOrder=async(order)=>{
    if(window.confirm(`Move order for ${order.customerName} to Trash?`)){
      const{id,...rest}=order;
      await setDoc(doc(db,"trash",id),clean({...rest,originalId:id,deletedAt:new Date().toISOString()}));
      await deleteDoc(doc(db,"orders",id));
      setView("dashboard");setEditingOrder(null);
    }
  };

  const restoreOrder=async(o)=>{
    const{id,deletedAt,originalId,...rest}=o;
    await addDoc(collection(db,"orders"),clean(rest));
    await deleteDoc(doc(db,"trash",id));
  };

  const deletePermanent=async(o)=>{
    if(window.confirm(`Permanently delete order for ${o.customerName}? Cannot be undone.`)){
      await deleteDoc(doc(db,"trash",o.id));
    }
  };

  const pinOrder=async(order)=>{
    await setDoc(doc(db,"orders",order.id),clean({...order,pinned:!order.pinned}));
  };

  const duplicateOrder=async(order)=>{
    const{id,invoiceNum,pinned,doneAt,...rest}=order;
    const newOrder=clean({...rest,dateCreated:todayStr(),status:"New Order",paid:false,payments:[],photos:[],editHistory:[],createdAt:new Date().toISOString(),createdBy:currentUser?.displayName||currentUser?.email||"Unknown",statusChangedAt:new Date().toISOString()});
    await addDoc(collection(db,"orders"),newOrder);
    setView("dashboard");setEditingOrder(null);
  };

  const snoozeOrder=async(order,days)=>{
    const until=new Date(Date.now()+days*864e5).toISOString().split("T")[0];
    await setDoc(doc(db,"orders",order.id),clean({...order,snoozedUntil:until}));
  };

  const saveNote=async(order,note)=>{
    await setDoc(doc(db,"orders",order.id),clean({...order,notes:note}));
  };

  const quickStatus=async(order,newStatus)=>{
    if(newStatus==="Order Done"&&!order.paid){alert('Please mark as Paid before setting "Order Done".');return;}
    const who=currentUser?.displayName||currentUser?.email||"Unknown";
    const diff=buildDiff(order,{...order,status:newStatus},who);
    const editHistory=[...(order.editHistory||[]),...(diff?[diff]:[])];
    const doneAt=newStatus==="Order Done"?(order.doneAt||new Date().toISOString()):order.doneAt;
    await setDoc(doc(db,"orders",order.id),clean({...order,status:newStatus,statusChangedAt:new Date().toISOString(),editHistory,doneAt}));
    if(newStatus==="Order Done") setShowThankYouOrder({...order,customerName:order.customerName});
  };
  const [showThankYouOrder,setShowThankYouOrder]=useState(null);

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

  const saveSources=async(items)=>await saveConfig("sources",items);
  const saveCustomerTags=async(items)=>await saveConfig("customerTags",items);
  const togLang=l=>{setLang(l);lsSet("lb_lang",l);};
  const saveExpenses=async(items)=>{ await setDoc(doc(db,"config","expenses"),{items}); };
  const saveAlbumSizes=async(items)=>await saveConfig("albumSizes",items);
  const saveCoverTypes=async(items)=>await saveConfig("coverTypes",items);
  const saveSettingOrder=async(order)=>{
    await setDoc(doc(db,"config","settingOrder"),{order});
  };

  const saveCompanyNotes=async(notes)=>{
    await setDoc(doc(db,"config","companyNotes"),{items:notes});
  };

  const saveCustomStatuses=async(items)=>{
    await setDoc(doc(db,"config","customStatuses"),{items});
    setCustomStatuses(items.length>0?items:null);
  };

  const saveCompanyProfile=async(profile)=>{
    await setDoc(doc(db,"config","companyProfile"),clean(profile));
    setCompanyProfile(profile);
  };
  const restoreBackup=async(data)=>{
    for(const o of (data.orders||[])){const{id,...rest}=o;await setDoc(doc(db,"orders",id),clean(rest));}
    for(const c of (data.customers||[])){const{id,...rest}=c;await setDoc(doc(db,"customers",id),clean(rest));}
    if(data.config){
      const cfg=data.config;
      if(cfg.albums)    await saveConfig("albums",cfg.albums);
      if(cfg.upgrades)  await saveConfig("upgrades",cfg.upgrades);
      if(cfg.paymentMethods) await saveConfig("payments",cfg.paymentMethods);
      if(cfg.sources)   await saveConfig("sources",cfg.sources);
      if(cfg.customerTags) await saveConfig("customerTags",cfg.customerTags);
    }
  };

  const changePw=async(email,pass)=>await saveUsers(users.map(u=>u.email===email?{...u,password:pass}:u));
  const updateDisplayName=async(email,name)=>await saveUsers(users.map(u=>u.email===email?{...u,displayName:name}:u));
  const updatePhoto=async(email,photo)=>await saveUsers(users.map(u=>u.email===email?{...u,photo:photo||null}:u));
  const signOut=async()=>{ await fbSignOut(auth); setCurrentUser(null); setView("dashboard"); };
  const togDark=()=>{const d=!darkMode;setDarkMode(d);lsSet("lb_dark",d);};

  // V6: Keyboard shortcuts
  useEffect(()=>{
    const handleKey=(e)=>{
      if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA"||e.target.tagName==="SELECT") return;
      try{
        const shortcuts=JSON.parse(localStorage.getItem("lb_shortcuts")||"[]");
        const match=shortcuts.find(s=>s.key===e.key);
        if(!match) return;
        e.preventDefault();
        switch(match.action){
          case "New Order": setEditingOrder(null);setView("newOrder"); break;
          case "Settings": setView("settings"); break;
          case "Export": setShowExport(true); break;
          case "Go Back": setView("dashboard");setEditingOrder(null); break;
          case "Dashboard": setView("dashboard"); break;
          default: break;
        }
      }catch{}
    };
    window.addEventListener("keydown",handleKey);
    return()=>window.removeEventListener("keydown",handleKey);
  },[]);

  if(!authReady) return <Loader/>;
  if(!currentUser) return <LoginScreen companyLogo={companyProfile?.logo||null} companyName={companyProfile?.name||"LuxeBound Albums"}/>;
  if(!ready) return <Loader/>;

  if(view==="newOrder"||view==="editOrder") return(
    <OrderForm
      order={editingOrder} albums={albums} upgrades={upgrades} paymentMethods={payments}
      onSave={saveOrder} onDelete={deleteOrder} onDuplicate={duplicateOrder}
      onCancel={()=>{setView("dashboard");setEditingOrder(null);}}
      currentUser={currentUser} customers={customers} onSaveCustomer={saveCustomer}
      sources={sources} companyProfile={companyProfile} activeStatuses={customStatuses||STATUSES}
      albumSizes={albumSizes} coverTypes={coverTypes} lang={lang} th={theme}/>
  );

  if(view==="settings") return(
    <SettingsPanel
      currentUser={currentUser}
      albums={albums}           onSaveAlbums={i=>saveConfig("albums",i)}
      upgrades={upgrades}       onSaveUpgrades={i=>saveConfig("upgrades",i)}
      paymentMethods={payments} onSavePayments={i=>saveConfig("payments",i)}
      users={users}             onSaveUsers={saveUsers}
      orders={orders}           customers={customers}   onSaveCustomer={saveCustomersList}
      sources={sources}         onSaveSources={saveSources}
      customerTags={customerTags} onSaveCustomerTags={saveCustomerTags}
      trash={trash}             onRestoreOrder={restoreOrder} onDeletePermanent={deletePermanent}
      companyProfile={companyProfile} onSaveCompanyProfile={saveCompanyProfile}
      onRestoreBackup={restoreBackup}
      customStatuses={customStatuses} onSaveCustomStatuses={saveCustomStatuses}
      companyNotes={companyNotes} onSaveCompanyNotes={saveCompanyNotes}
      settingOrder={settingOrder} onSaveSettingOrder={saveSettingOrder}
      expenses={expenses} onSaveExpenses={saveExpenses}
      albumSizes={albumSizes} onSaveAlbumSizes={saveAlbumSizes}
      coverTypes={coverTypes} onSaveCoverTypes={saveCoverTypes}
      lang={lang}               onToggleLang={togLang}
      darkMode={darkMode}       onToggleDark={togDark}

      onBack={()=>{setView("dashboard");setSettingsTab(null);}}
      activeTab={settingsTab}   setActiveTab={setSettingsTab}
      th={theme}/>
  );

  return(
    <>
    {showThankYouOrder&&<ThankYouPopup order={showThankYouOrder} lang={lang} onClose={()=>setShowThankYouOrder(null)}/>}
    <Dashboard
      orders={orders} albums={albums} upgrades={upgrades} customers={customers} onSaveCustomer={saveCustomersList}
      statusFilter={statusFilter} setStatusFilter={setStatusFilter}
      onNew={()=>{setEditingOrder(null);setView("newOrder");}}
      onEdit={o=>{setEditingOrder(o);setView("editOrder");}}
      onDelete={deleteOrder}
      onPin={pinOrder}
      onQuickStatus={quickStatus}
      onSnooze={snoozeOrder}
      onBulkStatus={bulkStatus}
      invoiceMap={invoiceMap}
      activeStatuses={customStatuses||STATUSES}
      lang={lang}
      onEditNote={saveNote}
      onSettings={()=>setView("settings")}
      onSignOut={signOut}
      showExport={showExport} setShowExport={setShowExport}
      currentUser={currentUser}
      th={theme}/>
    </>
  );
}
