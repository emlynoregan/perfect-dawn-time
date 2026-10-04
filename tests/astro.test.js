import { test } from "node:test";
import assert from "node:assert/strict";
import {DAY,solar,dawn,at,clockString,annualJumps,sunriseAngle,difference} from "../source/astro.js";
const close=(a,b,tol)=>assert.ok(Math.abs(a-b)<tol,`Expected ${a} ≈ ${b}, tolerance ${tol}`);
const burra=[-33.682,138.94];
test("dawn always shows precisely 06:00:00",()=>{
  for(const coords of [[0,0],burra,[51.5,-.13],[60,25],[66.4,25],[-75,0],[90,60]]){
    for(const month of [0,2,5,8,11]){
      const day=Math.floor(Date.UTC(2026,month,14)/DAY), event=dawn(day,...coords);
      assert.equal(clockString(at(event.ms,...coords).clock),"06:00:00");
      assert.equal(at(event.ms-2000,...coords).nextJump!==undefined,true);
    }
  }
});
test("the event reset uses an ordinary ticking second until next sunrise",()=>{
 const event=dawn(Math.floor(Date.UTC(2026,8,21)/DAY),...burra);
 close(at(event.ms+9000,...burra).clock-at(event.ms+1000,...burra).clock,8000,.1);
});
test("the dawn jump is exactly the gap from 24h and changes sign",()=>{
 let dates=annualJumps(2026,...burra);
 assert.equal(dates.length,365);
 const pos=dates.find(x=>x.ms>0),neg=dates.find(x=>x.ms<0);
 assert.ok(pos && neg);close(pos.ms,DAY-(pos.dawnUTC-dawn(pos.dayIndex-1,...burra).ms),.01);
});
test("equinox geometry and polar no-rise labels",()=>{
 close(sunriseAngle(0,0).angle,90.8333,0.01);
 assert.equal(sunriseAngle(89,23.4).kind,"polar-day");
 assert.equal(sunriseAngle(89,-23.4).kind,"polar-night");
});
test("equation of time reflects annual solar wobble",()=>{
 const a=solar(Date.UTC(2026,1,11)).equationOfTime;
 const b=solar(Date.UTC(2026,10,3)).equationOfTime;
 assert.ok(a<-13 && a>-16,`Feb equation ${a}`);
 assert.ok(b>15 && b<17,`Nov equation ${b}`);
});
test("longitude offsets are about four minutes per degree at same latitude",()=>{
 const t=Date.UTC(2026,3,10,4);
 const a=at(t,0,0),b=at(t,0,1);
 close(b.clock-a.clock,240000,300);
});
test("daily equinox jump near Burra is roughly one minute",()=>{
 const data=annualJumps(2026,...burra);
 const equinox=data.find(x=>x.date==="2026-09-21");
 assert.ok(Math.abs(equinox.ms)>35000 && Math.abs(equinox.ms)<110000,`Observed ${equinox.ms/1000} sec`);
});
test("shortest signed PDT difference is zero at same place, antisymmetric",()=>{
 const t=Date.UTC(2026,9,5,10);
 const a={lat:-33.68,lon:138.94},b={lat:51.5,lon:-.13};
 close(difference(t,a,a),0,.0001);
 close(difference(t,a,b)+difference(t,b,a),0,.0001);
});

test("dawn events stay chronological even at high latitudes",()=>{
 for(const lat of [0,34,60,65,66,66.5,66.6,67,75,89,90,-66.6,-89]){
   const first=Math.floor(Date.UTC(2026,0,1)/DAY)-1;
   let prior=dawn(first,lat,25);
   for(let i=0;i<366;i++){
     const next=dawn(first+i+1,lat,25);
     assert.ok(next.ms>prior.ms,`Out-of-order dawn at latitude ${lat}, index ${i}, gap ${(next.ms-prior.ms)/60000} minutes`);
     prior=next;
   }
 }
});
