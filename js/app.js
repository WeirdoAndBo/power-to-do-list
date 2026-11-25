/* ============================================================================
   Meine Power-Liste – die gesamte App-Logik in einer Datei.
   Eine Übersicht für Menschen, die hier etwas ändern wollen, steht in DEVELOPING.md.

   ACHTUNG, Namen im Code ≠ Namen in der App:
     Code „cat“  / S.cats      = in der App „Bereich“   (z. B. Arbeit, Privat)
     Code „sub“, „area“         = in der App „Kategorie“ (z. B. Akquise, Finanzen)
     Code „needs“               = Vorher-To-Do „geht sonst nicht“ (sperrt)
     Code „soft“                = Vorher-To-Do „würde nur helfen“ (sperrt nicht)
     Code-Ansicht „jetzt“       = Tab „Machbar“, „baum“ = Tab „Übersicht“
     Hinweis: sub(id) ist dagegen eine Funktion (alle Vorher-To-Dos eines To-Dos), keine Kategorie.

   Grundprinzip: Der ganze Zustand liegt im Objekt S. Jede Änderung läuft so ab:
     S verändern → save() (speichert in localStorage) → render() (baut die Ansicht neu).
   Die Ansichten sind Funktionen, die HTML als Text zurückgeben (Template-Strings).
   Texte von Nutzer*innen immer mit esc(...) einsetzen, sonst kann HTML eingeschleust werden.

   Aufbau der Datei (Abschnitte mit „----------“ markiert):
     Einstellungen & Hilfen → Laden/Speichern → Datenlogik (Graph) → Ansichten
     → Fokusmodus → Popup & Hinweis → Abläufe (Dialoge) → Datensicherung → Ereignisse → Start
   ============================================================================ */
{
/* ---------- Einstellungen & Hilfen ---------- */
const KEY='powerliste-b-v1';
// Versionen: APP_VERSION = Stand der App (siehe auch sw.js), FORMAT = Version des gespeicherten Datenformats.
// FORMAT nur erhöhen, wenn sich die Datenstruktur ändert, und dann in migrate() nachziehen.
const APP_VERSION='1.0.0';
const FORMAT=1;
const FILE_APP='power-liste';
// Farben, die beim Anlegen eines Bereichs zur Auswahl stehen.
const COLORS=['#5b8def','#e0a03a','#9b7fd1','#4fae8c','#e07a6a','#3fa3b5','#d27fb0','#8a96a3'];
// Kleine SVG-Symbole (Häkchen, Papierkorb, Menü-Punkte, Stift, Griff, Pfeil).
const TICK='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>';
const TRASH='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
const DOTS='<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
const PEN='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>';
const GRIP='<svg width="12" height="20" viewBox="0 0 12 20" fill="currentColor"><circle cx="3" cy="4" r="1.5"/><circle cx="9" cy="4" r="1.5"/><circle cx="3" cy="10" r="1.5"/><circle cx="9" cy="10" r="1.5"/><circle cx="3" cy="16" r="1.5"/><circle cx="9" cy="16" r="1.5"/></svg>';
const CHEV='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>';
// $ = ein Element per CSS-Selektor finden · esc = Text sicher in HTML einsetzen · uid = neue zufällige ID
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,9);
// Zustand nur für diese Sitzung (wird NICHT gespeichert):
//   open = auf-/zugeklappte Äste in der Übersicht · blOpen = aufgeklappte Backlog-Kästen
//   noClick = Zeitpunkt, bis zu dem Klicks ignoriert werden (direkt nach dem Ziehen)
//   S = der gesamte gespeicherte Zustand · undoSnap = Kopie von S für „Rückgängig“
//   toastT = Timer des Hinweises unten · curCol = Nummer der sichtbaren Kategorie-Spalte
const open=new Map(),blOpen=new Set();let noClick=0;
let S,undoSnap=null,toastT,curCol=0;
// sod = Mitternacht des Tages zu einem Zeitpunkt (36e5 ms = 1 Stunde, 864e5 ms = 1 Tag)
const sod=ts=>{const d=new Date(ts);d.setHours(0,0,0,0);return d.getTime()};
// Ein „Tag“ beginnt morgens um 4 Uhr, damit späte Abende noch zum Vortag zählen.
const dayStart=()=>sod(Date.now()-4*36e5)+4*36e5;
// Ist seit dem letzten Öffnen ein neuer Tag angebrochen? Dann wird „Heute“ geleert. true = es lagen noch offene To-Dos in „Heute“.
function newDay(){if(S.day===undefined)S.day=dayStart();if(S.day===dayStart())return false;const had=all().some(t=>t.today&&!t.done);all().forEach(t=>{t.today=false});S.day=dayStart();save();return had}

/* ---------- Laden, Speichern, Beispieldaten ----------
   seed() liefert die Beispieldaten beim ersten Start (und für „Beispiel wiederherstellen“).
   Gleichzeitig ist es die beste Beschreibung des Datenmodells, siehe DEVELOPING.md. */
function seed(){
 const now=Date.now();
// Ein To-Do: id, t (Titel), needs/soft (IDs der Vorher-To-Dos), done/doneAt, goal (ist ein Ziel),
// cat/area (eigener Bereich/eigene Kategorie, sonst geerbt), prio (höher = weiter oben), created,
// optional: today, todayBy (wer es nach „Heute“ mitgenommen hat), todayOrder (Reihenfolge in Heute), backlog
 const t=(id,title,o={})=>({id,t:title,needs:[],soft:[],done:false,goal:false,cat:null,prio:0,created:now,doneAt:null,...o});
 const L=[
  t('g1','Stellen anschreiben für Kundenakquise',{goal:true,cat:'arbeit',area:'akq',needs:['a','b']}),
  t('a','Liste an Stellen anlegen',{needs:['c','desk']}),
  t('c','Ort festlegen, wo die Liste entsteht',{today:true}),
  t('b','Text überlegen',{soft:['ex']}),
  t('ex','Zwei Beispiel-Anschreiben ansehen'),
  t('g2','Newsletter starten',{goal:true,cat:'arbeit',area:'akq',needs:['n1'],backlog:true}),
  t('n1','Thema der ersten Ausgabe festlegen',{backlog:true}),
  t('g5','Rechnungen für November schreiben',{goal:true,cat:'arbeit',area:'fin',needs:['r1']}),
  t('r1','Stunden aus dem Kalender zusammenzählen'),
  t('g6','Steuerunterlagen 2025 sortieren',{goal:true,cat:'arbeit',area:'fin',backlog:true}),
  t('g8','Mails auf null bringen',{goal:true,cat:'arbeit',area:'orga'}),
  t('g7','Ablagesystem für Projekte überlegen',{goal:true,cat:'arbeit',area:'orga',backlog:true}),
  t('desk','Schreibtisch freiräumen'),
  t('g3','Keller entrümpeln',{goal:true,cat:'privat',area:'haus',needs:['k1','k2']}),
  t('k1','Sperrmüll-Termin holen',{today:true}),t('k2','Kisten besorgen',{done:true,doneAt:now-864e5}),
  t('g9','Zahnarzttermin ausmachen',{goal:true,cat:'privat',area:'ges'}),
  t('g10','Neue Laufschuhe aussuchen',{goal:true,cat:'privat',area:'ges',backlog:true}),
  t('g4','Ein Bild malen',{goal:true,cat:'hobby',needs:['desk','f1']}),
  t('f1','Farben besorgen'),
  t('g11','Gitarre wieder stimmen',{goal:true,cat:'hobby',backlog:true})];
 const tasks={};L.forEach(x=>tasks[x.id]=x);
 let anim=true;try{anim=!matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}
 return{name:'Meine Power-Liste',tasks,cats:[{id:'arbeit',name:'Arbeit',color:'#5b8def',subs:[{id:'akq',name:'Akquise'},{id:'fin',name:'Finanzen'},{id:'orga',name:'Orga'}]},{id:'privat',name:'Privat',color:'#e0a03a',subs:[{id:'haus',name:'Haushalt'},{id:'ges',name:'Gesundheit'}]},{id:'hobby',name:'Hobby',color:'#9b7fd1',subs:[]}],openCat:'arbeit',view:'jetzt',inbox:[],anim,day:dayStart(),format:FORMAT};
}
// Bringt gespeicherte oder importierte Daten auf das aktuelle Format. Daten ohne Formatnummer stammen aus dem Prototyp (= Format 1).
function migrate(o){o.inbox=o.inbox||[];o.cats.forEach(c=>c.subs=c.subs||[]);if(o.openCat===undefined)o.openCat=o.cats[0]?o.cats[0].id:null;
 Object.values(o.tasks).forEach(t=>{t.needs=t.needs||[];t.soft=t.soft||[]});o.format=FORMAT;return o}
// load: liest S aus localStorage, sonst Beispieldaten. save: schreibt S zurück. Fehler (z. B. voller Speicher) werden still ignoriert.
function load(){try{const r=localStorage.getItem(KEY);if(r){const o=JSON.parse(r);if(o&&o.tasks&&o.cats)return migrate(o)}}catch(e){}return seed()}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
// snap: Momentaufnahme von S als Text, für „Rückgängig“ (undoSnap)
const snap=()=>JSON.stringify(S);

/* ---------- Datenlogik (Graph) ----------
   needs = geht ohne das nicht (sperrt), soft = hilft nur. Ein Schritt kann zu mehreren To-Dos gehören. */
// Kurznamen: T(id) = To-Do holen · C(id) = Bereich holen · all() = alle To-Dos als Liste
// openHard(t) = noch offene „geht sonst nicht“-Vorher-To-Dos · parentsAll/parentsHard(id) = To-Dos, vor denen id kommt
const T=id=>S.tasks[id];
const C=id=>S.cats.find(c=>c.id===id);
const all=()=>Object.values(S.tasks);
const openHard=t=>t.needs.filter(n=>T(n)&&!T(n).done);
const parentsAll=id=>all().filter(p=>p.needs.includes(id)||p.soft.includes(id));
const parentsHard=id=>all().filter(p=>p.needs.includes(id));
// goalsOf: alle Ziele, zu denen ein To-Do (auch über mehrere Ebenen) gehört. sub: das To-Do selbst plus alle Vorher-To-Dos, alle Ebenen.
function goalsOf(id){const out=[],seen=new Set,st=[id];while(st.length){const x=st.pop();if(seen.has(x)||!T(x))continue;seen.add(x);if(T(x).goal&&x!==id)out.push(T(x));parentsAll(x).forEach(p=>st.push(p.id))}return out}
function sub(id){const seen=new Set,st=[id];while(st.length){const x=st.pop();if(seen.has(x)||!T(x))continue;seen.add(x);st.push(...T(x).needs,...T(x).soft)}return seen}
// Version B: Eine eigene Bereich gewinnt. Ohne eigene erbt das To-Do Bereich und Kategorie von seinen Zielen.
// catsOf: in welchem Bereich (oder welchen Bereichen) ein To-Do angezeigt wird
function catsOf(t){if(t.cat&&C(t.cat))return[t.cat];const s=new Set;goalsOf(t.id).forEach(g=>{if(g.cat&&C(g.cat))s.add(g.cat)});return[...s]}
// areaIn: in welcher Kategorie eines Bereichs ein To-Do angezeigt wird (eigene, sonst vom Ziel geerbt, sonst die erste)
function areaIn(t,cid,seen=new Set()){const c=C(cid);if(!c||!c.subs.length)return'';if(seen.has(t.id))return c.subs[0].id;seen.add(t.id);
 if(t.cat===cid&&c.subs.some(x=>x.id===t.area))return t.area;
 if(t.cat!==cid)for(const p of parentsAll(t.id))if(catsOf(p).includes(cid))return areaIn(p,cid,seen);
 return c.subs[0].id}
// Orte werden als Text „bereichId|kategorieId“ weitergereicht, z. B. „arbeit|akq“. Leer = „Ohne Bereich“.
const subsOf=c=>c&&c.subs&&c.subs.length?c.subs:[{id:'',name:c?c.name:''}];
const places=()=>[...S.cats.flatMap(c=>c.subs.length?c.subs.map(x=>({v:c.id+'|'+x.id,l:c.name+' · '+x.name})):[{v:c.id+'|',l:c.name}]),{v:'|',l:'Ohne Bereich'}];
const placeOf=t=>{const c=catsOf(t)[0]||'';return c+'|'+(c?areaIn(t,c):'')};
const placeName=(cid,area)=>{const c=C(cid);if(!c)return'Ohne Bereich';const x=c.subs.find(y=>y.id===area);return c.name+(x?' · '+x.name:'')};
// Wohin: erst Bereich, dann Kategorie (nur die des gewählten Bereichs; ohne Kategorien entfällt die zweite Auswahl)
const katOpts=(cid,sel)=>{const c=C(cid);return c?c.subs.map(x=>`<option value="${x.id}"${x.id===sel?' selected':''}>${esc(x.name)}</option>`).join(''):''};
function placeSel(sel){const[cid,area]=sel.split('|');const c=C(cid);
 return`<div class="pick"><input type="hidden" name="place" value="${esc(sel)}"><label class="lbl">Bereich</label><select class="field" data-pick="cat">${S.cats.map(x=>`<option value="${x.id}"${x.id===cid?' selected':''}>${esc(x.name)}</option>`).join('')}<option value=""${!c?' selected':''}>Ohne Bereich</option></select>
 <div class="pkat"${c&&c.subs.length?'':' hidden'}><label class="lbl">Kategorie</label><select class="field" data-pick="kat">${katOpts(cid,area)}</select></div></div>`}
document.addEventListener('change',e=>{const el=e.target;if(el.matches&&el.matches('#modal [name=what]')){const f=$('#modal [name=text]');if(f)f.placeholder=el.value==='goal'?'Was willst du erreichen? z. B. Neue Kund*innen gewinnen':'Was ist zu tun?';return}if(!el.matches||!el.matches('[data-pick]'))return;const w=el.closest('.pick'),cs=w.querySelector('[data-pick=cat]'),ks=w.querySelector('[data-pick=kat]');
 if(el===cs){ks.innerHTML=katOpts(cs.value,'');w.querySelector('.pkat').hidden=!ks.options.length}
 w.querySelector('[name=place]').value=cs.value+'|'+(ks.options.length?ks.value:'')});
// curPlace: der gerade sichtbare Ort, als Vorbelegung für „Neues To-Do“
function curPlace(){const cid=S.openCat??(S.cats[0]?S.cats[0].id:'');const c=C(cid);const x=c&&c.subs.length?c.subs[Math.min(curCol,c.subs.length-1)]:null;return(cid||'')+'|'+(x?x.id:'')}
// colorOf: Farbe eines To-Dos = Farbe seines Bereichs (grau ohne Bereich)
const colorOf=t=>{const c=C(catsOf(t)[0]);return c?c.color:'#8a96a3'};
// mk: legt ein neues To-Do an und gibt es zurück (speichert noch nicht)
function mk(title,o={}){const t={id:uid(),t:title,needs:[],soft:[],done:false,goal:false,cat:null,prio:0,created:Date.now(),doneAt:null,...o};S.tasks[t.id]=t;return t}
// progress: Anteil erledigter Vorher-To-Dos eines Ziels in Prozent (Balken in der Übersicht)
const progress=g=>{const ids=[...sub(g.id)].filter(i=>i!==g.id);const d=ids.filter(i=>T(i).done).length;return ids.length?Math.round(d/ids.length*100):0};
// canPrecede/canFollow: welche To-Dos als Vorher-To-Do bzw. Ziel verknüpft werden dürfen, ohne einen Kreis zu bilden
const canPrecede=pid=>{const p=T(pid);return all().filter(x=>!x.done&&x.id!==pid&&!sub(x.id).has(pid)&&!p.needs.includes(x.id)&&!p.soft.includes(x.id))};
const canFollow=id=>all().filter(x=>!x.done&&x.id!==id&&!sub(id).has(x.id)&&!x.needs.includes(id)&&!x.soft.includes(id));
// columns: alle Bereiche, dazu „Ohne Bereich“, falls es To-Dos ohne Bereich gibt. inCol: gehört ein To-Do in diesen Bereich/diese Kategorie?
const columns=()=>{const cols=S.cats.map(c=>({...c}));if(all().some(t=>!catsOf(t).length))cols.push({id:'',name:'Ohne Bereich',color:'#8a96a3',subs:[]});return cols};
const inCol=(t,cid,area='')=>cid?catsOf(t).includes(cid)&&(!area||areaIn(t,cid)===area):!catsOf(t).length;
// byPrio: Sortierung – höhere prio zuerst, sonst das ältere zuerst
const byPrio=(a,b)=>b.prio-a.prio||a.created-b.created;
const goalHint=t=>{const g=goalsOf(t.id);return t.goal?'Das ist ein Ziel':g.length?'Ziel: '+g.map(x=>esc(x.t)).join(' · '):''};
// alle Wege vom To-Do hoch bis zu einem Ziel (bei geteilten Schritten mehrere)
function chains(id,seen=new Set()){if(seen.has(id))return[];const s2=new Set(seen).add(id);const t=T(id),ps=parentsAll(id);
 if(!ps.length||(t.goal&&id!==[...seen][0]&&seen.size))return[[id]];
 return ps.flatMap(p=>chains(p.id,s2).map(c=>[id,...c]))}
const chainOpen=new Set();
// Heute an/aus. Beim Anhaken kommen alle offenen Vorher-To-Dos (alle Ebenen) mit; sie merken sich, wer sie mitgenommen hat.
// Beim Abhaken gehen nur die mit raus, die mitgenommen wurden – selbst markierte bleiben.
const nextOrder=()=>Math.max(0,...all().map(x=>x.todayOrder||0))+1;
function setToday(id,on){const t=T(id);let n=0;if(on&&!t.today)t.todayOrder=nextOrder();t.today=on;t.todayBy=null;if(on)t.backlog=false;
 sub(id).forEach(x=>{if(x===id)return;const k=T(x);if(k.done)return;
  if(on&&!k.today){k.today=true;k.todayBy=id;k.todayOrder=nextOrder();k.backlog=false;n++}
  else if(!on&&k.today&&k.todayBy===id){k.today=false;k.todayBy=null;n++}});
 return n}
function chainBox(t){
 const hint=goalHint(t);if(!hint)return'';if(t.goal)return`<p class="goal">${hint}</p>`;
 const cs=chains(t.id).slice(0,6);
 return`<details class="chain" data-id="${t.id}"${chainOpen.has(t.id)?' open':''}><summary>${hint}</summary>${cs.map(c=>`<ol>${c.map((id,i)=>`<li class="${i===0?'me':''}${T(id).goal?' g':''}">${esc(T(id).t)}</li>`).join('')}</ol>`).join('')}</details>`}
const optList=(L,sel)=>L.map(o=>`<option value="${o.id}"${o.id===sel?' selected':''}>${o.goal?'◆ ':''}${esc(o.t)}</option>`).join('');

/* ---------- Ansichten ---------- */
// Runder Abhak-Knopf. c = Farbe. Jede Ansicht baut ihr HTML aus solchen kleinen Funktionen zusammen.
const checkBtn=(t,c)=>`<button class="check" role="checkbox" aria-checked="${!!t.done}" aria-label="${t.done?'Wieder öffnen':'Abhaken'}: ${esc(t.t)}" data-act="check" data-id="${t.id}" style="--c:${c}">${TICK}</button>`;
// Karte: Kopf mit Griff, Heute-Schalter, Bearbeiten/Verschieben/Löschen. Darunter Häkchen + Titel, Ziel-Kette, dann die Frage.
function card(t,c,o={}){
 const grip=o.grip?`<button class="cgrip" data-act="grip" data-id="${t.id}" aria-label="${esc(t.t)} verschieben (Pfeiltasten hoch/runter)" title="Ziehen, um die Reihenfolge zu ändern">${GRIP}</button>`
  :o.move?`<button class="cgrip mgrip" data-act="mgrip" data-id="${t.id}" aria-label="${esc(t.t)} verschieben" title="Ziehen: ins Backlog, in eine andere Kategorie oder einen anderen Bereich">${GRIP}</button>`:'';
 return`<article class="card" data-act="focus" data-id="${t.id}" style="--c:${c}" tabindex="0" aria-label="${esc(t.t)} – im Fokusmodus öffnen">
 <div class="chead">${grip}${todaySw(t)}<span class="sp"></span>
  <button class="hbtn" data-act="edit" data-id="${t.id}" aria-label="${esc(t.t)} bearbeiten" title="Bearbeiten">${PEN}</button>
  ${o.move?`<button class="hbtn" data-act="move" data-id="${t.id}" aria-label="${esc(t.t)}: Backlog oder verschieben" title="Backlog / Verschieben nach …">${DOTS}</button>`:''}
  <button class="hbtn" data-act="del" data-id="${t.id}" aria-label="${esc(t.t)} löschen" title="Löschen">${TRASH}</button></div>
 <div class="cbody">${checkBtn(t,c)}<div class="ctext"><h3>${esc(t.t)}</h3>${chainBox(t)}
 ${openHard(t).length?`<p class="wait">Erst noch: ${openHard(t).map(n=>esc(T(n).t)).join(', ')}</p>`:''}</div></div>
 <button class="ask" data-act="block" data-id="${t.id}"><b aria-hidden="true">+</b> ${t.goal?'To-Do':'Vorher-To-Do'}</button></article>`}
// Schalter „Heute“ auf Karten und (klein, mini) in der Übersicht
const todaySw=(t,mini)=>`<button class="today sw${mini?' tmini':''}" role="switch" aria-checked="${!!t.today}" data-act="today" data-id="${t.id}" aria-label="${esc(t.t)}: für heute" title="Für heute – mit allen Vorher-To-Dos"><i></i><span>Heute</span></button>`;
// Aufklappbarer Kasten „Erledigt · N“
function doneBox(L,c){return L.length?`<details class="done"><summary>Erledigt · ${L.length}</summary>${L.map(t=>`<div class="drow">${checkBtn(t,c)}<span>${esc(t.t)}</span><button class="mini del" data-act="del" data-id="${t.id}" aria-label="${esc(t.t)} löschen">${TRASH}</button></div>`).join('')}</details>`:''}
// Tab „Machbar“: eine Kategorie-Spalte mit Zeitnah (nicht blockiert), Backlog und Erledigt
function colJetzt(col,sb){
 const inc=t=>inCol(t,col.id,sb.id);
 const L=all().filter(t=>!t.done&&!t.backlog&&!openHard(t).length&&inc(t)).sort(byPrio);
 const BA=all().filter(t=>!t.done&&t.backlog&&inc(t));
 const B=BA.filter(t=>!parentsAll(t.id).some(p=>p.backlog&&!p.done&&inc(p))).sort(byPrio);
 const D=all().filter(t=>t.done&&inc(t)).sort((a,b)=>b.doneAt-a.doneAt);
 const z=`data-drop="zone" data-cat="${col.id}" data-area="${sb.id}"`,k=col.id+'|'+sb.id;
 return`<p class="zlabel">Zeitnah</p><div class="list zone" ${z} data-bl="0">${L.length?L.map(t=>card(t,col.color,{move:true})).join(''):`<div class="empty" style="--c:${col.color}">Hier ist gerade nichts zu tun.</div>`}</div>
 <details class="bl zone" ${z} data-bl="1" data-k="${esc(k)}"${blOpen.has(k)?' open':''}><summary>Backlog · ${BA.length}</summary>${B.length?B.map(t=>brow(t,col.color)).join(''):'<p class="bempty">Leer. Zieh To-Dos hierher, die gerade nicht dran sind.</p>'}</details>${doneBox(D,col.color)}`}
// Eine Zeile im Backlog-Kasten
function brow(t,c){const n=[...sub(t.id)].filter(x=>x!==t.id&&!T(x).done).length;
 return`<div class="brow" data-id="${t.id}" style="--c:${c}"><span class="grip mgrip" data-id="${t.id}" title="Ziehen: nach Zeitnah, in eine andere Kategorie oder einen anderen Bereich">${GRIP}</span><button class="t" data-act="edit" data-id="${t.id}">${esc(t.t)}${n?`<small>mit ${n} Vorher-To-Do${n>1?'s':''}</small>`:''}</button><button class="mini" data-act="tozeit" data-id="${t.id}" title="Nach Zeitnah holen" aria-label="${esc(t.t)} nach Zeitnah holen">↑</button><button class="mini" data-act="move" data-id="${t.id}" aria-label="${esc(t.t)} verschieben" title="Verschieben nach …">${DOTS}</button></div>`}
// Tab „Übersicht“: ein Knoten im Baum, ruft sich für seine Vorher-To-Dos selbst auf. path = Weg im Baum (für auf/zu).
function node(t,c,path,lvl,viaSoft){
 const kids=[...t.needs.map(n=>[T(n),0]),...t.soft.map(n=>[T(n),1])].filter(k=>k[0]).sort((a,b)=>a[0].done-b[0].done);
 const key=path+'/'+t.id,isOpen=open.has(key)?open.get(key):lvl>0;
 return`<li><div class="row${t.done?' isdone':''}${t.backlog&&!t.done?' inbl':''}">${checkBtn(t,c)}<button class="t" data-act="edit" data-id="${t.id}">${esc(t.t)}${t.backlog&&!t.done?' <span class="tag bl" title="Liegt im Backlog">Backlog</span>':''}</button>${viaSoft?'<span class="tag">hilft</span>':''}
 ${t.done?'':`${todaySw(t,1)}`}<button class="mini" data-act="addsub" data-id="${t.id}" aria-label="Vorher-To-Do für ${esc(t.t)} hinzufügen" title="Hier etwas davor einfügen">+</button><button class="mini del" data-act="del" data-id="${t.id}" aria-label="${esc(t.t)} löschen" title="Löschen">${TRASH}</button>
 ${kids.length?`<button class="mini chev" data-act="tog" data-k="${esc(key)}" data-l="${lvl}" aria-expanded="${isOpen}" aria-label="${isOpen?'Zuklappen':(lvl===0?'Alles aufklappen':'Aufklappen')}" title="${lvl===0?(isOpen?'Alles zuklappen':'Alles aufklappen'):''}">${CHEV}</button>`:'<span class="mini"></span>'}</div>
 ${lvl===0&&!t.done?`<div class="pbar" aria-hidden="true"><i style="width:${progress(t)}%"></i></div>`:''}
 ${kids.length&&isOpen?`<ul>${kids.map(([k,s])=>node(k,c,key,lvl+1,s)).join('')}</ul>`:''}</li>`}
// Tab „Übersicht“: eine Kategorie-Spalte mit den Zielen als Wurzeln
function colBaum(col,sb){
 const roots=all().filter(t=>(t.goal||!parentsAll(t.id).length)&&(col.id?t.cat===col.id:!t.cat||!C(t.cat))&&(!sb.id||areaIn(t,col.id)===sb.id));
 const L=roots.filter(t=>!t.done&&!t.backlog).sort(byPrio),B=roots.filter(t=>!t.done&&t.backlog).sort(byPrio),D=roots.filter(t=>t.done);
 return`<p class="zlabel">Zeitnah</p>${L.length?`<ul class="tree">${L.map(t=>node(t,col.color,col.id,0)).join('')}</ul>`:`<div class="empty" style="--c:${col.color}">${B.length?'Gerade nichts zeitnah.':`Noch kein Ziel in ${esc(sb.name||col.name)}.`}</div>`}
 ${B.length?`<p class="zlabel blhead">Backlog · ${B.length}</p><ul class="tree bltree">${B.map(t=>node(t,col.color,col.id,0)).join('')}</ul>`:''}${D.length?`<details class="done"><summary>Erreichte Ziele · ${D.length}</summary><ul class="tree">${D.map(t=>node(t,col.color,col.id,1)).join('')}</ul></details>`:''}`}

// Tab „Heute“: freie To-Dos (ziehbar), „Danach dran“ (noch blockiert) und „Heute geschafft“
function viewHeute(){
 const L=all().filter(t=>t.today&&!t.done&&!openHard(t).length).sort((a,b)=>(a.todayOrder??1e12)-(b.todayOrder??1e12)||byPrio(a,b));
 const W=all().filter(t=>t.today&&!t.done&&openHard(t).length).sort(byPrio);
 const D=all().filter(t=>t.today&&t.done&&t.doneAt>=dayStart()).sort((a,b)=>b.doneAt-a.doneAt);
 return`<section class="col daywrap" style="--c:#8a96a3"><p class="dayhead">${new Date().toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'})}</p>
 <div class="list" id="daylist">${L.length?L.map(t=>card(t,colorOf(t),{grip:true})).join(''):`<div class="empty">${W.length?'Gerade ist nichts frei.':'Noch nichts für heute.<br>Hake in „Machbar“ bei einer Karte „Heute“ an.'}</div>`}</div>
 ${W.length?`<details class="done"><summary>Danach dran · ${W.length}</summary>${W.map(t=>`<div class="drow wrow"><span>${esc(t.t)}<small>erst: ${openHard(t).map(n=>esc(T(n).t)).join(', ')}</small></span></div>`).join('')}</details>`:''}
 ${D.length?`<details class="done"><summary>Heute geschafft · ${D.length}</summary>${D.map(t=>`<div class="drow">${checkBtn(t,colorOf(t))}<span>${esc(t.t)}</span></div>`).join('')}</details>`:''}</section>`}
// Bereich zugeklappt (catBar) und aufgeklappt mit Kategorie-Registern und Spalten (catOpen)
function counts(c){const ts=all().filter(t=>!t.done&&inCol(t,c.id));const z=ts.filter(t=>!t.backlog).length,b=ts.length-z;return`${z} zeitnah${b?` · ${b} im Backlog`:''}`}
function catBar(c){return`<button class="catbar" data-act="opencat" data-cat="${c.id}" data-drop="cat" style="--c:${c.color}" aria-expanded="false"><b>${esc(c.name)}</b><small>${counts(c)}</small>${CHEV}</button>`}
function catOpen(c){const subs=subsOf(c);
 return`<section class="cat open" style="--c:${c.color}" aria-label="${esc(c.name)}">
 <div class="cathead"><button class="ct" data-act="opencat" data-cat="${c.id}" aria-expanded="true" title="Zuklappen"><i></i>${esc(c.name)} <small>${counts(c)}</small>${CHEV}</button>${c.id?`<button class="iconbtn" data-act="editcat" data-id="${c.id}" aria-label="Bereich ${esc(c.name)} bearbeiten">${PEN}</button>`:''}</div>
 ${c.id?`<nav class="tabs subtabs" aria-label="Kategorien von ${esc(c.name)}">${c.subs.map((x,i)=>`<button class="tab" data-act="gocol" data-i="${i}" data-drop="zone" data-cat="${c.id}" data-area="${x.id}" style="--c:${c.color}" aria-current="${i===curCol}"><i></i>${esc(x.name)}</button>`).join('')}<button class="tab new" data-act="newsub" data-id="${c.id}">+ Kategorie</button></nav>`:''}
 <div class="cols" id="cols">${subs.map(x=>`<section class="col" aria-label="${esc(x.name)}">${c.subs.length?`<div class="colhead"><h2>${esc(x.name)}</h2><button class="iconbtn" data-act="editsub" data-id="${c.id}" data-s="${x.id}" aria-label="Kategorie ${esc(x.name)} umbenennen">${PEN}</button></div>`:''}${S.view==='baum'?colBaum(c,x):colJetzt(c,x)}</section>`).join('')}</div></section>`}
let lastCat;
// render: baut die ganze Seite aus S neu auf. Nach jeder Änderung an S aufrufen (nach save()).
function render(){
 document.body.classList.toggle('noanim',!S.anim);
 const nm=$('#name');if(document.activeElement!==nm)nm.value=S.name;document.title=S.name||'Meine Liste';
 document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===S.view));
 $('#inboxSlot').innerHTML=S.inbox.length?`<button class="inbox" data-act="inbox">Später einsortieren · <b>${S.inbox.length}</b></button>`:'';
 if(S.view==='heute'){$('#acc').innerHTML=viewHeute();lastCat=undefined;if(!$('#focus').hidden)renderFocus();return}
 const cols=columns();if(S.openCat!==null&&!cols.some(c=>c.id===S.openCat))S.openCat=cols[0]?cols[0].id:null;
 const oc=cols.find(c=>c.id===S.openCat);curCol=Math.max(0,Math.min(curCol,subsOf(oc).length-1));
 const x=$('#cols')?.scrollLeft||0;
 $('#acc').innerHTML=cols.map(c=>c===oc?catOpen(c):catBar(c)).join('')+`<button class="catbar new" data-act="newcat">+ Bereich</button>`;
 const el=$('#cols');if(el){if(lastCat===S.openCat)el.scrollLeft=x;else if(curCol){const c=el.children[curCol];if(c)el.scrollLeft=c.offsetLeft-el.offsetLeft}}lastCat=S.openCat;moreCols();
 if(!$('#focus').hidden)renderFocus();
}
// moreCols: blendet die Kanten der Spalten aus, wenn man seitlich weiterwischen kann
function moreCols(){const el=$('#cols');if(!el)return;const c=el.closest('.cat'),over=el.scrollWidth>el.clientWidth+4;c.classList.toggle('ovf',over);c.classList.toggle('ovf-r',over&&el.scrollLeft<el.scrollWidth-el.clientWidth-4);c.classList.toggle('ovf-l',over&&el.scrollLeft>4)}
addEventListener('resize',moreCols);
// Beim Wischen durch die Spalten das passende Kategorie-Register markieren (14 = Abstand zwischen Spalten in px, siehe .cat .cols in app.css)
document.addEventListener('scroll',e=>{const el=e.target;if(!el||el.id!=='cols')return;moreCols();const w=el.firstElementChild?.offsetWidth||1;const i=Math.round(el.scrollLeft/(w+14));if(i!==curCol){curCol=i;document.querySelectorAll('.tab[data-i]').forEach(b=>b.setAttribute('aria-current',+b.dataset.i===i))}},{capture:true,passive:true});
// Desktop: die zuletzt angetippte Spalte gilt als aktuelle Kategorie (z. B. als Vorbelegung bei „Neues To-Do“)
document.addEventListener('pointerdown',e=>{const c=e.target.closest&&e.target.closest('#cols > .col');if(c)curCol=[...c.parentElement.children].indexOf(c)},true);
// goCol: zu Kategorie-Spalte Nr. i wischen
function goCol(i){curCol=i;const el=$('#cols'),c=el&&el.children[i];if(c)el.scrollTo({left:c.offsetLeft-el.offsetLeft,behavior:S.anim?'smooth':'auto'});document.querySelectorAll('.tab[data-i]').forEach(b=>b.setAttribute('aria-current',+b.dataset.i===i))}

/* ---------- Fokusmodus ---------- */
let focusId=null;
function openFocus(id){focusId=id;$('#focus').hidden=false;document.body.style.overflow='hidden';renderFocus();setTimeout(()=>$('#focus .bigcheck .check')?.focus(),30)}
function closeFocus(){$('#focus').hidden=true;document.body.style.overflow='';focusId=null;render()}
function renderFocus(){
 const t=T(focusId);if(!t){closeFocus();return}
 const c=colorOf(t),before=openHard(t).map(T);
 const f=$('#focus');f.style.setProperty('--c',c);
 f.innerHTML=`<div class="ftop"><small>FOKUSMODUS</small><button class="iconbtn" data-act="closefocus" aria-label="Fokusmodus schließen"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
 <div class="fmain">${goalHint(t)?`<p class="goal">${goalHint(t)}</p>`:''}<h1>${esc(t.t)}</h1>
 ${before.length?`<div class="before"><p>Vorher noch:</p>${before.map(n=>`<div class="drow">${checkBtn(n,c)}<span>${esc(n.t)}</span></div>`).join('')}</div>`:''}
 <div class="bigcheck">${checkBtn(t,c)}<span>${t.done?'Geschafft':'Abhaken, wenn es geschafft ist'}</span></div>
 ${t.done?'':`<button class="softbtn" data-act="block" data-id="${t.id}">${t.goal?'+ To-Do':'+ Vorher-To-Do'}</button>`}</div>
 <div class="fbot"><button class="plus" data-act="quick"><span>+</span> Neues To-Do</button></div>`}

/* ---------- Popup & Hinweis ---------- */
// modal(html): zeigt ein Popup und wartet, bis es geschlossen wird. Ergebnis: {v, vals}
//   v = data-v des gedrückten Knopfs (null bei Escape/Klick daneben)
//   vals = Werte aller Felder mit name="…" im Popup, _pre = Einträge der Vorher-Liste
// Benutzung: const r = await modal(`<h2>…</h2> … ${btn('ok','Fertig','pri')}`); if (r.v === 'ok') …
function modal(html){
 return new Promise(res=>{
  const m=$('#modal'),prev=document.activeElement;
  $('#toast').hidden=true;
  m.innerHTML=`<div class="box" role="dialog" aria-modal="true">${html}</div>`;m.hidden=false;
  (m.querySelector('input.field')||m.querySelector('.btn.pri')||m.querySelector('button'))?.focus();
  const close=v=>{const vals={_pre:[...m.querySelectorAll('.prerow')].map(r=>({t:r.querySelector('input').value.trim(),l:+r.dataset.l})).filter(x=>x.t)};m.querySelectorAll('[name]').forEach(el=>{if(el.type==='radio'){if(el.checked)vals[el.name]=el.value}else if(el.type==='checkbox')vals[el.name]=el.checked;else vals[el.name]=el.value.trim()});
   m.hidden=true;m.innerHTML='';m.onclick=null;document.removeEventListener('keydown',kd);prev?.focus?.();res({v,vals})};
  const kd=e=>{if(e.key==='Escape')close(null);if(e.key!=='Enter'||!e.target.matches('input.field'))return;e.preventDefault();
   const pre=m.querySelector('.prelist');
   if(pre&&e.target.name==='text'){addRow(pre,null,0);return}
   if(pre&&e.target.matches('.pre')&&e.target.value.trim()){const r=e.target.closest('.prerow');addRow(pre,r,+r.dataset.l);return}
   const p=m.querySelector('.btn.pri');if(p)close(p.dataset.v)};
  document.addEventListener('keydown',kd);
  m.onclick=e=>{const rb=e.target.closest('[data-row]');if(rb){rowAct(rb);return}const b=e.target.closest('[data-v]');if(b)close(b.dataset.v);else if(e.target===m)close(null)};
 })}
/* Vorher-Liste im Popup: Einrückung = kommt vor dem Eintrag darüber */
const preRow=l=>`<div class="prerow" data-l="${l}" style="--l:${l}"><span class="grip" aria-hidden="true" title="Ziehen: hoch/runter = Reihenfolge, links/rechts = Ebene"><svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor"><circle cx="4" cy="4" r="1.6"/><circle cx="10" cy="4" r="1.6"/><circle cx="4" cy="10" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="4" cy="16" r="1.6"/><circle cx="10" cy="16" r="1.6"/></svg></span><input class="field pre" placeholder="${l?'Und davor?':'z. B. Einkaufen'}" autocomplete="off" aria-label="Vorher-To-Do"><button type="button" class="mini" data-row="ind" title="Kommt davor (einrücken)" aria-label="Kommt vor dem Eintrag darüber">↳</button><button type="button" class="mini" data-row="up" aria-label="Nach oben">↑</button><button type="button" class="mini" data-row="rm" aria-label="Entfernen">×</button></div>`;
function fixLevels(list){let prev=-1;list.querySelectorAll('.prerow').forEach(r=>{let l=Math.min(+r.dataset.l,prev+1);r.dataset.l=l;r.style.setProperty('--l',l);r.querySelector('input').placeholder=l?'Und davor?':'z. B. Einkaufen';prev=l})}
function addRow(list,after,l){const tmp=document.createElement('div');tmp.innerHTML=preRow(l);const r=tmp.firstElementChild;if(after)after.after(r);else list.append(r);fixLevels(list);r.querySelector('input').focus()}
function rowAct(b){const list=$('#modal .prelist'),r=b.closest('.prerow'),a=b.dataset.row;
 if(a==='add'){addRow(list,null,0);return}
 if(a==='rm'){const n=r.nextElementSibling||r.previousElementSibling;r.remove();fixLevels(list);(n?.querySelector('input')||$('#modal .preadd'))?.focus();return}
 if(a==='up'){const p=r.previousElementSibling;if(p){p.before(r);fixLevels(list)}r.querySelector('input').focus();return}
 if(a==='ind'){const p=r.previousElementSibling,max=p?+p.dataset.l+1:0,l=+r.dataset.l;r.dataset.l=l<max?l+1:0;fixLevels(list);r.querySelector('input').focus()}}
// Ziehen mit Maus oder Finger: senkrecht = Reihenfolge, waagerecht = Ebene (kommt davor)
document.addEventListener('pointerdown',e=>{
 const g=e.target.closest('#modal .grip');if(!g)return;e.preventDefault();
 const r=g.closest('.prerow'),list=r.parentElement,x0=e.clientX,l0=+r.dataset.l;
 r.classList.add('dragging');
 const move=ev=>{const y=ev.clientY;let placed=false;
  for(const o of list.querySelectorAll('.prerow')){if(o===r)continue;const b=o.getBoundingClientRect();if(y<b.top+b.height/2){o.before(r);placed=true;break}}
  if(!placed)list.append(r);
  r.dataset.l=Math.max(0,l0+Math.round((ev.clientX-x0)/26));fixLevels(list)};
 const up=()=>{r.classList.remove('dragging');removeEventListener('pointermove',move);removeEventListener('pointerup',up);removeEventListener('pointercancel',up);fixLevels(list)};
 addEventListener('pointermove',move);addEventListener('pointerup',up);addEventListener('pointercancel',up)});
// Heute: Karten per Griff ziehen (Maus/Finger) oder mit Pfeiltasten verschieben
// saveDayOrder: merkt sich die Reihenfolge der Karten in „Heute“
function saveDayOrder(){const list=$('#daylist');if(!list)return;[...list.querySelectorAll('.card')].forEach((c,i)=>{T(c.dataset.id).todayOrder=i+1});save()}
document.addEventListener('pointerdown',e=>{
 const g=e.target.closest('#daylist .cgrip');if(!g)return;e.preventDefault();
 const card=g.closest('.card'),list=card.parentElement;card.classList.add('dragging');
 const move=ev=>{const y=ev.clientY;let placed=false;
  for(const o of list.querySelectorAll('.card')){if(o===card)continue;const b=o.getBoundingClientRect();if(y<b.top+b.height/2){if(o.previousElementSibling!==card)o.before(card);placed=true;break}}
  if(!placed&&list.lastElementChild!==card)list.append(card)};
 const up=()=>{card.classList.remove('dragging');removeEventListener('pointermove',move);removeEventListener('pointerup',up);removeEventListener('pointercancel',up);saveDayOrder();render()};
 addEventListener('pointermove',move);addEventListener('pointerup',up);addEventListener('pointercancel',up)});
document.addEventListener('keydown',e=>{const g=e.target.closest&&e.target.closest('#daylist .cgrip');if(!g||(e.key!=='ArrowUp'&&e.key!=='ArrowDown'))return;e.preventDefault();
 const card=g.closest('.card');if(e.key==='ArrowUp'&&card.previousElementSibling)card.previousElementSibling.before(card);if(e.key==='ArrowDown'&&card.nextElementSibling)card.nextElementSibling.after(card);
 saveDayOrder();render();document.querySelector(`.cgrip[data-id="${card.dataset.id}"]`)?.focus()});
// Version B: Karte am Griff ziehen. Ziele: Zeitnah, Backlog, Kategorie-Register, Bereich-Leisten.
document.addEventListener('pointerdown',e=>{
 const g=e.target.closest('.mgrip');if(!g||!$('#modal').hidden)return;e.preventDefault();
 const id=g.dataset.id,src=g.closest('.card,.brow'),r=src.getBoundingClientRect();
 const gh=src.cloneNode(true);gh.classList.add('dragghost');Object.assign(gh.style,{width:r.width+'px',left:r.left+'px',top:r.top+'px',margin:0});
 const dx=e.clientX-r.left,dy=e.clientY-r.top,x0=e.clientX,y0=e.clientY;let moved=false,over=null,edgeT=0;
 const move=ev=>{
  if(!moved){if(Math.hypot(ev.clientX-x0,ev.clientY-y0)<6)return;moved=true;document.body.append(gh);src.classList.add('src-drag');document.body.classList.add('dnd')}
  gh.style.left=ev.clientX-dx+'px';gh.style.top=ev.clientY-dy+'px';
  const t=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('[data-drop]')||null;
  if(t!==over){over?.classList.remove('over');over=t;over?.classList.add('over')}
  const cols=$('#cols'),now=Date.now();
  if(cols&&cols.scrollWidth>cols.clientWidth+4&&now-edgeT>700){if(ev.clientX<30&&curCol>0){edgeT=now;goCol(curCol-1)}else if(ev.clientX>innerWidth-30&&curCol<cols.children.length-1){edgeT=now;goCol(curCol+1)}}
  if(ev.clientY<50)scrollBy(0,-14);else if(ev.clientY>innerHeight-50)scrollBy(0,14)};
 const up=ev=>{removeEventListener('pointermove',move);removeEventListener('pointerup',up);removeEventListener('pointercancel',up);
  gh.remove();src.classList.remove('src-drag');document.body.classList.remove('dnd');over?.classList.remove('over');
  if(!moved)return;noClick=Date.now()+350;if(ev.type==='pointercancel'||!over)return;
  const d=over.dataset;
  if(d.drop==='cat'){const c=C(d.cat);moveTo(id,{cat:d.cat,area:c&&c.subs.length?c.subs[0].id:''})}
  else moveTo(id,{cat:d.cat,area:d.area,bl:d.bl===undefined?undefined:d.bl==='1'})};
 addEventListener('pointermove',move);addEventListener('pointerup',up);addEventListener('pointercancel',up)});
// Bei einem Ziel: „Was gehört dazu?“ (ein Ziel ist ein Zustand, erreicht, wenn alle To-Dos erledigt sind). Bei einem To-Do: die eine Vorher-Frage der ganzen App.
const preBlock=()=>`<label class="lbl only-goal">Was gehört dazu? Welche To-Dos braucht es, damit das Ziel erreicht ist?</label><label class="lbl only-sub">Muss etwas anderes vorher passieren?</label><div class="prelist"></div><button type="button" class="link preadd" data-row="add"><span class="only-goal">+ To-Do</span><span class="only-sub">+ Vorher-To-Do</span></button><p class="prehint"><span class="only-goal">Das Ziel ist erreicht, wenn alles davon erledigt ist. </span>Darf leer bleiben. Ziehen am Griff oder ↳: ein Eintrag muss vor dem darüber passieren.</p>`;
// createPre: legt die im Popup eingetippten Vorher-To-Dos an (Einrückung = eine Ebene tiefer)
function createPre(root,list,today){const stack=[root];list.forEach(({t,l})=>{const d=Math.min(l,stack.length-1);const n=mk(t,{today,backlog:!!root.backlog});attach(stack[d],n,'hard');stack.length=d+1;stack.push(n)})}
// btn(wert, beschriftung, art): Knopf für Popups. art 'pri' = Hauptknopf, 'ghost' = unauffällig
const btn=(v,l,c='')=>`<button type="button" class="btn ${c}" data-v="${v}">${l}</button>`;
// toast: kurzer Hinweis unten, verschwindet nach 7 Sekunden. undo=true zeigt „Rückgängig“ (setzt S auf undoSnap zurück).
function toast(msg,undo){const t=$('#toast');clearTimeout(toastT);t.innerHTML=`<span>${msg}</span>${undo?'<button id="undo">Rückgängig</button>':''}`;t.hidden=false;
 if(undo)$('#undo').onclick=()=>{S=JSON.parse(undoSnap);save();render();t.hidden=true};toastT=setTimeout(()=>t.hidden=true,7000)}
// kindSeg: Auswahl „Geht sonst nicht“ (hard) / „Würde nur helfen“ (help). catSel: Auswahl eines Bereichs.
const kindSeg=(def='hard')=>`<div class="seg" role="radiogroup" aria-label="Wie wichtig vorher?"><label><input type="radio" name="kind" value="hard"${def==='hard'?' checked':''}>Geht sonst nicht</label><label><input type="radio" name="kind" value="help"${def==='help'?' checked':''}>Würde nur helfen</label></div>`;
const catSel=sel=>`<select class="field" name="cat">${S.cats.map(c=>`<option value="${c.id}"${c.id===sel?' selected':''}>${esc(c.name)}</option>`).join('')}<option value=""${!sel?' selected':''}>Ohne Bereich</option></select>`;
// attach: macht n zum Vorher-To-Do von p. Bei „geht sonst nicht“ rutscht n in der Sortierung über p.
function attach(p,n,kind){if(kind==='help')p.soft.push(n.id);else{p.needs.push(n.id);n.prio=Math.max(n.prio,p.prio+1)}}

/* ---------- Abläufe ---------- */
// check: abhaken oder wieder öffnen. Danach fragt die App für jedes To-Do, das dadurch frei wird: „Jetzt machen?“
async function check(id){
 const t=T(id);undoSnap=snap();
 if(t.done){t.done=false;t.doneAt=null;save();render();return}
 const freed=parentsHard(id).filter(p=>!p.done&&openHard(p).length===1);
 const el=document.querySelector(`#acc .card[data-id="${id}"]`);
 if(el&&S.anim){el.querySelector('.check').setAttribute('aria-checked','true');el.classList.add('leaving');await new Promise(r=>setTimeout(r,320))}
 t.done=true;t.doneAt=Date.now();save();render();
 for(const p of freed){
  if(p.goal){
   const r=await modal(`<div class="next" style="--c:${colorOf(p)}"><p class="yay">Alles dafür erledigt!</p><h2>${esc(p.t)}</h2>
    <div class="nbtns">${btn('','Noch nicht','ghost')}${btn('reached','Ziel erreicht!','pri')}${btn('more','+ To-Do')}</div></div>`);
   if(r.v==='reached'){undoSnap=snap();p.done=true;p.doneAt=Date.now();save();render();toast(`Ziel erreicht: ${esc(p.t)}`,true)}
   if(r.v==='more')await blocker(p.id);
   continue}
  const r=await modal(`<div class="next" style="--c:${colorOf(p)}"><p class="yay">Cool, geschafft! Next!</p><h2>${esc(p.t)}</h2>
   <div class="nbtns">${btn('later','Später','ghost')}${btn('go','Jetzt machen','pri')}${btn('more','+ Vorher-To-Do')}</div></div>`);
  if(r.v==='go'){openFocus(p.id);break}
  if(r.v==='more')await blocker(p.id);
 }}
// blocker: Popup „Muss etwas anderes vorher passieren?“
async function blocker(id){
 const t=T(id),opts=canPrecede(id);
 const r=await modal(`<h2>${t.goal?'Was gehört noch dazu?':'Muss etwas anderes vorher passieren?'}</h2><p>${t.goal?'Ziel':'Für'}: ${esc(t.t)}</p>
  <input class="field" name="text" placeholder="z. B. Erst klären, wer zuständig ist" autocomplete="off" aria-label="Muss etwas anderes vorher passieren?">
  ${opts.length?`<details style="margin-top:10px"><summary class="link" style="cursor:pointer">Oder ein To-Do wählen, das schon da ist</summary><select class="field" name="link" style="margin-top:8px"><option value="">–</option>${optList(opts)}</select></details>`:''}
  ${kindSeg()}<div class="btns">${btn('','Nichts, ich kann loslegen','ghost')}${btn('ok','Hinzufügen','pri')}</div>`);
 if(r.v!=='ok')return;
 const before=snap(),n=r.vals.link?T(r.vals.link):r.vals.text?mk(r.vals.text):null;if(!n)return;
 attach(t,n,r.vals.kind);if(!r.vals.link)n.backlog=!!t.backlog;if(t.today&&r.vals.kind!=='help')n.today=true;undoSnap=before;save();render();
 toast(r.vals.kind==='help'?'Notiert – sperrt nichts.':'Kommt vorher und steht jetzt oben.',true)}
// addTask: Popup „Neues Ziel / Neues To-Do“ (Knopf + unten). Gibt true zurück, wenn etwas angelegt wurde.
async function addTask({text='',parent=null,mode=null}={}){
 const cp=curPlace(),ocid=cp.split('|')[0],ctx=parent||(focusId&&T(focusId)?focusId:null);
 const parents=all().filter(x=>!x.done);
 const asSub=mode?mode==='sub':!!ctx;
 const def=ctx||(parents.find(p=>p.goal&&inCol(p,ocid))||{}).id;
 const r=await modal(`<h2><span class="only-goal">Neues Ziel</span><span class="only-sub">Neues To-Do</span></h2>
  <input class="field" name="text" value="${esc(text)}" placeholder="${asSub?'Was ist zu tun?':'Was willst du erreichen? z. B. Neue Kund*innen gewinnen'}" autocomplete="off" aria-label="Titel">
  <div class="seg"><label><input type="radio" id="w-goal" name="what" value="goal"${asSub?'':' checked'}>Neues Ziel</label><label><input type="radio" id="w-sub" name="what" value="sub"${asSub?' checked':''}>Unter-To-Do</label></div>
  <div class="only-goal">${placeSel(cp)}<label class="opt"><input type="checkbox" name="bl"> Erst mal ins Backlog</label></div>
  <div class="only-sub"><label class="lbl">Kommt vor</label><select class="field" name="parent">${optList(parents,def)}</select>
  ${parent&&T(parent)&&T(parent).needs.length?`<label class="opt"><input type="checkbox" name="between"> Dazwischen einfügen – was bisher vor „${esc(T(parent).t)}“ kam, kommt dann vor das neue</label>`:''}</div>
  ${preBlock()}
  <div class="btns">${btn('','Abbrechen','ghost')}${btn('ok','Hinzufügen','pri')}</div>`);
 if(r.v!=='ok'||!r.vals.text)return false;
 undoSnap=snap();
 const today=S.view==='heute',pre=r.vals._pre;let n;
 if(r.vals.what==='goal'){const[cat,area]=r.vals.place.split('|');n=mk(r.vals.text,{goal:true,cat:cat||null,area:area||null,today,backlog:!!r.vals.bl&&!today})}
 else{const p=T(r.vals.parent);if(!p)return false;n=mk(r.vals.text,{today,backlog:!!p.backlog&&!today});
  if(r.vals.between&&p.id===parent){n.needs.push(...p.needs);p.needs=[]}
  attach(p,n,'hard')}
 createPre(n,pre,today);
 toast(pre.length?`Angelegt – mit ${pre.length} Vorher-To-Do${pre.length>1?'s':''}.`:(r.vals.what==='goal'?'Neues Ziel angelegt.':'Angelegt.'),true);
 save();render();return true}
// quick: schnelles Notieren im Fokusmodus („später einsortieren“ landet in S.inbox)
async function quick(){
 const r=await modal(`<h2>Neues To-Do</h2><p>Schreib es kurz auf. Danach geht’s hier weiter.</p>
  <input class="field" name="text" placeholder="Was ist dir eingefallen?" autocomplete="off" aria-label="Was ist dir eingefallen?">
  <div class="btns">${btn('now','Direkt einsortieren')}${btn('later','Später einsortieren','pri')}</div>`);
 if(!r.v||!r.vals.text)return;
 if(r.v==='later'){undoSnap=snap();S.inbox.push({id:uid(),t:r.vals.text,ctx:focusId});save();render();toast('Notiert. Weiter geht’s.',true);return}
 await addTask({text:r.vals.text,parent:focusId,mode:'sub'})}
// inbox: Liste „Später einsortieren“ abarbeiten
async function inbox(){
 for(;;){
  if(!S.inbox.length)return;
  const r=await modal(`<h2>Später einsortieren</h2><p>Was dir zwischendurch eingefallen ist.</p>
   ${S.inbox.map(i=>`<div class="lrow"><span>${esc(i.t)}</span><button class="btn" data-v="sort:${i.id}" style="min-height:40px">Einsortieren</button><button class="mini" data-v="rm:${i.id}" aria-label="Löschen">×</button></div>`).join('')}
   <div class="btns">${btn('','Fertig','pri')}</div>`);
  if(!r.v)return;
  const[a,iid]=r.v.split(':'),it=S.inbox.find(i=>i.id===iid);if(!it)continue;
  if(a==='rm'){undoSnap=snap();S.inbox=S.inbox.filter(i=>i!==it);save();render();continue}
  const before=snap();
  if(await addTask({text:it.t,parent:it.ctx&&T(it.ctx)?it.ctx:null})){S.inbox=S.inbox.filter(i=>i.id!==iid);undoSnap=before;save();render()}
 }}
// edit: Popup „Bearbeiten“. Läuft in einer Schleife, bis „Fertig“ oder „Löschen“ gedrückt wird.
async function edit(id){
 const before=snap();
 for(;;){
  const t=T(id);if(!t)return;
  const kids=[...t.needs.map(n=>[n,0]),...t.soft.map(n=>[n,1])].filter(k=>T(k[0]));
  const ps=parentsAll(id);
  const r=await modal(`<h2>Bearbeiten</h2>
   <input class="field" name="text" value="${esc(t.t)}" aria-label="Titel" autocomplete="off">
   <p>${esc(placeName(...placeOf(t).split('|')))} · ${t.backlog?'Backlog':'Zeitnah'} <button class="link" data-v="move">Verschieben …</button></p>
   <label class="lbl">Kommt vorher</label>
   ${kids.map(([n,s])=>`<div class="lrow"><span>${esc(T(n).t)}</span><button class="link" data-v="kind:${n}" title="Umschalten">${s?'hilft nur':'geht sonst nicht'}</button><button class="mini" data-v="rmk:${n}" aria-label="Verknüpfung lösen">×</button></div>`).join('')}
   <button class="link" data-v="addk">+ Ein To-Do, das schon da ist, kommt vorher</button>
   ${ps.length?`<label class="lbl">Gehört zu</label>${ps.map(p=>`<div class="lrow"><span>${esc(p.t)}</span><button class="mini" data-v="rmp:${p.id}" aria-label="Verknüpfung lösen">×</button></div>`).join('')}`:''}
   <div><button class="link" data-v="addp">+ Zahlt auch auf ein anderes To-Do ein</button></div>
   <div class="btns">${btn('del','Löschen','ghost')}${btn('ok','Fertig','pri')}</div>`);
  if(r.vals.text)t.t=r.vals.text;if('cat'in r.vals)t.cat=r.vals.cat||null;
  const[a,x]=(r.v||'').split(':');
  if(a==='kind'){if(t.needs.includes(x)){t.needs=t.needs.filter(n=>n!==x);t.soft.push(x)}else{t.soft=t.soft.filter(n=>n!==x);t.needs.push(x)}}
  else if(a==='rmk'){t.needs=t.needs.filter(n=>n!==x);t.soft=t.soft.filter(n=>n!==x);if(T(x)&&!parentsAll(x).length)T(x).goal=true}
  else if(a==='rmp'){const p=T(x);p.needs=p.needs.filter(n=>n!==id);p.soft=p.soft.filter(n=>n!==id);if(!parentsAll(id).length)t.goal=true}
  else if(a==='addk'||a==='addp'){const L=a==='addk'?canPrecede(id):canFollow(id);
   const q=await modal(`<h2>${a==='addk'?'Was kommt vorher?':'Worauf zahlt es noch ein?'}</h2><p>Auch aus anderen Bereichen.</p>${L.length?`<select class="field" name="o">${optList(L)}</select>${kindSeg()}`:'<p>Gerade passt nichts.</p>'}<div class="btns">${btn('','Zurück','ghost')}${L.length?btn('ok','Verknüpfen','pri'):''}</div>`);
   if(q.v==='ok'){if(a==='addk')attach(t,T(q.vals.o),q.vals.kind);else attach(T(q.vals.o),t,q.vals.kind)}}
  else if(a==='move'){await moveMenu(id)}
  else if(a==='del'){const q=await modal(`<h2>„${esc(t.t)}“ löschen?</h2><p>Unter-To-Dos, die nur dazu gehören, verschwinden mit.</p><div class="btns">${btn('','Behalten','ghost')}${btn('ok','Löschen','pri')}</div>`);
   if(q.v==='ok'){del(id);save();render();undoSnap=before;toast('Gelöscht.',true);return}}
  else{save();render();if(snap()!==before){undoSnap=before;toast('Gespeichert.',true)}return}
  save();render();
 }}
// delAsk: löschen mit Hinweis und Rückgängig. del: löscht das To-Do und alle Vorher-To-Dos, die danach zu nichts mehr gehören.
function delAsk(id){
 const t=T(id);if(!t)return;undoSnap=snap();
 const before=new Set(Object.keys(S.tasks));del(id);save();render();
 const gone=[...before].filter(x=>!S.tasks[x]).length-1;
 toast(`„${esc(t.t)}“ gelöscht${gone>0?` – mit ${gone} Unter-To-Do${gone>1?'s':''}`:''}.`,true)}
function del(id){
 const strip=x=>{delete S.tasks[x];all().forEach(y=>{y.needs=y.needs.filter(n=>n!==x);y.soft=y.soft.filter(n=>n!==x)})};strip(id);
 let ch=true;while(ch){ch=false;all().forEach(x=>{if(!x.goal&&!parentsAll(x.id).length){strip(x.id);ch=true}})}
 if(focusId===id)closeFocus()}
// catDialog: Bereich anlegen/bearbeiten/löschen. subDialog: Kategorie anlegen/umbenennen/löschen.
async function catDialog(id){
 const c=id?C(id):null;
 const r=await modal(`<h2>${c?'Bereich bearbeiten':'Neuer Bereich'}</h2>
  <input class="field" name="name" value="${esc(c?c.name:'')}" placeholder="z. B. Freund*innen" aria-label="Name" autocomplete="off">
  <label class="lbl">Farbe</label><div class="sw">${COLORS.map((x,i)=>`<label style="--c:${x}" aria-label="Farbe ${i+1}"><input type="radio" name="color" value="${x}"${(c?c.color:COLORS[S.cats.length%COLORS.length])===x?' checked':''}></label>`).join('')}</div>
  <div class="btns">${c?btn('del','Löschen','ghost'):btn('','Abbrechen','ghost')}${btn('ok',c?'Fertig':'Anlegen','pri')}</div>`);
 if(r.v==='del'){undoSnap=snap();S.cats=S.cats.filter(x=>x!==c);if(S.openCat===id)S.openCat=S.cats[0]?S.cats[0].id:null;all().forEach(t=>{if(t.cat===id)t.cat=null});save();render();toast('Bereich gelöscht. Die To-Dos sind noch da.',true);return}
 if(r.v!=='ok'||!r.vals.name)return;
 undoSnap=snap();if(c){c.name=r.vals.name;c.color=r.vals.color}else{const n={id:uid(),name:r.vals.name,color:r.vals.color,subs:[]};S.cats.push(n);S.openCat=n.id;curCol=0}
 save();render()}
async function subDialog(cid,sid){const c=C(cid);if(!c)return;const x=sid?c.subs.find(y=>y.id===sid):null;
 const r=await modal(`<h2>${x?'Kategorie bearbeiten':'Neue Kategorie'}</h2><p>in ${esc(c.name)}</p>
  <input class="field" name="name" value="${esc(x?x.name:'')}" placeholder="z. B. Akquise" autocomplete="off" aria-label="Name">
  ${!x&&!c.subs.length&&all().some(t=>inCol(t,cid))?`<p class="prehint">Was schon in ${esc(c.name)} liegt, kommt erst mal in diese erste Kategorie.</p>`:''}
  <div class="btns">${x?btn('del','Löschen','ghost'):btn('','Abbrechen','ghost')}${btn('ok',x?'Fertig':'Anlegen','pri')}</div>`);
 if(r.v==='del'){undoSnap=snap();const i=c.subs.indexOf(x);c.subs.splice(i,1);all().forEach(t=>{if(t.area===sid)t.area=null});curCol=Math.max(0,i-1);save();render();toast(`Kategorie gelöscht. Die To-Dos liegen jetzt in ${esc(c.subs[0]?c.subs[0].name:c.name)}.`,true);return}
 if(r.v!=='ok'||!r.vals.name)return;undoSnap=snap();
 if(x)x.name=r.vals.name;else{c.subs.push({id:uid(),name:r.vals.name});curCol=c.subs.length-1;S.openCat=cid}
 save();render();if(!x)goCol(curCol)}
/* Zeitnah ⇄ Backlog und Verschieben. Geht ein To-Do ins Backlog, fragt die App einmal, ob die ganze Kette mitkommt. */
async function moveTo(id,{cat,area,bl}){
 const t=T(id);if(!t)return;const before=snap(),msgs=[];
 if(cat!==undefined){const nx=(cat||'')+'|'+(area||'');if(placeOf(t)!==nx){t.cat=cat||null;t.area=area||null;msgs.push('liegt jetzt in '+placeName(cat,area))}}
 if(bl!==undefined&&bl!==!!t.backlog){
  if(bl){
   const g=t.goal?null:goalsOf(id).find(x=>!x.done&&!x.backlog);
   const kids=[...sub(id)].filter(x=>x!==id&&!T(x).done&&!T(x).backlog);
   let ids=[id];
   if(g||kids.length){
    const gk=g?[...sub(g.id)].filter(x=>!T(x).done):[];
    const q=await modal(`<h2>Kommt die ganze Kette mit ins Backlog?</h2><p>„${esc(t.t)}“${g?` gehört zum Ziel „${esc(g.t)}“.`:` hat ${kids.length} offene${kids.length>1?'':'s'} Vorher-To-Do${kids.length>1?'s':''}.`}</p>
     <div class="btns">${btn('','Abbrechen','ghost')}${btn('one','Nur dieses To-Do')}${g?btn('goal','Das ganze Ziel','pri'):btn('chain','Ja, alles','pri')}</div>`);
    if(!q.v){S=JSON.parse(before);render();return}
    if(q.v==='goal')ids=gk;else if(q.v==='chain')ids=[id,...kids];
   }
   ids.forEach(x=>{const k=T(x);k.backlog=true;if(k.today){k.today=false;k.todayBy=null}});
   msgs.push(ids.length>1?`ist mit ${ids.length-1} weiteren im Backlog`:'ist im Backlog');
  }else{
   const ids=[id,...[...sub(id)].filter(x=>x!==id&&T(x).backlog&&!T(x).done)];ids.forEach(x=>T(x).backlog=false);
   msgs.push(ids.length>1?`ist mit ${ids.length-1} Vorher-To-Do${ids.length>2?'s':''} zurück in Zeitnah`:'ist zurück in Zeitnah')}
 }
 if(!msgs.length)return;
 undoSnap=before;save();render();toast(`„${esc(t.t)}“ ${msgs.join(' und ')}.`,true)}
// moveMenu: Popup „Verschieben“ (Zeitnah/Backlog, Bereich, Kategorie)
async function moveMenu(id){const t=T(id);if(!t)return;
 const r=await modal(`<h2>Verschieben</h2><p>${esc(t.t)}</p>
  <div class="seg" role="radiogroup" aria-label="Zeitnah oder Backlog"><label><input type="radio" name="bl" value="0"${t.backlog?'':' checked'}>Zeitnah</label><label><input type="radio" name="bl" value="1"${t.backlog?' checked':''}>Backlog</label></div>
  ${placeSel(placeOf(t))}
  <div class="btns">${btn('','Abbrechen','ghost')}${btn('ok','Fertig','pri')}</div>`);
 if(r.v!=='ok')return;const[cat,area]=r.vals.place.split('|');
 await moveTo(id,{cat,area,bl:r.vals.bl==='1'})}
// menu: Einstellungen (···)
async function menu(){
 const r=await modal(`<h2>Einstellungen</h2><label class="opt"><input type="checkbox" name="anim"${S.anim?' checked':''}> Sanfte Animationen</label>
  <p>Version B: Bereiche übereinander, Kategorien zum Wischen, Zeitnah und Backlog. Alles bleibt nur auf diesem Gerät.</p>
  <label class="lbl">Datensicherung</label>
  <p>Speichere ab und zu eine Sicherung als Datei. Damit holst du deine Liste auch auf ein anderes Gerät.</p>
  <div class="btns" style="justify-content:flex-start;margin-top:10px">${btn('export','Sicherung speichern')}${btn('import','Sicherung laden')}</div>
  <p class="prehint">App ${APP_VERSION} · Datenformat ${FORMAT}</p>
  <div class="btns">${btn('reset','Beispiel wiederherstellen','ghost')}${btn('copy','Daten kopieren','ghost')}${btn('ok','Fertig','pri')}</div>`);
 if(!r.v)return;S.anim=!!r.vals.anim;
 if(r.v==='import'){save();render();$('#importFile').click();return}
 if(r.v==='reset'){undoSnap=snap();S=seed();open.clear();save();render();toast('Beispiel wiederhergestellt.',true);return}
 save();render();
 if(r.v==='export')exportData();
 if(r.v==='copy'){try{await navigator.clipboard.writeText(snap());toast('Kopiert.')}catch(e){toast('Kopieren ging hier nicht.')}}}

/* ---------- Datensicherung: Export und Import als JSON-Datei ----------
   Aufbau der Datei: {app:'power-liste', format:<Datenformat>, appVersion, exportedAt, data:<kompletter Zustand>} */
function exportData(){
 const d=new Date(),p=n=>String(n).padStart(2,'0');
 const out={app:FILE_APP,format:FORMAT,appVersion:APP_VERSION,exportedAt:d.toISOString(),data:S};
 const url=URL.createObjectURL(new Blob([JSON.stringify(out,null,1)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download=`power-liste-${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}.json`;
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
 toast('Sicherung gespeichert.')}
// Prüft eine Sicherung. Gibt den Zustand zurück oder einen Fehlertext. Nimmt auch rohe Daten aus „Daten kopieren“ an.
function readBackup(txt){
 let o;try{o=JSON.parse(txt)}catch(e){return'Die Datei ist keine gültige Sicherung.'}
 const wrapped=o&&o.app===FILE_APP&&o.data;
 const fmt=wrapped?+o.format||1:+(o&&o.format)||1;
 if(fmt>FORMAT)return'Die Sicherung stammt aus einer neueren Version der App. Bitte erst die App aktualisieren.';
 const d=wrapped?o.data:o;
 if(!d||typeof d!=='object'||!d.tasks||typeof d.tasks!=='object'||Array.isArray(d.tasks)||!Array.isArray(d.cats))return'In der Datei stehen keine To-Dos.';
 const ID=/^[A-Za-z0-9_-]{1,64}$/,COL=/^#[0-9a-fA-F]{3,8}$/,ids=x=>x==null||ID.test(x),arr=x=>x==null||(Array.isArray(x)&&x.every(i=>ID.test(i)));
 for(const[k,t]of Object.entries(d.tasks)){if(!t||typeof t!=='object'||!ID.test(k)||t.id!==k||typeof t.t!=='string'||!arr(t.needs)||!arr(t.soft)||!ids(t.cat)||!ids(t.area)||!ids(t.todayBy))return'Die Datei ist beschädigt.'}
 for(const c of d.cats){if(!c||!ID.test(c.id)||typeof c.name!=='string'||!COL.test(c.color)||!(c.subs==null||(Array.isArray(c.subs)&&c.subs.every(x=>x&&ID.test(x.id)&&typeof x.name==='string'))))return'Die Datei ist beschädigt.'}
 if(d.inbox!=null&&!(Array.isArray(d.inbox)&&d.inbox.every(i=>i&&ID.test(i.id)&&typeof i.t==='string'&&ids(i.ctx))))return'Die Datei ist beschädigt.';
 if(!ids(d.openCat)||!['heute','jetzt','baum',undefined].includes(d.view))return'Die Datei ist beschädigt.';
 return{data:migrate(d),when:wrapped&&o.exportedAt}}
async function importFile(file){
 let txt;try{txt=await file.text()}catch(e){toast('Die Datei ließ sich nicht lesen.');return}
 const r=readBackup(txt);if(typeof r==='string'){toast(r);return}
 const n=Object.values(r.data.tasks).filter(t=>!t.done).length,dt=r.when?new Date(r.when):null;
 const q=await modal(`<h2>Sicherung laden?</h2><p>${esc(file.name)}${dt&&!isNaN(dt)?` · vom ${dt.toLocaleDateString('de-DE',{day:'numeric',month:'long',year:'numeric'})}`:''}</p><p>Darin: ${n} offene To-Do${n===1?'':'s'}. Deine jetzige Liste wird dadurch ersetzt. Gleich danach kannst du es noch rückgängig machen.</p>
  <div class="btns">${btn('','Abbrechen','ghost')}${btn('ok','Laden','pri')}</div>`);
 if(q.v!=='ok')return;
 undoSnap=snap();S=r.data;open.clear();chainOpen.clear();blOpen.clear();curCol=0;newDay();save();render();toast('Sicherung geladen.',true)}
$('#importFile').addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(f)importFile(f)});

/* ---------- Ereignisse ---------- */
document.addEventListener('toggle',e=>{const d=e.target;if(d.matches&&d.matches('details.chain')){d.open?chainOpen.add(d.dataset.id):chainOpen.delete(d.dataset.id)}if(d.matches&&d.matches('details.bl')){d.open?blOpen.add(d.dataset.k):blOpen.delete(d.dataset.k)}},true);
// Alle Klicks laufen hier zusammen. Jeder Knopf im HTML trägt data-act="…" (und meist data-id),
// hier steht, was dann passiert. Neuer Knopf = data-act im HTML setzen + hier ein neues case.
document.addEventListener('click',e=>{
 if(!$('#modal').hidden||Date.now()<noClick)return;
 if(e.target.closest('details.chain'))return;
 const v=e.target.closest('[data-view]');if(v){S.view=v.dataset.view;save();render();return}
 const b=e.target.closest('[data-act]');if(!b)return;const id=b.dataset.id;
 switch(b.dataset.act){
  case'check':check(id);break;
  case'block':blocker(id);break;
  case'today':{const t=T(id),wasBl=!!t.backlog;const n=setToday(id,!t.today);if(n>0&&t.today)toast(`Mit ${n} Vorher-To-Do${n>1?'s':''} in „Heute“.`+(wasBl?' Aus dem Backlog nach Zeitnah geholt.':''));else if(wasBl&&t.today)toast('In „Heute“ und aus dem Backlog nach Zeitnah geholt.');save();if(S.view==='heute'&&!t.today){const el=b.closest('.card');if(el&&S.anim){el.classList.add('leaving');setTimeout(render,280);break}}render();break}
  case'del':delAsk(id);break;
  case'focus':openFocus(id);break;
  case'closefocus':closeFocus();break;
  case'add':addTask();break;
  case'addsub':addTask({parent:id,mode:'sub'});break;
  case'quick':quick();break;
  case'edit':edit(id);break;
  case'inbox':inbox();break;
  case'menu':menu();break;
  case'gocol':goCol(+b.dataset.i);break;
  case'newcat':catDialog();break;
  case'editcat':catDialog(id);break;
  case'opencat':{const c=b.dataset.cat;S.openCat=S.openCat===c?null:c;curCol=0;save();render();if(S.openCat!==null)document.querySelector('.cat.open')?.scrollIntoView({block:'nearest',behavior:S.anim?'smooth':'auto'});break}
  case'newsub':subDialog(id);break;
  case'editsub':subDialog(id,b.dataset.s);break;
  case'move':case'mgrip':moveMenu(id);break;
  case'tozeit':moveTo(id,{bl:false});break;
  case'tog':{const k=b.dataset.k,l=+b.dataset.l,cur=open.has(k)?open.get(k):l>0;if(l===0)[...open.keys()].forEach(x=>{if(x.startsWith(k+'/'))open.delete(x)});open.set(k,!cur);render();break}
 }});
// Tastatur: Escape schließt den Fokusmodus, Enter öffnet eine Karte, Pfeiltasten wechseln die Kategorie
document.addEventListener('keydown',e=>{
 if(!$('#modal').hidden)return;
 if(e.key==='Escape'&&!$('#focus').hidden)closeFocus();
 if(e.key==='Enter'&&e.target.matches('.card'))openFocus(e.target.dataset.id);
 if(e.target.matches('.tab[data-i]')&&(e.key==='ArrowRight'||e.key==='ArrowLeft')){const n=subsOf(columns().find(c=>c.id===S.openCat)).length;goCol((curCol+(e.key==='ArrowRight'?1:n-1))%n);document.querySelector(`.tab[data-i="${curCol}"]`)?.focus()}});
$('#name').addEventListener('change',e=>{S.name=e.target.value.trim()||'Meine Liste';save();render()});
$('#name').addEventListener('keydown',e=>{if(e.key==='Enter')e.target.blur()});

/* ---------- Start: Daten laden, ggf. neuen Tag beginnen, anzeigen ---------- */
S=load();const wasNew=newDay();render();if(wasNew)toast('Guten Morgen. „Heute“ ist wieder leer – Offenes steht weiter in „Machbar“.');
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&newDay()){render();toast('Neuer Tag. „Heute“ ist wieder leer.')}});
// Offline-Betrieb: Der Service Worker legt alle Dateien der App lokal ab. Er greift nur über http(s), nicht bei file://.
if('serviceWorker'in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('sw.js').catch(()=>{});
}
