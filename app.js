/* AirGuard GR — λογική εφαρμογής.
 * Δεν χρησιμοποιεί κλειδιά API. Όλα τα δεδομένα από Open-Meteo (δωρεάν, χωρίς εγγραφή).
 */
(function () {
  "use strict";

  var C = window.AGCore;
  var STORE_KEY = "airguard.v1";
  var FORECAST = "https://api.open-meteo.com/v1/forecast";
  var AIRQ = "https://air-quality-api.open-meteo.com/v1/air-quality";
  var GEO = "https://geocoding-api.open-meteo.com/v1/search";     // οικισμοί
  var PHOTON = "https://photon.komoot.io/api";                    // οδοί, autocomplete
  var NOMINATIM = "https://nominatim.openstreetmap.org/search";   // οδοί, ακριβής
  var GR_BBOX = "19.3,34.7,29.8,41.9";
  var lastNominatim = 0;      // η πολιτική του Nominatim θέλει <=1 αίτημα/δευτερόλεπτο
  var searchSeq = 0;          // αγνοεί απαντήσεις παλιότερων πληκτρολογήσεων

  var state = {
    home: null,          // {lat, lon, label}
    radiusKm: 15,
    airports: [],        // με distanceKm + bearing
    selected: null,      // κλειδί αεροδρομίου
    hours: [],           // ωριαία δεδομένα
    nowIdx: 0,
    viewIdx: 0,
    fetchedAt: 0
  };

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- αποθήκευση ---------- */
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ home: state.home, radiusKm: state.radiusKm }));
    } catch (e) { /* private mode: συνεχίζουμε χωρίς αποθήκευση */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      if (o && o.home && typeof o.home.lat === "number") state.home = o.home;
      if (o && o.radiusKm) state.radiusKm = o.radiusKm;
    } catch (e) { /* αγνοούμε αλλοιωμένα δεδομένα */ }
  }

  /* ---------- βοηθητικά ---------- */
  function keyOf(a) { return a.icao || (a.name + a.lat); }
  /** Ακτίνα αποτυπώματος. Ρητή τιμή αν υπάρχει, αλλιώς προσέγγιση ανά κατηγορία. */
  var EXTENT_BY_KIND = { int: 1.2, mil: 1.0, nat: 0.7, pub: 0.4 };
  function extentOf(a) {
    return a.extentKm != null ? a.extentKm : (EXTENT_BY_KIND[a.kind] || 0.5);
  }
  function hhmm(iso) { return iso.slice(11, 16); }

  function getJSON(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  /* ---------- αεροδρόμια σε ακτίνα ---------- */
  function findAirports() {
    var h = state.home, out = [];
    for (var i = 0; i < window.AIRPORTS.length; i++) {
      var a = window.AIRPORTS[i];
      if (a.planned) continue;
      var d = C.distanceKm(h.lat, h.lon, a.lat, a.lon);
      if (d <= state.radiusKm) {
        out.push({
          ref: a,
          key: keyOf(a),
          distanceKm: d,
          bearing: C.bearingDeg(h.lat, h.lon, a.lat, a.lon)
        });
      }
    }
    out.sort(function (x, y) { return x.distanceKm - y.distanceKm; });
    return out;
  }

  /* ---------- λήψη δεδομένων ---------- */
  function loadWeather() {
    var h = state.home;
    var qs = "?latitude=" + h.lat.toFixed(4) + "&longitude=" + h.lon.toFixed(4);
    var wUrl = FORECAST + qs +
      "&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m" +
      "&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m" +
      "&timezone=auto&forecast_days=2&wind_speed_unit=kmh";
    var aUrl = AIRQ + qs +
      "&hourly=pm2_5,pm10,nitrogen_dioxide,ozone,european_aqi" +
      "&timezone=auto&forecast_days=2";

    return Promise.all([
      getJSON(wUrl),
      getJSON(aUrl).catch(function () { return null; })   // η ποιότητα αέρα είναι προαιρετική
    ]).then(function (res) {
      var w = res[0], aq = res[1];
      var aqMap = {};
      if (aq && aq.hourly && aq.hourly.time) {
        for (var j = 0; j < aq.hourly.time.length; j++) {
          aqMap[aq.hourly.time[j]] = {
            eaqi: aq.hourly.european_aqi[j],
            pm25: aq.hourly.pm2_5[j],
            pm10: aq.hourly.pm10[j],
            no2: aq.hourly.nitrogen_dioxide[j],
            o3: aq.hourly.ozone[j]
          };
        }
      }
      var hours = [];
      var t = w.hourly.time;
      for (var i = 0; i < t.length; i++) {
        var extra = aqMap[t[i]] || {};
        hours.push({
          time: t[i],
          windDir: w.hourly.wind_direction_10m[i],
          windKmh: w.hourly.wind_speed_10m[i],
          gust: w.hourly.wind_gusts_10m[i],
          eaqi: extra.eaqi == null ? null : extra.eaqi,
          pm25: extra.pm25, pm10: extra.pm10, no2: extra.no2, o3: extra.o3
        });
      }
      state.hours = hours;
      state.nowIdx = currentIndex(hours, w.current && w.current.time);
      state.viewIdx = state.nowIdx;
      state.fetchedAt = Date.now();
      state.tz = w.timezone;
    });
  }

  /** Θέση της τρέχουσας ώρας στη σειρά. Προτιμά την τοπική ώρα του server (timezone=auto). */
  function currentIndex(hours, currentTime) {
    if (currentTime) {
      var stamp = currentTime.slice(0, 13) + ":00";
      for (var i = 0; i < hours.length; i++) if (hours[i].time === stamp) return i;
    }
    var now = Date.now(), best = 0, bestDiff = Infinity;
    for (var k = 0; k < hours.length; k++) {
      var diff = Math.abs(new Date(hours[k].time).getTime() - now);
      if (diff < bestDiff) { bestDiff = diff; best = k; }
    }
    return best;
  }

  /* ---------- υπολογισμοί ---------- */
  function exposureFor(ap, idx) {
    var h = state.hours[idx];
    return C.hourExposure({
      windDirDeg: h.windDir,
      windKmh: h.windKmh,
      bearingHomeToAirport: ap.bearing,
      distanceKm: ap.distanceKm,
      extentKm: extentOf(ap.ref),
      eaqi: h.eaqi
    });
  }

  function selectedAirport() {
    for (var i = 0; i < state.airports.length; i++) {
      if (state.airports[i].key === state.selected) return state.airports[i];
    }
    return state.airports[0] || null;
  }

  /** Προεπιλέγει το αεροδρόμιο με τη μεγαλύτερη τρέχουσα ένδειξη. */
  function autoSelect() {
    var best = null, bestScore = -1;
    for (var i = 0; i < state.airports.length; i++) {
      var s = exposureFor(state.airports[i], state.nowIdx).score;
      if (s > bestScore) { bestScore = s; best = state.airports[i]; }
    }
    state.selected = best ? best.key : null;
  }

  /* ---------- ραντάρ ---------- */
  var SVG_NS = "http://www.w3.org/2000/svg";
  function el(name, attrs, text) {
    var n = document.createElementNS(SVG_NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }
  function pt(cx, cy, r, deg) {
    var a = (deg * Math.PI) / 180;
    return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  }
  function wedge(cx, cy, r, from, to, fill) {
    var p1 = pt(cx, cy, r, from), p2 = pt(cx, cy, r, to);
    var d = "M" + cx + " " + cy + " L" + p1[0].toFixed(2) + " " + p1[1].toFixed(2) +
            " A" + r + " " + r + " 0 0 1 " + p2[0].toFixed(2) + " " + p2[1].toFixed(2) + " Z";
    return el("path", { d: d, fill: fill });
  }

  function drawDial() {
    var svg = $("dial");
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var cx = 150, cy = 150, R = 118;
    var ap = selectedAirport();
    var h = state.hours[state.viewIdx];
    var exp = ap ? exposureFor(ap, state.viewIdx) : null;
    var lvlColor = exp ? ({ low: "#3fa07f", moderate: "#d9a136", high: "#d4574f" })[exp.level] : "#4a7d9e";

    // Δακτύλιοι απόστασης. Η κλίμακα είναι τετραγωνική ρίζα, ώστε τα πολύ κοντινά
    // αεροδρόμια να μην στοιβάζονται πάνω στο κέντρο. Κάθε δακτύλιος γράφει τα km του.
    [0.2, 0.5, 1].forEach(function (f, i) {
      var r = R * Math.sqrt(f);
      svg.appendChild(el("circle", {
        cx: cx, cy: cy, r: r, fill: "none",
        stroke: "#2f4759", "stroke-width": i === 2 ? 1.5 : 1
      }));
      var km = state.radiusKm * f;
      var q = pt(cx, cy, r, 138);
      svg.appendChild(el("text", {
        x: q[0] + 4, y: q[1], fill: "#6b8496", "font-size": "10", "text-anchor": "start"
      }, (km % 1 ? km.toFixed(1) : km) + " km"));
    });

    // Κώνος από όπου έρχεται ο αέρας. Το άνοιγμα είναι αυτό που χρησιμοποιεί και ο
    // υπολογισμός, ώστε η εικόνα να συμφωνεί με τον δείκτη.
    if (h) {
      var span = exp ? exp.spanHalf : 0;
      svg.appendChild(wedge(cx, cy, R, h.windDir - 35 - span, h.windDir + 35 + span, "rgba(74,125,158,.16)"));
      svg.appendChild(wedge(cx, cy, R, h.windDir - 12 - span, h.windDir + 12 + span, "rgba(74,125,158,.34)"));
    }

    // σημεία ορίζοντα
    [["Β", 0], ["Α", 90], ["Ν", 180], ["Δ", 270]].forEach(function (p) {
      var q = pt(cx, cy, R + 17, p[1]);
      svg.appendChild(el("text", {
        x: q[0], y: q[1] + 4, fill: "#93a9b9", "font-size": "12",
        "text-anchor": "middle"
      }, p[0]));
    });

    // βέλος ανέμου: έρχεται από την περιφέρεια προς το κέντρο
    if (h) {
      var tail = pt(cx, cy, R - 6, h.windDir);
      var head = pt(cx, cy, 19, h.windDir);
      svg.appendChild(el("line", {
        x1: tail[0], y1: tail[1], x2: head[0], y2: head[1],
        stroke: lvlColor, "stroke-width": 2.5, "stroke-linecap": "round"
      }));
      var b1 = pt(cx, cy, 34, h.windDir - 7), b2 = pt(cx, cy, 34, h.windDir + 7);
      svg.appendChild(el("path", {
        d: "M" + head[0].toFixed(1) + " " + head[1].toFixed(1) +
           " L" + b1[0].toFixed(1) + " " + b1[1].toFixed(1) +
           " L" + b2[0].toFixed(1) + " " + b2[1].toFixed(1) + " Z",
        fill: lvlColor
      }));
    }

    // αεροδρόμια
    for (var i = 0; i < state.airports.length; i++) {
      var a = state.airports[i];
      var rr = Math.max(22, Math.min(R - 4, R * Math.sqrt(a.distanceKm / state.radiusKm)));
      var p = pt(cx, cy, rr, a.bearing);
      var isSel = ap && a.key === ap.key;
      var half = C.footprintHalfAngle(a.distanceKm, extentOf(a.ref));
      if (isSel && half > 6 && half < 90) {
        // το αεροδρόμιο δεν είναι σημείο: τόξο με το πραγματικό γωνιακό του πλάτος
        var e1 = pt(cx, cy, rr, a.bearing - half), e2 = pt(cx, cy, rr, a.bearing + half);
        svg.appendChild(el("path", {
          d: "M" + e1[0].toFixed(1) + " " + e1[1].toFixed(1) + " A" + rr.toFixed(1) + " " +
             rr.toFixed(1) + " 0 0 1 " + e2[0].toFixed(1) + " " + e2[1].toFixed(1),
          fill: "none", stroke: lvlColor, "stroke-width": 7, "stroke-linecap": "round", opacity: ".85"
        }));
      }
      svg.appendChild(el("circle", {
        cx: p[0], cy: p[1], r: isSel ? 7 : 4.5,
        fill: isSel ? lvlColor : "#233748",
        stroke: isSel ? "#e7eef3" : "#4a7d9e", "stroke-width": 1.5
      }));
      if (isSel) {
        // η ετικέτα φεύγει έξω από το πλήθος γραμμών του κέντρου
        var lp = pt(cx, cy, Math.min(R + 2, rr + 19), a.bearing);
        svg.appendChild(el("text", {
          x: lp[0], y: lp[1] + 4, fill: "#e7eef3", "font-size": "12", "font-weight": "600",
          "text-anchor": lp[0] > cx + 16 ? "start" : lp[0] < cx - 16 ? "end" : "middle"
        }, a.ref.iata || a.ref.icao || "AP"));
      }
    }

    // κατοικία
    svg.appendChild(el("circle", { cx: cx, cy: cy, r: 5, fill: "#e7eef3" }));
    svg.appendChild(el("circle", { cx: cx, cy: cy, r: 11, fill: "none", stroke: "#e7eef3", "stroke-width": 1, opacity: ".45" }));

    $("dialTitle").innerHTML = h
      ? (state.viewIdx === state.nowIdx ? "Τώρα, " : "Πρόβλεψη ") + hhmm(h.time) +
        " · άνεμος από " + C.compass16(h.windDir) + " (" + Math.round(h.windDir) + "°)" +
        "<br>Στο κέντρο το σπίτι σας. Η σκιασμένη ζώνη δείχνει από πού έρχεται ο αέρας."
      : "";
  }

  /* ---------- ετυμηγορία & μετρήσεις ---------- */
  function drawVerdict() {
    var v = $("verdict"), ap = selectedAirport(), h = state.hours[state.viewIdx];
    v.className = "verdict";
    if (!ap) {
      var n = nearestAirport();
      v.innerHTML = "<h2>Δεν εντοπίστηκε αεροδρόμιο σε ακτίνα " + state.radiusKm + " km</h2>" +
        "<p>" + (n
          ? "Το πλησιέστερο είναι: " + n.ref.name + ", στα " + n.distanceKm.toFixed(1) +
            " km " + C.compass16(n.bearing) + ". Αυξήστε την ακτίνα αναζήτησης για να το παρακολουθείτε."
          : "Αυξήστε την ακτίνα αναζήτησης από τις ρυθμίσεις.") + "</p>";
      return;
    }
    var exp = exposureFor(ap, state.viewIdx);
    v.classList.add("lvl-" + exp.level);
    var when = state.viewIdx === state.nowIdx ? "Τώρα" : "Στις " + hhmm(h.time);
    var head, sub;

    if (exp.transport === 0) {
      head = "Ο άνεμος δεν έρχεται από το αεροδρόμιο";
      sub = "Πνέει από " + C.compass16(h.windDir) + ", ενώ το αεροδρόμιο βρίσκεται " +
            C.compass16(ap.bearing) + " από εσάς.";
    } else if (exp.level === "high") {
      head = "Ο αέρας έρχεται από το αεροδρόμιο προς εσάς";
      sub = "Οι συνθήκες ευνοούν έντονα τη μεταφορά αέρα προς την κατοικία σας.";
    } else if (exp.level === "moderate") {
      head = "Πιθανή μεταφορά αέρα από το αεροδρόμιο";
      sub = "Ο άνεμος έρχεται από την κατεύθυνση του αεροδρομίου, αλλά " + weakReason(exp, h) + ".";
    } else {
      head = "Χαμηλή πιθανότητα μεταφοράς";
      sub = "Η γωνία ή η ένταση του ανέμου δεν ευνοούν τη μεταφορά αέρα προς εσάς.";
    }

    var advice = exp.level === "high"
      ? "Αποφύγετε τον αερισμό αυτή την ώρα."
      : exp.level === "moderate"
        ? "Σύντομος αερισμός, αν χρειάζεται."
        : "Καλή ώρα για αερισμό.";

    if (h.eaqi != null) {
      advice += " Ποιότητα αέρα περιοχής: " + C.eaqiLabel(h.eaqi) + ".";
    }

    v.innerHTML =
      '<div class="flag"><span class="dot"></span>' + when + " · " + shortName(ap.ref.name) +
      " · δείκτης έκθεσης " + '<span class="num">' + exp.score + "</span>/100</div>" +
      "<h2>" + head + "</h2><p>" + sub + " " + advice + "</p>";

    var d = $("readings");
    d.innerHTML =
      cell("Άνεμος", num(Math.round(h.windKmh), "km/h") + " " + C.compass16(h.windDir)) +
      cell("Ριπές", num(h.gust == null ? null : Math.round(h.gust), "km/h")) +
      cell("Απόσταση", num(ap.distanceKm.toFixed(1), "km") + " " + C.compass16(ap.bearing) +
        (exp.spanHalf >= 3 ? " · ±" + Math.round(exp.spanHalf) + "° πλάτος" : "")) +
      cell("Απόκλιση από το όριο", num(Math.round(exp.effDelta), "°", true)) +
      cell("PM2.5", num(h.pm25 == null ? null : Number(h.pm25).toFixed(1), "µg/m³")) +
      cell("PM10", num(h.pm10 == null ? null : Number(h.pm10).toFixed(1), "µg/m³")) +
      cell("NO₂", num(h.no2 == null ? null : Number(h.no2).toFixed(1), "µg/m³")) +
      cell("AQI Ευρώπης", h.eaqi == null ? "—" : '<span class="num">' + Math.round(h.eaqi) + "</span> · " + C.eaqiLabel(h.eaqi));
  }
  function cell(k, v) { return "<div><dt>" + k + "</dt><dd>" + v + "</dd></div>"; }
  /** Αριθμός με μονάδα, ή «—» όταν δεν υπάρχει τιμή (χωρίς ορφανή μονάδα). */
  function num(v, unit, glued) {
    if (v == null || v === "" || (typeof v === "number" && isNaN(v))) return "—";
    return '<span class="num">' + v + "</span>" + (glued ? unit : " " + unit);
  }
  function nearestAirport() {
    var h = state.home, best = null;
    if (!h) return null;
    for (var i = 0; i < window.AIRPORTS.length; i++) {
      var a = window.AIRPORTS[i];
      if (a.planned) continue;
      var d = C.distanceKm(h.lat, h.lon, a.lat, a.lon);
      if (!best || d < best.distanceKm) {
        best = { ref: a, distanceKm: d, bearing: C.bearingDeg(h.lat, h.lon, a.lat, a.lon) };
      }
    }
    return best;
  }
  function shortName(n) { return n.replace(/\s*«[^»]*»\s*/g, " ").replace(/\s*\([^)]*\)\s*/g, " ").trim(); }
  function weakReason(exp, h) {
    if (h.windKmh < 3) return "η άπνοια κάνει τη διεύθυνση αναξιόπιστη";
    if (h.windKmh > 40) return "ο δυνατός άνεμος διασκορπίζει τον αέρα";
    if (exp.effDelta > 5) return "η γωνία αποκλίνει κατά " + Math.round(exp.effDelta) +
      "° από το όριο του αεροδρομίου";
    if (exp.travelKm > 8) return "η διαδρομή των " + exp.travelKm.toFixed(1) + " km βοηθά στην αραίωση";
    return "οι συνθήκες δεν είναι ακραίες";
  }

  /* ---------- 24ωρη λωρίδα ---------- */
  function drawStrip() {
    var strip = $("strip"), ap = selectedAirport();
    strip.innerHTML = "";
    if (!ap) { $("stripCard").classList.add("hidden"); return; }
    $("stripCard").classList.remove("hidden");

    var from = state.nowIdx, to = Math.min(state.hours.length, from + 24);
    var levels = [];
    for (var i = from; i < to; i++) {
      var exp = exposureFor(ap, i);
      levels.push(exp);
      var b = document.createElement("button");
      b.type = "button";
      b.className = "hr " + exp.level + (i === state.nowIdx ? " now" : "");
      b.setAttribute("aria-pressed", i === state.viewIdx ? "true" : "false");
      b.setAttribute("aria-label", hhmm(state.hours[i].time) + " — δείκτης " + exp.score);
      b.title = hhmm(state.hours[i].time) + " · " + exp.score + "/100";
      var s = document.createElement("span");
      s.style.height = Math.max(4, Math.round(exp.score * 0.72)) + "%";
      b.appendChild(s);
      b.dataset.idx = String(i);
      b.addEventListener("click", function () {
        state.viewIdx = parseInt(this.dataset.idx, 10);
        render();
      });
      strip.appendChild(b);
    }

    var lab = $("stripLabels");
    lab.innerHTML = "";
    [0, 6, 12, 18, 23].forEach(function (k) {
      if (from + k < to) {
        var sp = document.createElement("span");
        sp.textContent = hhmm(state.hours[from + k].time);
        lab.appendChild(sp);
      }
    });

    var wins = C.ventilationWindows(levels).slice(0, 3);
    if (!wins.length) {
      $("windows").innerHTML = "Δεν υπάρχει ώρα με χαμηλή ένδειξη στο επόμενο 24ωρο. Προτιμήστε τις ώρες με τη χαμηλότερη μπάρα.";
    } else {
      if (wins.length === 1 && wins[0].start === 0 && wins[0].end === levels.length - 1) {
        $("windows").innerHTML = "Καλή ένδειξη <strong>σε όλο το επόμενο 24ωρο</strong>.";
      } else {
        var txt = wins.map(function (w) {
          var a = hhmm(state.hours[from + w.start].time);
          var endIdx = Math.min(from + w.end + 1, state.hours.length - 1);
          var bEnd = hhmm(state.hours[endIdx].time);
          return "<strong>" + a + "–" + bEnd + "</strong>";
        }).join(", ");
        $("windows").innerHTML = "Καλύτερες ώρες για αερισμό: " + txt + ".";
      }
    }
  }

  /* ---------- λίστα αεροδρομίων ---------- */
  var KIND = { int: "διεθνές", nat: "κρατικό", pub: "δημόσιας χρήσης", mil: "στρατιωτικό" };
  function drawAirports() {
    var ul = $("aplist");
    ul.innerHTML = "";
    $("apHead").textContent = state.airports.length === 1
      ? "Αεροδρόμιο σε ακτίνα " + state.radiusKm + " km"
      : "Αεροδρόμια σε ακτίνα " + state.radiusKm + " km (" + state.airports.length + ")";
    if (!state.airports.length) {
      ul.innerHTML = '<li><p class="note" style="margin:10px 0">Κανένα. Δοκιμάστε μεγαλύτερη ακτίνα.</p></li>';
      return;
    }
    var sel = selectedAirport();
    if (sel) {
      // Σταθερή πληροφορία, ανεξάρτητη από τον καιρό: ποιοι άνεμοι σας φέρνουν
      // τον αέρα αυτού του αεροδρομίου.
      var half = C.footprintHalfAngle(sel.distanceKm, extentOf(sel.ref));
      var a1 = ((sel.bearing - 12 - half) % 360 + 360) % 360;
      var a2 = ((sel.bearing + 12 + half) % 360 + 360) % 360;
      var li0 = document.createElement("li");
      li0.innerHTML = '<p class="note" style="margin:8px 0">Σας επηρεάζουν άνεμοι που πνέουν από ' +
        C.compass16(a1) + " έως " + C.compass16(a2) + " (" + Math.round(a1) + "°–" +
        Math.round(a2) + "°). Με άνεμο από άλλη κατεύθυνση ο αέρας του αεροδρομίου " +
        "απομακρύνεται από εσάς.</p>";
      ul.appendChild(li0);
    }
    state.airports.forEach(function (a) {
      var exp = exposureFor(a, state.viewIdx);
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.className = "apbtn";
      b.setAttribute("aria-pressed", sel && a.key === sel.key ? "true" : "false");
      b.innerHTML =
        '<span class="dot" style="background:' +
        ({ low: "#3fa07f", moderate: "#d9a136", high: "#d4574f" })[exp.level] + '"></span>' +
        '<span class="nm"><b>' + a.ref.name + "</b><small>" +
        a.distanceKm.toFixed(1) + " km " + C.compass16(a.bearing) + " · " +
        (KIND[a.ref.kind] || "") + (a.ref.icao ? " · " + a.ref.icao : "") + "</small></span>" +
        '<span class="sc num">' + exp.score + "</span>";
      b.addEventListener("click", function () { state.selected = a.key; render(); });
      li.appendChild(b);
      ul.appendChild(li);
    });
  }

  /* ---------- render ---------- */
  function render() {
    $("placeName").textContent = state.home ? state.home.label : "Χωρίς τοποθεσία";
    drawDial();
    drawVerdict();
    drawStrip();
    drawAirports();
    Array.prototype.forEach.call($("radius").children, function (b) {
      b.setAttribute("aria-pressed", Number(b.dataset.km) === state.radiusKm ? "true" : "false");
    });
  }

  function showMain() {
    $("setup").classList.add("hidden");
    $("main").classList.remove("hidden");
    $("main").classList.add("fade");
    $("btnRefresh").classList.remove("hidden");
  }
  function showSetup() {
    $("main").classList.add("hidden");
    $("setup").classList.remove("hidden");
    $("btnRefresh").classList.add("hidden");
  }

  function refresh() {
    if (!state.home) return Promise.resolve();
    $("btnRefresh").textContent = "…";
    state.airports = findAirports();
    return loadWeather().then(function () {
      if (!state.selected || !selectedAirport()) autoSelect();
      showMain();
      render();
    }).catch(function (e) {
      $("verdict").innerHTML = '<h2>Δεν ήταν δυνατή η λήψη δεδομένων</h2><p>Ελέγξτε τη σύνδεση και δοκιμάστε ανανέωση. (' + e.message + ")</p>";
      showMain();
    }).then(function () {
      $("btnRefresh").textContent = "Ανανέωση";
    });
  }

  /* ---------- αναζήτηση τοποθεσίας ---------- */
  function parseCoords(s) {
    var m = s.trim().match(/^(-?\d{1,2}(?:[.,]\d+)?)\s*[, ]\s*(-?\d{1,3}(?:[.,]\d+)?)$/);
    if (!m) return null;
    var lat = parseFloat(m[1].replace(",", ".")), lon = parseFloat(m[2].replace(",", "."));
    if (isNaN(lat) || isNaN(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { lat: lat, lon: lon };
  }

  /* Κανονικοποίηση αποτελεσμάτων από τους τρεις geocoders σε κοινή μορφή:
     {lat, lon, label, sub, kind, source} */

  function fromPhoton(d) {
    return ((d && d.features) || []).filter(function (f) {
      return f.properties && f.properties.countrycode === "GR" && f.geometry;
    }).map(function (f) {
      var p = f.properties;
      var street = p.street || (p.osm_key === "highway" ? p.name : null);
      var label = street
        ? street + (p.housenumber ? " " + p.housenumber : "")
        : (p.name || "");
      var area = [p.district, p.city || p.town || p.village || p.locality, p.county]
        .filter(Boolean);
      // χωρίς διπλότυπα στην περιγραφή
      area = area.filter(function (x, i) { return area.indexOf(x) === i && x !== label; });
      return {
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
        label: label,
        sub: area.join(", "),
        kind: p.housenumber ? "διεύθυνση" : p.osm_key === "highway" ? "οδός" : "περιοχή",
        source: "photon"
      };
    }).filter(function (r) { return r.label; });
  }

  function fromNominatim(list) {
    return (list || []).map(function (r) {
      var a = r.address || {};
      var street = a.road || a.pedestrian || a.residential;
      var label = street
        ? street + (a.house_number ? " " + a.house_number : "")
        : (r.name || (r.display_name || "").split(",")[0]);
      var area = [a.suburb || a.village || a.town || a.city, a.county].filter(Boolean);
      area = area.filter(function (x) { return x !== label; });
      return {
        lat: parseFloat(r.lat), lon: parseFloat(r.lon),
        label: label, sub: area.join(", "),
        kind: a.house_number ? "διεύθυνση" : street ? "οδός" : "περιοχή",
        source: "nominatim"
      };
    }).filter(function (r) { return r.label && !isNaN(r.lat); });
  }

  function fromOpenMeteo(d) {
    return ((d && d.results) || []).filter(function (r) { return r.country_code === "GR"; })
      .map(function (r) {
        return {
          lat: r.latitude, lon: r.longitude, label: r.name,
          sub: [r.admin2, r.admin1].filter(Boolean).join(", "),
          kind: "περιοχή", source: "open-meteo"
        };
      });
  }

  /** Ενώνει λίστες, κρατά τις οδούς/διευθύνσεις πρώτες, πετάει τα διπλά. */
  function mergeResults(lists) {
    var rank = { "διεύθυνση": 0, "οδός": 1, "περιοχή": 2 };
    var seen = {}, out = [];
    lists.forEach(function (list) {
      list.forEach(function (r) {
        var k = r.label + "|" + r.lat.toFixed(3) + "," + r.lon.toFixed(3);
        if (seen[k]) return;
        seen[k] = 1;
        out.push(r);
      });
    });
    return out.sort(function (a, b) { return rank[a.kind] - rank[b.kind]; }).slice(0, 12);
  }

  function bias() {
    var h = state.home;
    return h ? "&lat=" + h.lat.toFixed(3) + "&lon=" + h.lon.toFixed(3) : "&lat=38.0&lon=23.7";
  }

  /** Photon: γρήγορο, φτιαγμένο για autocomplete. */
  function searchPhoton(q) {
    return getJSON(PHOTON + "?q=" + encodeURIComponent(q) + "&limit=12&bbox=" + GR_BBOX + bias())
      .then(fromPhoton).catch(function () { return []; });
  }

  /** Nominatim: μόνο σε ρητή αναζήτηση, με σεβασμό στο όριο 1 αιτήματος/δευτερόλεπτο. */
  function searchNominatim(q) {
    var wait = Math.max(0, 1100 - (Date.now() - lastNominatim));
    return new Promise(function (resolve) { setTimeout(resolve, wait); }).then(function () {
      lastNominatim = Date.now();
      return getJSON(NOMINATIM + "?format=jsonv2&countrycodes=gr&addressdetails=1&limit=12&q=" +
                     encodeURIComponent(q));
    }).then(fromNominatim).catch(function () { return []; });
  }

  function searchPlaces(q) {
    return getJSON(GEO + "?name=" + encodeURIComponent(q) + "&count=10&language=el&format=json")
      .then(fromOpenMeteo).catch(function () { return []; });
  }

  function renderResults(list, q) {
    var ul = $("results");
    ul.innerHTML = "";
    if (!list.length) {
      $("searchMsg").innerHTML = "Δεν βρέθηκε τίποτα για «" + q + "». Δοκίμασε οδό μαζί με περιοχή " +
        "(π.χ. «Μπέκα Σπάτα»), μόνο την περιοχή, ή συντεταγμένες από τους Χάρτες Google " +
        "(παρατεταμένο πάτημα στο σπίτι σου → αντιγραφή των αριθμών).";
      return;
    }
    $("searchMsg").textContent = "";
    list.forEach(function (r) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.innerHTML = "<span>" + r.label + ' <span class="tag">' + r.kind + "</span></span><small>" +
        (r.sub ? r.sub + " · " : "") + r.lat.toFixed(4) + ", " + r.lon.toFixed(4) + "</small>";
      b.addEventListener("click", function () {
        setHome({
          lat: r.lat, lon: r.lon,
          label: r.label + (r.sub ? ", " + r.sub.split(",")[0] : "")
        });
        if (r.kind === "οδός") {
          // το σημείο μιας ολόκληρης οδού είναι το μέσο της· σε μακριές οδούς μετράει
          $("streetHint").classList.remove("hidden");
        }
      });
      li.appendChild(b);
      ul.appendChild(li);
    });
  }

  /** full=true: ρητή αναζήτηση, ρωτά και τους δύο geocoders. */
  function doSearch(full) {
    var q = $("q").value.trim();
    if (!q) { $("results").innerHTML = ""; $("searchMsg").textContent = ""; return; }

    var coords = parseCoords(q);
    if (coords) {
      setHome({ lat: coords.lat, lon: coords.lon, label: coords.lat.toFixed(4) + ", " + coords.lon.toFixed(4) });
      return;
    }
    if (q.length < 3) return;

    var seq = ++searchSeq;
    $("searchMsg").textContent = "Αναζήτηση…";
    var jobs = full ? [searchPhoton(q), searchNominatim(q), searchPlaces(q)] : [searchPhoton(q)];
    Promise.all(jobs).then(function (lists) {
      if (seq !== searchSeq) return;                 // ήρθε νεότερη αναζήτηση
      var merged = mergeResults(lists);
      if (!merged.length && !full) return doSearch(true);   // δοκιμή με όλους
      renderResults(merged, q);
    });
  }

  function useGps() {
    if (!navigator.geolocation) {
      $("searchMsg").textContent = "Η συσκευή δεν υποστηρίζει εντοπισμό θέσης.";
      return;
    }
    $("searchMsg").textContent = "Εντοπισμός θέσης…";
    navigator.geolocation.getCurrentPosition(function (p) {
      setHome({
        lat: p.coords.latitude, lon: p.coords.longitude,
        label: "Τρέχουσα θέση (" + p.coords.latitude.toFixed(3) + ", " + p.coords.longitude.toFixed(3) + ")"
      });
    }, function () {
      $("searchMsg").textContent = "Δεν δόθηκε άδεια τοποθεσίας. Γράψτε την περιοχή σας παραπάνω.";
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
  }

  function setHome(home) {
    state.home = home;
    state.selected = null;
    save();
    $("searchMsg").textContent = "";
    $("results").innerHTML = "";
    refresh();
  }

  /* ---------- συμβάντα ---------- */
  $("btnSearch").addEventListener("click", function () { doSearch(true); });
  $("q").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); doSearch(true); }
  });
  var typeTimer = null;
  $("q").addEventListener("input", function () {
    clearTimeout(typeTimer);
    typeTimer = setTimeout(function () { doSearch(false); }, 450);
  });
  $("btnGps").addEventListener("click", useGps);
  $("btnRefresh").addEventListener("click", refresh);
  $("btnChange").addEventListener("click", function () {
    $("q").value = "";
    $("results").innerHTML = "";
    $("streetHint").classList.add("hidden");
    showSetup();
  });
  Array.prototype.forEach.call($("radius").children, function (b) {
    b.addEventListener("click", function () {
      state.radiusKm = Number(b.dataset.km);
      state.selected = null;
      save();
      state.airports = findAirports();
      autoSelect();
      render();
    });
  });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && state.home && Date.now() - state.fetchedAt > 15 * 60 * 1000) refresh();
  });

  /* ---------- εκκίνηση ---------- */
  load();
  if (state.home) refresh(); else showSetup();
})();
