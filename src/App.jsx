import React, { useState, useEffect, useRef, useCallback } from "react";
import { db } from "./firebase";
import { collection, doc, onSnapshot, setDoc, addDoc, deleteDoc, updateDoc } from "firebase/firestore";

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
  "New Order":"נייע באַשטעלונג","Sent for First Look":"געשיקט פֿאַר ערשטן קוק",
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
function LoginScreen({ users, onLogin, companyLogo }) {
  const [email,setEmail]=useState(""); const [pass,setPass]=useState(""); const [err,setErr]=useState("");
  const login=()=>{const u=users.find(u=>u.email===email&&u.password===pass);if(u)onLogin(u);else setErr("Invalid email or password.");};
  const inp={width:"100%",padding:"12px 14px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#0f172a",fontSize:14,outline:"none",fontFamily:"system-ui,sans-serif",boxSizing:"border-box"};
  return(
    <div style={{minHeight:"100vh",background:`linear-gradient(135deg,${NAVY} 0%,#1e3a8a 50%,#1e40af 100%)`,display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"system-ui,sans-serif"}}>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:16}}>
            {companyLogo
              ?<img src={companyLogo} alt="logo" style={{width:80,height:80,borderRadius:"50%",objectFit:"cover",border:"3px solid rgba(255,255,255,0.3)"}}/>
              :<Logo size={80}/>
            }
          </div>
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
function StatCards({ orders, onFilterUnpaid }) {
  const revenue=orders.filter(o=>!o.refunded).reduce((s,o)=>s+(Number(o.finalTotal)||Number(o.total)||0),0);
  const zno=orders.reduce((s,o)=>s+(Number(o.znoCost)||0),0);
  const profit=revenue-zno;
  const outstanding=orders.filter(o=>!o.paid&&o.status!=="Order Done").reduce((s,o)=>{
    const total=Number(o.finalTotal)||Number(o.total)||0;
    const received=(o.payments||[]).reduce((ps,p)=>ps+Number(p.amount||0),0);
    return s+(total-received);
  },0);
  return(
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:14,marginBottom:24}}>
      {[
        {icon:"📦",label:"Total Orders",val:orders.length,   bg:"linear-gradient(135deg,#5271FF,#7c93ff)",sh:"rgba(82,113,255,0.3)", click:null},
        {icon:"💰",label:"Revenue",     val:fmt$(revenue),    bg:"linear-gradient(135deg,#0ea5e9,#38bdf8)",sh:"rgba(14,165,233,0.3)",click:null},
        {icon:"📈",label:"Your Profit", val:fmt$(profit),     bg:profit>=0?"linear-gradient(135deg,#18B978,#34d399)":"linear-gradient(135deg,#ef4444,#f87171)",sh:profit>=0?"rgba(24,185,120,0.3)":"rgba(239,68,68,0.3)",click:null},
        {icon:"🏭",label:"Zno Costs",   val:fmt$(zno),        bg:"linear-gradient(135deg,#f59e0b,#fbbf24)",sh:"rgba(245,158,11,0.3)",click:null},
        {icon:"💸",label:"Outstanding", val:fmt$(outstanding),bg:"linear-gradient(135deg,#ef4444,#f87171)",sh:"rgba(239,68,68,0.3)",click:onFilterUnpaid},
      ].map(c=>(
        <div key={c.label} onClick={c.click||undefined} style={{background:c.bg,borderRadius:16,padding:"18px 14px",boxShadow:`0 8px 24px ${c.sh}`,cursor:c.click?"pointer":"default"}}>
          <div style={{fontSize:24,marginBottom:6}}>{c.icon}</div>
          <div style={{fontSize:20,fontWeight:800,color:"white",letterSpacing:"-0.5px"}}>{c.val}</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.75)",marginTop:5,fontWeight:600}}>{c.label}</div>
          {c.click&&<div style={{fontSize:9,color:"rgba(255,255,255,0.6)",marginTop:2}}>tap to filter</div>}
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
// ══════════════════════════════════════════════════════════
// ORDER CARD  (V5: progress bar, color border, waiting timer, quick status, photos, payment history)
// ══════════════════════════════════════════════════════════
function OrderCard({ order, onEdit, onDelete, onPin, onQuickStatus, onEditNote }) {
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
              <div style={{fontWeight:700,fontSize:16,color:"#0f172a"}}>{order.customerName}</div>
              {order.invoiceNum&&<span style={{fontSize:10,color:"#94a3b8",fontFamily:"monospace",background:"#f1f5f9",padding:"1px 6px",borderRadius:4}}>{order.invoiceNum}</span>}
              {order.priority&&<span style={{fontSize:10,fontWeight:700,background:"#fef3c7",color:"#92400e",padding:"2px 7px",borderRadius:20}}>⚡ PRIORITY</span>}
              {order.vip&&<span style={{fontSize:10,fontWeight:700,background:"#fdf4ff",color:"#7e22ce",padding:"2px 7px",borderRadius:20}}>⭐ VIP</span>}
              {order.refunded&&<span style={{fontSize:10,fontWeight:700,background:"#fef2f2",color:RED,padding:"2px 7px",borderRadius:20}}>↩️ Refunded</span>}
              {order.manualFlag&&FLAG_DEFS[order.manualFlag]&&<span style={{fontSize:11}}>{FLAG_DEFS[order.manualFlag].icon}</span>}
            </div>
            <div style={{fontSize:12,color:"#64748b"}}>{order.phone}</div>
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
      <div style={{padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}} onClick={()=>setOpen(o=>!o)}>
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
// V7: HEBREW/ENGLISH DUAL CALENDAR
// ══════════════════════════════════════════════════════════

// Jewish holidays (approximate Gregorian dates for 2024-2027)
const JEWISH_HOLIDAYS = {
  "2024-10-02": "🍎 Rosh Hashana",
  "2024-10-03": "🍎 Rosh Hashana",
  "2024-10-04": "✡️ Tzom Gedaliah",
  "2024-10-11": "🙏 Yom Kippur",
  "2024-10-16": "🌿 Sukkos",
  "2024-10-17": "🌿 Sukkos",
  "2024-10-23": "💃 Shemini Atzeres",
  "2024-10-24": "📜 Simchas Torah",
  "2024-12-25": "🕎 Chanuka (last day)",
  "2024-12-26": "🕎 Chanuka",
  "2024-12-27": "🕎 Chanuka",
  "2024-12-28": "🕎 Chanuka",
  "2024-12-29": "🕎 Chanuka",
  "2024-12-30": "🕎 Chanuka",
  "2024-12-31": "🕎 Chanuka",
  "2025-01-01": "🕎 Chanuka (last day)",
  "2025-01-13": "⚡ Asara B'Teves",
  "2025-03-13": "🎭 Taanis Esther",
  "2025-03-13": "🎭 Taanis Esther",
  "2025-03-14": "🎉 Purim",
  "2025-03-15": "🎉 Shushan Purim",
  "2025-04-12": "🫓 Shabbos HaGadol",
  "2025-04-13": "🍷 Bedikas Chametz",
  "2025-04-14": "🕯️ Erev Pesach",
  "2025-04-15": "🍷 Pesach",
  "2025-04-16": "🍷 Pesach",
  "2025-04-17": "🍷 Pesach Chol HaMoed",
  "2025-04-18": "🍷 Pesach Chol HaMoed",
  "2025-04-19": "🍷 Pesach Chol HaMoed",
  "2025-04-20": "🍷 Pesach Chol HaMoed",
  "2025-04-21": "🍷 Pesach (7th day)",
  "2025-04-22": "🍷 Pesach (last day)",
  "2025-05-02": "🔥 Lag BaOmer",
  "2025-06-01": "📜 Shavuos",
  "2025-06-02": "📜 Shavuos",
  "2025-07-13": "😢 Shiva Asar B'Tammuz",
  "2025-08-03": "😢 Tisha B'Av",
  "2025-09-22": "🍎 Rosh Hashana",
  "2025-09-23": "🍎 Rosh Hashana",
  "2025-09-24": "✡️ Tzom Gedaliah",
  "2025-10-01": "🙏 Yom Kippur",
  "2025-10-06": "🌿 Sukkos",
  "2025-10-07": "🌿 Sukkos",
  "2025-10-13": "💃 Shemini Atzeres",
  "2025-10-14": "📜 Simchas Torah",
  "2025-12-14": "🕎 Chanuka",
  "2025-12-15": "🕎 Chanuka",
  "2025-12-16": "🕎 Chanuka",
  "2025-12-17": "🕎 Chanuka",
  "2025-12-18": "🕎 Chanuka",
  "2025-12-19": "🕎 Chanuka",
  "2025-12-20": "🕎 Chanuka",
  "2025-12-21": "🕎 Chanuka (last day)",
  "2026-01-01": "✡️ Asara B'Teves",
  "2026-03-03": "🎭 Taanis Esther",
  "2026-03-04": "🎉 Purim",
  "2026-03-05": "🎉 Shushan Purim",
  "2026-04-02": "🍷 Erev Pesach",
  "2026-04-03": "🍷 Pesach",
  "2026-04-04": "🍷 Pesach",
  "2026-04-05": "🍷 Pesach Chol HaMoed",
  "2026-04-06": "🍷 Pesach Chol HaMoed",
  "2026-04-07": "🍷 Pesach Chol HaMoed",
  "2026-04-08": "🍷 Pesach Chol HaMoed",
  "2026-04-09": "🍷 Pesach (7th day)",
  "2026-04-10": "🍷 Pesach (last day)",
  "2026-04-21": "🔥 Lag BaOmer",
  "2026-05-21": "📜 Shavuos",
  "2026-05-22": "📜 Shavuos",
  "2026-07-02": "😢 Shiva Asar B'Tammuz",
  "2026-07-23": "😢 Tisha B'Av",
};

const AMERICAN_HOLIDAYS = {
  "01-01": "🎆 New Year's Day",
  "07-04": "🇺🇸 Independence Day",
  "11-11": "🎖️ Veterans Day",
  "12-25": "🎄 Christmas",
  "12-24": "🎄 Christmas Eve",
  "12-31": "🎆 New Year's Eve",
};

// Thanksgiving: 4th Thursday of November
function getThanksgiving(year) {
  const nov1 = new Date(year, 10, 1);
  const day = nov1.getDay();
  const firstThursday = day <= 4 ? 4 - day + 1 : 11 - day + 4 + 1;
  const thanksgiving = firstThursday + 21;
  return `${year}-11-${String(thanksgiving).padStart(2,"0")}`;
}

// MLK Day: 3rd Monday of January
function getMLKDay(year) {
  const jan1 = new Date(year, 0, 1);
  const day = jan1.getDay();
  const firstMonday = day <= 1 ? 1 - day + 1 : 8 - day + 1 + 1;
  const mlk = firstMonday + 14;
  return `${year}-01-${String(mlk).padStart(2,"0")}`;
}

function getDualCalendarHoliday(dateStr, year) {
  // Check Jewish holidays
  if(JEWISH_HOLIDAYS[dateStr]) return { label: JEWISH_HOLIDAYS[dateStr], type: "jewish" };
  // Check American fixed holidays
  const mmdd = dateStr.slice(5);
  if(AMERICAN_HOLIDAYS[mmdd]) return { label: AMERICAN_HOLIDAYS[mmdd], type: "american" };
  // Check Thanksgiving
  if(dateStr === getThanksgiving(year)) return { label: "🦃 Thanksgiving", type: "american" };
  if(dateStr === getMLKDay(year)) return { label: "✊ MLK Day", type: "american" };
  return null;
}

function DualCalendar() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [tooltip, setTooltip] = useState(null);
  const [open, setOpen] = useState(true);

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  const prevMonth = () => { if(viewMonth===0){setViewMonth(11);setViewYear(y=>y-1);}else setViewMonth(m=>m-1); };
  const nextMonth = () => { if(viewMonth===11){setViewMonth(0);setViewYear(y=>y+1);}else setViewMonth(m=>m+1); };

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();
  const days = [];
  for(let i=0; i<firstDay; i++) days.push(null);
  for(let i=1; i<=daysInMonth; i++) days.push(i);
  while(days.length%7!==0) days.push(null);

  const todayStr2 = today.toISOString().split("T")[0];

  return(
    <div style={{background:"white",borderRadius:16,marginBottom:20,boxShadow:"0 4px 16px rgba(0,0,0,0.07)",overflow:"hidden"}}>
      {/* Header */}
      <div style={{padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",background:"white"}} onClick={()=>setOpen(o=>!o)}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16,transition:"transform .2s",display:"inline-block",transform:open?"rotate(0deg)":"rotate(-90deg)"}}>▼</span>
          <span style={{fontWeight:700,fontSize:14,color:"#0f172a"}}>🗓 Hebrew / English Calendar</span>
        </div>
        {!open&&<span style={{fontSize:12,color:"#64748b"}}>{monthNames[viewMonth]} {viewYear}</span>}
      </div>

      {open&&(
        <div style={{padding:"0 16px 16px"}}>
          {/* Month Navigation */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,padding:"0 4px"}}>
            <button onClick={prevMonth} style={{background:"#f1f5f9",border:"none",borderRadius:8,width:34,height:34,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
            <div style={{textAlign:"center"}}>
              <div style={{fontWeight:700,fontSize:16,color:"#0f172a"}}>{monthNames[viewMonth]} {viewYear}</div>
              <div style={{fontSize:11,color:"#8b5cf6",marginTop:1}}>
                {(() => {
                  try {
                    const d = new Date(viewYear, viewMonth, 15);
                    return new Intl.DateTimeFormat("he-IL-u-ca-hebrew",{month:"long",year:"numeric"}).format(d);
                  } catch { return ""; }
                })()}
              </div>
            </div>
            <button onClick={nextMonth} style={{background:"#f1f5f9",border:"none",borderRadius:8,width:34,height:34,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
          </div>

          {/* Day headers */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
            {dayNames.map(d=>(
              <div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:"#94a3b8",padding:"4px 0"}}>{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
            {days.map((day,i)=>{
              if(!day) return <div key={i}/>;
              const dateStr = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const isToday = dateStr===todayStr2;
              const isSabbath = (i%7)===6;
              const holiday = getDualCalendarHoliday(dateStr, viewYear);
              let hebrewDay = "";
              try {
                hebrewDay = new Intl.DateTimeFormat("he-IL-u-ca-hebrew",{day:"numeric"}).format(new Date(viewYear,viewMonth,day));
              } catch {}

              return(
                <div key={i}
                  onClick={()=>setTooltip(tooltip===dateStr?null:dateStr)}
                  style={{
                    borderRadius:8,padding:"4px 2px",textAlign:"center",cursor:"pointer",
                    background: isToday?"#5271FF":holiday?.type==="jewish"?"#fdf4ff":holiday?.type==="american"?"#fff7ed":isSabbath?"#fef9c3":"#f8fafc",
                    border: isToday?"2px solid #5271FF":holiday?"2px solid "+(holiday.type==="jewish"?"#c084fc":"#fbbf24"):"2px solid transparent",
                    position:"relative",minHeight:52,
                  }}>
                  <div style={{fontSize:13,fontWeight:700,color:isToday?"white":isSabbath?"#92400e":"#0f172a",lineHeight:1.2}}>{day}</div>
                  <div style={{fontSize:9,color:isToday?"rgba(255,255,255,0.85)":"#8b5cf6",lineHeight:1.1,marginTop:1}}>{hebrewDay}</div>
                  {holiday&&<div style={{fontSize:8,marginTop:2,lineHeight:1.1,color:isToday?"white":holiday.type==="jewish"?"#7e22ce":"#92400e",fontWeight:600}}>{holiday.label.slice(0,12)}</div>}
                  {/* Tooltip */}
                  {tooltip===dateStr&&(
                    <div style={{position:"absolute",top:"100%",left:"50%",transform:"translateX(-50%)",zIndex:50,background:"#0f172a",color:"white",borderRadius:8,padding:"8px 12px",fontSize:11,whiteSpace:"nowrap",boxShadow:"0 4px 16px rgba(0,0,0,0.3)",marginTop:4,minWidth:140,textAlign:"left"}}>
                      <div style={{fontWeight:700,marginBottom:3}}>{monthNames[viewMonth]} {day}, {viewYear}</div>
                      <div style={{color:"#c084fc",marginBottom:holiday?3:0}}>{hebrewDay && (() => {
                        try { return new Intl.DateTimeFormat("he-IL-u-ca-hebrew",{day:"numeric",month:"long",year:"numeric"}).format(new Date(viewYear,viewMonth,day)); } catch { return ""; }
                      })()}</div>
                      {holiday&&<div style={{color:holiday.type==="jewish"?"#f0abfc":"#fbbf24",fontWeight:600}}>{holiday.label}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{display:"flex",gap:14,marginTop:12,flexWrap:"wrap",paddingTop:10,borderTop:"1px solid #f1f5f9"}}>
            {[
              {color:"#5271FF",label:"Today"},
              {color:"#c084fc",label:"Jewish Holiday"},
              {color:"#fbbf24",label:"American Holiday"},
              {color:"#92400e",bg:"#fef9c3",label:"Shabbos"},
            ].map(item=>(
              <div key={item.label} style={{display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:12,height:12,borderRadius:3,background:item.bg||item.color}}/>
                <span style={{fontSize:10,color:"#64748b"}}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
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
function Dashboard({ orders,albums,statusFilter,setStatusFilter,onNew,onEdit,onDelete,onPin,onSnooze,onSettings,onSignOut,showExport,setShowExport,currentUser,onBulkStatus,onQuickStatus,onEditNote,invoiceMap,activeStatuses,th }) {
  const [filters,setFilters]=useState({search:"",album:"",paid:"",vip:false,priority:false,pinned:false});
  const [quickNoteOrder,setQuickNoteOrder]=useState(null);
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
  const [ordersOpen,setOrdersOpen]=useState(false);
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
          <Btn variant="ghost" sm onClick={()=>setShowExport(true)} style={{padding:"8px 18px",fontSize:13}}>📊 Export</Btn>
          <Btn variant="ghost" sm onClick={onSettings} style={{padding:"8px 18px",fontSize:13}}>⚙️</Btn>
          <Btn variant="ghost" sm onClick={onSignOut} style={{padding:"8px 18px",fontSize:13}}>Sign Out</Btn>
        </div>
      </div>

      <div style={{padding:"28px 32px",maxWidth:1200,margin:"0 auto"}}>
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
                      <OrderCard order={{...o,invoiceNum:invoiceMap?.[o.id]||o.invoiceNum||""}} onEdit={onEdit} onDelete={onDelete} onPin={onPin} onQuickStatus={onQuickStatus} onEditNote={o=>setQuickNoteOrder(o)}/>
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
<div class="foot">Thank you for choosing LuxeBound Albums · The Art of Album Making</div>
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

function OrderForm({ order, albums, upgrades, paymentMethods, onSave, onCancel, onDelete, currentUser, customers, onSaveCustomer, sources, companyProfile, activeStatuses, th }) {
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

  // V5: Auto-check paid when fully paid via deposits
  const totalReceived=payments.reduce((s,p)=>s+Number(p.amount||0),0);
  React.useEffect(()=>{
    if(totalReceived>0&&totalReceived>=finalTotal&&finalTotal>0) setPaid(true);
  // eslint-disable-next-line
  },[totalReceived]);

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
            <button onClick={()=>generateInvoice({...order,customerName,finalTotal,payments,paymentDueDate,selectedAlbums:selAlbums,selectedUpgrades:selUpg,upgradeNames:Object.fromEntries(upgrades.map(u=>[u.id,u.name])),upgradePrices:Object.fromEntries(upgrades.map(u=>[u.id,u.price])),_companyName:companyProfile?.name,_companyTagline:companyProfile?.tagline,_companyPhone:companyProfile?.phone,_companyLogo:companyProfile?.logo})}
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

// Business Insights Tab (V6: adds best upgrade, profit by album, customer ranking, year vs year, goal tracker)
function InsightsTab({ orders, th }) {
  const total=orders.length;
  const [chartYear,setChartYear]=useState(new Date().getFullYear());
  const [monthlyGoal,setMonthlyGoal]=useState(()=>Number(localStorage.getItem("lb_monthly_goal")||0));
  const [yearlyGoal,setYearlyGoal]=useState(()=>Number(localStorage.getItem("lb_yearly_goal")||0));
  const [editGoal,setEditGoal]=useState(false);
  const [tmpMonthly,setTmpMonthly]=useState("");
  const [tmpYearly,setTmpYearly]=useState("");

  if(!total) return <div style={{color:th.subtext,fontSize:14,textAlign:"center",padding:"40px 0"}}>No orders yet to analyze.</div>;

  const revenue=orders.filter(o=>!o.refunded).reduce((s,o)=>s+(Number(o.finalTotal)||Number(o.total)||0),0);
  const avgVal=revenue/total;
  const paidCount=orders.filter(o=>o.paid).length;
  const done=orders.filter(o=>o.status==="Order Done");
  const returnCust=orders.reduce((acc,o)=>{const n=(o.customerName||"").toLowerCase();acc[n]=(acc[n]||0)+1;return acc;},{});
  const returning=Object.values(returnCust).filter(c=>c>1).length;
  const totalCust=Object.keys(returnCust).length;
  const returnRate=totalCust>0?Math.round((returning/totalCust)*100):0;
  const outstanding=orders.filter(o=>!o.paid&&o.status!=="Order Done").reduce((s,o)=>{
    const ft=Number(o.finalTotal)||0;const rec=(o.payments||[]).reduce((ps,p)=>ps+Number(p.amount||0),0);return s+(ft-rec);
  },0);

  // Best selling upgrade (#21)
  const byUpgrade=orders.reduce((acc,o)=>{
    Object.entries(o.selectedUpgrades||{}).filter(([,q])=>Number(q)>0).forEach(([id])=>{
      const name=(o.upgradeNames||{})[id]||id;
      acc[name]=(acc[name]||0)+1;
    });
    return acc;
  },{});
  const topUpgrades=Object.entries(byUpgrade).sort((a,b)=>b[1]-a[1]).slice(0,5);

  // Profit margin by album type (#22)
  const byAlbumData=orders.reduce((acc,o)=>{
    (o.selectedAlbums||[{albumType:o.albumType,albumPrice:o.albumPrice}]).filter(a=>a.albumType).forEach(a=>{
      if(!acc[a.albumType])acc[a.albumType]={revenue:0,zno:0,count:0};
      acc[a.albumType].revenue+=Number(a.albumPrice)||0;
      acc[a.albumType].zno+=Number(o.znoCost)||0;
      acc[a.albumType].count++;
    });
    return acc;
  },{});

  // Orders per customer ranking (#23)
  const custRanking=Object.entries(
    orders.reduce((acc,o)=>{
      const n=o.customerName||"Unknown";
      if(!acc[n])acc[n]={count:0,revenue:0};
      acc[n].count++;
      acc[n].revenue+=Number(o.finalTotal)||Number(o.total)||0;
      return acc;
    },{})
  ).sort((a,b)=>b[1].count-a[1].count).slice(0,5);

  // Year vs year (#25)
  const thisYear=new Date().getFullYear();
  const lastYear=thisYear-1;
  const thisYearOrders=orders.filter(o=>(o.dateCreated||"").startsWith(String(thisYear)));
  const lastYearOrders=orders.filter(o=>(o.dateCreated||"").startsWith(String(lastYear)));
  const thisYearRev=thisYearOrders.filter(o=>!o.refunded).reduce((s,o)=>s+(Number(o.finalTotal)||0),0);
  const lastYearRev=lastYearOrders.filter(o=>!o.refunded).reduce((s,o)=>s+(Number(o.finalTotal)||0),0);
  const revChange=lastYearRev>0?Math.round(((thisYearRev-lastYearRev)/lastYearRev)*100):0;

  // Monthly revenue chart
  const years=[...new Set(orders.map(o=>(o.dateCreated||"").slice(0,4)).filter(Boolean))].sort().reverse();
  const monthlyData=Array.from({length:12},(_,i)=>{
    const mo=String(i+1).padStart(2,"0");
    const mo_orders=orders.filter(o=>(o.dateCreated||"").startsWith(`${chartYear}-${mo}`)&&!o.refunded);
    return{month:new Date(chartYear,i,1).toLocaleDateString("en-US",{month:"short"}),revenue:mo_orders.reduce((s,o)=>s+(Number(o.finalTotal)||Number(o.total)||0),0),count:mo_orders.length};
  });
  const maxRev=Math.max(...monthlyData.map(m=>m.revenue),1);

  // Heatmap
  const heatData=Array.from({length:12},(_,i)=>{
    const mo=String(i+1).padStart(2,"0");
    const all=orders.filter(o=>(o.dateCreated||"").slice(5,7)===mo);
    return{month:new Date(2024,i,1).toLocaleDateString("en-US",{month:"short"}),count:all.length,revenue:all.reduce((s,o)=>s+(Number(o.finalTotal)||0),0)};
  });
  const maxCount=Math.max(...heatData.map(h=>h.count),1);

  // Avg time per status
  const statusTimes=STATUSES.slice(0,-1).map(s=>{
    const rel=orders.filter(o=>o.status===s&&o.statusChangedAt);
    const avg=rel.length>0?rel.reduce((sum,o)=>sum+daysSince(o.statusChangedAt),0)/rel.length:0;
    return{status:s,avg:Math.round(avg*10)/10,count:rel.length};
  });

  // Goal tracker (#27)
  const thisMonthKey=new Date().toISOString().slice(0,7);
  const thisMonthRev=orders.filter(o=>(o.dateCreated||"").startsWith(thisMonthKey)&&!o.refunded).reduce((s,o)=>s+(Number(o.finalTotal)||0),0);
  const saveGoals=()=>{
    if(tmpMonthly) {localStorage.setItem("lb_monthly_goal",tmpMonthly);setMonthlyGoal(Number(tmpMonthly));}
    if(tmpYearly)  {localStorage.setItem("lb_yearly_goal",tmpYearly);setYearlyGoal(Number(tmpYearly));}
    setEditGoal(false);
  };

  const card=(icon,label,val,sub)=>(
    <div style={{background:th.card,borderRadius:12,padding:16,border:`1px solid ${th.border}`,marginBottom:12}}>
      <div style={{fontSize:22,marginBottom:6}}>{icon}</div>
      <div style={{fontSize:20,fontWeight:800,color:BLUE}}>{val}</div>
      <div style={{fontSize:13,fontWeight:700,color:th.text,marginTop:2}}>{label}</div>
      {sub&&<div style={{fontSize:11,color:th.subtext,marginTop:3}}>{sub}</div>}
    </div>
  );

  const ProgressBar=({current,goal,color})=>{
    const pct=goal>0?Math.min(100,Math.round((current/goal)*100)):0;
    return(
      <div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
          <span style={{color:th.subtext}}>{fmt$(current)} of {fmt$(goal)}</span>
          <span style={{fontWeight:700,color}}>{pct}%</span>
        </div>
        <div style={{height:8,background:"#f1f5f9",borderRadius:4,overflow:"hidden"}}>
          <div style={{height:8,width:`${pct}%`,background:color,borderRadius:4,transition:"width .4s"}}/>
        </div>
      </div>
    );
  };

  return(
    <div>
      {/* Summary cards */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
        {card("📦","Total Orders",total,`${paidCount} paid · ${total-paidCount} unpaid`)}
        {card("💰","Avg Order Value",fmt$(avgVal),`Total revenue: ${fmt$(revenue)}`)}
        {card("🔁","Return Rate",`${returnRate}%`,`${returning} of ${totalCust} customers returned`)}
        {card("✅","Completed",done.length,`${total>0?Math.round((done.length/total)*100):0}% completion rate`)}
        {card("💸","Outstanding",fmt$(outstanding),`${orders.filter(o=>!o.paid&&o.status!=="Order Done").length} unpaid orders`)}
        {card("📅","This Year vs Last",`${revChange>=0?"+":""}${revChange}%`,`${fmt$(thisYearRev)} vs ${fmt$(lastYearRev)}`)}
      </div>

      {/* Goal Tracker (#27) */}
      <div style={{background:th.card,borderRadius:12,padding:16,border:`1px solid ${th.border}`,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontWeight:700,fontSize:14,color:th.text}}>🎯 Revenue Goals</div>
          <button onClick={()=>{setTmpMonthly(monthlyGoal||"");setTmpYearly(yearlyGoal||"");setEditGoal(e=>!e);}} style={{padding:"5px 12px",borderRadius:8,border:`1.5px solid ${BLUE}`,background:"transparent",color:BLUE,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>{editGoal?"Cancel":"Set Goals"}</button>
        </div>
        {editGoal?(
          <div style={{display:"flex",gap:10,marginBottom:14}}>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:th.subtext,marginBottom:4,fontWeight:600,textTransform:"uppercase"}}>Monthly Goal $</div>
              <input type="number" value={tmpMonthly} onChange={e=>setTmpMonthly(e.target.value)} placeholder="e.g. 5000" style={{...{width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid #e2e8f0`,background:"#f8fafc",color:"#0f172a",fontSize:14,outline:"none",fontFamily:"system-ui,sans-serif",boxSizing:"border-box"}}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:th.subtext,marginBottom:4,fontWeight:600,textTransform:"uppercase"}}>Yearly Goal $</div>
              <input type="number" value={tmpYearly} onChange={e=>setTmpYearly(e.target.value)} placeholder="e.g. 60000" style={{...{width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid #e2e8f0`,background:"#f8fafc",color:"#0f172a",fontSize:14,outline:"none",fontFamily:"system-ui,sans-serif",boxSizing:"border-box"}}}/>
            </div>
            <div style={{display:"flex",alignItems:"flex-end"}}>
              <button onClick={saveGoals} style={{padding:"9px 16px",borderRadius:8,border:"none",background:GREEN,color:"white",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Save</button>
            </div>
          </div>
        ):null}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:th.subtext,marginBottom:6}}>📅 This Month</div>
            {monthlyGoal>0?<ProgressBar current={thisMonthRev} goal={monthlyGoal} color={BLUE}/>:<div style={{fontSize:12,color:th.subtext}}>No monthly goal set. Tap "Set Goals" to add one.</div>}
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:th.subtext,marginBottom:6}}>📆 This Year</div>
            {yearlyGoal>0?<ProgressBar current={thisYearRev} goal={yearlyGoal} color={GREEN}/>:<div style={{fontSize:12,color:th.subtext}}>No yearly goal set. Tap "Set Goals" to add one.</div>}
          </div>
        </div>
      </div>

      {/* Year vs Year (#25) */}
      <div style={{background:th.card,borderRadius:12,padding:16,border:`1px solid ${th.border}`,marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:14}}>📅 Year vs Year</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          {[
            {label:"Revenue",this:fmt$(thisYearRev),last:fmt$(lastYearRev),pct:revChange},
            {label:"Orders",this:thisYearOrders.length,last:lastYearOrders.length,pct:lastYearOrders.length>0?Math.round(((thisYearOrders.length-lastYearOrders.length)/lastYearOrders.length)*100):0},
            {label:"Profit",this:fmt$(thisYearOrders.filter(o=>!o.refunded).reduce((s,o)=>s+(Number(o.finalTotal)||0)-(Number(o.znoCost)||0),0)),last:fmt$(lastYearOrders.filter(o=>!o.refunded).reduce((s,o)=>s+(Number(o.finalTotal)||0)-(Number(o.znoCost)||0),0)),pct:0},
          ].map(item=>(
            <div key={item.label} style={{background:"#f8fafc",borderRadius:10,padding:12,textAlign:"center"}}>
              <div style={{fontSize:11,color:th.subtext,fontWeight:700,marginBottom:6,textTransform:"uppercase"}}>{item.label}</div>
              <div style={{fontSize:16,fontWeight:800,color:BLUE}}>{item.this}</div>
              <div style={{fontSize:11,color:th.subtext,marginTop:2}}>{thisYear}</div>
              <div style={{fontSize:13,fontWeight:600,color:"#64748b",marginTop:4}}>{item.last}</div>
              <div style={{fontSize:10,color:th.subtext}}>{lastYear}</div>
              {item.pct!==0&&<div style={{fontSize:11,fontWeight:700,color:item.pct>=0?GREEN:RED,marginTop:4}}>{item.pct>=0?"+":""}{item.pct}%</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Revenue Chart */}
      <div style={{background:th.card,borderRadius:12,padding:16,border:`1px solid ${th.border}`,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontWeight:700,fontSize:14,color:th.text}}>📈 Monthly Revenue</div>
          <select value={chartYear} onChange={e=>setChartYear(Number(e.target.value))} style={{padding:"5px 10px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"system-ui,sans-serif",outline:"none"}}>
            {years.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div style={{display:"flex",alignItems:"flex-end",gap:6,height:120}}>
          {monthlyData.map((m,i)=>(
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
              <div style={{fontSize:8,color:BLUE,fontWeight:700}}>{m.revenue>0?`$${Math.round(m.revenue/100)/10}k`:""}</div>
              <div title={`${m.month}: ${fmt$(m.revenue)} · ${m.count} orders`}
                style={{width:"100%",background:m.revenue>0?BLUE:"#f1f5f9",borderRadius:"3px 3px 0 0",height:`${Math.max((m.revenue/maxRev)*90,m.revenue>0?6:3)}px`,transition:"height .3s"}}/>
              <div style={{fontSize:8,color:"#94a3b8",fontWeight:600}}>{m.month}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Busiest Months Heatmap */}
      <div style={{background:th.card,borderRadius:12,padding:16,border:`1px solid ${th.border}`,marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:14}}>🗓 Busiest Months (All Time)</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:6}}>
          {heatData.map((h,i)=>{
            const intensity=h.count/maxCount;
            const bg=h.count===0?"#f1f5f9":`rgba(82,113,255,${0.15+intensity*0.85})`;
            return(
              <div key={i} title={`${h.month}: ${h.count} orders · ${fmt$(h.revenue)}`}
                style={{background:bg,borderRadius:8,padding:"10px 6px",textAlign:"center"}}>
                <div style={{fontSize:11,fontWeight:700,color:h.count>0?"white":"#94a3b8"}}>{h.month}</div>
                <div style={{fontSize:14,fontWeight:800,color:h.count>0?"white":"#cbd5e1"}}>{h.count}</div>
                {h.revenue>0&&<div style={{fontSize:9,color:"rgba(255,255,255,0.8)"}}>{fmt$(h.revenue)}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Best Selling Upgrades (#21) */}
      <div style={{background:th.card,borderRadius:12,padding:16,border:`1px solid ${th.border}`,marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:14}}>🏆 Best Selling Upgrades</div>
        {topUpgrades.length===0?<div style={{color:th.subtext,fontSize:13}}>No upgrade data yet.</div>:topUpgrades.map(([name,count],i)=>(
          <div key={name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<topUpgrades.length-1?"1px solid #f1f5f9":"none"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:13,fontWeight:700,color:BLUE,minWidth:20}}>#{i+1}</span>
              <span style={{fontSize:13,color:th.text}}>{name}</span>
            </div>
            <span style={{fontSize:13,fontWeight:700,color:th.subtext}}>{count} orders</span>
          </div>
        ))}
      </div>

      {/* Profit Margin by Album (#22) */}
      <div style={{background:th.card,borderRadius:12,padding:16,border:`1px solid ${th.border}`,marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:14}}>💰 Profit Margin by Album</div>
        {Object.entries(byAlbumData).map(([name,data])=>{
          const margin=data.revenue>0?Math.round(((data.revenue-data.zno)/data.revenue)*100):0;
          return(
            <div key={name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #f1f5f9"}}>
              <div>
                <div style={{fontSize:13,color:th.text,fontWeight:600}}>{name}</div>
                <div style={{fontSize:11,color:th.subtext}}>{data.count} orders · {fmt$(data.revenue)} revenue</div>
              </div>
              <span style={{fontSize:15,fontWeight:800,color:margin>=50?GREEN:margin>=30?AMBER:RED}}>{margin}%</span>
            </div>
          );
        })}
      </div>

      {/* Top Customers (#23) */}
      <div style={{background:th.card,borderRadius:12,padding:16,border:`1px solid ${th.border}`,marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:14}}>👑 Top Customers</div>
        {custRanking.map(([name,data],i)=>(
          <div key={name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<custRanking.length-1?"1px solid #f1f5f9":"none"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:13,fontWeight:700,color:BLUE,minWidth:20}}>#{i+1}</span>
              <span style={{fontSize:13,color:th.text}}>{name}</span>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:13,fontWeight:700,color:BLUE}}>{fmt$(data.revenue)}</div>
              <div style={{fontSize:11,color:th.subtext}}>{data.count} order{data.count!==1?"s":""}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Unpaid Orders Total (#24) */}
      <div style={{background:"#fef2f2",borderRadius:12,padding:16,border:"1px solid #fecaca",marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:14,color:RED,marginBottom:8}}>💸 Unpaid Orders</div>
        <div style={{fontSize:26,fontWeight:800,color:RED}}>{fmt$(outstanding)}</div>
        <div style={{fontSize:12,color:"#64748b",marginTop:4}}>{orders.filter(o=>!o.paid&&o.status!=="Order Done").length} unpaid orders outstanding</div>
      </div>

      {/* Average Time Per Status */}
      <div style={{background:th.card,borderRadius:12,padding:16,border:`1px solid ${th.border}`}}>
        <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:14}}>⏱ Average Time Per Status</div>
        {statusTimes.map((s,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<statusTimes.length-1?"1px solid #f1f5f9":"none"}}>
            <div>
              <div style={{fontSize:13,color:th.text,fontWeight:600}}>{s.status}</div>
              <div style={{fontSize:11,color:th.subtext}}>{s.count} orders here now</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:16,fontWeight:800,color:s.avg>14?RED:s.avg>7?AMBER:BLUE}}>{s.avg}d</div>
              <div style={{fontSize:10,color:th.subtext}}>avg days</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


// Tag List Editor (no price column)
function TagListEditor({ items, onSave, th, placeholder="Add item…" }) {
  const [list,setList]=useState([...(items||[])]);
  const [newVal,setNewVal]=useState("");
  const inp=iStyle(th);
  const update=u=>{setList(u);onSave(u);};
  const add=()=>{if(!newVal.trim())return;update([...list,{id:uid(),name:newVal.trim()}]);setNewVal("");};
  const remove=id=>update(list.filter(i=>i.id!==id));
  const change=(id,v)=>update(list.map(i=>i.id===id?{...i,name:v}:i));
  return(
    <div>
      {list.map(item=>(
        <div key={item.id} style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,background:th.card,borderRadius:10,padding:"10px 14px",border:`1px solid ${th.border}`}}>
          <input value={item.name} onChange={e=>change(item.id,e.target.value)} style={{...inp,flex:1,padding:"8px 10px",fontSize:13}}/>
          <button onClick={()=>remove(item.id)} style={{padding:"8px 12px",borderRadius:8,border:"none",background:RED,color:"white",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>✕</button>
        </div>
      ))}
      <div style={{display:"flex",gap:8,marginTop:10}}>
        <input value={newVal} onChange={e=>setNewVal(e.target.value)} placeholder={placeholder}
          style={{...inp,flex:1,padding:"9px 12px",fontSize:13}} onKeyDown={e=>e.key==="Enter"&&add()}/>
        <button onClick={add} style={{padding:"9px 16px",borderRadius:8,border:"none",background:BLUE,color:"white",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>+ Add</button>
      </div>
    </div>
  );
}

// Lists & Tags Tab (sources + customer tags)
function ListsTagsTab({ sources, onSaveSources, customerTags, onSaveCustomerTags, th }) {
  const [section,setSection]=useState("sources");
  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {[["sources","📍 Sources"],["tags","🏷️ Customer Tags"]].map(([k,l])=>(
          <button key={k} onClick={()=>setSection(k)} style={{padding:"8px 16px",borderRadius:8,border:`1.5px solid ${section===k?BLUE:"#e2e8f0"}`,background:section===k?"#eff2ff":"white",color:section===k?BLUE:"#64748b",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>{l}</button>
        ))}
      </div>
      {section==="sources"&&(
        <div>
          <div style={{fontSize:13,color:"#64748b",marginBottom:12}}>These are the "How did they find us?" options on customer profiles. Add, edit or remove anytime.</div>
          <TagListEditor items={sources} onSave={onSaveSources} th={th} placeholder="e.g. TikTok"/>
        </div>
      )}
      {section==="tags"&&(
        <div>
          <div style={{fontSize:13,color:"#64748b",marginBottom:12}}>Create tags you can apply to customers. E.g. Wholesale, Rabbi, Photographer, Family.</div>
          <TagListEditor items={customerTags} onSave={onSaveCustomerTags} th={th} placeholder="e.g. Wholesale"/>
        </div>
      )}
    </div>
  );
}

// Trash Tab
function TrashTab({ trash, onRestore, onDeletePermanent, th }) {
  return(
    <div>
      {(!trash||trash.length===0)&&<div style={{color:th.subtext,fontSize:14,textAlign:"center",padding:"40px 0"}}>🗑️ Trash is empty.</div>}
      {(trash||[]).map(o=>(
        <div key={o.id} style={{background:th.card,borderRadius:12,padding:16,marginBottom:10,border:`1px solid ${th.border}`,opacity:0.85}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontWeight:700,fontSize:14,color:th.text}}>{o.customerName}</div>
              <div style={{fontSize:12,color:th.subtext,marginTop:2}}>{o.status} · {fmtD(o.dateCreated)}</div>
              <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>Deleted {fmtDateTime(o.deletedAt)}</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>onRestore(o)} style={{padding:"6px 14px",borderRadius:8,border:`1.5px solid ${GREEN}`,background:"transparent",color:GREEN,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>↩️ Restore</button>
              <button onClick={()=>onDeletePermanent(o)} style={{padding:"6px 14px",borderRadius:8,border:"none",background:RED,color:"white",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Delete Forever</button>
            </div>
          </div>
        </div>
      ))}
      {trash&&trash.length>0&&<div style={{fontSize:11,color:"#94a3b8",textAlign:"center",marginTop:8}}>Orders in trash are permanently deleted after 30 days.</div>}
    </div>
  );
}

// Customer Management Tab (V5: lifetime value, export CSV, tags, source)
function CustomersTab({ customers, onSave, orders, sources, customerTags, th }) {
  const [search,setSearch]=useState("");
  const [editing,setEditing]=useState(null);
  const [editName,setEditName]=useState(""); const [editPhone,setEditPhone]=useState("");
  const [editEmail,setEditEmail]=useState(""); const [editVip,setEditVip]=useState(false);
  const [editNote,setEditNote]=useState(""); const [editSource,setEditSource]=useState("");
  const [editTags,setEditTags]=useState([]);
  const inp=iStyle(th);

  const filtered=(customers||[]).filter(c=>(c.name||"").toLowerCase().includes(search.toLowerCase()));
  const custOrders=name=>(orders||[]).filter(o=>(o.customerName||"").toLowerCase()===(name||"").toLowerCase());
  const lifetimeValue=name=>custOrders(name).filter(o=>!o.refunded).reduce((s,o)=>s+(Number(o.finalTotal)||Number(o.total)||0),0);

  const startEdit=c=>{setEditing(c.id);setEditName(c.name);setEditPhone(c.phone||"");setEditEmail(c.email||"");setEditVip(c.vip||false);setEditNote(c.note||"");setEditSource(c.source||"");setEditTags(c.tags||[]);};
  const saveEdit=()=>{onSave((customers||[]).map(c=>c.id===editing?{...c,name:editName,phone:editPhone,email:editEmail,vip:editVip,note:editNote,source:editSource,tags:editTags}:c));setEditing(null);};
  const remove=id=>{if(window.confirm("Remove this customer?")) onSave((customers||[]).filter(c=>c.id!==id));};

  const exportCSV=()=>{
    const headers=["Name","Phone","Email","VIP","Source","Tags","Total Orders","Lifetime Value","Last Order"];
    const rows=(customers||[]).map(c=>{
      const co=custOrders(c.name);
      return[c.name,c.phone||"",c.email||"",c.vip?"Yes":"No",c.source||"",(c.tags||[]).join("; "),co.length,lifetimeValue(c.name),c.lastOrder||""];
    });
    const csv=[headers,...rows].map(r=>r.map(v=>`"${(v||"").toString().replace(/"/g,'""')}"`).join(",")).join("\n");
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download=`LuxeBound_Customers_${todayStr()}.csv`;
    a.click();
  };

  return(
    <div>
      <div style={{display:"flex",gap:10,marginBottom:14}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search customers…" style={{...inp,flex:1,fontSize:13}}/>
        <button onClick={exportCSV} style={{padding:"10px 16px",borderRadius:8,border:"none",background:GREEN,color:"white",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif",whiteSpace:"nowrap"}}>📥 Export CSV</button>
      </div>
      {filtered.length===0&&<div style={{color:th.subtext,fontSize:14,textAlign:"center",padding:"40px 0"}}>No customers yet. They are added automatically when you create orders.</div>}
      {filtered.map(c=>{
        const co=custOrders(c.name);
        const lv=lifetimeValue(c.name);
        const isEditing=editing===c.id;
        return(
          <div key={c.id} style={{background:th.card,borderRadius:12,padding:16,marginBottom:10,border:`1px solid ${th.border}`}}>
            {isEditing?(
              <div>
                <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:10}}>
                  <input value={editName} onChange={e=>setEditName(e.target.value)} placeholder="Name" style={{...inp,fontSize:13}}/>
                  <input value={editPhone} onChange={e=>setEditPhone(fmtPhone(e.target.value))} placeholder="Phone" style={{...inp,fontSize:13}}/>
                  <input value={editEmail} onChange={e=>setEditEmail(e.target.value)} placeholder="Email" style={{...inp,fontSize:13}}/>
                  <select value={editSource} onChange={e=>setEditSource(e.target.value)} style={{...inp,fontSize:13}}>
                    <option value="">How did they find us?</option>
                    {(sources||DEFAULT_SOURCES).map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                  <textarea value={editNote} onChange={e=>setEditNote(e.target.value)} placeholder="Permanent note…" rows={2} style={{...inp,resize:"vertical",fontSize:13}}/>
                  {(customerTags||[]).length>0&&(
                    <div>
                      <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.6px"}}>Tags</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {(customerTags||[]).map(tag=>(
                          <label key={tag.id} style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",fontSize:12,fontFamily:"system-ui,sans-serif",background:editTags.includes(tag.name)?"#eff2ff":"#f8fafc",padding:"5px 10px",borderRadius:20,border:`1.5px solid ${editTags.includes(tag.name)?BLUE:"#e2e8f0"}`,color:editTags.includes(tag.name)?BLUE:"#64748b"}}>
                            <input type="checkbox" checked={editTags.includes(tag.name)} onChange={e=>setEditTags(prev=>e.target.checked?[...prev,tag.name]:prev.filter(t=>t!==tag.name))} style={{display:"none"}}/>
                            {tag.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:th.text,fontFamily:"system-ui,sans-serif"}}>
                    <input type="checkbox" checked={editVip} onChange={e=>setEditVip(e.target.checked)} style={{accentColor:"#8b5cf6"}}/>
                    ⭐ VIP Customer
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
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2,flexWrap:"wrap"}}>
                      <div style={{fontWeight:700,fontSize:15,color:th.text}}>{c.name}</div>
                      {c.vip&&<span style={{fontSize:10,background:"#fdf4ff",color:"#7e22ce",padding:"2px 7px",borderRadius:20,fontWeight:700}}>⭐ VIP</span>}
                      {(c.tags||[]).map(tag=><span key={tag} style={{fontSize:10,background:"#eff2ff",color:BLUE,padding:"2px 7px",borderRadius:20,fontWeight:600}}>{tag}</span>)}
                    </div>
                    {c.phone&&<div style={{fontSize:12,color:th.subtext}}>{c.phone}</div>}
                    {c.email&&<div style={{fontSize:12,color:th.subtext}}>{c.email}</div>}
                    {c.source&&<div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>📍 {c.source}</div>}
                    {c.note&&<div style={{fontSize:12,color:"#92400e",background:"#fff7ed",padding:"5px 10px",borderRadius:7,marginTop:6,border:"1px solid #fed7aa"}}>📝 {c.note}</div>}
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>startEdit(c)} style={{padding:"5px 12px",borderRadius:8,border:`1.5px solid ${BLUE}`,background:"transparent",color:BLUE,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Edit</button>
                    <button onClick={()=>remove(c.id)} style={{padding:"5px 12px",borderRadius:8,border:"none",background:RED,color:"white",cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>✕</button>
                  </div>
                </div>
                <div style={{display:"flex",gap:16,fontSize:12,color:th.subtext}}>
                  <span>📦 {co.length} order{co.length!==1?"s":""}</span>
                  <span>💰 {fmt$(lv)} lifetime</span>
                  {c.lastOrder&&<span>📅 Last: {fmtD(c.lastOrder)}</span>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


// ══════════════════════════════════════════════════════════
// V7: SHARED COMPANY NOTES TAB
// ══════════════════════════════════════════════════════════
function CompanyNotesTab({ notes, onSave, currentUser, th }) {
  const [items, setItems] = useState(notes||[]);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [showNew, setShowNew] = useState(false);
  const inp = iStyle(th);

  // Sync from props
  React.useEffect(()=>{ setItems(notes||[]); },[notes]);

  const addNote = () => {
    if(!newTitle.trim()&&!newBody.trim()) return;
    const note = { id:uid(), title:newTitle.trim()||"Note", body:newBody.trim(), createdBy:currentUser?.displayName||currentUser?.email||"Unknown", createdAt:new Date().toISOString() };
    const updated = [note,...items];
    setItems(updated); onSave(updated);
    setNewTitle(""); setNewBody(""); setShowNew(false);
  };

  const startEdit = (note) => { setEditingId(note.id); setEditTitle(note.title); setEditBody(note.body); };
  const saveEdit = () => {
    const updated = items.map(n=>n.id===editingId?{...n,title:editTitle,body:editBody,editedBy:currentUser?.displayName||currentUser?.email,editedAt:new Date().toISOString()}:n);
    setItems(updated); onSave(updated); setEditingId(null);
  };
  const deleteNote = (id) => {
    if(!window.confirm("Delete this note?")) return;
    const updated = items.filter(n=>n.id!==id);
    setItems(updated); onSave(updated);
  };

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontSize:13,color:th.subtext}}>Shared notes visible to all users in real time.</div>
        <button onClick={()=>setShowNew(s=>!s)} style={{padding:"9px 18px",borderRadius:8,border:"none",background:BLUE,color:"white",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>
          {showNew?"Cancel":"+ New Note"}
        </button>
      </div>

      {/* New note form */}
      {showNew&&(
        <div style={{background:th.card,borderRadius:12,padding:16,marginBottom:16,border:`2px solid ${BLUE}`,boxShadow:"0 4px 16px rgba(82,113,255,0.15)"}}>
          <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Note title…" style={{...inp,marginBottom:10,fontWeight:600,fontSize:14}}/>
          <textarea value={newBody} onChange={e=>setNewBody(e.target.value)} placeholder="Write your note here…" rows={4} style={{...inp,resize:"vertical",fontSize:13,marginBottom:12}}/>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setShowNew(false);setNewTitle("");setNewBody("");}} style={{flex:1,padding:"10px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"white",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Cancel</button>
            <button onClick={addNote} style={{flex:2,padding:"10px",borderRadius:8,border:"none",background:GREEN,color:"white",cursor:"pointer",fontSize:14,fontWeight:700,fontFamily:"system-ui,sans-serif"}}>💾 Save Note</button>
          </div>
        </div>
      )}

      {/* Notes list */}
      {items.length===0&&!showNew&&(
        <div style={{textAlign:"center",padding:"40px 20px",color:th.subtext,fontSize:14}}>
          📋 No notes yet. Tap "+ New Note" to add one.
        </div>
      )}
      {items.map(note=>(
        <div key={note.id} style={{background:th.card,borderRadius:12,padding:16,marginBottom:12,border:`1px solid ${th.border}`,boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
          {editingId===note.id?(
            <div>
              <input value={editTitle} onChange={e=>setEditTitle(e.target.value)} style={{...inp,marginBottom:10,fontWeight:600,fontSize:14}}/>
              <textarea value={editBody} onChange={e=>setEditBody(e.target.value)} rows={4} style={{...inp,resize:"vertical",fontSize:13,marginBottom:12}}/>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setEditingId(null)} style={{flex:1,padding:"9px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"white",color:"#64748b",cursor:"pointer",fontSize:13,fontFamily:"system-ui,sans-serif"}}>Cancel</button>
                <button onClick={saveEdit} style={{flex:2,padding:"9px",borderRadius:8,border:"none",background:GREEN,color:"white",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"system-ui,sans-serif"}}>💾 Save</button>
              </div>
            </div>
          ):(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div style={{fontWeight:700,fontSize:15,color:th.text}}>{note.title}</div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>startEdit(note)} style={{padding:"4px 12px",borderRadius:8,border:`1.5px solid ${BLUE}`,background:"transparent",color:BLUE,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Edit</button>
                  <button onClick={()=>deleteNote(note.id)} style={{padding:"4px 12px",borderRadius:8,border:"none",background:RED,color:"white",cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Delete</button>
                </div>
              </div>
              {note.body&&<div style={{fontSize:13,color:th.text,lineHeight:1.6,whiteSpace:"pre-wrap",marginBottom:10}}>{note.body}</div>}
              <div style={{fontSize:11,color:th.subtext,borderTop:`1px solid ${th.border}`,paddingTop:8}}>
                📝 Created by <strong>{note.createdBy}</strong> · {fmtDateTime(note.createdAt)}
                {note.editedBy&&<span> · ✏️ Edited by <strong>{note.editedBy}</strong> · {fmtDateTime(note.editedAt)}</span>}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}


// ══════════════════════════════════════════════════════════
// V6.2: PIPELINE EDITOR TAB
// ══════════════════════════════════════════════════════════
function PipelineTab({ customStatuses, onSave, th }) {
  const DEFAULT = ["New Order","Sent for First Look","Waiting for Changes","Waiting for Pictures",
    "Waiting for Approval","Waiting to be Ordered","Ordered","In Production","Shipped","Delivered","Order Done"];
  const [items, setItems] = useState(customStatuses||[...DEFAULT]);
  const [newItem, setNewItem] = useState("");
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const [saved, setSaved] = useState(false);
  const inp = iStyle(th);

  const update = u => setItems(u);
  const add = () => {
    if(!newItem.trim()||items.includes(newItem.trim())) return;
    setItems(prev=>[...prev, newItem.trim()]);
    setNewItem("");
  };
  const remove = i => {
    if(items.length<=2){alert("You need at least 2 statuses.");return;}
    setItems(prev=>prev.filter((_,idx)=>idx!==i));
  };
  const moveUp = i => { if(i===0) return; const u=[...items]; [u[i-1],u[i]]=[u[i],u[i-1]]; setItems(u); };
  const moveDown = i => { if(i===items.length-1) return; const u=[...items]; [u[i],u[i+1]]=[u[i+1],u[i]]; setItems(u); };
  const onDragStart = i => setDragIdx(i);
  const onDragOver = (e,i) => { e.preventDefault(); setOverIdx(i); };
  const onDrop = i => {
    if(dragIdx===null||dragIdx===i){setDragIdx(null);setOverIdx(null);return;}
    const u=[...items]; const[moved]=u.splice(dragIdx,1); u.splice(i,0,moved);
    setItems(u); setDragIdx(null); setOverIdx(null);
  };
  const handleSave = () => {
    onSave(items);
    setSaved(true);
    setTimeout(()=>setSaved(false),2000);
  };
  const resetDefaults = () => {
    if(window.confirm("Reset pipeline to default statuses? This will remove any custom statuses.")) {
      setItems([...DEFAULT]);
      onSave([]);
    }
  };

  return(
    <div>
      <div style={{fontSize:13,color:"#64748b",marginBottom:14}}>Drag to reorder. Add or remove statuses. <strong>Note:</strong> "Order Done" should always be last.</div>
      {items.map((item,i)=>(
        <div key={i} draggable onDragStart={()=>onDragStart(i)} onDragOver={e=>onDragOver(e,i)} onDrop={()=>onDrop(i)} onDragEnd={()=>{setDragIdx(null);setOverIdx(null);}}
          style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,background:th.card,borderRadius:10,padding:"10px 14px",border:`1.5px solid ${overIdx===i&&dragIdx!==i?"#5271FF":th.border}`,opacity:dragIdx===i?.4:1,cursor:"grab"}}>
          <span style={{color:"#94a3b8",fontSize:16,userSelect:"none"}}>⠿</span>
          <div style={{display:"flex",flexDirection:"column",gap:2,flexShrink:0}}>
            <button onClick={()=>moveUp(i)} disabled={i===0} style={{background:"none",border:"none",cursor:i===0?"not-allowed":"pointer",color:i===0?"#cbd5e1":"#5271FF",fontSize:12,padding:"1px 4px",lineHeight:1}}>▲</button>
            <button onClick={()=>moveDown(i)} disabled={i===items.length-1} style={{background:"none",border:"none",cursor:i===items.length-1?"not-allowed":"pointer",color:i===items.length-1?"#cbd5e1":"#5271FF",fontSize:12,padding:"1px 4px",lineHeight:1}}>▼</button>
          </div>
          <input value={item} onChange={e=>update(items.map((x,idx)=>idx===i?e.target.value:x))}
            style={{...inp,flex:1,padding:"8px 10px",fontSize:13}}/>
          <button onClick={()=>remove(i)} style={{padding:"8px 12px",borderRadius:8,border:"none",background:"#ef4444",color:"white",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>✕</button>
        </div>
      ))}
      <div style={{display:"flex",gap:8,marginTop:12,marginBottom:16}}>
        <input value={newItem} onChange={e=>setNewItem(e.target.value)} placeholder="New status name…"
          style={{...inp,flex:1,padding:"9px 12px",fontSize:13}} onKeyDown={e=>e.key==="Enter"&&add()}/>
        <button onClick={add} style={{padding:"9px 16px",borderRadius:8,border:"none",background:"#5271FF",color:"white",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>+ Add</button>
      </div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={resetDefaults} style={{flex:1,padding:"12px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"white",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Reset Defaults</button>
        <button onClick={handleSave} style={{flex:2,padding:"12px",borderRadius:10,border:"none",background:saved?"#18B978":"#5271FF",color:"white",cursor:"pointer",fontSize:14,fontWeight:700,fontFamily:"system-ui,sans-serif",transition:"background .2s"}}>
          {saved?"✅ Saved!":"💾 Save Pipeline"}
        </button>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════
// V6: COMPANY PROFILE TAB
// ══════════════════════════════════════════════════════════
function CompanyProfileTab({ profile, onSave, th }) {
  const [name,setName]=useState(profile?.name||"LuxeBound Albums");
  const [tagline,setTagline]=useState(profile?.tagline||"The Art of Album Making");
  const [phone,setPhone]=useState(profile?.phone||"");
  const [email,setEmail]=useState(profile?.email||"");
  const [address,setAddress]=useState(profile?.address||"");
  const [website,setWebsite]=useState(profile?.website||"");
  const [logo,setLogo]=useState(profile?.logo||null);
  const [saved,setSaved]=useState(false);
  const inp=iStyle(th);

  const handleLogoChange=async(e)=>{
    const file=e.target.files?.[0];if(!file)return;e.target.value="";
    const img=new Image();const url=URL.createObjectURL(file);
    img.onload=()=>{
      const MAX=400;const scale=Math.min(1,MAX/Math.max(img.width,img.height));
      const w=Math.round(img.width*scale);const h=Math.round(img.height*scale);
      const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
      canvas.getContext("2d").drawImage(img,0,0,w,h);
      URL.revokeObjectURL(url);
      setLogo(canvas.toDataURL("image/jpeg",0.8));
    };img.src=url;
  };

  const handleSave=()=>{
    onSave({name,tagline,phone,email,address,website,logo});
    setSaved(true);setTimeout(()=>setSaved(false),2000);
  };

  return(
    <div>
      <div style={{background:th.card,borderRadius:12,padding:20,border:`1px solid ${th.border}`,marginBottom:12}}>
        <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:14}}>Company Logo</div>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          {logo
            ?<img src={logo} alt="logo" style={{width:72,height:72,borderRadius:"50%",objectFit:"cover",border:"2px solid #e2e8f0"}}/>
            :<div style={{width:72,height:72,borderRadius:"50%",background:"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,border:"2px solid #e2e8f0"}}>🏢</div>
          }
          <div>
            <label style={{display:"inline-block",padding:"9px 18px",borderRadius:8,background:BLUE,color:"white",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif",marginBottom:6}}>
              📷 Upload Logo<input type="file" accept="image/*" onChange={handleLogoChange} style={{display:"none"}}/>
            </label>
            <div style={{fontSize:11,color:th.subtext,marginTop:4}}>This logo appears on the login screen and all invoices.</div>
            {logo&&<button onClick={()=>setLogo(null)} style={{display:"block",marginTop:6,background:"none",border:"none",color:RED,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"system-ui,sans-serif",padding:0}}>Remove logo</button>}
          </div>
        </div>
      </div>
      <div style={{background:th.card,borderRadius:12,padding:16,border:`1px solid ${th.border}`,marginBottom:12}}>
        <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:14}}>Company Information</div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            <label style={{fontSize:11,fontWeight:700,letterSpacing:"0.6px",textTransform:"uppercase",color:"#64748b"}}>Company Name</label>
            <input value={name} onChange={e=>setName(e.target.value)} style={{...inp,fontSize:13}}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            <label style={{fontSize:11,fontWeight:700,letterSpacing:"0.6px",textTransform:"uppercase",color:"#64748b"}}>Tagline</label>
            <input value={tagline} onChange={e=>setTagline(e.target.value)} style={{...inp,fontSize:13}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              <label style={{fontSize:11,fontWeight:700,letterSpacing:"0.6px",textTransform:"uppercase",color:"#64748b"}}>Phone</label>
              <input value={phone} onChange={e=>setPhone(e.target.value)} style={{...inp,fontSize:13}}/>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              <label style={{fontSize:11,fontWeight:700,letterSpacing:"0.6px",textTransform:"uppercase",color:"#64748b"}}>Email</label>
              <input value={email} onChange={e=>setEmail(e.target.value)} style={{...inp,fontSize:13}}/>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            <label style={{fontSize:11,fontWeight:700,letterSpacing:"0.6px",textTransform:"uppercase",color:"#64748b"}}>Address</label>
            <input value={address} onChange={e=>setAddress(e.target.value)} style={{...inp,fontSize:13}}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            <label style={{fontSize:11,fontWeight:700,letterSpacing:"0.6px",textTransform:"uppercase",color:"#64748b"}}>Website</label>
            <input value={website} onChange={e=>setWebsite(e.target.value)} style={{...inp,fontSize:13}}/>
          </div>
        </div>
      </div>
      <button onClick={handleSave} style={{width:"100%",padding:"13px",borderRadius:10,border:"none",background:saved?GREEN:BLUE,color:"white",cursor:"pointer",fontSize:14,fontWeight:700,fontFamily:"system-ui,sans-serif",transition:"background .2s"}}>
        {saved?"✅ Saved!":"💾 Save Company Profile"}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// V6: BACKUP & RESTORE TAB
// ══════════════════════════════════════════════════════════
function BackupTab({ orders, customers, albums, upgrades, paymentMethods, users, sources, customerTags, onRestore, th }) {
  const [restoring,setRestoring]=useState(false);
  const [msg,setMsg]=useState("");

  const doBackup=()=>{
    const data={orders,customers,config:{albums,upgrades,paymentMethods,users,sources,customerTags},exportedAt:new Date().toISOString(),version:"5.1"};
    const json=JSON.stringify(data,null,2);
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([json],{type:"application/json"}));
    a.download=`LuxeBound_Backup_${todayStr()}.json`;
    a.click();
    setMsg("✅ Backup downloaded!");
    setTimeout(()=>setMsg(""),3000);
  };

  const doRestore=async(e)=>{
    const file=e.target.files?.[0];if(!file)return;
    e.target.value="";
    setRestoring(true);setMsg("");
    try{
      const text=await file.text();
      const data=JSON.parse(text);
      if(!data.orders||!data.config){setMsg("❌ Invalid backup file.");setRestoring(false);return;}
      if(window.confirm(`This will restore ${data.orders.length} orders and overwrite current data. Are you sure?`)){
        await onRestore(data);
        setMsg("✅ Restore complete!");
      }
    }catch{setMsg("❌ Failed to read backup file.");}
    setRestoring(false);
  };

  return(
    <div>
      <div style={{background:th.card,borderRadius:12,padding:20,border:`1px solid ${th.border}`,marginBottom:12}}>
        <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:8}}>💾 Backup Database</div>
        <div style={{fontSize:13,color:th.subtext,marginBottom:14}}>Download a complete backup of all your orders, customers, and settings as a JSON file. Keep it somewhere safe!</div>
        <button onClick={doBackup} style={{width:"100%",padding:"13px",borderRadius:10,border:"none",background:BLUE,color:"white",cursor:"pointer",fontSize:14,fontWeight:700,fontFamily:"system-ui,sans-serif"}}>
          💾 Download Backup ({orders.length} orders)
        </button>
      </div>
      <div style={{background:th.card,borderRadius:12,padding:20,border:`1px solid ${th.border}`,marginBottom:12}}>
        <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:8}}>📂 Restore from Backup</div>
        <div style={{fontSize:13,color:th.subtext,marginBottom:14}}>Upload a backup JSON file to restore your data. ⚠️ This will overwrite all current data!</div>
        <label style={{display:"block",width:"100%",padding:"13px",borderRadius:10,border:`2px dashed ${RED}`,background:"#fef2f2",color:RED,cursor:"pointer",fontSize:14,fontWeight:700,fontFamily:"system-ui,sans-serif",textAlign:"center",boxSizing:"border-box"}}>
          {restoring?"Restoring…":"📂 Choose Backup File"}
          <input type="file" accept=".json" onChange={doRestore} style={{display:"none"}} disabled={restoring}/>
        </label>
      </div>
      {msg&&<div style={{padding:"12px 16px",borderRadius:10,background:msg.startsWith("✅")?"#f0fdf4":"#fef2f2",color:msg.startsWith("✅")?GREEN:RED,fontSize:13,fontWeight:600}}>{msg}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// V6: KEYBOARD SHORTCUTS TAB
// ══════════════════════════════════════════════════════════
const DEFAULT_SHORTCUTS = [
  {id:"s1",key:"n",action:"New Order",description:"Open new order form"},
  {id:"s2",key:"s",action:"Settings",description:"Open settings"},
  {id:"s3",key:"f",action:"Search",description:"Focus search box"},
  {id:"s4",key:"Escape",action:"Go Back",description:"Go back / cancel"},
  {id:"s5",key:"e",action:"Export",description:"Open export modal"},
];

function KeyboardShortcutsTab({ th }) {
  const [shortcuts,setShortcuts]=useState(()=>{
    try{const s=localStorage.getItem("lb_shortcuts");return s?JSON.parse(s):DEFAULT_SHORTCUTS;}catch{return DEFAULT_SHORTCUTS;}
  });
  const [newKey,setNewKey]=useState("");
  const [newAction,setNewAction]=useState("");
  const inp=iStyle(th);

  const ACTIONS=["New Order","Settings","Search","Go Back","Export","Dashboard","Bulk Select"];

  const save=updated=>{setShortcuts(updated);localStorage.setItem("lb_shortcuts",JSON.stringify(updated));};
  const remove=id=>save(shortcuts.filter(s=>s.id!==id));
  const add=()=>{
    if(!newKey.trim()||!newAction)return;
    save([...shortcuts,{id:uid(),key:newKey.trim(),action:newAction,description:""}]);
    setNewKey("");setNewAction("");
  };

  return(
    <div>
      <div style={{fontSize:13,color:th.subtext,marginBottom:14}}>These keyboard shortcuts work anywhere in the app. Press the key to trigger the action.</div>
      {shortcuts.map(s=>(
        <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,background:th.card,borderRadius:10,padding:"12px 14px",border:`1px solid ${th.border}`}}>
          <div style={{background:NAVY,color:"white",fontFamily:"monospace",fontWeight:700,fontSize:13,padding:"4px 10px",borderRadius:6,minWidth:40,textAlign:"center"}}>{s.key}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600,color:th.text}}>{s.action}</div>
            {s.description&&<div style={{fontSize:11,color:th.subtext}}>{s.description}</div>}
          </div>
          <button onClick={()=>remove(s.id)} style={{background:"none",border:"none",color:RED,cursor:"pointer",fontSize:16,padding:"0 4px",lineHeight:1}}>×</button>
        </div>
      ))}
      <div style={{display:"flex",gap:8,marginTop:16,alignItems:"center"}}>
        <input value={newKey} onChange={e=>setNewKey(e.target.value)} placeholder="Key (e.g. n)" maxLength={10} style={{...inp,width:80,padding:"9px 12px",fontSize:13}}/>
        <select value={newAction} onChange={e=>setNewAction(e.target.value)} style={{...inp,flex:1,fontSize:13}}>
          <option value="">Select action…</option>
          {ACTIONS.map(a=><option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={add} style={{padding:"9px 16px",borderRadius:8,border:"none",background:BLUE,color:"white",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>+ Add</button>
      </div>
      <button onClick={()=>save(DEFAULT_SHORTCUTS)} style={{marginTop:12,padding:"8px 16px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"white",color:"#64748b",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"system-ui,sans-serif"}}>Reset to Defaults</button>
    </div>
  );
}


function AccountTab({currentUser,onChangePw,onUpdateDisplayName,onUpdatePhoto,darkMode,onToggleDark,lang,onToggleLang,th}){
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

function SettingsPanel({currentUser,albums,onSaveAlbums,upgrades,onSaveUpgrades,paymentMethods,onSavePayments,users,onSaveUsers,darkMode,onToggleDark,lang,onToggleLang,onChangePw,onUpdateDisplayName,onUpdatePhoto,onBack,activeTab,setActiveTab,orders,customers,onSaveCustomer,sources,onSaveSources,customerTags,onSaveCustomerTags,trash,onRestoreOrder,onDeletePermanent,companyProfile,onSaveCompanyProfile,onRestoreBackup,customStatuses,onSaveCustomStatuses,companyNotes,onSaveCompanyNotes,th}){
  const isAdmin=currentUser.role==="admin";
  const tabs=[
    {id:"pipeline",icon:"🔄",label:"Pipeline",desc:"Edit order statuses & stages"},
    {id:"notes",icon:"📋",label:"Company Notes",desc:"Shared notes for your whole team"},
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
        case "albums":    return <ListEditor items={albums} onSave={onSaveAlbums} th={th} placeholder="Album name"/>;
        case "upgrades":  return <ListEditor items={upgrades} onSave={onSaveUpgrades} th={th} placeholder="Upgrade name"/>;
        case "payments":  return <PaymentsTab paymentMethods={paymentMethods} onSave={onSavePayments} th={th}/>;
        case "users":     return <UsersTab users={users} onSave={onSaveUsers} th={th}/>;
        case "insights":  return <InsightsTab orders={orders} th={th}/>;
        case "customers": return <CustomersTab customers={customers} onSave={onSaveCustomer} orders={orders} sources={sources} customerTags={customerTags} th={th}/>;
        case "lists":     return <ListsTagsTab sources={sources} onSaveSources={onSaveSources} customerTags={customerTags} onSaveCustomerTags={onSaveCustomerTags} th={th}/>;
        case "trash":     return <TrashTab trash={trash} onRestore={onRestoreOrder} onDeletePermanent={onDeletePermanent} th={th}/>;
        case "company":   return <CompanyProfileTab profile={companyProfile} onSave={onSaveCompanyProfile} th={th}/>;
        case "backup":    return <BackupTab orders={orders} customers={customers} albums={albums} upgrades={upgrades} paymentMethods={paymentMethods} users={users} sources={sources} customerTags={customerTags} onRestore={onRestoreBackup} th={th}/>;
        case "shortcuts": return <KeyboardShortcutsTab th={th}/>;
        case "account":   return <AccountTab currentUser={currentUser} onChangePw={onChangePw} onUpdateDisplayName={onUpdateDisplayName} onUpdatePhoto={onUpdatePhoto} darkMode={darkMode} onToggleDark={onToggleDark} lang={lang} onToggleLang={onToggleLang} th={th}/>;
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
    account:   "linear-gradient(135deg,#C9A84C,#fbbf24)",
  };

  const renderGrid = (items) => (
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
      {items.map(tab=>(
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

  return(
    <div style={{background:"linear-gradient(160deg,#e8eeff 0%,#f0f7ff 100%)",minHeight:"100vh",fontFamily:"system-ui,sans-serif"}}>
      <NavBar title="⚙️ Settings" onBack={onBack}/>
      <div style={{padding:"24px",maxWidth:800,margin:"0 auto"}}>
        {/* Main grid - all users */}
        {renderGrid(tabs)}

        {/* Admin only section */}
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
  const [companyNotes,setCompanyNotes]=useState([]); // null = use defaults
  const [lang,setLang]=useState(()=>lsGet("lb_lang")||"en");
  const [darkMode,setDarkMode]=useState(false);
  const [invoiceMap,setInvoiceMap]=useState({});
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
    unsubs.push(onSnapshot(collection(db,"trash"),snap=>setTrash(snap.docs.map(d=>({id:d.id,...d.data()}))),e=>console.error("trash:",e)));
    const cfg=(name,setter,fallback)=>unsubs.push(onSnapshot(doc(db,"config",name),snap=>{if(snap.exists())setter(snap.data().items??fallback);else setter(fallback);},e=>console.error(name,e)));
    cfg("albums",setAlbums,DEFAULT_ALBUMS);
    cfg("upgrades",setUpgrades,DEFAULT_UPGRADES);
    cfg("payments",setPayments,DEFAULT_PAYMENTS);
    cfg("users",setUsers,DEFAULT_USERS);
    cfg("sources",setSources,DEFAULT_SOURCES);
    cfg("customerTags",setCustomerTags,[]);
    // Company profile
    unsubs.push(onSnapshot(doc(db,"config","companyProfile"),snap=>{
      if(snap.exists()) setCompanyProfile(snap.data());
    },e=>console.error("companyProfile:",e)));
    // Custom pipeline statuses
    unsubs.push(onSnapshot(doc(db,"config","customStatuses"),snap=>{
      if(snap.exists()&&snap.data().items?.length>0) setCustomStatuses(snap.data().items);
      else setCustomStatuses(null);
    },e=>console.error("customStatuses:",e)));
    // Company notes - real time sync between all users
    unsubs.push(onSnapshot(doc(db,"config","companyNotes"),snap=>{
      if(snap.exists()) setCompanyNotes(snap.data().items||[]);
      else setCompanyNotes([]);
    },e=>console.error("companyNotes:",e)));
    setReady(true);
    return()=>unsubs.forEach(u=>u());
  },[]);

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
    await setDoc(doc(db,"orders",order.id),clean({...order,status:newStatus,statusChangedAt:new Date().toISOString(),editHistory}));
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

  const saveSources=async(items)=>await saveConfig("sources",items);
  const saveCustomerTags=async(items)=>await saveConfig("customerTags",items);
  const togLang=l=>{setLang(l);lsSet("lb_lang",l);};
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
  const login=u=>{setCurrentUser(u);lsSet("lb_user",u);};
  const signOut=()=>{setCurrentUser(null);lsSet("lb_user",null);};
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

  if(!ready) return <Loader/>;
  if(!currentUser) return <LoginScreen users={users} onLogin={login}/>;

  if(view==="newOrder"||view==="editOrder") return(
    <OrderForm
      order={editingOrder} albums={albums} upgrades={upgrades} paymentMethods={payments}
      onSave={saveOrder} onDelete={deleteOrder}
      onCancel={()=>{setView("dashboard");setEditingOrder(null);}}
      currentUser={currentUser} customers={customers} onSaveCustomer={saveCustomer}
      sources={sources} companyProfile={companyProfile} activeStatuses={customStatuses||STATUSES} th={theme}/>
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
      lang={lang}               onToggleLang={togLang}
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
      onQuickStatus={quickStatus}
      onSnooze={snoozeOrder}
      onBulkStatus={bulkStatus}
      invoiceMap={invoiceMap}
      activeStatuses={customStatuses||STATUSES}
      onEditNote={saveNote}
      onSettings={()=>setView("settings")}
      onSignOut={signOut}
      showExport={showExport} setShowExport={setShowExport}
      currentUser={currentUser}
      th={theme}/>
  );
}
