/* AirGuard GR — υπολογιστικός πυρήνας.
 * Καθαρές συναρτήσεις, χωρίς DOM και χωρίς δικτύωση, ώστε να ελέγχονται ανεξάρτητα.
 *
 * ΣΥΜΒΑΣΗ ΑΝΕΜΟΥ (κρίσιμο): το wind_direction της μετεωρολογίας δηλώνει
 * τη διεύθυνση ΑΠΟ ΤΗΝ ΟΠΟΙΑ έρχεται ο άνεμος (0° = από βορρά).
 * Άρα ο αέρας ταξιδεύει από το αεροδρόμιο προς την κατοικία όταν το
 * wind_direction πλησιάζει το αζιμούθιο κατοικία -> αεροδρόμιο.
 */
(function (root) {
  "use strict";

  var R_EARTH_KM = 6371.0088;
  var toRad = function (d) { return (d * Math.PI) / 180; };
  var toDeg = function (r) { return (r * 180) / Math.PI; };

  /** Απόσταση μεγίστου κύκλου σε km (haversine). */
  function distanceKm(lat1, lon1, lat2, lon2) {
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  /** Αρχικό αζιμούθιο από το σημείο 1 προς το 2, σε μοίρες 0..360 (0 = βορράς). */
  function bearingDeg(lat1, lon1, lat2, lon2) {
    var p1 = toRad(lat1), p2 = toRad(lat2), dl = toRad(lon2 - lon1);
    var y = Math.sin(dl) * Math.cos(p2);
    var x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  /** Μικρότερη γωνιακή διαφορά δύο διευθύνσεων, 0..180. */
  function angleDiff(a, b) {
    var d = Math.abs(((a - b) % 360 + 360) % 360);
    return d > 180 ? 360 - d : d;
  }

  var POINTS_16 = ["Β", "ΒΒΑ", "ΒΑ", "ΑΒΑ", "Α", "ΑΝΑ", "ΝΑ", "ΝΝΑ",
                   "Ν", "ΝΝΔ", "ΝΔ", "ΔΝΔ", "Δ", "ΔΒΔ", "ΒΔ", "ΒΒΔ"];

  /** Ονομασία 16 σημείων του ορίζοντα. */
  function compass16(deg) {
    var d = ((deg % 360) + 360) % 360;
    return POINTS_16[Math.round(d / 22.5) % 16];
  }

  /* --- Παράγοντες του δείκτη ------------------------------------------- */

  /**
   * Γωνιακό ημιπλάτος με το οποίο «φαίνεται» το αεροδρόμιο από την κατοικία.
   * Ένα μεγάλο αεροδρόμιο δεν είναι σημείο: ο Ελ. Βενιζέλος έχει δύο διαδρόμους
   * 3,8 και 4,0 km και από τα Σπάτα καταλαμβάνει πάνω από 30° του ορίζοντα.
   * Μοντελοποιείται ως δίσκος ακτίνας extentKm γύρω από το σημείο αναφοράς.
   */
  function footprintHalfAngle(distanceKm, extentKm) {
    if (!extentKm) return 0;
    if (distanceKm <= extentKm) return 90;           // η κατοικία μέσα στο αποτύπωμα
    return toDeg(Math.asin(extentKm / distanceKm));
  }

  /**
   * Ευθυγράμμιση ανέμου με το αεροδρόμιο. 1 = πλήρης, 0 = καμία.
   * Ο κώνος ανοίγει κατά το ημιπλάτος του αποτυπώματος και κατά ~12°-35° για την
   * πλευρική διασπορά του νέφους (τάξη μεγέθους gaussian plume, σy/x ≈ 0,2-0,6).
   */
  function alignmentFactor(deltaDeg, spanHalfDeg) {
    var span = spanHalfDeg || 0;
    var inner = 12 + span, outer = 35 + span;
    if (deltaDeg <= inner) return 1;
    if (deltaDeg >= outer) return 0;
    return (outer - deltaDeg) / (outer - inner);
  }

  /** Ταχύτητα ανέμου (km/h): στην άπνοια η διεύθυνση είναι αναξιόπιστη,
   *  στα πολύ δυνατά ο αέρας διαλύεται. */
  function speedFactor(kmh) {
    if (kmh < 3) return 0.25;
    if (kmh < 8) return 0.7;
    if (kmh <= 25) return 1;
    if (kmh <= 40) return 0.7;
    return 0.45;
  }

  /** Απόσταση διαδρομής σε km: όσο μακρύτερα, τόσο μεγαλύτερη η αραίωση. */
  function distanceFactor(km) {
    if (km <= 3) return 1;
    return Math.max(0.35, 1 - (km - 3) * 0.05);
  }

  /**
   * Δείκτης έκθεσης για μία ώρα.
   *
   * Ο δείκτης είναι αυστηρά αύξων και στους δύο όρους: καλή μετρούμενη ποιότητα
   * αέρα ΔΕΝ μειώνει την ένδειξη μεταφοράς (το μοντέλο AQI είναι περιοχικό και
   * δεν «βλέπει» ένα τοπικό νέφος), και αντίστροφα κακή ποιότητα αέρα φαίνεται
   * ακόμη κι όταν ο άνεμος δεν έρχεται από το αεροδρόμιο.
   *
   * @param {object} o {windDirDeg, windKmh, bearingHomeToAirport, distanceKm, extentKm?, eaqi?}
   * @returns {object} {delta, effDelta, spanHalf, travelKm, transport, score, level, windFromAirport, aqiMissing}
   */
  function hourExposure(o) {
    var delta = angleDiff(o.windDirDeg, o.bearingHomeToAirport);
    var spanHalf = footprintHalfAngle(o.distanceKm, o.extentKm);
    // η αραίωση μετράει τη διαδρομή από το κοντινότερο όριο του αεροδρομίου
    var travelKm = Math.max(0.5, o.distanceKm - (o.extentKm || 0));
    var align = alignmentFactor(delta, spanHalf);
    var transport = align * speedFactor(o.windKmh) * distanceFactor(travelKm);
    var transportScore = 100 * transport;
    var score, aqiMissing = o.eaqi == null;
    if (aqiMissing) {
      score = transportScore;
    } else {
      score = Math.min(100, 0.7 * transportScore + 0.45 * Math.min(100, Math.max(0, o.eaqi)));
    }
    return {
      delta: delta,
      effDelta: Math.max(0, delta - spanHalf),
      spanHalf: spanHalf,
      travelKm: travelKm,
      transport: transport,
      score: Math.round(score),
      level: score < 30 ? "low" : score < 60 ? "moderate" : "high",
      windFromAirport: align > 0,
      aqiMissing: aqiMissing
    };
  }

  /** Κατηγορία European AQI (EEA). */
  function eaqiLabel(v) {
    if (v == null) return "—";
    if (v <= 20) return "καλή";
    if (v <= 40) return "ικανοποιητική";
    if (v <= 60) return "μέτρια";
    if (v <= 80) return "κακή";
    if (v <= 100) return "πολύ κακή";
    return "εξαιρετικά κακή";
  }

  /** Συνεχόμενα διαστήματα ωρών με level "low", ταξινομημένα κατά διάρκεια. */
  function ventilationWindows(hours) {
    var out = [], cur = null;
    for (var i = 0; i < hours.length; i++) {
      if (hours[i].level === "low") {
        if (!cur) cur = { start: i, end: i };
        else cur.end = i;
      } else if (cur) { out.push(cur); cur = null; }
    }
    if (cur) out.push(cur);
    return out.sort(function (a, b) { return (b.end - b.start) - (a.end - a.start); });
  }

  var api = {
    distanceKm: distanceKm,
    bearingDeg: bearingDeg,
    angleDiff: angleDiff,
    compass16: compass16,
    alignmentFactor: alignmentFactor,
    speedFactor: speedFactor,
    distanceFactor: distanceFactor,
    footprintHalfAngle: footprintHalfAngle,
    hourExposure: hourExposure,
    eaqiLabel: eaqiLabel,
    ventilationWindows: ventilationWindows
  };

  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AGCore = api;
})(typeof self !== "undefined" ? self : this);
