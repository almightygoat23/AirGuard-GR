/* AirGuard GR — αεροδρόμια Ελλάδας
 * Πηγή συντεταγμένων: Wikipedia "List of airports in Greece" (WGS84, δεκαδικές μοίρες).
 * extentKm: ακτίνα του αποτυπώματος του αεροδρομίου (προσέγγιση δίσκου). Δίνεται ρητά
 * μόνο όπου το μέγεθος αλλάζει ουσιαστικά το αποτέλεσμα για κοντινούς κατοίκους·
 * αλλιώς το app βάζει προεπιλογή ανά κατηγορία (δες extentOf() στο app.js).
 * kind: "int" = διεθνές, "nat" = κρατικό, "pub" = δημοτικό/άλλης δημόσιας χρήσης, "mil" = στρατιωτικό.
 * Δεν περιλαμβάνονται κλειστά αεροδρόμια. Το Καστέλλι Ηρακλείου (LGTL) περιλαμβάνεται
 * ως planned:true και αγνοείται στους υπολογισμούς μέχρι να λειτουργήσει.
 */
window.AIRPORTS = [
  // Διεθνή
  { icao: "LGAL", iata: "AXD", name: "Αλεξανδρούπολη «Δημόκριτος»", kind: "int", lat: 40.855869, lon: 25.956264 },
  // Δύο παράλληλοι διάδρομοι 03L/21R (3.800 m) και 03R/21L (4.000 m): το αποτύπωμα
  // είναι περίπου 4,5 x 2,5 km, οπότε ένα σημείο υποεκτιμά σοβαρά την έκθεση σε
  // Σπάτα, Λούτσα και Μαρκόπουλο.
  { icao: "LGAV", iata: "ATH", name: "Αθήνα «Ελευθέριος Βενιζέλος»", kind: "int", lat: 37.936389, lon: 23.947222, extentKm: 2.2 },
  { icao: "LGSA", iata: "CHQ", name: "Χανιά «Ι. Δασκαλογιάννης» (Σούδα)", kind: "int", lat: 35.531667, lon: 24.149722 },
  { icao: "LGKR", iata: "CFU", name: "Κέρκυρα «Ι. Καποδίστριας»", kind: "int", lat: 39.601944, lon: 19.911667 },
  { icao: "LGIR", iata: "HER", name: "Ηράκλειο «Ν. Καζαντζάκης»", kind: "int", lat: 35.339722, lon: 25.180278 },
  { icao: "LGKL", iata: "KLX", name: "Καλαμάτα «Β. Κωνσταντακόπουλος»", kind: "int", lat: 37.068333, lon: 22.025556 },
  { icao: "LGKV", iata: "KVA", name: "Καβάλα «Μέγας Αλέξανδρος»", kind: "int", lat: 40.913333, lon: 24.619167 },
  { icao: "LGKF", iata: "EFL", name: "Κεφαλονιά «Άννα Πολλάτου»", kind: "int", lat: 38.12, lon: 20.500278 },
  { icao: "LGKO", iata: "KGS", name: "Κως «Ιπποκράτης»", kind: "int", lat: 36.793336, lon: 27.091667 },
  { icao: "LGLM", iata: "LXS", name: "Λήμνος «Ήφαιστος»", kind: "int", lat: 39.917072, lon: 25.236308 },
  { icao: "LGMT", iata: "MJT", name: "Μυτιλήνη «Οδυσσέας Ελύτης»", kind: "int", lat: 39.0567, lon: 26.5994 },
  { icao: "LGRP", iata: "RHO", name: "Ρόδος «Διαγόρας»", kind: "int", lat: 36.405419, lon: 28.086192 },
  { icao: "LGSM", iata: "SMI", name: "Σάμος «Αρίσταρχος»", kind: "int", lat: 37.6891, lon: 26.9116 },
  { icao: "LGSK", iata: "JSI", name: "Σκιάθος «Α. Παπαδιαμάντης»", kind: "int", lat: 39.1775, lon: 23.503675 },
  { icao: "LGTS", iata: "SKG", name: "Θεσσαλονίκη «Μακεδονία»", kind: "int", lat: 40.519722, lon: 22.970833 },
  { icao: "LGZA", iata: "ZTH", name: "Ζάκυνθος «Δ. Σολωμός»", kind: "int", lat: 37.750833, lon: 20.884167 },

  // Κρατικά
  { icao: "LGPL", iata: "JTY", name: "Αστυπάλαια «Παναγιά»", kind: "nat", lat: 36.5793, lon: 26.3756 },
  { icao: "LGHI", iata: "JKH", name: "Χίος «Όμηρος»", kind: "nat", lat: 38.343056, lon: 26.140556 },
  { icao: "LGIK", iata: "JIK", name: "Ικαρία «Ίκαρος»", kind: "nat", lat: 37.682717, lon: 26.347061 },
  { icao: "LGIO", iata: "IOA", name: "Ιωάννινα «Βασιλεύς Πύρρος»", kind: "nat", lat: 39.696389, lon: 20.8225 },
  { icao: "LGKY", iata: "JKL", name: "Κάλυμνος «Ποθαία»", kind: "nat", lat: 36.963333, lon: 26.940556 },
  { icao: "LGKP", iata: "AOK", name: "Κάρπαθος «Αμμοοπή»", kind: "nat", lat: 35.420556, lon: 27.146667 },
  { icao: "LGKA", iata: "KSO", name: "Καστοριά «Αριστοτέλης»", kind: "nat", lat: 40.4471, lon: 21.2794 },
  { icao: "LGKZ", iata: "KZI", name: "Κοζάνη «Φίλιππος»", kind: "nat", lat: 40.286111, lon: 21.840833 },
  { icao: "LGKC", iata: "KIT", name: "Κύθηρα «Α. Ωνάσης»", kind: "nat", lat: 36.274258, lon: 23.016978 },
  { icao: "LGML", iata: "MLO", name: "Μήλος «Αφροδίτη»", kind: "nat", lat: 36.6969, lon: 24.4769 },
  { icao: "LGMK", iata: "JMK", name: "Μύκονος «Δήλος»", kind: "nat", lat: 37.435128, lon: 25.348103 },
  { icao: "LGNX", iata: "JNX", name: "Νάξος «Απόλλων»", kind: "nat", lat: 37.081072, lon: 25.368158 },
  { icao: "LGPA", iata: "PAS", name: "Πάρος", kind: "nat", lat: 37.020833, lon: 25.113056 },
  { icao: "LGRX", iata: "GPA", name: "Άραξος «Αγαμέμνων» (Πάτρα)", kind: "nat", lat: 38.151111, lon: 21.425556 },
  { icao: "LGPZ", iata: "PVK", name: "Άκτιο (Πρέβεζα / Λευκάδα)", kind: "nat", lat: 38.925556, lon: 20.765278 },
  { icao: "LGSR", iata: "JTR", name: "Σαντορίνη «Ζέφυρος»", kind: "nat", lat: 36.399169, lon: 25.479333 },
  { icao: "LGSY", iata: "SKU", name: "Σκύρος «Αιγαίο»", kind: "nat", lat: 38.9675, lon: 24.487222 },
  { icao: "LGSO", iata: "JSY", name: "Σύρος «Δ. Βικέλας»", kind: "nat", lat: 37.4229, lon: 24.9498 },
  { icao: "LGBL", iata: "VOL", name: "Νέα Αγχίαλος (Βόλος)", kind: "nat", lat: 39.219444, lon: 22.794167 },

  // Δημοτικά / άλλης δημόσιας χρήσης
  { icao: "LGKS", iata: "KSJ", name: "Κάσος «Αγία Μαρίνα»", kind: "pub", lat: 35.421358, lon: 26.910047 },
  { icao: "LGKJ", iata: "KZS", name: "Καστελόριζο «Μεγίστη»", kind: "pub", lat: 36.14167, lon: 29.576376 },
  { icao: "", iata: "", name: "Αεροδρόμιο Καρδίτσας «Μυρίνα»", kind: "pub", lat: 39.4073, lon: 21.9956 },
  { icao: "LGLE", iata: "LRS", name: "Λέρος «Δωδεκάνησος»", kind: "pub", lat: 37.184722, lon: 26.800278 },
  { icao: "LGMG", iata: "", name: "Μέγαρα (γενικής αεροπορίας)", kind: "pub", lat: 37.9812, lon: 23.3659 },
  { icao: "", iata: "", name: "Αεροδρόμιο Μεσολογγίου", kind: "pub", lat: 38.3568, lon: 21.4802 },
  { icao: "LGST", iata: "JSH", name: "Σητεία «Β. Κορνάρος»", kind: "pub", lat: 35.216108, lon: 26.101325 },

  // Στρατιωτικά
  { icao: "LGAG", iata: "AGQ", name: "Αγρίνιο (στρατιωτικό)", kind: "mil", lat: 38.602, lon: 21.3499 },
  { icao: "LGAX", iata: "", name: "Αλεξάνδρεια Ημαθίας (στρατιωτικό)", kind: "mil", lat: 40.6511, lon: 22.4885 },
  { icao: "LGKM", iata: "", name: "Αμυγδαλεώνας Καβάλας (στρατιωτικό)", kind: "mil", lat: 40.9732, lon: 24.3411 },
  { icao: "LGAD", iata: "PYR", name: "Ανδραβίδα (στρατιωτικό)", kind: "mil", lat: 37.9198, lon: 21.2922 },
  { icao: "LGEL", iata: "", name: "Ελευσίνα (στρατιωτικό)", kind: "mil", lat: 38.0646, lon: 23.5556 },
  { icao: "LGLR", iata: "LRA", name: "Λάρισα (στρατιωτικό)", kind: "mil", lat: 39.6501, lon: 22.4628 },
  { icao: "LGKN", iata: "", name: "Κοτρώνι Μαραθώνα (στρατιωτικό)", kind: "mil", lat: 38.1374, lon: 23.9518 },
  { icao: "LGRD", iata: "", name: "Μαρίτσα Ρόδου (στρατιωτικό)", kind: "mil", lat: 36.3844, lon: 28.1177 },
  { icao: "LGTG", iata: "", name: "Τανάγρα (στρατιωτικό)", kind: "mil", lat: 38.3396, lon: 23.5651 },
  { icao: "LGTT", iata: "", name: "Τατόι / Δεκέλεια (στρατιωτικό)", kind: "mil", lat: 38.1085, lon: 23.7835 },
  { icao: "LGTP", iata: "", name: "Τρίπολη (στρατιωτικό)", kind: "mil", lat: 37.5306, lon: 22.4035 },

  // Υπό κατασκευή — αγνοείται στους υπολογισμούς
  { icao: "LGTL", iata: "", name: "Καστέλλι Ηρακλείου (υπό κατασκευή)", kind: "int", lat: 35.1907, lon: 25.3264, planned: true }
];
