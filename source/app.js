import { DAY, solar, dawn, at, annualJumps, validCoords, clockString, jumpString, difference } from "./astro.js";
const $ = id => document.getElementById(id);
const BURRA={lat:-33.682,lon:138.94,name:"Burra, South Australia"};
const LONDON={lat:51.5074,lon:-0.1278,name:"London, United Kingdom"};
const state={home:{...BURRA},from:{...BURRA},to:{...LONDON},live:true,chosen:Date.now()};
const fmtCoords=p=>`${p.lat.toFixed(3)}°, ${p.lon.toFixed(3)}°`;
const dayString=ms=>new Date(ms).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"});
const hmsDuration=ms=>{const s=Math.ceil(ms/1000);const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);return (d?d+"d ":"")+h+"h "+String(m).padStart(2,"0")+"m";};
const fmtDiff=mins=>{let v=Math.abs(mins);const h=Math.floor(v/60),m=Math.floor(v%60),s=Math.round((v%1)*60);return (h?h+"h ":"")+(m?m+"m ":"")+(s?s+"s":h||m?"":"0m");};
const safeGet=(key)=>{try{return JSON.parse(localStorage.getItem(key)||"null");}catch{return null}};
const safeSet=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{/* browsing without storage */}};
function savedLocation(){const p=safeGet("pdt-location");return p&&validCoords(p.lat,p.lon)?p:null;}
function setHome(p){state.home=p;safeSet("pdt-location",p);renderHome();if($("jumps-chart")){setJumpCoords(p);} }
function locate(yes,no){if(!navigator.geolocation){no?.("Geolocation is not available; enter your coordinates instead.");return;}
  navigator.geolocation.getCurrentPosition(({coords})=>yes({lat:coords.latitude,lon:coords.longitude,name:"Your location"}),err=>no?.("Location unavailable ("+err.message+"). You can enter coordinates instead."),{enableHighAccuracy:false,timeout:13000,maximumAge:600000});
}
function renderHome(){if(!$("clock"))return;const p=state.home, t=Date.now(), x=at(t,p.lat,p.lon);
  $("clock").textContent=clockString(x.clock);
  $("location-name").textContent=p.name||fmtCoords(p);
  $("clock-date").textContent="DAWN DAY · "+dayString(x.before.ms+4*p.lon*60000);
  $("clock-status").textContent=x.virtual?"VIRTUAL DAWN":savedLocation()?"YOUR LOCATION":"EXAMPLE CLOCK";
  $("dawn-countdown").textContent=hmsDuration(x.untilDawn);
  $("next-jump").textContent=jumpString(x.nextJump);
  if(x.virtual) $("geo-message").textContent="Polar convention in effect: this period has no actual sunrise. A virtual dawn is used.";
}
function initHome(){if(!$("clock"))return;
  const saved=savedLocation();if(saved)state.home=saved;
  $("locate").addEventListener("click",()=>locate(p=>{setHome(p);$("geo-message").textContent="Using your device location. Coordinates remain in this browser."},msg=>$("geo-message").textContent=msg));
  $("edit-coords").addEventListener("click",()=>{const f=$("location-form");f.hidden=!f.hidden;$("edit-coords").setAttribute("aria-expanded",String(!f.hidden));f.latitude.value=state.home.lat;f.longitude.value=state.home.lon;});
  $("focus-clock").addEventListener("click",()=>{const active=document.body.classList.toggle("focus-clock");$("focus-clock").textContent=active?"✕ Exit clock":"⛶ Clock only";$("focus-clock").setAttribute("aria-pressed",String(active));window.scrollTo(0,0);});
  $("location-form").addEventListener("submit",e=>{e.preventDefault();const f=e.currentTarget,lat=Number(f.latitude.value),lon=Number(f.longitude.value);if(!validCoords(lat,lon))return;$("location-form").hidden=true;$("edit-coords").setAttribute("aria-expanded","false");setHome({lat,lon,name:"Chosen coordinates"});$("geo-message").textContent="Your chosen coordinates are stored only in this browser."});
  renderHome();setInterval(renderHome,250);
  if(!saved)locate(p=>{setHome(p);$("geo-message").textContent="Location detected. Your coordinates stay in this browser."},msg=>{$("geo-message").textContent=msg+" Showing Burra as an example.";});
}
function niceMax(max,steps){const n=max/steps;if(!n)return 1;const pow=10**Math.floor(Math.log10(n));const k=n/pow;return (k<=1?1:k<=2?2:k<=2.5?2.5:k<=5?5:10)*pow*steps;}
/** Canvas chart with visible zero, selectable point, tooltip via adjacent accessible DOM. */
function drawChart(canvas, data, {value,date,maxY,label,yLabel,polar=false}){
  if(!canvas||!data.length)return;
  const cw=Math.max(320,canvas.getBoundingClientRect().width),ch=canvas.getBoundingClientRect().height||320;
  const ratio=Math.min(2,window.devicePixelRatio||1);
  canvas.width=Math.round(cw*ratio);canvas.height=Math.round(ch*ratio);
  const c=canvas.getContext("2d");if(!c)return;c.setTransform(ratio,0,0,ratio,0,0);
  const l=56,r=14,top=16,bottom=24,w=cw-l-r,h=ch-top-bottom;
  const values=data.map(value);const abs=Math.max(1,...values.map(v=>Math.abs(v)));
  const upper=maxY||niceMax(abs,3),low=-upper;
  const x=i=>l+(i/(data.length-1))*w, y=v=>top+(upper-v)/(2*upper)*h;
  c.clearRect(0,0,cw,ch);
  c.font="11px sans-serif";c.fillStyle="#7c8a98";c.textAlign="right";c.lineWidth=1;
  for(let k=-3;k<=3;k++){const n=k*upper/3,py=y(n);c.strokeStyle=k===0?"#a3abae":"#edf0ed";c.beginPath();c.moveTo(l,py);c.lineTo(cw-r,py);c.stroke();c.fillText(yLabel(n),l-8,py+4);}
  c.strokeStyle="#d8dedc";for(let m=1;m<12;m++){const ix=data.findIndex(d=>new Date(date(d)+"T12:00:00Z").getUTCMonth()===m);if(ix<0)continue;c.beginPath();c.moveTo(x(ix),top);c.lineTo(x(ix),ch-bottom);c.stroke();}
  // Virtual dawn segments are dashed: real sunrise is not guaranteed in polar regions.
  for(let i=0;i<data.length-1;i++){if(polar&& (data[i].kind!=="sunrise"||data[i+1].kind!=="sunrise")){c.setLineDash([3,3]);c.strokeStyle="#b38e75";}else{c.setLineDash([]);c.strokeStyle="#bf7b4c";}c.lineWidth=2;c.beginPath();c.moveTo(x(i),y(values[i]));c.lineTo(x(i+1),y(values[i+1]));c.stroke();}
  c.setLineDash([]);
  function select(i){i=Math.max(0,Math.min(data.length-1,i));c.clearRect(0,0,0,0);c.strokeStyle="#8b9ba3";c.lineWidth=1;c.setLineDash([4,5]);c.beginPath();c.moveTo(x(i),top);c.lineTo(x(i),ch-bottom);c.stroke();c.setLineDash([]);c.fillStyle="#ca7c45";c.beginPath();c.arc(x(i),y(values[i]),4,0,Math.PI*2);c.fill();$(""+label+"-point").textContent=new Date(date(data[i])+"T12:00:00Z").toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"});$(""+label+"-value").textContent=yLabel(values[i]);}
  let current=null;
  const hit=e=>{const rect=canvas.getBoundingClientRect();return Math.round(((e.clientX-rect.left)*cw/rect.width-l)/w*(data.length-1));};
  const onPointer=e=>{const i=Math.max(0,Math.min(data.length-1,hit(e)));if(i!==current){current=i;draw();}};
  function draw(){c.clearRect(0,0,cw,ch);c.font="11px sans-serif";c.fillStyle="#7c8a98";c.textAlign="right";c.lineWidth=1;for(let k=-3;k<=3;k++){const n=k*upper/3,py=y(n);c.strokeStyle=k===0?"#a3abae":"#edf0ed";c.beginPath();c.moveTo(l,py);c.lineTo(cw-r,py);c.stroke();c.fillText(yLabel(n),l-8,py+4);}c.strokeStyle="#d8dedc";for(let m=1;m<12;m++){const ix=data.findIndex(d=>new Date(date(d)+"T12:00:00Z").getUTCMonth()===m);if(ix>=0){c.beginPath();c.moveTo(x(ix),top);c.lineTo(x(ix),ch-bottom);c.stroke();}}for(let i=0;i<data.length-1;i++){if(polar&&(data[i].kind!=="sunrise"||data[i+1].kind!=="sunrise")){c.setLineDash([4,4]);c.strokeStyle="#ab9890"}else{c.setLineDash([]);c.strokeStyle="#bf7b4c";}c.lineWidth=2;c.beginPath();c.moveTo(x(i),y(values[i]));c.lineTo(x(i+1),y(values[i+1]));c.stroke();}c.setLineDash([]);if(current!==null)select(current);}
  draw();canvas.onpointermove=onPointer;canvas.onpointerdown=onPointer;
}
const updateYearInput=id=>{const el=$(id);if(!el)return;el.value=new Date().getFullYear();};
function initEot(){if(!$("eot-chart"))return;updateYearInput("eot-year");
 function update(){const year=Number($("eot-year").value);if(year<1800||year>2100||!Number.isInteger(year))return;const data=[];for(let date=Date.UTC(year,0,1);date<Date.UTC(year+1,0,1);date+=DAY)data.push({date:new Date(date).toISOString().slice(0,10),e:solar(date+12*3600000).equationOfTime});drawChart($("eot-chart"),data,{value:x=>x.e,date:x=>x.date,label:"eot",yLabel:n=>(n>=0?"+":"")+n.toFixed(1)+" min"});}
 $("eot-year").addEventListener("change",update);window.addEventListener("resize",update);update();
}
function setJumpCoords(p){$("jumps-lat").value=p.lat;$("jumps-lat-number").value=p.lat;$("jumps-lon").value=p.lon;$("jumps-location").textContent=(p.name||"CHOSEN LOCATION").toUpperCase()+" · "+fmtCoords(p);renderJumps();}
function renderJumps(){if(!$("jumps-chart"))return;const lat=Number($("jumps-lat-number").value),lon=Number($("jumps-lon").value),year=Number($("jumps-year").value);if(!validCoords(lat,lon)||!Number.isInteger(year)||year<1800||year>2100)return;
 const data=annualJumps(year,lat,lon);
 drawChart($("jumps-chart"),data,{value:x=>x.ms,date:x=>x.date,label:"jumps",yLabel:ms=>(ms>=0?"+":"−")+(Math.abs(ms)>=60000?(Math.abs(ms)/60000).toFixed(1)+" min":(Math.abs(ms)/1000).toFixed(0)+" s"),polar:true});
 const positive=data.reduce((a,b)=>b.ms>a.ms?b:a),negative=data.reduce((a,b)=>b.ms<a.ms?b:a);
 $("largest-forward").textContent=jumpString(positive.ms,true);$("forward-date").textContent=dayString(positive.dawnUTC);
 $("largest-back").textContent=jumpString(negative.ms,true);$("back-date").textContent=dayString(negative.dawnUTC);
 $("avg-jump").textContent=jumpString(data.reduce((a,b)=>a+Math.abs(b.ms),0)/data.length,true).replace("+","");
 $("polar-note").hidden=!data.some(x=>x.kind!=="sunrise");$("lat-readout").textContent=lat.toFixed(1)+"°";
}
function initJumps(){if(!$("jumps-chart"))return;updateYearInput("jumps-year");const p=savedLocation()||BURRA;setJumpCoords(p);
 $("jumps-lat").addEventListener("input",()=>{$("jumps-lat-number").value=$("jumps-lat").value;$("jumps-location").textContent="CUSTOM COORDINATES";renderJumps()});
 for(const id of ["jumps-lat-number","jumps-lon","jumps-year"])$(id).addEventListener("change",()=>{if(id==="jumps-lat-number")$("jumps-lat").value=$("jumps-lat-number").value;$("jumps-location").textContent="CUSTOM COORDINATES";renderJumps()});
 $("jumps-use-me").addEventListener("click",()=>locate(setJumpCoords,msg=>alert(msg)));
 document.querySelectorAll("[data-jump-preset]").forEach(b=>b.addEventListener("click",()=>{const [lat,lon]=b.dataset.jumpPreset.split(",").map(Number);setJumpCoords({lat,lon,name:b.textContent})}));window.addEventListener("resize",renderJumps);
}
function fromTarget(){return document.querySelector('input[name="map-target"]:checked')?.value||"to";}
let map=null,pins={};
function setPlace(target,p){state[target]=p;if(target==="from"){safeSet("pdt-location",p);state.home=p;}syncMap();syncFields();renderConverter(true);}
function syncFields(){const target=fromTarget(),p=state[target];if($("coords-form")){$("coords-form").lat.value=p.lat;$("coords-form").lon.value=p.lon;}}
function syncMap(){if(!map)return;for(const type of ["from","to"]){const p=state[type];const loc=[p.lat,p.lon];if(pins[type])pins[type].setLatLng(loc);else pins[type]=window.L.circleMarker(loc,{radius:9,weight:3,color:type==="from"?"#a85f34":"#326b8c",fillColor:type==="from"?"#e8a769":"#88b6cb",fillOpacity:1}).addTo(map);pins[type].bindPopup(type==="from"?"Your place: "+p.name:"Other place: "+p.name);}}
function setupMap(){if(!$("pick-map"))return;if(!window.L){$("pick-map").innerHTML='<div class="map-fallback">Map library unavailable. Use the named-place search or coordinate inputs.</div>';return;}
 const L=window.L;map=L.map("pick-map",{worldCopyJump:true}).setView([15,15],2);L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
 map.on("click",e=>{const lat=Number(e.latlng.lat.toFixed(5)),lon=Number((((e.latlng.lng+180)%360+360)%360-180).toFixed(5));setPlace(fromTarget(),{lat,lon,name:"Selected map point"});});syncMap();
}
function renderConverter(redraw=false){if(!$("from-clock"))return;const t=state.live?Date.now():state.chosen;
 const a=at(t,state.from.lat,state.from.lon),b=at(t,state.to.lat,state.to.lon);
 $("from-clock").textContent=clockString(a.clock);$("to-clock").textContent=clockString(b.clock);
 $("from-name").textContent=state.from.name;$("to-name").textContent=state.to.name;$("from-coords").textContent=fmtCoords(state.from);$("to-coords").textContent=fmtCoords(state.to);
 const diff=difference(t,state.from,state.to);
 $("time-difference").textContent=Math.abs(diff)<.01?"essentially the same time":fmtDiff(diff)+" "+(diff>=0?"ahead":"behind");
 $("difference-description").textContent="at "+new Date(t).toLocaleString()+" on your device's clock. (Shortest signed PDT clock difference.)";
 if(redraw)renderCompareYear();
}
function renderCompareYear(){if(!$("compare-chart"))return;const year=Number($("compare-year").value);if(!Number.isInteger(year)||year<1800||year>2100)return;
 const data=[];const selected=new Date(state.live?Date.now():state.chosen);const utcWithin=state.live?12*3600000:(selected.getUTCHours()*3600+selected.getUTCMinutes()*60)*1000;
 for(let t=Date.UTC(year,0,1);t<Date.UTC(year+1,0,1);t+=DAY){data.push({date:new Date(t).toISOString().slice(0,10),diff:difference(t+utcWithin,state.from,state.to)});}
 drawChart($("compare-chart"),data,{value:x=>x.diff,date:x=>x.date,label:"compare",maxY:720,yLabel:v=>(v>=0?"+":"−")+fmtDiff(Math.abs(v))});
}
async function searchPlace(e){e.preventDefault();const input=$("search-place"),term=input.value.trim(),el=$("search-results");if(term.length<2)return;el.textContent="Searching…";
 try{const url="https://nominatim.openstreetmap.org/search?format=json&limit=4&q="+encodeURIComponent(term);
 const response=await fetch(url,{headers:{"Accept":"application/json"}});if(!response.ok)throw Error("Service unavailable");const places=await response.json();el.replaceChildren();
 if(!places.length){el.textContent="No matches. Try more specific terms or pick coordinates.";return;}
 for(const result of places){const b=document.createElement("button");b.type="button";b.textContent=result.display_name;b.addEventListener("click",()=>{const lat=Number(result.lat),lon=Number(result.lon);setPlace(fromTarget(),{lat,lon,name:result.display_name.split(",").slice(0,2).join(",")});map?.setView([lat,lon],8);el.replaceChildren();});el.append(b);}
 }catch{el.textContent="Place search unavailable. The map and coordinate fields still work.";}
}
function initConverter(){if(!$("from-clock"))return;state.from=savedLocation()||BURRA;
 updateYearInput("compare-year");$("when").value="";
 document.querySelectorAll('input[name="map-target"]').forEach(el=>el.addEventListener("change",syncFields));
 $("place-search").addEventListener("submit",searchPlace);
 $("coords-form").addEventListener("submit",e=>{e.preventDefault();const lat=Number(e.currentTarget.lat.value),lon=Number(e.currentTarget.lon.value);if(!validCoords(lat,lon))return;setPlace(fromTarget(),{lat,lon,name:"Chosen coordinates"});map?.setView([lat,lon],5);});
 $("converter-geolocate").addEventListener("click",()=>locate(p=>{setPlace("from",p);document.querySelector('input[name="map-target"][value="from"]').checked=true;syncFields();map?.setView([p.lat,p.lon],7);$("converter-message").textContent="Your device location selected."},msg=>$("converter-message").textContent=msg));
 document.querySelectorAll("[data-place]").forEach(b=>b.addEventListener("click",()=>{const [lat,lon,name]=b.dataset.place.split(",");setPlace(fromTarget(),{lat:Number(lat),lon:Number(lon),name});map?.setView([Number(lat),Number(lon)],5);}));
 $("when").addEventListener("change",()=>{const n=new Date($("when").value).getTime();if(Number.isFinite(n)){state.live=false;state.chosen=n;renderConverter(true);}});
 $("use-now").addEventListener("click",()=>{state.live=true;$("when").value="";renderConverter(true);});
 $("compare-year").addEventListener("change",renderCompareYear);window.addEventListener("resize",renderCompareYear);
 syncFields();renderConverter(true);setInterval(()=>renderConverter(false),500);
 // Wait for Leaflet's deferred script; the rest of the converter works without it.
 if(window.L)setupMap();else window.addEventListener("load",setupMap,{once:true});
}
initHome();initEot();initJumps();initConverter();

