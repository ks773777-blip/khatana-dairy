/*
 * ============================================================
 *  Khatana Dairy Manager — cloud configuration
 * ============================================================
 *  Google Sign-In and Google Drive backup only need Google
 *  OAuth *client ID*s (below). They do NOT need Firebase and
 *  do NOT need an API key.
 *
 *  Both client ids are listed. The app tries them in order and
 *  automatically falls back to the next one, so it does not
 *  matter which is the "Android" client and which is the
 *  "Web application" client.
 *
 *  Firebase Authentication is OPTIONAL. On this project it is
 *  NOT enabled yet. To use it:
 *    1. Firebase Console -> Authentication -> Get started
 *    2. Sign-in method -> Google -> Enable
 *    3. Copy the full web app config into FIREBASE_CONFIG below.
 *  A Firebase web apiKey starts with "AIzaSy".
 *
 *  Until then the app works 100% offline and the cloud section
 *  shows a "not set up" note.
 * ============================================================
 */
window.GOOGLE_OAUTH = {
  clientIds: [
    "825594104011-h02pqq57t6iasr2h2qgnqceu1tbbp7oe.apps.googleusercontent.com",
    "825594104011-kp07lei9uc7qu2rrgm8hdu5hvspad9b7.apps.googleusercontent.com"
  ]
};

/* Firebase web config (optional). apiKey added; fill the rest to enable it. */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCr1LnVod5p1Nm6jUff0VcTE-MeCmMyLPc",
  authDomain: "PASTE_PROJECT.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE_PROJECT.appspot.com",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};
