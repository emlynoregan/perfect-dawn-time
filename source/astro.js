/**
 * Perfect Dawn Time astronomical engine.
 * Dates are absolute UTC milliseconds; east longitude and north latitude are positive.
 * A "day" is indexed by the local MEAN solar date (not a political time zone).
 * Each ideal-horizon sunrise starts a new PDT day at 06:00. In polar no-rise
 * periods a clearly flagged *virtual dawn* uses the clipped sunrise hour angle.
 * NOAA/Meeus approximate solar position; not an observational ephemeris.
 */
export const DAY = 86400000;
const RAD = Math.PI / 180;
const deg = x => x / RAD;
const sin = x => Math.sin(x * RAD);
const cos = x => Math.cos(x * RAD);
const tan = x => Math.tan(x * RAD);
const mod = (x, n) => ((x % n) + n) % n;
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export function solar(t) {
  const jd = t / DAY + 2440587.5;
  const T = (jd - 2451545) / 36525;
  const L0 = mod(280.46646 + T * (36000.76983 + 0.0003032 * T), 360);
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const ecc = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = sin(M) * (1.914602 - T * (0.004817 + 0.000014 * T))
    + sin(2*M) * (0.019993 - 0.000101 * T) + sin(3*M) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const apparent = L0 + C - 0.00569 - 0.00478 * sin(omega);
  const obliq0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const obliq = obliq0 + 0.00256 * cos(omega);
  const declination = deg(Math.asin(sin(obliq) * sin(apparent)));
  const y = tan(obliq / 2) ** 2;
  const equationOfTime = 4 * deg(
    y * sin(2*L0) - 2*ecc * sin(M) + 4*ecc*y*sin(M)*cos(2*L0)
    - 0.5*y*y*sin(4*L0) - 1.25*ecc*ecc*sin(2*M)
  );
  return { declination, equationOfTime };
}

export function sunriseAngle(latitude, declination) {
  const phi = clamp(latitude, -90, 90);
  const denom = cos(phi) * cos(declination);
  const arg = (sin(-0.8333) - sin(phi) * sin(declination)) / Math.max(1e-12, denom);
  if (arg < -1) return { angle: 180, kind: "polar-day" };
  if (arg > 1) return { angle: 0, kind: "polar-night" };
  return { angle: deg(Math.acos(clamp(arg, -1, 1))), kind: "sunrise" };
}

/** Sunrise attached to the given local-mean-solar calendar day.
 * Even at longitude +/-180 this is an unambiguous day index.
 */
export function dawn(dayIndex, latitude, longitude) {
  if (!Number.isInteger(dayIndex) || !validCoords(latitude, longitude)) throw new Error("Invalid date or coordinates");
  const base = dayIndex * DAY;
  // Use local solar noon for initial declination, iterate at the event itself.
  let t = base + (720 - 4*longitude) * 60000;
  let event = { kind: "sunrise" };
  for (let i=0; i<5; i++) {
    const { declination, equationOfTime } = solar(t);
    event = sunriseAngle(latitude, declination);
    t = base + (720 - 4*longitude - 4*event.angle - equationOfTime) * 60000;
  }
  return { ms: t, dayIndex, kind: event.kind };
}
export function validCoords(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

export function at(t, latitude, longitude) {
  if (!validCoords(latitude, longitude) || !Number.isFinite(t)) throw new Error("Invalid coordinates or time");
  const localDay = Math.floor((t + 4 * longitude * 60000) / DAY);
  let before = null, after = null;
  // 3 days either side, robust around ±180 longitude and polar virtual dawn.
  for (let d=localDay-3; d<=localDay+3; d++) {
    const candidate = dawn(d, latitude, longitude);
    if (candidate.ms <= t && (!before || candidate.ms > before.ms)) before = candidate;
    if (candidate.ms > t && (!after || candidate.ms < after.ms)) after = candidate;
  }
  if (!before || !after) throw new Error("Cannot bracket dawn");
  const clock = mod(6*3600000 + t - before.ms, DAY);
  return {
    clock, before, after,
    untilDawn: after.ms - t,
    sinceDawn: t - before.ms,
    // Jump occurring at the NEXT sunrise: difference from 06:00 on the pre-jump clock.
    nextJump: DAY - (after.ms - before.ms),
    virtual: before.kind !== "sunrise" || after.kind !== "sunrise"
  };
}
export function timeParts(ms) {
  const whole = Math.floor(mod(ms, DAY) / 1000);
  return { h: Math.floor(whole / 3600), m: Math.floor(whole / 60) % 60, s: whole % 60 };
}
export function clockString(ms, seconds = true) {
  const {h,m,s} = timeParts(ms);
  const pad = n => String(n).padStart(2, "0");
  return pad(h) + ":" + pad(m) + (seconds ? ":" + pad(s) : "");
}
export function jumpString(ms, decimals = false) {
  const sec = Math.abs(ms) / 1000;
  const v = sec >= 60 ? (sec/60).toFixed(1) + " min" : (decimals ? sec.toFixed(1) : sec.toFixed(0)) + " s";
  return (ms < 0 ? "−" : ms > 0 ? "+" : "±") + v;
}
export function dateOfDay(dayIndex, longitude = 0) {
  return new Date(dayIndex * DAY + (12*60 - 4*longitude)*60000).toISOString().slice(0,10);
}
export function annualJumps(year, latitude, longitude) {
  if (!Number.isInteger(year) || year < 1800 || year > 2100 || !validCoords(latitude, longitude)) throw new Error("Invalid inputs");
  const start = Math.floor(Date.UTC(year,0,1) / DAY);
  const end = Math.floor(Date.UTC(year+1,0,1) / DAY);
  const result=[];
  let prior = dawn(start-1,latitude,longitude);
  for(let d=start; d<end; d++) {
    const next=dawn(d,latitude,longitude);
    result.push({
      date: new Date(d * DAY).toISOString().slice(0,10),
      dayIndex:d, ms:DAY-(next.ms-prior.ms),
      kind: next.kind, dawnUTC: next.ms
    });
    prior=next;
  }
  return result;
}
export function difference(t, from, to) {
  let minutes=(at(t,to.lat,to.lon).clock - at(t,from.lat,from.lon).clock)/60000;
  // Represent the shortest signed clock difference. At ±12h there is no unique answer.
  minutes=((minutes+720)%1440+1440)%1440-720;
  return minutes;
}
