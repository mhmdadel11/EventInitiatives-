const $ = id => document.getElementById(id);
const STORAGE_KEY = "eventInitiativesDemo_v1";
let events = [];
let currentDate = new Date();
let selectedId = null;
let selectedStatus = "pending";
let selectedMedia = [];          // روابط الصور والفيديوهات المرفقة بالمنشور
let uploadsInProgress = 0;
let draggedId = null;      // الفعالية الجاري سحبها من المربع
let dragOffsetDays = 0;   // اليوم الذي أُمسك منه المنشور متعدد الأيام (0 = يوم البداية)
let pickedPoolId = null;   // الفعالية المختارة بالضغط (بديل السحب للموبايل)
const months = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const weekdays = ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const statusText = {done:"تمت بنجاح",notdone:"لم تتم",pending:"بانتظار التقييم"};
const todayISO = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function save(){renderAll();}
// الحقول الاختيارية قد لا تكون موجودة في الصفحة (مثلًا لو تم حذف تاريخ النهاية): لا نريد أن يتعطل الزرار بسببها.
const setVal = (id, v) => { const el = $(id); if (el) el.value = v; };
const isoDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i, VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;
const isVideoSrc = src => /^data:video\//i.test(src) || VIDEO_EXT.test(String(src).split("?")[0]);
function mediaElement(src, alt){
  if (isVideoSrc(src)) { const v=document.createElement("video"); v.src=src; v.controls=true; v.preload="metadata"; v.playsInline=true; return v; }
  const img=document.createElement("img"); img.src=src; img.alt=alt; return img;
}
const dateText = d => d ? new Date(d+"T12:00:00").toLocaleDateString("ar-EG",{year:"numeric",month:"2-digit",day:"2-digit"}) : "—";
const statusMark = s => s==="done" ? "✓" : s==="notdone" ? "×" : "◷";

function showView(view){
  if (!["calendar","events","add"].includes(view)) view = "calendar";
  ["calendar","events","add"].forEach(v => {
    const section = $(v+"View");
    if (section) section.classList.toggle("hidden", v !== view);
  });
  document.querySelectorAll(".nav").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  const titles = {calendar:"تقويم المنشورات",events:"كل المنشورات والمبادرات",add:"إضافة منشور / مبادرة"};
  if ($("pageTitle")) $("pageTitle").textContent = titles[view];
  // Keep the selected section in the URL so navigation is easier to verify and restore.
  if (location.hash !== "#" + view) { try { history.replaceState(null, "", "#" + view); } catch (e) { /* داخل iframe لا يسمح بتغيير الرابط */ } }
}
// Reliable navigation: bind the buttons directly after the page markup has loaded.
const topAddButton = $("topAdd");
if (topAddButton) topAddButton.addEventListener("click", (ev) => {
  ev.preventDefault();
  resetForm();
  showView("add");
});
document.querySelectorAll(".nav[data-view]").forEach((button) => {
  button.addEventListener("click", (ev) => {
    ev.preventDefault();
    const view = button.dataset.view;
    if (view === "add") resetForm();
    showView(view);
  });
});
const cancelButton = $("cancelForm");
if (cancelButton) cancelButton.addEventListener("click", (ev) => {
  ev.preventDefault();
  showView("calendar");
});
window.addEventListener("hashchange", () => showView(location.hash.slice(1)));

// Bind the all-posts PDF action immediately so it is available as soon as the page loads.
// The function declaration is hoisted, and the click opens the print window synchronously
// from the user's gesture to avoid popup blockers.
const allEventsPdfButton = $("allEventsPdf");
if (allEventsPdfButton) {
  allEventsPdfButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    makeAllEventsPdf(events);
  });
}

function renderStats(){
  $("totalCount").textContent=events.length;
  $("doneCount").textContent=events.filter(e=>e.status==="done").length;
  $("notDoneCount").textContent=events.filter(e=>e.status==="notdone").length;
  $("pendingCount").textContent=events.filter(e=>e.status==="pending").length;
}
function renderCalendar(){
  const y=currentDate.getFullYear(), m=currentDate.getMonth();
  $("monthLabel").textContent=`${months[m]} ${y}`;
  const first=new Date(y,m,1), start=new Date(y,m,1-first.getDay());
  let html=weekdays.map(d=>`<div class="day-name">${d}</div>`).join("");
  for(let i=0;i<42;i++){
    const day=new Date(start);day.setDate(start.getDate()+i);
    const iso=`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,"0")}-${String(day.getDate()).padStart(2,"0")}`;
    const dayEvents=events.filter(e=>e.isScheduled===true && e.startDate<=iso && e.endDate>=iso);
    html+=`<div class="day-cell ${day.getMonth()!==m?"outside":""} ${iso===todayISO()?"today":""}" data-date="${iso}"><div class="day-num">${day.getDate()}</div>${dayEvents.slice(0,3).map(e=>`<div role="button" tabindex="0" draggable="true" class="event-chip ${e.type==="مبادرة"?"initiative":""} ${e.status}" data-id="${esc(e.id)}" title="${esc(e.name)} — اسحبه إلى يوم آخر لتغيير موعده، أو إلى مربع المنشورات المضافة لإرجاعه"><span class="chip-status">${statusMark(e.status)}</span>${esc(e.name)}</div>`).join("")}${dayEvents.length>3?`<small>+${dayEvents.length-3} أخرى</small>`:""}</div>`;
  }
  $("calendarGrid").innerHTML=html;
  $("calendarGrid").querySelectorAll(".event-chip").forEach(b=>{
    b.onclick=()=>openModal(b.dataset.id);
    b.onkeydown=ev=>{if(ev.key==="Enter"||ev.key===" "){ev.preventDefault();openModal(b.dataset.id);}};
    // سحب منشور موضوع على التقويم: إلى يوم آخر (تغيير الموعد) أو إلى مربع "المنشورات المضافة" (إرجاعه)
    b.addEventListener("dragstart",ev=>{
      draggedId=b.dataset.id;const item=events.find(x=>x.id===draggedId);
      const from=b.closest(".day-cell")?.dataset.date;
      dragOffsetDays=item&&from?Math.max(0,Math.round((new Date(from+"T12:00:00")-new Date(item.startDate+"T12:00:00"))/86400000)):0;
      ev.dataTransfer.setData("text/plain",draggedId);ev.dataTransfer.setData("text/event-id",draggedId);ev.dataTransfer.effectAllowed="move";b.classList.add("dragging");
    });
    b.addEventListener("dragend",()=>{draggedId=null;dragOffsetDays=0;b.classList.remove("dragging");document.querySelectorAll(".drop-target").forEach(c=>c.classList.remove("drop-target"));});
  });
  // المربع يعرض فقط المنشورات التي لم توضع على التقويم بعد؛ بمجرد وضع المنشور على يوم يختفي من هنا.
  const pool=$("eventPool");
  if(pool){
    const waiting=events.filter(e=>e.isScheduled!==true).sort((a,b)=>a.startDate.localeCompare(b.startDate));
    $("poolCount").textContent=`${waiting.length} منشور`;
    pool.innerHTML=waiting.length?waiting.map(e=>`<div role="button" tabindex="0" draggable="true" class="pool-event ${e.type==="مبادرة"?"initiative":""} ${pickedPoolId===e.id?"pool-picked":""}" data-drag-id="${esc(e.id)}" title="اسحب إلى يوم في التقويم"><span class="pool-grip" aria-hidden="true">⠿</span><span class="pool-event-text"><strong>${esc(e.name)}</strong><small>${esc(e.type)} · ${dateText(e.startDate)}${e.location?` · ${esc(e.location)}`:""}</small></span><span class="pool-drag-hint">اسحب للتقويم</span></div>`).join(""):`<div class="pool-empty">${events.length?"كل المنشورات موضوعة على التقويم.":"لا توجد منشورات مضافة حتى الآن. أضف منشورًا ليظهر هنا."}</div>`;
    pool.querySelectorAll("[data-drag-id]").forEach(card=>{
      card.addEventListener("dragstart",ev=>{draggedId=card.dataset.dragId;dragOffsetDays=0;ev.dataTransfer.setData("text/plain",draggedId);ev.dataTransfer.setData("text/event-id",draggedId);ev.dataTransfer.effectAllowed="move";card.classList.add("dragging");});
      card.addEventListener("dragend",()=>{draggedId=null;card.classList.remove("dragging");document.querySelectorAll(".day-cell.drop-target").forEach(c=>c.classList.remove("drop-target"));});
      // للموبايل (السحب لا يعمل باللمس): اضغط على الفعالية ثم اضغط على اليوم المطلوب
      const pick=()=>{pickedPoolId=pickedPoolId===card.dataset.dragId?null:card.dataset.dragId;renderCalendar();};
      card.addEventListener("click",pick);
      card.addEventListener("keydown",ev=>{if(ev.key==="Enter"||ev.key===" "){ev.preventDefault();pick();}});
    });
  }
  $("calendarGrid").querySelectorAll(".day-cell").forEach(cell=>{
    cell.addEventListener("dragover",ev=>{ev.preventDefault();ev.dataTransfer.dropEffect="move";cell.classList.add("drop-target");});
    cell.addEventListener("dragleave",ev=>{if(!cell.contains(ev.relatedTarget))cell.classList.remove("drop-target");});
    cell.addEventListener("drop",ev=>{
      ev.preventDefault();cell.classList.remove("drop-target");
      const id=draggedId||ev.dataTransfer.getData("text/plain")||ev.dataTransfer.getData("text/event-id");
      placeEvent(id,cell.dataset.date,cell);
    });
    cell.addEventListener("click",ev=>{
      if(!pickedPoolId||ev.target.closest(".event-chip"))return;
      const id=pickedPoolId;pickedPoolId=null;
      placeEvent(id,cell.dataset.date,cell);
    });
  });
}
// وضع المنشور على اليوم المختار في التقويم (سحب أو ضغط) وحفظه في قاعدة البيانات المركزية
async function placeEvent(id,target,cell){
  const item=events.find(x=>x.id===id);if(!item||!target)return;
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  // منشور متعدد الأيام أُمسك من يومه الثاني مثلًا: نحافظ على موضع الإمساك
  const newStartDate=new Date(target+"T12:00:00");newStartDate.setDate(newStartDate.getDate()-dragOffsetDays);
  const newStart=iso(newStartDate);
  // موضوع فعلًا على التقويم في نفس اليوم: لا شيء يتغير. أما غير الموضوع فيجب وضعه حتى لو كان تاريخه المسجّل هو نفس اليوم.
  if(item.isScheduled===true&&item.startDate===newStart){renderCalendar();return;}
  const oldStart=new Date(item.startDate+"T12:00:00"),oldEnd=new Date(item.endDate+"T12:00:00");
  const duration=Math.max(0,Math.round((oldEnd-oldStart)/86400000));const newEnd=new Date(newStartDate);newEnd.setDate(newEnd.getDate()+duration);
  const updated={...item,startDate:newStart,endDate:iso(newEnd),isScheduled:true};
  if(cell)cell.classList.add("drop-saving");
  try{const saved=await api(`/api/events/${encodeURIComponent(id)}`,{method:"PUT",body:JSON.stringify(updated)});const i=events.findIndex(x=>x.id===id);if(i>=0)events[i]=saved;renderAll();}
  catch(err){alert("تعذر تغيير موعد المنشور: "+err.message);renderCalendar();}
  finally{if(cell)cell.classList.remove("drop-saving");}
}
// إرجاع منشور من التقويم إلى مربع "المنشورات المضافة" (يبقى تاريخه كما هو)
async function returnToPool(id){
  const item=events.find(x=>x.id===id);if(!item||item.isScheduled!==true)return;
  try{const saved=await api(`/api/events/${encodeURIComponent(id)}`,{method:"PUT",body:JSON.stringify({...item,isScheduled:false})});const i=events.findIndex(x=>x.id===id);if(i>=0)events[i]=saved;renderAll();}
  catch(err){alert("تعذر إرجاع المنشور: "+err.message);renderCalendar();}
}
{
  const poolBox=document.querySelector(".event-pool");
  if(poolBox){
    const draggingPlaced=()=>events.some(x=>x.id===draggedId&&x.isScheduled===true);
    poolBox.addEventListener("dragover",ev=>{if(draggingPlaced()){ev.preventDefault();ev.dataTransfer.dropEffect="move";poolBox.classList.add("drop-target");}});
    poolBox.addEventListener("dragleave",ev=>{if(!poolBox.contains(ev.relatedTarget))poolBox.classList.remove("drop-target");});
    poolBox.addEventListener("drop",ev=>{ev.preventDefault();poolBox.classList.remove("drop-target");returnToPool(draggedId);});
  }
}
$("prevMonth").onclick=()=>{currentDate.setMonth(currentDate.getMonth()-1);renderCalendar();};
$("nextMonth").onclick=()=>{currentDate.setMonth(currentDate.getMonth()+1);renderCalendar();};
$("todayBtn").onclick=()=>{currentDate=new Date();renderCalendar();};

function renderTable(){
  const q=($("searchInput").value||"").trim().toLowerCase();
  const filtered=events.filter(e=>`${e.name} ${e.location} ${e.organizer}`.toLowerCase().includes(q)).sort((a,b)=>a.startDate.localeCompare(b.startDate));
  $("eventsTable").innerHTML=filtered.map(e=>`<tr><td><strong>${esc(e.name)}</strong></td><td>${esc(e.type)}</td><td>${dateText(e.startDate)}</td><td><span class="badge ${e.status}">${statusMark(e.status)} ${statusText[e.status]}</span></td><td><div class="row-actions"><button class="mini view" data-open="${e.id}">التفاصيل</button><button class="mini pdf" data-pdf="${e.id}">PDF</button></div></td></tr>`).join("");
  $("emptyEvents").classList.toggle("hidden",filtered.length>0);
  $("eventsTable").querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>openModal(b.dataset.open));
  $("eventsTable").querySelectorAll("[data-pdf]").forEach(b=>b.onclick=()=>makePdf(events.find(e=>e.id===b.dataset.pdf)));
}
$("searchInput").addEventListener("input",renderTable);
function renderAll(){renderStats();renderCalendar();renderTable();}

function renderMediaPreview(){
  const wrap=$("imagePreviewWrap");
  wrap.innerHTML="";
  if(!selectedMedia.length){wrap.classList.add("hidden");return;}
  wrap.classList.remove("hidden");
  selectedMedia.forEach((src,index)=>{
    const card=document.createElement("div");card.className="image-preview-card";
    const media=mediaElement(src,`معاينة الصورة ${index+1}`);
    const label=document.createElement("small");label.textContent=`${isVideoSrc(src)?"فيديو":"صورة"} ${index+1}`;
    const remove=document.createElement("button");remove.type="button";remove.className="soft";remove.textContent="إزالة";remove.onclick=()=>{selectedMedia.splice(index,1);renderMediaPreview();};
    card.append(media,label,remove);wrap.append(card);
  });
}
function setUploadStatus(text){const el=$("uploadStatus");if(!el)return;el.textContent=text||"";el.classList.toggle("hidden",!text);}
$("eventImage").addEventListener("change", async ev=>{
  const input=ev.target; const files=Array.from(input.files||[]); if(!files.length)return;
  // نتحقق من كل الملفات قبل رفع أي منها
  for(const file of files){
    const isImg=IMAGE_EXT.test(file.name), isVid=VIDEO_EXT.test(file.name);
    if(!isImg&&!isVid){alert(`الملف ${file.name} غير مدعوم. المسموح: JPG وPNG وWEBP وGIF للصور، وMP4 وWEBM وMOV للفيديو.`);input.value="";return;}
    const MI=(window.APP_CONFIG&&APP_CONFIG.MAX_IMAGE_MB)||20, MV=(window.APP_CONFIG&&APP_CONFIG.MAX_VIDEO_MB)||50;
    if(isImg&&file.size>MI*1024*1024){alert(`حجم الصورة ${file.name} أكبر من ${MI} ميجابايت.`);input.value="";return;}
    if(isVid&&file.size>MV*1024*1024){alert(`حجم الفيديو ${file.name} أكبر من ${MV} ميجابايت.`);input.value="";return;}
  }
  const submitBtn=$("eventForm").querySelector('button[type="submit"]');
  uploadsInProgress++; if(submitBtn)submitBtn.disabled=true;
  try{
    for(let i=0;i<files.length;i++){
      const file=files[i];
      const show=pct=>setUploadStatus(`جاري رفع الملف ${i+1} من ${files.length}: ${file.name} (${pct}%)`);
      show(0);
      const url=await uploadFile(file,show);
      selectedMedia.push(url);renderMediaPreview();
    }
  }catch(err){alert(err.message||"تعذر رفع الملفات.");}
  finally{uploadsInProgress--; if(!uploadsInProgress&&submitBtn)submitBtn.disabled=false; setUploadStatus("");input.value="";}
});
function resetForm(e=null){
  $("eventForm").reset();$("eventId").value=e?.id||"";
  selectedMedia=e?.imagesDataUrls?.length?[...e.imagesDataUrls]:(e?.imageDataUrl?[e.imageDataUrl]:[]);
  renderMediaPreview();
  $("formTitle").textContent=e?"تعديل المنشور":"إضافة منشور / مبادرة";
  if(e){["name","type","organizer","startDate","endDate","startTime","endTime","location","owner","audience","status","description","notes"].forEach(k=>setVal(k,e[k]??""));}
  else{setVal("startDate",todayISO());setVal("endDate",todayISO());setVal("status","pending");}
}
$("eventForm").addEventListener("submit",ev=>{
  ev.preventDefault();
  if(uploadsInProgress>0){alert("انتظر حتى ينتهي رفع الملفات ثم احفظ.");return;}
  const oldId=$("eventId").value; const oldEvent=oldId?events.find(e=>e.id===oldId):null;
  // أي حقل غير موجود في الصفحة نحتفظ بقيمته القديمة (أو نتركه فارغًا)
  const val=k=>$(k)?$(k).value.trim():(oldEvent?.[k]??"");
  const fields=Object.fromEntries(["name","type","organizer","startDate","endDate","startTime","endTime","location","owner","audience","status","description","notes"].map(k=>[k,val(k)]));
  // لا يوجد تاريخ (الحقل غير موجود في الصفحة): المنشور الجديد يأخذ تاريخ اليوم مبدئيًا ويتحدد موعده الفعلي بسحبه على التقويم،
  // والمنشور الموجود يحتفظ بتاريخه.
  if(!fields.startDate)fields.startDate=oldEvent?.startDate||todayISO();
  if(!$("endDate")){
    // لا يوجد حقل تاريخ نهاية: المنشور بتاريخ واحد، ومنشور قديم متعدد الأيام يحتفظ بعدد أيامه عند تغيير تاريخه
    fields.endDate=fields.startDate;
    if(oldEvent&&oldEvent.startDate&&oldEvent.endDate){
      const days=Math.max(0,Math.round((new Date(oldEvent.endDate+"T12:00:00")-new Date(oldEvent.startDate+"T12:00:00"))/86400000));
      const d=new Date(fields.startDate+"T12:00:00");d.setDate(d.getDate()+days);fields.endDate=isoDate(d);
    }
  }
  if(!fields.status)fields.status="pending";
  if(fields.endDate<fields.startDate){alert("تاريخ النهاية يجب أن يكون مساويًا لتاريخ البداية أو بعده.");return;}
  const event={id:oldId||crypto.randomUUID(),...fields,isScheduled:oldEvent?.isScheduled===true,imagesDataUrls:selectedMedia};
  api(oldId?`/api/events/${encodeURIComponent(oldId)}`:"/api/events",{method:oldId?"PUT":"POST",body:JSON.stringify(event)}).then(saved=>{const i=events.findIndex(e=>e.id===saved.id);if(i>=0)events[i]=saved;else events.push(saved);renderAll();currentDate=new Date(saved.startDate+"T12:00:00");showView("calendar")}).catch(e=>alert("تعذر حفظ المنشور: "+e.message));
});
function openModal(id){
  const e=events.find(x=>x.id===id);if(!e)return;selectedId=id;selectedStatus=e.status;
  $("modalType").textContent=e.type;$("modalName").textContent=e.name;
  $("modalDate").textContent=`${dateText(e.startDate)}${e.endDate!==e.startDate?" — "+dateText(e.endDate):""}`;
  const timeText=[e.startTime,e.endTime].filter(Boolean).join(" - ");
  const details=[["الجهة المنظمة",e.organizer],["الموقع",e.location],["المسؤول",e.owner],["الوقت",timeText],["الفئة المستهدفة",e.audience],["الوصف",e.description],["الحالة الحالية",statusText[e.status]]].filter(([k,v])=>v);
  $("modalDetails").innerHTML=details.map(([k,v])=>`<div class="detail"><small>${k}</small><span>${esc(v)}</span></div>`).join("");
  $("modalNotes").value=e.notes||"";
  const modalImages=$("modalImageWrap");modalImages.innerHTML="";
  const imageList=e.imagesDataUrls?.length?e.imagesDataUrls:(e.imageDataUrl?[e.imageDataUrl]:[]);
  imageList.forEach((src,index)=>modalImages.append(mediaElement(src,`صورة ${index+1} للمنشور`)));
  modalImages.classList.toggle("hidden",imageList.length===0);
  updateStatusButtons();$("eventModal").classList.remove("hidden");
}
function updateStatusButtons(){[["markDone","done"],["markNotDone","notdone"],["markPending","pending"]].forEach(([id,s])=>$(id).classList.toggle("selected",selectedStatus===s));}
$("markDone").onclick=()=>{selectedStatus="done";updateStatusButtons();};
$("markNotDone").onclick=()=>{selectedStatus="notdone";updateStatusButtons();};
$("markPending").onclick=()=>{selectedStatus="pending";updateStatusButtons();};
$("saveResult").onclick=async()=>{const e=events.find(x=>x.id===selectedId);if(!e)return;try{const s=await api(`/api/events/${encodeURIComponent(selectedId)}`,{method:"PUT",body:JSON.stringify({...e,status:selectedStatus,notes:$("modalNotes").value.trim()})});events=events.map(x=>x.id===s.id?s:x);renderAll();openModal(selectedId)}catch(err){alert("تعذر حفظ النتيجة: "+err.message)}};
function closeModal(){$("eventModal").classList.add("hidden");}
$("closeModal").onclick=closeModal;
$("eventModal").addEventListener("click",e=>{if(e.target===$("eventModal"))closeModal();});
$("editEvent").onclick=()=>{const e=events.find(x=>x.id===selectedId);if(!e)return;closeModal();resetForm(e);showView("add");};
$("deleteEvent").onclick=async()=>{const e=events.find(x=>x.id===selectedId);if(!e)return;if(confirm(`هل تريد حذف "${e.name}"؟`)){try{await api(`/api/events/${encodeURIComponent(selectedId)}`,{method:"DELETE"});events=events.filter(x=>x.id!==selectedId);renderAll();closeModal()}catch(err){alert("تعذر حذف المنشور: "+err.message)}}};
$("pdfEvent").onclick=()=>makePdf(events.find(e=>e.id===selectedId));
// إنشاء تقرير واحد شامل بجميع المنشورات، وليس المنشور المفتوح فقط.
function makeAllEventsPdf(items){
  if (!items || items.length === 0) {
    alert("لا توجد منشورات لإنشاء التقرير.");
    return;
  }

  const ordered = [...items].sort((a,b) => (a.startDate || "").localeCompare(b.startDate || ""));
  const resultLabel = s => ({done:"تمت بنجاح",notdone:"لم تتم",pending:"بانتظار التقييم"}[s] || "بانتظار التقييم");
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    alert("المتصفح منع فتح نافذة التقرير. اسمح بالنوافذ المنبثقة للموقع ثم حاول مرة أخرى.");
    return;
  }

  const rows = ordered.map((e, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="name">${esc(e.name || "—")}</td>
      <td>${esc(e.type || "—")}</td>
      <td>${esc(dateText(e.startDate))}</td>
      <td><span class="status ${esc(e.status || "pending")}">${esc(resultLabel(e.status))}</span></td>
      <td>${esc(e.organizer || "—")}</td>
      <td>${esc(e.notes || "—")}</td>
    </tr>`).join("");

  const done = ordered.filter(e=>e.status==="done").length;
  const notDone = ordered.filter(e=>e.status==="notdone").length;
  const pending = ordered.length - done - notDone;

  reportWindow.document.open();
  reportWindow.document.write(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>تقرير جميع المنشورات والمبادرات</title>
<style>
@page{size:A4 landscape;margin:12mm}
*{box-sizing:border-box}
body{font-family:Tahoma,Arial,sans-serif;direction:rtl;text-align:right;color:#203449;margin:0;background:#fff;font-size:11px;line-height:1.7}
header{background:#102c46;color:#fff;padding:18px 22px;border-radius:8px}
header h1{font-size:21px;margin:0 0 4px}
header p{font-size:11px;margin:0;color:#dce8f2}
.summary{display:flex;gap:10px;margin:16px 0}
.summary div{flex:1;background:#f1f6fa;border:1px solid #e1eaf2;border-radius:7px;padding:9px 12px}
.summary strong{display:block;font-size:18px;color:#173e5d}
.summary span{color:#61778b}
h2{font-size:15px;color:#173e5d;margin:15px 0 8px}
table{width:100%;border-collapse:collapse;table-layout:fixed}
th,td{padding:8px 7px;border:1px solid #dce5ed;vertical-align:top;overflow-wrap:anywhere}
th{background:#edf3f8;color:#405a70;font-weight:700}
tbody tr:nth-child(even){background:#fafcfe}
td:first-child{width:4%;text-align:center}
.name{font-weight:700}
.status{display:inline-block;border-radius:12px;padding:2px 7px;white-space:nowrap}
.status.done{background:#e5f7ef;color:#138658}
.status.notdone{background:#fff0f0;color:#c43d45}
.status.pending{background:#fff5df;color:#a87712}
footer{margin-top:14px;border-top:1px solid #dce5ed;padding-top:8px;color:#718397;font-size:9px}
.actions{margin:16px 0;display:flex;gap:8px}
button{border:0;border-radius:6px;padding:9px 15px;background:#2878e5;color:#fff;font:700 12px Tahoma,Arial,sans-serif;cursor:pointer}
@media print{
 .actions{display:none}
 header,th,.summary div{print-color-adjust:exact;-webkit-print-color-adjust:exact}
}
</style>
</head>
<body>
<header><h1>تقرير جميع المنشورات والمبادرات</h1><p>نظام إدارة المنشورات والمبادرات</p></header>
<section class="summary">
  <div><strong>${ordered.length}</strong><span>إجمالي المنشورات</span></div>
  <div><strong>${done}</strong><span>تمت بنجاح</span></div>
  <div><strong>${notDone}</strong><span>لم تتم</span></div>
  <div><strong>${pending}</strong><span>بانتظار التقييم</span></div>
</section>
<h2>قائمة المنشورات والمبادرات</h2>
<table>
<thead><tr><th>م</th><th>اسم المنشور</th><th>النوع</th><th>التاريخ</th><th>النتيجة</th><th>الجهة المنظمة</th><th>ملاحظات النتيجة</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<footer>تاريخ إنشاء التقرير: ${new Date().toLocaleDateString("ar-EG")} — عدد السجلات في التقرير: ${ordered.length} — تم إنشاء هذا التقرير إلكترونيًا.</footer>
<div class="actions"><button onclick="window.print()">طباعة / حفظ كـ PDF</button><button onclick="window.close()">إغلاق</button></div>
<script>window.onload=()=>setTimeout(()=>window.print(),350);<\/script>
</body></html>`);
  reportWindow.document.close();
}


function makePdf(e){
  if(!e){alert("لم يتم العثور على المنشور.");return;}
  // Use a real HTML document and the browser's Print / Save as PDF.
  // This preserves Arabic RTL text and shaping, unlike jsPDF's default fonts.
  const safe = value => esc(value || "—");
  const resultLabel = {done:"تمت بنجاح ✓",notdone:"لم تتم ✕",pending:"بانتظار التقييم"}[e.status] || "بانتظار التقييم";
  const rows = [
    ["اسم المنشور / المبادرة", e.name],
    ["نوع النشاط", e.type],
    ["تاريخ النشر", dateText(e.startDate)],
    ...(e.endDate && e.endDate !== e.startDate ? [["تاريخ النهاية", dateText(e.endDate)]] : []),
    ["وقت البداية", e.startTime],
    ["وقت النهاية", e.endTime],
    ["الموقع", e.location],
    ["الجهة المنظمة", e.organizer],
    ["المسؤول عن المنشور", e.owner],
    ["الفئة المستهدفة", e.audience],
    ["حالة التنفيذ", resultLabel],
    ["وصف المنشور", e.description],
    ["ملاحظات النتيجة", e.notes]
  ].filter(([label, value]) => value || label === "حالة التنفيذ");
  const reportWindow = window.open("", "_blank");
  if(!reportWindow){
    alert("المتصفح منع فتح نافذة التقرير. اسمح بالنوافذ المنبثقة للموقع ثم حاول مرة أخرى.");
    return;
  }
  reportWindow.document.open();
  reportWindow.document.write(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>تقرير منشور - ${safe(e.name)}</title>
<style>
@page{size:A4;margin:16mm}
*{box-sizing:border-box}
body{font-family:Tahoma,Arial,sans-serif;direction:rtl;text-align:right;color:#203449;margin:0;background:#fff;font-size:13px;line-height:1.8}
header{background:#102c46;color:#fff;padding:22px 25px;border-radius:8px 8px 0 0}
header h1{font-size:24px;margin:0 0 4px}
header p{font-size:12px;margin:0;color:#dce8f2}
main{padding:24px 0}
h2{font-size:20px;margin:0 0 17px;color:#173e5d;overflow-wrap:anywhere}
table{width:100%;border-collapse:separate;border-spacing:0 7px}
th,td{padding:11px 13px;vertical-align:top;background:#f1f6fa;overflow-wrap:anywhere}
th{width:34%;font-weight:700;color:#425a70}
tr.result th,tr.result td{background:${e.status==="done"?"#e7f7ef":e.status==="notdone"?"#fff0f0":"#fff5df"}}
footer{margin-top:20px;border-top:1px solid #dce5ed;padding-top:10px;color:#718397;font-size:10px}
.actions{margin:20px 0;display:flex;gap:10px}
button{border:0;border-radius:6px;padding:10px 16px;background:#2878e5;color:#fff;font:700 13px Tahoma,Arial,sans-serif;cursor:pointer}
@media print{.actions{display:none}header{print-color-adjust:exact;-webkit-print-color-adjust:exact}th,td{print-color-adjust:exact;-webkit-print-color-adjust:exact}body{font-size:12px}}
</style>
</head>
<body>
<header><h1>تقرير منشور / مبادرة</h1><p>نظام إدارة المنشورات والمبادرات</p></header>
<main>
<h2>${safe(e.name)}</h2>
<table><tbody>
${rows.map(([label,value])=>`<tr class="${label==="حالة التنفيذ"?"result":""}"><th>${safe(label)}</th><td>${safe(value)}</td></tr>`).join("")}
</tbody></table>
<footer>تاريخ إنشاء التقرير: ${new Date().toLocaleDateString("ar-EG")} — تم إنشاء هذا التقرير إلكترونيًا.</footer>
<div class="actions"><button onclick="window.print()">طباعة / حفظ كـ PDF</button><button onclick="window.close()">إغلاق</button></div>
</main>
<script>window.onload=()=>setTimeout(()=>window.print(),350);<\/script>
</body></html>`);
  reportWindow.document.close();
}
// Authentication gates the app; all employees share the same Supabase data.
let appStarted=false;
async function startApplication(session){
  $("loginScreen").classList.add("hidden");
  $("signedInAs").textContent=session?.user?.email||"";
  if(appStarted){await refreshEvents();return;}
  appStarted=true;
  showView(location.hash.slice(1)||"calendar");
  try{events=await api("/api/events");renderAll();}
  catch(err){console.error(err);alert("تعذر تحميل البيانات: "+err.message);}
}
function showLogin(message=""){
  $("loginScreen").classList.remove("hidden");
  $("loginError").textContent=message;
  $("loginError").classList.toggle("hidden",!message);
  $("signedInAs").textContent="";
}
$("loginForm").addEventListener("submit",async ev=>{
  ev.preventDefault(); const btn=$("loginButton"); btn.disabled=true; btn.textContent="جارٍ تسجيل الدخول…";
  try{const session=await Store.auth.signIn($("loginEmail").value,$("loginPassword").value);$("loginPassword").value="";await startApplication(session);}
  catch(err){showLogin(err.message||"تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور.");}
  finally{btn.disabled=false;btn.textContent="تسجيل الدخول";}
});
$("logoutButton").addEventListener("click",async()=>{try{await Store.auth.signOut();appStarted=false;events=[];renderAll();showLogin();}catch(err){alert("تعذر تسجيل الخروج: "+err.message);}});
(async()=>{
  if(!Store.auth.configured()){showLogin("أكمل مفتاح Supabase Publishable في js/config.js ثم أعد تحميل الصفحة.");return;}
  try{const session=await Store.auth.getSession();if(session)await startApplication(session);else showLogin();}
  catch(err){showLogin(err.message||"تعذر الاتصال بخدمة تسجيل الدخول.");}
  Store.auth.onChange(async session=>{if(session)await startApplication(session);else{appStarted=false;events=[];renderAll();showLogin();}});
})();
async function refreshEvents(){
  if(!appStarted||document.hidden||draggedId||pickedPoolId||!$("eventModal").classList.contains("hidden"))return;
  try{events=await api("/api/events");renderAll();}catch(err){console.warn("Sync:",err.message);}
}
setInterval(refreshEvents,30000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshEvents();});
window.addEventListener("online",refreshEvents);
