/* =====================================================================
   Serenity booking-system DEMO — fake backend (Hifill Design Studio).
   Loaded BEFORE the shop / admin page scripts. Overrides window.fetch
   and answers every api/public.php and api/admin.php call from a
   localStorage-backed store, replicating the real Lumina booking
   system's contracts and its per-technician availability engine
   (weekly schedule + one-off days off + per-date shift overrides;
   a chain of treatments must fit ONE technician; a 2-guest treatment
   needs TWO distinct technicians; "No preference" bookings are gated
   by whole-team feasibility, exactly like api/lib.php).

   All data is fictional sample data. Nothing leaves the browser.
   Reset any time: SerenityDemo.reset() (also wired to buttons).
   ===================================================================== */
(function () {
  'use strict';
  var KEY = 'serenity_demo_v1';
  var VERSION = 1;

  /* ---------------- date / format helpers (local time) ---------------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function isoOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayStr() { return isoOf(new Date()); }
  function addDays(ds, n) { var p = ds.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]); d.setDate(d.getDate() + n); return isoOf(d); }
  function dowOf(ds) { var p = ds.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).getDay(); }
  function nowStamp() { var d = new Date(); return isoOf(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
  function fmtTime(mins) {
    mins = +mins; var h = Math.floor(mins / 60), m = mins % 60;
    var ap = h >= 12 ? 'PM' : 'AM'; var h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + ':' + pad(m) + ' ' + ap;
  }
  function fmtDay(ds) {
    var p = ds.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }
  function monthLabel(ym) {
    var p = ym.split('-'); var d = new Date(+p[0], +p[1] - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  function isDateStr(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
    var p = s.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isoOf(d) === s;
  }
  function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '')); }
  function overlaps(aS, aE, bS, bE) { return aS < bE && bS < aE; }
  function randRef() {
    var chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', s = '';
    for (var i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
  function randToken() {
    var s = '';
    for (var i = 0; i < 48; i++) s += '0123456789abcdef'[Math.floor(Math.random() * 16)];
    return s;
  }

  /* ---------------- seed data ---------------- */
  function seed() {
    var T = todayStr();
    var d = function (n) { return addDays(T, n); };
    /* Weekly schedules: 7 entries, index 0 = Sunday; [start,end] or null.
       Amy: Mon–Sat. Lily: Wed–Sun (later start). Grace: no schedule saved
       -> works the shop hours every day (the engine's fallback). */
    var amySched = JSON.stringify([null, [600, 1080], [600, 1080], [600, 1080], [600, 1080], [600, 1080], [600, 960]]);
    var lilySched = JSON.stringify([[720, 1260], null, null, [720, 1260], [720, 1260], [720, 1260], [720, 1260]]);
    var store = {
      version: VERSION,
      settings: {
        open_min: '600', close_min: '1260', slot_step: '30', window_days: '30',
        capacity: '2', cancel_cutoff_hours: '3', booking_mode: 'staff', notify_emails: ''
      },
      groups: [
        { id: 1, name: 'Signature', sort: 10 },
        { id: 2, name: 'Head Spa', sort: 20 },
        { id: 3, name: 'Facial', sort: 30 },
        { id: 4, name: 'Massage', sort: 40 },
        { id: 5, name: 'Special Combos', sort: 50 }
      ],
      treatments: [
        { id: 1, name: 'Aromatherapy Head Spa Ritual', cat: 'Signature', minutes: 75, price: 95, units: 1, active: 1, sort: 10 },
        { id: 2, name: 'Herbal Steam Head Therapy', cat: 'Signature', minutes: 90, price: 118, units: 1, active: 1, sort: 20 },
        { id: 3, name: 'Signature Japanese Head Spa', cat: 'Head Spa', minutes: 60, price: 72, units: 1, active: 1, sort: 30 },
        { id: 4, name: 'Deep Scalp Renewal Treatment', cat: 'Head Spa', minutes: 60, price: 84, units: 1, active: 1, sort: 40 },
        { id: 5, name: 'Radiance Renewal Facial', cat: 'Facial', minutes: 60, price: 76, units: 1, active: 1, sort: 50 },
        { id: 6, name: 'HydraDew Glow Facial', cat: 'Facial', minutes: 90, price: 148, units: 1, active: 1, sort: 60 },
        { id: 7, name: 'Swedish Massage', cat: 'Massage', minutes: 60, price: 82, units: 1, active: 1, sort: 70 },
        { id: 8, name: 'Hot Stone Massage', cat: 'Massage', minutes: 60, price: 92, units: 1, active: 1, sort: 80 },
        { id: 9, name: 'Foot Reflexology', cat: 'Massage', minutes: 45, price: 58, units: 1, active: 1, sort: 90 },
        { id: 10, name: 'Swedish Massage for Two', cat: 'Massage', minutes: 60, price: 138, units: 2, active: 1, sort: 100 },
        { id: 11, name: 'Head Spa & Facial Combo', cat: 'Special Combos', minutes: 90, price: 109, units: 1, active: 1, sort: 110 },
        { id: 12, name: 'Head Spa & Stone Massage Combo', cat: 'Special Combos', minutes: 90, price: 115, units: 1, active: 1, sort: 120 }
      ],
      technicians: [
        { id: 1, name: 'Amy', email: 'amy@serenitywellness.example', active: 1, sort: 1, sched: amySched },
        { id: 2, name: 'Lily', email: 'lily@serenitywellness.example', active: 1, sort: 2, sched: lilySched },
        { id: 3, name: 'Grace', email: '', active: 1, sort: 3, sched: null }
      ],
      daysOff: [{ tech_id: 1, d: d(5) }],
      shifts: [{ tech_id: 2, d: d(4), start_min: 720, end_min: 1020 }],
      blocked: [{ d: d(6), note: 'Staff training day' }],
      bookings: [],
      items: [],
      messages: [
        { id: 1, name: 'Priya Nair', email: 'priya.nair@example.com', phone: '647-555-0119', message: 'Hi! Do you sell gift cards? I would love to buy one for my mother.', created_at: d(0) + ' 09:12:00', seen: 0 },
        { id: 2, name: 'Tom Baker', email: 'tom.baker@example.com', phone: '', message: 'Hello — is there parking near the spa? Thanks!', created_at: d(-1) + ' 15:40:00', seen: 1 }
      ],
      seq: { treatment: 13, technician: 4, booking: 1, message: 3, group: 6 }
    };

    /* Resolve a technician whose roster window covers [s,e) on ds and who
       has no seeded booking overlapping — used so the seed bookings always
       sit on technicians who actually work then. */
    function winOf(tech, ds) {
      if (tech.sched == null || tech.sched === '') return [600, 1260];
      var map = JSON.parse(tech.sched); var v = map[dowOf(ds)];
      return Array.isArray(v) ? v : null;
    }
    function pick(ds, s, e, exclude) {
      exclude = exclude || [];
      var cands = store.technicians.slice().sort(function (a, b) { return a.sort - b.sort; });
      for (var i = 0; i < cands.length; i++) {
        var t = cands[i];
        if (exclude.indexOf(t.id) >= 0) continue;
        var w = winOf(t, ds); if (!w || s < w[0] || e > w[1]) continue;
        var clash = store.bookings.some(function (b) {
          return b.date === ds && b.status !== 'cancelled' &&
            (b.tech_id === t.id || b.tech2_id === t.id) && overlaps(s, e, b.start_min, b.end_min);
        });
        if (!clash) return t.id;
      }
      return 3; /* Grace fallback: shop hours every day */
    }
    function addBooking(o) {
      var totalMin = 0, totalPrice = 0, units = 1;
      o.treats.forEach(function (tid) {
        var t = store.treatments.find(function (x) { return x.id === tid; });
        totalMin += t.minutes; totalPrice += t.price; units = Math.max(units, t.units);
      });
      var id = store.seq.booking++;
      var b = {
        id: id, ref: randRef(), name: o.name, phone: o.phone, email: o.email || '', note: o.note || '',
        date: o.date, start_min: o.start, end_min: o.start + totalMin, total_min: totalMin,
        total_price: totalPrice, units: units,
        tech_id: o.tech !== undefined ? o.tech : null, tech2_id: o.tech2 || null,
        tech_pref: o.pref ? 1 : 0, status: o.status, source: o.source || 'online',
        token: randToken(), created_at: o.created || (T + ' 09:00:00')
      };
      store.bookings.push(b);
      var tcur = o.start;
      o.treats.forEach(function (tid) {
        var t = store.treatments.find(function (x) { return x.id === tid; });
        store.items.push({ booking_id: id, treatment_id: tid, name_snapshot: t.name, minutes: t.minutes, price: t.price, start_min: tcur, end_min: tcur + t.minutes });
        tcur += t.minutes;
      });
      return b;
    }

    var mayaTech = pick(d(1), 660, 780, []);
    addBooking({ name: 'Maya Chen', phone: '416-555-0142', email: 'maya.chen@example.com', note: 'First visit — my scalp is a bit sensitive.', date: d(1), start: 660, treats: [1, 9], tech: mayaTech, pref: 1, status: 'pending', created: d(0) + ' 08:47:00' });
    addBooking({ name: 'Jordan Lee', phone: '647-555-0108', email: 'jordan.lee@example.com', date: d(1), start: 840, treats: [3], tech: null, pref: 0, status: 'pending', created: d(0) + ' 09:05:00' });
    addBooking({ name: 'Sofia Ramirez', phone: '437-555-0163', email: 'sofia.r@example.com', date: d(0), start: 960, treats: [5], tech: pick(d(0), 960, 1020, []), pref: 0, status: 'confirmed', created: d(-1) + ' 18:22:00' });
    var cpl1 = pick(d(2), 780, 840, []), cpl2 = pick(d(2), 780, 840, [cpl1]);
    addBooking({ name: 'Daniel Kim', phone: '416-555-0127', email: 'daniel.kim@example.com', note: 'Anniversary treat for two.', date: d(2), start: 780, treats: [10], tech: cpl1, tech2: cpl2, pref: 0, status: 'confirmed', source: 'phone', created: d(0) + ' 10:15:00' });
    addBooking({ name: 'Emma Wilson', phone: '905-555-0171', email: 'emma.w@example.com', date: d(3), start: 630, treats: [11], tech: null, pref: 0, status: 'confirmed', source: 'phone', created: d(0) + ' 11:02:00' });
    addBooking({ name: 'Oliver Brown', phone: '647-555-0139', email: 'oliver.b@example.com', date: d(-1), start: 780, treats: [7], tech: 3, pref: 0, status: 'done', created: d(-2) + ' 13:30:00' });
    addBooking({ name: 'Ava Thompson', phone: '416-555-0186', email: 'ava.t@example.com', date: d(2), start: 1020, treats: [8], tech: pick(d(2), 1020, 1080, []), pref: 1, status: 'cancelled', created: d(-1) + ' 09:48:00' });
    addBooking({ name: 'Noah Williams', phone: '437-555-0155', email: '', date: d(0), start: 1110, treats: [9], tech: pick(d(0), 1110, 1155, []), pref: 0, status: 'confirmed', source: 'phone', created: d(0) + ' 12:26:00' });
    return store;
  }

  /* ---------------- store ---------------- */
  var store;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { var s = JSON.parse(raw); if (s && s.version === VERSION && s.settings && s.treatments) return s; }
    } catch (e) {}
    var s2 = seed(); store = s2; save(); return s2;
  }
  store = load();
  function reset() { store = seed(); save(); return counts(); }
  function counts() {
    return { treatments: store.treatments.length, technicians: store.technicians.length, bookings: store.bookings.length, messages: store.messages.length };
  }

  /* ---------------- availability engine (port of api/lib.php) ---------------- */
  function sInt(k, dflt) { var v = parseInt(store.settings[k], 10); return isNaN(v) ? dflt : v; }
  function parseSched(json) {
    if (json === null || json === undefined || String(json).trim() === '') return null;
    var d; try { d = JSON.parse(json); } catch (e) { return null; }
    if (!Array.isArray(d)) return null;
    var out = [];
    for (var i = 0; i < 7; i++) { var v = d[i]; out.push(Array.isArray(v) && v.length >= 2 ? [+v[0], +v[1]] : null); }
    return out;
  }
  function cleanSched(raw) {
    var d = typeof raw === 'string' ? (function () { try { return JSON.parse(raw); } catch (e) { return null; } })() : raw;
    if (!Array.isArray(d)) return '';
    var out = [];
    for (var i = 0; i < 7; i++) {
      var v = d[i];
      if (Array.isArray(v) && v.length >= 2) { var a = +v[0], b = +v[1]; out.push(a >= 0 && b <= 1440 && b > a ? [a, b] : null); }
      else out.push(null);
    }
    return JSON.stringify(out);
  }
  function activeTechs() {
    return store.technicians.filter(function (t) { return +t.active === 1; })
      .sort(function (a, b) { return (+a.sort - +b.sort) || (+a.id - +b.id); });
  }
  function techById(id) { return store.technicians.find(function (t) { return +t.id === +id; }) || null; }
  /* Roster resolution: day-off override > per-date shift > weekly > shop hours. */
  function techResolve(tech, ds) {
    var tid = +tech.id;
    if (store.daysOff.some(function (o) { return +o.tech_id === tid && o.d === ds; }))
      return { state: 'off', start: null, end: null, source: 'off_override' };
    var sh = store.shifts.find(function (s) { return +s.tech_id === tid && s.d === ds; });
    if (sh) return { state: 'work', start: +sh.start_min, end: +sh.end_min, source: 'shift' };
    var map = parseSched(tech.sched);
    if (map === null) return { state: 'work', start: sInt('open_min', 600), end: sInt('close_min', 1260), source: 'shop' };
    var v = map[dowOf(ds)];
    if (!Array.isArray(v)) return { state: 'off', start: null, end: null, source: 'weekly_off' };
    return { state: 'work', start: v[0], end: v[1], source: 'weekly' };
  }
  function techWindow(tech, ds) { var r = techResolve(tech, ds); return r.state === 'work' ? [r.start, r.end] : null; }
  function techFree(tech, ds, start, end, excludeId, ignoreOverlap) {
    var w = techWindow(tech, ds); if (!w) return false;
    if (start < w[0] || end > w[1]) return false;
    if (ignoreOverlap) return true;
    return !store.bookings.some(function (b) {
      return b.date === ds && (b.status === 'pending' || b.status === 'confirmed') &&
        +b.id !== +excludeId && (+b.tech_id === +tech.id || +b.tech2_id === +tech.id) &&
        overlaps(start, end, +b.start_min, +b.end_min);
    });
  }
  function techBookedMin(techId, ds, excludeId) {
    return store.bookings.reduce(function (a, b) {
      return a + ((b.date === ds && b.status !== 'cancelled' && +b.id !== +excludeId &&
        (+b.tech_id === +techId || +b.tech2_id === +techId)) ? (+b.end_min - +b.start_min) : 0);
    }, 0);
  }
  function staffAssign(ds, start, totalMin, units, techId, excludeId, ignoreOverlap) {
    excludeId = excludeId || 0;
    var end = start + totalMin, free = [];
    activeTechs().forEach(function (t) {
      if (techFree(t, ds, start, end, excludeId, !!ignoreOverlap)) {
        free.push({ t: t, load: techBookedMin(t.id, ds, excludeId) });
      }
    });
    function byLoad(a, b) { return (a.load - b.load) || ((+a.t.sort) - (+b.t.sort)) || ((+a.t.id) - (+b.t.id)); }
    if (techId > 0) {
      var chosen = null;
      free.forEach(function (f) { if (+f.t.id === techId) chosen = f; });
      if (!chosen) return null;
      if (units < 2) return { tech_id: techId, tech2_id: null };
      var others = free.filter(function (f) { return +f.t.id !== techId; }).sort(byLoad);
      if (!others.length) return null;
      return { tech_id: techId, tech2_id: +others[0].t.id };
    }
    if (free.length < units) return null;
    free.sort(byLoad);
    return { tech_id: +free[0].t.id, tech2_id: units >= 2 ? +free[1].t.id : null };
  }
  function combos(items, k) {
    if (k === 0) return [[]];
    if (items.length < k) return [];
    var out = [];
    for (var i = 0; i <= items.length - k; i++) {
      var rest = combos(items.slice(i + 1), k - 1);
      for (var j = 0; j < rest.length; j++) out.push([items[i]].concat(rest[j]));
    }
    return out;
  }
  function placeJobs(jobs, idx, occ) {
    if (idx >= jobs.length) return true;
    var j = jobs[idx], cand = [];
    j.win.forEach(function (tid) {
      var clash = (occ[tid] || []).some(function (iv) { return j.s < iv[1] && iv[0] < j.e; });
      if (!clash) cand.push(tid);
    });
    if (cand.length < j.need) return false;
    var cs = combos(cand, j.need);
    for (var c = 0; c < cs.length; c++) {
      cs[c].forEach(function (tid) { (occ[tid] = occ[tid] || []).push([j.s, j.e]); });
      if (placeJobs(jobs, idx + 1, occ)) return true;
      cs[c].forEach(function (tid) { occ[tid].pop(); });
    }
    return false;
  }
  /* Whole-team feasibility: assigned bookings stay pinned; unassigned ones
     may land on anyone whose roster covers them (backtracking placement). */
  function teamFeasible(ds, start, end, units, excludeId, pin) {
    pin = pin || []; excludeId = excludeId || 0;
    var techs = activeTechs();
    if (techs.length < units) return false;
    for (var p = 0; p < pin.length; p++) {
      var pt = techById(pin[p]); var pw = pt ? techWindow(pt, ds) : null;
      if (!pw || start < pw[0] || end > pw[1]) return false;
    }
    var rows = store.bookings.filter(function (b) {
      return b.date === ds && (b.status === 'pending' || b.status === 'confirmed') &&
        +b.id !== excludeId && overlaps(start, end, +b.start_min, +b.end_min);
    });
    if (!rows.some(function (b) { return !b.tech_id; })) return true;
    var winOf = {};
    techs.forEach(function (t) { var w = techWindow(t, ds); if (w) winOf[t.id] = w; });
    function cover(s, e) {
      return Object.keys(winOf).map(Number).filter(function (tid) { return s >= winOf[tid][0] && e <= winOf[tid][1]; });
    }
    var occ = {}, jobs = [];
    rows.forEach(function (b) {
      var fixed = [];
      if (b.tech_id) fixed.push(+b.tech_id);
      if (b.tech2_id) fixed.push(+b.tech2_id);
      fixed.forEach(function (ft) { (occ[ft] = occ[ft] || []).push([+b.start_min, +b.end_min]); });
      var need = Math.max(1, +b.units || 1) - fixed.length;
      if (need > 0) jobs.push({ s: +b.start_min, e: +b.end_min, need: need, win: cover(+b.start_min, +b.end_min) });
    });
    var newWin = cover(start, end);
    for (var q = 0; q < pin.length; q++) if (newWin.indexOf(pin[q]) < 0) return false;
    pin.forEach(function (pt) { (occ[pt] = occ[pt] || []).push([start, end]); });
    var newNeed = units - pin.length;
    if (newNeed > 0) jobs.push({ s: start, e: end, need: newNeed, win: newWin });
    jobs.sort(function (a, b) { return a.win.length - b.win.length; });
    return placeJobs(jobs, 0, occ);
  }
  function availableStartsStaff(ds, totalMin, units, techId, excludeId) {
    excludeId = excludeId || 0;
    var techs = activeTechs();
    var techList = techs.map(function (t) { return { id: +t.id, name: t.name }; });
    var empty = { starts: [], byStart: {}, techs: techList };
    var today = todayStr(), last = addDays(today, sInt('window_days', 30));
    if (ds < today || ds > last) return empty;
    if (store.blocked.some(function (b) { return b.d === ds; })) return empty;
    var open = sInt('open_min', 600), close = sInt('close_min', 1260), step = sInt('slot_step', 30);
    var nowMin = null;
    if (ds === today) { var n = new Date(); nowMin = n.getHours() * 60 + n.getMinutes(); }
    var starts = [], byStart = {};
    for (var st = open; st + totalMin <= close; st += step) {
      if (nowMin !== null && st <= nowMin) continue;
      var free = [];
      techs.forEach(function (t) { if (techFree(t, ds, st, st + totalMin, excludeId)) free.push(+t.id); });
      var ok = techId > 0 ? (free.indexOf(techId) >= 0 && (units < 2 || free.length >= 2)) : (free.length >= units);
      if (ok) ok = teamFeasible(ds, st, st + totalMin, units, excludeId, techId > 0 ? [techId] : []);
      if (ok) { starts.push(st); byStart[st] = free; }
    }
    return { starts: starts, byStart: byStart, techs: techList };
  }

  /* ---------------- shared booking helpers ---------------- */
  function bookingItems(bid) {
    return store.items.filter(function (i) { return +i.booking_id === +bid; })
      .sort(function (a, b) { return +a.start_min - +b.start_min; });
  }
  function bookingLines(bid) {
    return bookingItems(bid).map(function (i) {
      return i.name_snapshot + ' ' + fmtTime(i.start_min) + ' - ' + fmtTime(i.end_min);
    });
  }
  function techName(id) { var t = techById(id); return t ? t.name : null; }
  function bookingFull(b) {
    var out = {};
    Object.keys(b).forEach(function (k) { out[k] = b[k]; });
    out.id = +b.id; out.start_min = +b.start_min; out.end_min = +b.end_min;
    out.total_min = +b.total_min; out.total_price = +b.total_price; out.units = +b.units;
    out.tech_id = b.tech_id ? +b.tech_id : null; out.tech2_id = b.tech2_id ? +b.tech2_id : null;
    out.tech_pref = +b.tech_pref || 0;
    out.techName = b.tech_id ? techName(b.tech_id) : null;
    out.tech2Name = b.tech2_id ? techName(b.tech2_id) : null;
    out.suggest = null;
    if (!b.tech_id && (b.status === 'pending' || b.status === 'confirmed')) {
      var as = staffAssign(b.date, +b.start_min, +b.total_min, Math.max(1, +b.units), 0, +b.id);
      if (as) out.suggest = as.tech_id;
    }
    out.items = bookingItems(b.id).map(function (i) {
      return {
        name_snapshot: i.name_snapshot, name: i.name_snapshot, minutes: +i.minutes, price: +i.price,
        start_min: +i.start_min, end_min: +i.end_min,
        startLabel: fmtTime(i.start_min), endLabel: fmtTime(i.end_min)
      };
    });
    out.dayLabel = fmtDay(b.date);
    out.startLabel = fmtTime(b.start_min);
    out.endLabel = fmtTime(b.end_min);
    return out;
  }
  function insertBooking(fields, treatIds) {
    var items = [], totalMin = 0, totalPrice = 0, units = 1;
    treatIds.forEach(function (id) {
      var t = store.treatments.find(function (x) { return +x.id === +id; });
      if (!t) return;
      items.push(t); totalMin += +t.minutes; totalPrice += +t.price; units = Math.max(units, +t.units);
    });
    var id = store.seq.booking++;
    var b = {
      id: id, ref: randRef(), name: fields.name, phone: fields.phone, email: fields.email || '',
      note: fields.note || '', date: fields.date, start_min: fields.start, end_min: fields.start + totalMin,
      total_min: totalMin, total_price: totalPrice, units: units,
      tech_id: fields.tech_id || null, tech2_id: fields.tech2_id || null,
      tech_pref: fields.techId > 0 ? 1 : 0,
      status: fields.status, source: fields.source, token: randToken(), created_at: nowStamp()
    };
    store.bookings.push(b);
    var tcur = fields.start;
    items.forEach(function (t) {
      store.items.push({ booking_id: id, treatment_id: +t.id, name_snapshot: t.name, minutes: +t.minutes, price: +t.price, start_min: tcur, end_min: tcur + +t.minutes });
      tcur += +t.minutes;
    });
    return b;
  }
  function findTreatments(ids, mustBeActive) {
    var out = [];
    for (var i = 0; i < ids.length; i++) {
      var t = store.treatments.find(function (x) { return +x.id === +ids[i]; });
      if (!t || (mustBeActive && +t.active !== 1)) return null;
      out.push(t);
    }
    return out;
  }

  /* ---------------- public actions (api/public.php) ---------------- */
  var publicActions = {
    health: function () {
      return [200, { ok: true, live: true, mode: 'staff', techs: activeTechs().map(function (t) { return { id: +t.id, name: t.name }; }) }];
    },
    treatments: function () {
      var rows = store.treatments.filter(function (t) { return +t.active === 1; })
        .sort(function (a, b) { return (+a.sort - +b.sort) || (+a.id - +b.id); })
        .map(function (t) { return { id: +t.id, name: t.name, cat: t.cat, minutes: +t.minutes, price: +t.price, units: +t.units }; });
      return [200, { ok: true, treatments: rows }];
    },
    availability: function (q) {
      var date = q.get('date') || '';
      var minutes = Math.max(1, parseInt(q.get('minutes') || '60', 10) || 60);
      var units = Math.max(1, parseInt(q.get('units') || '1', 10) || 1);
      var exclude = parseInt(q.get('exclude') || '0', 10) || 0;
      var techId = parseInt(q.get('techId') || '0', 10) || 0;
      if (!isDateStr(date)) return [400, { ok: false, error: 'Bad date' }];
      var r = availableStartsStaff(date, minutes, units, techId, exclude);
      return [200, { ok: true, starts: r.starts, byStart: r.byStart, techs: r.techs }];
    },
    book: function (q, body) {
      var name = String(body.name || '').trim(), phone = String(body.phone || '').trim();
      var email = String(body.email || '').trim(), note = String(body.note || '').trim();
      var date = String(body.date || ''), start = parseInt(body.start, 10);
      var techId = parseInt(body.techId || 0, 10) || 0;
      var ids = (Array.isArray(body.items) ? body.items : []).map(function (x) { return parseInt(x, 10); }).slice(0, 5);
      if (name === '' || phone === '' || !ids.length || !isDateStr(date) || isNaN(start))
        return [422, { ok: false, error: 'Please complete your name, phone, treatment, date and time.' }];
      if (!validEmail(email))
        return [422, { ok: false, error: 'Please add your email — your confirmation and booking link are sent there.' }];
      var items = findTreatments(ids, true);
      if (!items) return [422, { ok: false, error: 'One of the treatments is no longer available.' }];
      var totalMin = 0, totalPrice = 0, units = 1;
      items.forEach(function (t) { totalMin += +t.minutes; totalPrice += +t.price; units = Math.max(units, +t.units); });
      var asTech = null, asTech2 = null;
      if (techId > 0) {
        var as = staffAssign(date, start, totalMin, units, techId, 0);
        if (!as) return [409, { ok: false, error: 'That time is no longer available for your chosen therapist — please pick another time, or choose “No preference”.' }];
        asTech = as.tech_id; asTech2 = as.tech2_id;
      } else if (!teamFeasible(date, start, start + totalMin, units, 0, [])) {
        return [409, { ok: false, error: 'That time was just taken — please pick another time.' }];
      }
      var b = insertBooking({ name: name, phone: phone, email: email, note: note, date: date, start: start, tech_id: asTech, tech2_id: asTech2, techId: techId, status: 'pending', source: 'online' }, ids);
      var summary = { date: date, dayLabel: fmtDay(date), lines: bookingLines(b.id), totalPrice: totalPrice, totalMin: totalMin };
      if (asTech) {
        var names = [techName(asTech), asTech2 ? techName(asTech2) : null].filter(Boolean);
        if (names.length) summary.withTechs = names.join(' & ');
      }
      return [200, { ok: true, ref: b.ref, manageUrl: 'admin.html', summary: summary, demoNote: 'Demo only — no email was sent.' }];
    },
    contact: function (q, body) {
      if (body.website) return [200, { ok: true }]; /* honeypot */
      var name = String(body.name || '').trim().slice(0, 120);
      var email = String(body.email || '').trim();
      var phone = String(body.phone || '').trim().slice(0, 40);
      var msg = String(body.message || '').trim().slice(0, 4000);
      if (name === '' || msg === '' || !validEmail(email))
        return [422, { ok: false, error: 'Please add your name, a valid email and your message.' }];
      store.messages.push({ id: store.seq.message++, name: name, email: email, phone: phone, message: msg, created_at: nowStamp(), seen: 0 });
      return [200, { ok: true }];
    }
  };

  /* ---------------- admin actions (api/admin.php) ---------------- */
  var adminActions = {
    me: function () { return [200, { ok: true, loggedIn: true }]; },
    login: function () { return [200, { ok: true }]; },
    logout: function () { return [200, { ok: true }]; },

    bookings: function (q) {
      var status = q.get('status'), date = q.get('date'), query = q.get('q'), from = q.get('from');
      var rows = store.bookings.filter(function (b) {
        if (status && b.status !== status) return false;
        if (date && b.date !== date) return false;
        if (from && b.date < from) return false;
        if (query) {
          var needle = query.toLowerCase();
          var hit = [b.name, b.phone, b.ref].some(function (v) { return String(v || '').toLowerCase().indexOf(needle) >= 0; });
          if (!hit) return false;
        }
        return true;
      });
      rows.sort(function (a, b) {
        if (!from) { var pa = a.status === 'pending' ? 0 : 1, pb = b.status === 'pending' ? 0 : 1; if (pa !== pb) return pa - pb; }
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        return (+a.start_min - +b.start_min) || (+a.id - +b.id);
      });
      return [200, { ok: true, bookings: rows.slice(0, 300).map(bookingFull) }];
    },

    month_counts: function (q) {
      var ym = q.get('ym') || todayStr().slice(0, 7);
      var out = {};
      store.bookings.forEach(function (b) {
        if (b.date.indexOf(ym + '-') !== 0 || b.status === 'cancelled') return;
        if (!out[b.date]) out[b.date] = { total: 0, pending: 0 };
        out[b.date].total++;
        if (b.status === 'pending') out[b.date].pending++;
      });
      return [200, { ok: true, counts: out }];
    },

    month_report: function (q) {
      var from = q.get('from') || '', to = q.get('to') || '', ym = q.get('ym') || '';
      var range = isDateStr(from) && isDateStr(to);
      if (range && to < from) { var tmp = from; from = to; to = tmp; }
      if (!range && !/^\d{4}-\d{2}$/.test(ym)) return [400, { ok: false, error: 'Bad month' }];
      var rows = store.bookings.filter(function (b) {
        return range ? (b.date >= from && b.date <= to) : (b.date.indexOf(ym + '-') === 0);
      }).sort(function (a, b) { return a.date === b.date ? (+a.start_min - +b.start_min) : (a.date < b.date ? -1 : 1); }).slice(0, 1000);
      var counts = { total: 0, confirmed: 0, pending: 0, done: 0, cancelled: 0 };
      var revenue = 0, served = 0, perTechMap = {}, perTreatMap = {};
      rows.forEach(function (b) {
        counts.total++;
        if (counts[b.status] !== undefined) counts[b.status]++;
        if (b.status !== 'cancelled') {
          revenue += +b.total_price; served++;
          [b.tech_id, b.tech2_id].forEach(function (tid) {
            if (!tid) return;
            if (!perTechMap[tid]) perTechMap[tid] = { name: techName(tid) || ('#' + tid), bookings: 0, minutes: 0 };
            perTechMap[tid].bookings++; perTechMap[tid].minutes += +b.total_min;
          });
          bookingItems(b.id).forEach(function (i) { perTreatMap[i.name_snapshot] = (perTreatMap[i.name_snapshot] || 0) + 1; });
        }
      });
      var perTreatment = Object.keys(perTreatMap).map(function (n) { return { name: n, count: perTreatMap[n] }; })
        .sort(function (a, b) { return (b.count - a.count) || (a.name < b.name ? -1 : 1); });
      var outRows = rows.map(function (b) {
        return {
          date: b.date, time: fmtTime(b.start_min), ref: b.ref, name: b.name, phone: b.phone, email: b.email,
          treatments: bookingItems(b.id).map(function (i) { return i.name_snapshot; }).join(' + '),
          total: +b.total_price, status: b.status, source: b.source,
          therapist: [b.tech_id ? techName(b.tech_id) : '', b.tech2_id ? techName(b.tech2_id) : ''].filter(Boolean).join(' & ')
        };
      });
      return [200, {
        ok: true, ym: range ? (from + '_to_' + to) : ym, from: range ? from : null, to: range ? to : null,
        counts: counts, revenue: revenue, bookingsServed: served,
        perTreatment: perTreatment, perTech: Object.keys(perTechMap).map(function (k) { return perTechMap[k]; }), rows: outRows
      }];
    },

    booking_status: function (q, body) {
      var id = parseInt(body.id, 10) || 0, status = String(body.status || '');
      if (['confirmed', 'cancelled', 'done', 'pending'].indexOf(status) < 0) return [400, { ok: false, error: 'Bad status' }];
      var b = store.bookings.find(function (x) { return +x.id === id; });
      if (!b) return [404, { ok: false, error: 'Not found' }];
      if (status === 'confirmed' && b.status === 'cancelled') {
        /* Restore: the slot must still fit the team. */
        if (b.tech_id) {
          var as = staffAssign(b.date, +b.start_min, +b.total_min, Math.max(1, +b.units), +b.tech_id, id);
          if (!as) return [409, { ok: false, error: 'That time has been taken since the cancellation, so this booking cannot be restored as-is.' }];
          b.tech_id = as.tech_id; b.tech2_id = as.tech2_id;
        } else if (!teamFeasible(b.date, +b.start_min, +b.start_min + +b.total_min, Math.max(1, +b.units), id, [])) {
          return [409, { ok: false, error: 'That time has been taken since the cancellation, so this booking cannot be restored as-is.' }];
        }
      }
      b.status = status;
      return [200, { ok: true }];
    },

    booking_assign: function (q, body) {
      var id = parseInt(body.id, 10) || 0, techId = parseInt(body.techId, 10) || 0;
      var b = store.bookings.find(function (x) { return +x.id === id; });
      if (!b) return [404, { ok: false, error: 'Booking not found' }];
      if (b.status === 'cancelled') return [422, { ok: false, error: 'Cancelled bookings cannot be reassigned.' }];
      var as = staffAssign(b.date, +b.start_min, +b.total_min, +b.units, techId, id);
      if (!as) return [422, { ok: false, error: techId > 0 ? "That therapist is not free at this booking's time — please pick another." : "No therapist is free at this booking's time." }];
      b.tech_id = as.tech_id; b.tech2_id = as.tech2_id;
      return [200, { ok: true }];
    },

    tech_day_bookings: function (q) {
      var techId = parseInt(q.get('techId') || '0', 10) || 0, date = q.get('date') || '';
      if (!isDateStr(date)) return [400, { ok: false, error: 'Bad date' }];
      var t = techById(techId);
      if (!t) return [404, { ok: false, error: 'Technician not found' }];
      var rows = store.bookings.filter(function (b) {
        return b.date === date && ['pending', 'confirmed', 'done'].indexOf(b.status) >= 0 &&
          (+b.tech_id === techId || +b.tech2_id === techId);
      }).sort(function (a, b) { return (+a.start_min - +b.start_min) || (+a.id - +b.id); }).map(bookingFull);
      return [200, { ok: true, tech: { id: +t.id, name: t.name, email: t.email || '' }, window: techWindow(t, date), dayLabel: fmtDay(date), bookings: rows }];
    },

    tech_day_email: function (q, body) {
      var techId = parseInt(body.techId, 10) || 0, date = String(body.date || '');
      if (!isDateStr(date)) return [400, { ok: false, error: 'Bad date' }];
      var t = techById(techId);
      if (!t) return [404, { ok: false, error: 'Technician not found' }];
      if (!t.email) return [422, { ok: false, error: 'No email on file for this technician — add one above first.' }];
      return [200, { ok: true, demo: true, note: 'Demo mode: no email was actually sent.' }];
    },

    phone_availability: function (q) {
      var ym = q.get('ym') || '';
      if (!/^\d{4}-\d{2}$/.test(ym)) return [400, { ok: false, error: 'Bad month' }];
      var p = ym.split('-'); var dim = new Date(+p[0], +p[1], 0).getDate();
      if (new Date(+p[0], +p[1] - 1, 1).getMonth() !== +p[1] - 1) return [400, { ok: false, error: 'Bad month' }];
      var minutes = Math.max(1, parseInt(q.get('minutes') || '60', 10) || 60);
      var units = Math.max(1, parseInt(q.get('units') || '1', 10) || 1);
      var techId = parseInt(q.get('techId') || '0', 10) || 0;
      var today = todayStr(), last = addDays(today, sInt('window_days', 30));
      var days = {};
      for (var dn = 1; dn <= dim; dn++) {
        var ds = ym + '-' + pad(dn);
        if (ds < today) { days[ds] = { starts: 0, state: 'past' }; continue; }
        if (store.blocked.some(function (b) { return b.d === ds; })) { days[ds] = { starts: 0, state: 'blocked' }; continue; }
        if (ds > last) { days[ds] = { starts: 0, state: 'outside' }; continue; }
        var n = availableStartsStaff(ds, minutes, units, techId, 0).starts.length;
        days[ds] = { starts: n, state: n >= 6 ? 'many' : (n >= 3 ? 'some' : (n >= 1 ? 'few' : 'full')) };
      }
      return [200, { ok: true, days: days }];
    },

    phone_booking: function (q, body) {
      var name = String(body.name || '').trim(), phone = String(body.phone || '').trim();
      var email = String(body.email || '').trim(), note = String(body.note || '').trim();
      var date = String(body.date || ''), start = parseInt(body.start, 10);
      var ids = (Array.isArray(body.items) ? body.items : []).map(function (x) { return parseInt(x, 10); }).slice(0, 5);
      var force = !!body.force, techId = parseInt(body.techId || 0, 10) || 0;
      if (name === '' || !ids.length || !isDateStr(date) || isNaN(start) || start < 0)
        return [422, { ok: false, error: 'Name, treatment, date and time are required.' }];
      var items = findTreatments(ids, false);
      if (!items) return [422, { ok: false, error: 'Unknown treatment' }];
      var totalMin = 0, units = 1;
      items.forEach(function (t) { totalMin += +t.minutes; units = Math.max(units, +t.units); });
      var asTech = null, asTech2 = null;
      if (techId > 0) {
        var as = staffAssign(date, start, totalMin, units, techId, 0, force);
        if (!as && !force) return [409, { ok: false, full: true, error: 'That therapist is not free at this time. Save anyway (overbook)?' }];
        if (as) { asTech = as.tech_id; asTech2 = as.tech2_id; }
      } else if (!force) {
        if (!teamFeasible(date, start, start + totalMin, units, 0, []))
          return [409, { ok: false, full: true, error: 'No therapist is free at this time. Save anyway (overbook)?' }];
      }
      var b = insertBooking({ name: name, phone: phone, email: email, note: note, date: date, start: start, tech_id: asTech, tech2_id: asTech2, techId: techId, status: 'confirmed', source: 'phone' }, ids);
      return [200, { ok: true, ref: b.ref }];
    },

    messages: function () {
      var rows = store.messages.slice().sort(function (a, b) { return +b.id - +a.id; }).slice(0, 200)
        .map(function (m) { return { id: +m.id, name: m.name, email: m.email, phone: m.phone, message: m.message, created_at: m.created_at, seen: +m.seen || 0 }; });
      return [200, { ok: true, messages: rows }];
    },
    message_seen: function (q, body) {
      var m = store.messages.find(function (x) { return +x.id === +(parseInt(body.id, 10) || 0); });
      if (m) m.seen = body.seen ? 1 : 0;
      return [200, { ok: true }];
    },
    message_delete: function (q, body) {
      var id = parseInt(body.id, 10) || 0;
      store.messages = store.messages.filter(function (x) { return +x.id !== id; });
      return [200, { ok: true }];
    },

    treatments: function () {
      var rows = store.treatments.slice()
        .sort(function (a, b) { return (+a.sort - +b.sort) || (+a.id - +b.id); })
        .map(function (t) { return { id: +t.id, name: t.name, cat: t.cat, minutes: +t.minutes, price: +t.price, units: +t.units, active: +t.active, sort: +t.sort }; });
      return [200, { ok: true, treatments: rows }];
    },
    treatment_save: function (q, body) {
      var id = parseInt(body.id, 10) || 0;
      var name = String(body.name || '').trim(), cat = String(body.cat || '').trim();
      var minutes = parseInt(body.minutes, 10) || 0, price = parseInt(body.price, 10) || 0;
      var units = parseInt(body.units, 10) || 1, active = body.active ? 1 : 0, sort = parseInt(body.sort, 10) || 0;
      if (name === '' || minutes <= 0) return [422, { ok: false, error: 'Name and minutes are required.' }];
      if (id) {
        var t = store.treatments.find(function (x) { return +x.id === id; });
        if (t) { t.name = name; t.cat = cat; t.minutes = minutes; t.price = price; t.units = units; t.active = active; t.sort = sort; }
      } else {
        store.treatments.push({ id: store.seq.treatment++, name: name, cat: cat, minutes: minutes, price: price, units: units, active: active, sort: sort });
      }
      return [200, { ok: true }];
    },
    groups: function () {
      var rows = store.groups.slice().sort(function (a, b) { return (+a.sort - +b.sort) || (+a.id - +b.id); })
        .map(function (g) {
          return { id: +g.id, name: g.name, sort: +g.sort, n: store.treatments.filter(function (t) { return t.cat === g.name; }).length };
        });
      return [200, { ok: true, groups: rows }];
    },
    treatment_delete: function (q, body) {
      var id = parseInt(body.id, 10) || 0;
      var used = store.items.some(function (i) { return +i.treatment_id === id; });
      if (used) {
        var t = store.treatments.find(function (x) { return +x.id === id; });
        if (t) t.active = 0;
        return [200, { ok: true, mode: 'hidden' }];
      }
      store.treatments = store.treatments.filter(function (x) { return +x.id !== id; });
      return [200, { ok: true, mode: 'deleted' }];
    },

    technicians: function () {
      var rows = store.technicians.slice()
        .sort(function (a, b) { return (+a.sort - +b.sort) || (+a.id - +b.id); })
        .map(function (t) { return { id: +t.id, name: t.name, email: t.email || '', active: +t.active, sort: +t.sort, sched: t.sched }; });
      return [200, { ok: true, technicians: rows }];
    },
    technician_save: function (q, body) {
      var id = parseInt(body.id, 10) || 0;
      var name = String(body.name || '').trim(), email = String(body.email || '').trim();
      if (name === '') return [422, { ok: false, error: 'Name required' }];
      if (email !== '' && !validEmail(email)) return [422, { ok: false, error: 'That email looks incomplete — please check it, or leave it blank.' }];
      var hasSched = Object.prototype.hasOwnProperty.call(body, 'sched');
      var schedVal = null;
      if (hasSched) { var cs = cleanSched(body.sched); schedVal = cs === '' ? null : cs; }
      if (id) {
        var t = techById(id);
        if (t) { t.name = name; t.email = email; t.active = body.active ? 1 : 0; if (hasSched) t.sched = schedVal; }
      } else {
        var maxSort = store.technicians.reduce(function (a, x) { return Math.max(a, +x.sort || 0); }, 0);
        store.technicians.push({ id: store.seq.technician++, name: name, email: email, active: 1, sort: maxSort + 1, sched: hasSched ? schedVal : null });
      }
      return [200, { ok: true }];
    },
    technician_delete: function (q, body) {
      var id = parseInt(body.id, 10) || 0;
      var t = techById(id);
      if (!t) return [404, { ok: false, error: 'Technician not found' }];
      var count = store.bookings.filter(function (b) { return +b.tech_id === id || +b.tech2_id === id; }).length;
      if (count > 0) { t.active = 0; return [200, { ok: true, mode: 'deactivated', bookings: count }]; }
      store.daysOff = store.daysOff.filter(function (o) { return +o.tech_id !== id; });
      store.shifts = store.shifts.filter(function (s) { return +s.tech_id !== id; });
      store.technicians = store.technicians.filter(function (x) { return +x.id !== id; });
      return [200, { ok: true, mode: 'deleted' }];
    },

    settings: function () {
      var s = {};
      Object.keys(store.settings).forEach(function (k) { s[k] = String(store.settings[k]); });
      return [200, { ok: true, settings: s, blocked: store.blocked.map(function (b) { return { d: b.d, note: b.note || '' }; }) }];
    },
    settings_save: function (q, body) {
      ['open_min', 'close_min', 'slot_step', 'window_days', 'capacity', 'cancel_cutoff_hours'].forEach(function (k) {
        if (body[k] !== undefined) store.settings[k] = String(parseInt(body[k], 10) || 0);
      });
      if (body.notify_emails !== undefined) store.settings.notify_emails = String(body.notify_emails).trim();
      if (body.booking_mode !== undefined) store.settings.booking_mode = body.booking_mode === 'staff' ? 'staff' : 'pool';
      return [200, { ok: true }];
    },

    tech_days_off: function (q) {
      var tid = parseInt(q.get('techId') || '0', 10) || 0;
      var days = store.daysOff.filter(function (o) { return +o.tech_id === tid; }).map(function (o) { return o.d; }).sort();
      return [200, { ok: true, days: days }];
    },
    tech_dayoff_add: function (q, body) {
      var tid = parseInt(body.techId, 10) || 0, d = String(body.date || '').trim();
      if (tid <= 0 || !isDateStr(d)) return [422, { ok: false, error: 'Pick a valid date.' }];
      if (!store.daysOff.some(function (o) { return +o.tech_id === tid && o.d === d; })) store.daysOff.push({ tech_id: tid, d: d });
      return [200, { ok: true }];
    },
    tech_dayoff_remove: function (q, body) {
      var tid = parseInt(body.techId, 10) || 0, d = String(body.date || '');
      store.daysOff = store.daysOff.filter(function (o) { return !(+o.tech_id === tid && o.d === d); });
      return [200, { ok: true }];
    },

    tech_month: function (q) {
      var tid = parseInt(q.get('techId') || '0', 10) || 0, ym = q.get('ym') || '';
      if (!/^\d{4}-\d{2}$/.test(ym)) return [400, { ok: false, error: 'Bad month' }];
      var t = techById(tid);
      if (!t) return [404, { ok: false, error: 'Unknown technician' }];
      var p = ym.split('-'); var dim = new Date(+p[0], +p[1], 0).getDate();
      var days = {};
      for (var dn = 1; dn <= dim; dn++) {
        var ds = ym + '-' + pad(dn);
        var r = techResolve(t, ds);
        days[ds] = { state: r.state, start: r.start, end: r.end, source: r.source };
      }
      return [200, { ok: true, tech: { id: tid, name: t.name }, ym: ym, monthLabel: monthLabel(ym), days: days }];
    },
    team_month: function (q) {
      var ym = q.get('ym') || '';
      if (!/^\d{4}-\d{2}$/.test(ym)) return [400, { ok: false, error: 'Bad month' }];
      var techs = activeTechs();
      var p = ym.split('-'); var dim = new Date(+p[0], +p[1], 0).getDate();
      var days = {};
      for (var dn = 1; dn <= dim; dn++) {
        var ds = ym + '-' + pad(dn), row = {};
        techs.forEach(function (t) { row[t.id] = techWindow(t, ds); });
        days[ds] = row;
      }
      return [200, { ok: true, ym: ym, monthLabel: monthLabel(ym), techs: techs.map(function (t) { return { id: +t.id, name: t.name }; }), days: days }];
    },
    tech_shift_set: function (q, body) {
      var tid = parseInt(body.techId, 10) || 0, d = String(body.date || '').trim();
      var start = parseInt(body.start, 10), end = parseInt(body.end, 10);
      if (tid <= 0 || !isDateStr(d)) return [422, { ok: false, error: 'Pick a valid date.' }];
      if (isNaN(start) || isNaN(end) || start < 0 || end > 1440 || end <= start) return [422, { ok: false, error: 'End time must be after start time.' }];
      if (!techById(tid)) return [404, { ok: false, error: 'Unknown technician' }];
      var sh = store.shifts.find(function (s) { return +s.tech_id === tid && s.d === d; });
      if (sh) { sh.start_min = start; sh.end_min = end; } else store.shifts.push({ tech_id: tid, d: d, start_min: start, end_min: end });
      store.daysOff = store.daysOff.filter(function (o) { return !(+o.tech_id === tid && o.d === d); });
      return [200, { ok: true }];
    },
    tech_shift_off: function (q, body) {
      var tid = parseInt(body.techId, 10) || 0, d = String(body.date || '').trim();
      if (tid <= 0 || !isDateStr(d)) return [422, { ok: false, error: 'Pick a valid date.' }];
      if (!techById(tid)) return [404, { ok: false, error: 'Unknown technician' }];
      if (!store.daysOff.some(function (o) { return +o.tech_id === tid && o.d === d; })) store.daysOff.push({ tech_id: tid, d: d });
      store.shifts = store.shifts.filter(function (s) { return !(+s.tech_id === tid && s.d === d); });
      return [200, { ok: true }];
    },
    tech_shift_clear: function (q, body) {
      var tid = parseInt(body.techId, 10) || 0, d = String(body.date || '').trim();
      if (tid <= 0 || !isDateStr(d)) return [422, { ok: false, error: 'Pick a valid date.' }];
      store.daysOff = store.daysOff.filter(function (o) { return !(+o.tech_id === tid && o.d === d); });
      store.shifts = store.shifts.filter(function (s) { return !(+s.tech_id === tid && s.d === d); });
      return [200, { ok: true }];
    },

    blocked_add: function (q, body) {
      var d = String(body.date || '');
      if (!isDateStr(d)) return [400, { ok: false, error: 'Bad date' }];
      if (!store.blocked.some(function (b) { return b.d === d; })) store.blocked.push({ d: d, note: String(body.note || '').trim() });
      return [200, { ok: true }];
    },
    blocked_remove: function (q, body) {
      var d = String(body.date || '');
      store.blocked = store.blocked.filter(function (b) { return b.d !== d; });
      return [200, { ok: true }];
    }
  };

  /* ---------------- fetch override ---------------- */
  function resp(status, payload) {
    return {
      ok: status >= 200 && status < 300,
      status: status,
      headers: { get: function () { return 'application/json'; } },
      json: function () { return Promise.resolve(payload); },
      text: function () { return Promise.resolve(JSON.stringify(payload)); }
    };
  }
  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (url, opts) {
    opts = opts || {};
    var u;
    try { u = new URL(String(url), window.location.href); } catch (e) { u = null; }
    var isAdmin = u && u.pathname.indexOf('admin.php') >= 0;
    var isPub = u && u.pathname.indexOf('public.php') >= 0;
    if (!u || (!isAdmin && !isPub)) {
      return nativeFetch ? nativeFetch(url, opts) : Promise.reject(new Error('fetch unavailable'));
    }
    var action = u.searchParams.get('action') || '';
    var body = {};
    if (opts.body) { try { body = JSON.parse(opts.body); } catch (e) { body = {}; } }
    var table = isAdmin ? adminActions : publicActions;
    var fn = table[action];
    var out;
    if (!fn) out = [400, { ok: false, error: 'Unknown action' }];
    else {
      try { out = fn(u.searchParams, body); } catch (e) { out = [500, { ok: false, error: 'Demo backend error: ' + (e && e.message) }]; }
    }
    if ((opts.method || 'GET').toUpperCase() === 'POST') save();
    return Promise.resolve(resp(out[0], out[1]));
  };

  /* ---------------- public handle for the hub page + tests ---------------- */
  window.SerenityDemo = { reset: reset, counts: counts, KEY: KEY, version: VERSION };
})();
