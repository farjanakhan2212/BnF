// Firebase is initialised in exactly ONE place: js/data.js.
//
// This file used to hold a second copy of firebaseConfig plus its own
// initializeApp() call, which meant two apps could be created for the same
// project. It is kept only so the old path is obvious, and it must stay
// commented out. Everything imports { getFs, getAuthKit } from ./data.js.
//
// Firebase > Project settings > Your apps > Web app > "firebaseConfig"
// The live values live in js/config.js and are safe to publish; access is
// controlled by firestore.rules.
