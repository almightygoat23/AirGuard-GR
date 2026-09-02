const C = require("./core.js");
let fails = 0;
function ok(name, cond, extra) {
  if (!cond) { fails++; console.log("FAIL " + name + (extra !== undefined ? "  -> " + extra : "")); }
  else console.log("ok   " + name + (extra !== undefined ? "  (" + extra + ")" : ""));
}
function near(a, b, tol) { return Math.abs(a - b) <= tol; }

// Γνωστά σημεία
const ASPRO = [38.0611, 23.5936];       // Ασπρόπυργος
const LGEL  = [38.0646, 23.5556];       // Ελευσίνα (στρατιωτικό)
const LGAV  = [37.936389, 23.947222];   // Ελ. Βενιζέλος
const SPATA = [37.9642, 23.9167];       // Σπάτα

// Αποστάσεις: Αθήνα–Θεσσαλονίκη ~ 300 km σε ευθεία
ok("distance Athens-Thessaloniki ~301km",
   near(C.distanceKm(37.9838, 23.7275, 40.6401, 22.9444), 301, 6),
   C.distanceKm(37.9838, 23.7275, 40.6401, 22.9444).toFixed(1));

ok("distance Aspropyrgos-Elefsina AB ~3.4km",
   near(C.distanceKm(...ASPRO, ...LGEL), 3.4, 0.6),
   C.distanceKm(...ASPRO, ...LGEL).toFixed(2));

ok("Spata-LGAV under 15km",
   C.distanceKm(...SPATA, ...LGAV) < 15,
   C.distanceKm(...SPATA, ...LGAV).toFixed(2));

// Αζιμούθια
ok("bearing due north = 0", near(C.bearingDeg(37, 23, 38, 23), 0, 0.01));
ok("bearing due east ~90", near(C.bearingDeg(37, 23, 37, 24), 90, 0.5),
   C.bearingDeg(37, 23, 37, 24).toFixed(2));
ok("bearing due south = 180", near(C.bearingDeg(38, 23, 37, 23), 180, 0.01));
ok("bearing due west ~270", near(C.bearingDeg(37, 24, 37, 23), 270, 0.5));

const bAsproToElefsina = C.bearingDeg(...ASPRO, ...LGEL);
ok("Aspropyrgos -> Elefsina bearing is west-northwest (280-300)",
   bAsproToElefsina > 275 && bAsproToElefsina < 305, bAsproToElefsina.toFixed(1));

// Γωνιακή διαφορά
ok("angleDiff 350 vs 10 = 20", C.angleDiff(350, 10) === 20);
ok("angleDiff 10 vs 350 = 20", C.angleDiff(10, 350) === 20);
ok("angleDiff 0 vs 180 = 180", C.angleDiff(0, 180) === 180);

// Πυξίδα
ok("compass16 0 = Β", C.compass16(0) === "Β");
ok("compass16 90 = Α", C.compass16(90) === "Α");
ok("compass16 225 = ΝΔ", C.compass16(225) === "ΝΔ");
ok("compass16 359 = Β", C.compass16(359) === "Β");

// ΣΥΜΒΑΣΗ: άνεμος από το αεροδρόμιο => wind_direction ~ bearing(κατοικία->αεροδρόμιο)
// Ασπρόπυργος, αεροδρόμιο ΔΒΔ (~290). Δυτικός άνεμος (270) => φέρνει αέρα από εκεί.
let e1 = C.hourExposure({ windDirDeg: 290, windKmh: 15, bearingHomeToAirport: 290, distanceKm: 3.4 });
ok("wind straight from airport => transport ~0.98 (3.4km)", near(e1.transport, 0.98, 0.01), e1.transport.toFixed(3));
ok("wind straight from airport => flagged", e1.windFromAirport === true);

let e2 = C.hourExposure({ windDirDeg: 110, windKmh: 15, bearingHomeToAirport: 290, distanceKm: 3.4 });
ok("wind blowing towards airport (opposite) => transport 0", e2.transport === 0, e2.transport);
ok("opposite wind not flagged", e2.windFromAirport === false);

let e3 = C.hourExposure({ windDirDeg: 290, windKmh: 1, bearingHomeToAirport: 290, distanceKm: 3.4 });
ok("calm reduces transport", e3.transport < 0.3, e3.transport.toFixed(2));

let e4 = C.hourExposure({ windDirDeg: 290, windKmh: 15, bearingHomeToAirport: 290, distanceKm: 14 });
// --- αποτύπωμα αεροδρομίου (Σπάτα / Ελ. Βενιζέλος) ---
const dSp = C.distanceKm(...SPATA, ...LGAV), bSp = C.bearingDeg(...SPATA, ...LGAV);
ok("Spata-LGAV ~4.1km", near(dSp, 4.1, 0.3), dSp.toFixed(2));
ok("LGAV lies SE of Spata", C.compass16(bSp) === "ΝΑ", bSp.toFixed(1));
ok("LGAV subtends >25 deg from Spata", C.footprintHalfAngle(dSp, 2.2) > 25,
   C.footprintHalfAngle(dSp, 2.2).toFixed(1));
ok("point source subtends 0", C.footprintHalfAngle(dSp, 0) === 0);
ok("home inside footprint => 90 deg", C.footprintHalfAngle(1, 2.2) === 90);

const spataArgs = (wd) => ({ windDirDeg: wd, windKmh: 18, bearingHomeToAirport: bSp,
                             distanceKm: dSp, extentKm: 2.2, eaqi: 35 });
// άνεμος από ΑΝΑ: το δυτικό όριο του αεροδρομίου είναι upwind -> πρέπει να χτυπά κόκκινο
const spE = C.hourExposure(spataArgs(110));
ok("Spata: ENE wind flags high (west edge of airfield upwind)", spE.level === "high", spE.score);
// άνεμος από ΒΑ (μελτέμι): σπρώχνει τον αέρα του αεροδρομίου προς ΝΔ, μακριά από τα Σπάτα
const spNE = C.hourExposure(spataArgs(30));
ok("Spata: NE meltemi is low", spNE.level === "low", spNE.score);
// άνεμος από ΝΝΔ: πέρασε δίπλα από το αεροδρόμιο, όχι πάνω του
const spSSW = C.hourExposure(spataArgs(200));
ok("Spata: SSW wind is not high", spSSW.level !== "high", spSSW.score);
ok("Spata: footprint raises ENE score vs point model",
   spE.score > C.hourExposure({ windDirDeg: 110, windKmh: 18, bearingHomeToAirport: bSp, distanceKm: dSp, eaqi: 35 }).score,
   C.hourExposure({ windDirDeg: 110, windKmh: 18, bearingHomeToAirport: bSp, distanceKm: dSp, eaqi: 35 }).score + " -> " + spE.score);
ok("cone widens with footprint",
   C.alignmentFactor(40, 32) === 1 && C.alignmentFactor(40, 0) === 0, "");
ok("distance reduces transport", e4.transport < e1.transport && e4.transport > 0.4, e4.transport.toFixed(2));

let e5 = C.hourExposure({ windDirDeg: 290, windKmh: 15, bearingHomeToAirport: 290, distanceKm: 3.4, eaqi: 90 });
ok("high AQI raises score vs clean AQI", e5.score > C.hourExposure({ windDirDeg: 290, windKmh: 15, bearingHomeToAirport: 290, distanceKm: 3.4, eaqi: 10 }).score,
   C.hourExposure({ windDirDeg: 290, windKmh: 15, bearingHomeToAirport: 290, distanceKm: 3.4, eaqi: 10 }).score + " -> " + e5.score);
ok("clean AQI cannot mask straight-from-airport wind (still high)",
   C.hourExposure({ windDirDeg: 290, windKmh: 15, bearingHomeToAirport: 290, distanceKm: 3.4, eaqi: 5 }).level === "high",
   C.hourExposure({ windDirDeg: 290, windKmh: 15, bearingHomeToAirport: 290, distanceKm: 3.4, eaqi: 5 }).score);
ok("bad AQI shows up even with wrong wind direction (not low)",
   C.hourExposure({ windDirDeg: 110, windKmh: 15, bearingHomeToAirport: 290, distanceKm: 3.4, eaqi: 85 }).level !== "low",
   C.hourExposure({ windDirDeg: 110, windKmh: 15, bearingHomeToAirport: 290, distanceKm: 3.4, eaqi: 85 }).score);
ok("missing AQI is flagged", C.hourExposure({ windDirDeg: 290, windKmh: 15, bearingHomeToAirport: 290, distanceKm: 3.4 }).aqiMissing === true);
ok("worst case is high level", e5.level === "high", e5.score);

let e6 = C.hourExposure({ windDirDeg: 110, windKmh: 15, bearingHomeToAirport: 290, distanceKm: 3.4, eaqi: 10 });
ok("clean air + wrong direction = low", e6.level === "low", e6.score);

// Παράθυρα αερισμού
const seq = [{level:"low"},{level:"low"},{level:"high"},{level:"low"},{level:"low"},{level:"low"}];
const w = C.ventilationWindows(seq);
ok("finds 2 windows", w.length === 2, JSON.stringify(w));
ok("longest window first", w[0].start === 3 && w[0].end === 5, JSON.stringify(w[0]));

// EAQI ετικέτες
ok("eaqi 15 = καλή", C.eaqiLabel(15) === "καλή");
ok("eaqi 75 = κακή", C.eaqiLabel(75) === "κακή");

console.log(fails === 0 ? "\nALL TESTS PASSED" : "\n" + fails + " FAILURES");
process.exit(fails ? 1 : 0);
