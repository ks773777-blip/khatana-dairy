/*
 * ============================================================
 *  Khatana Dairy Manager — cloud configuration
 * ============================================================
 *  Google Sign-In and Google Drive backup only need a Google
 *  OAuth *client ID*. Paste it in GOOGLE_OAUTH below.
 *
 *  Firebase (Firestore sync) is OPTIONAL. It needs a Firebase
 *  *web* config (apiKey, authDomain, projectId, appId ...). Note:
 *  a Firebase web apiKey starts with "AIzaSy". A key starting
 *  with "AQ." is a Gemini/Vertex AI key and will NOT work here.
 *
 *  Until you fill these in, the app still works 100% offline —
 *  the cloud section just shows a "not set up" note.
 * ============================================================
 */
window.GOOGLE_OAUTH = {
  clientId: "825594104011-h02pqq57t6iasr2h2qgnqceu1tbbp7oe.apps.googleusercontent.com"
};

/* Same client id is used by the Android app (see
 * android/app/src/main/assets/oauth.properties). For the APK to sign in,
 * this must be an "Android" OAuth client registered with the package name
 * com.khatana.dairymanager and the app's SHA-1. For the browser/PWA it must
 * be a "Web application" client with the site's origin authorised. */
window.ANDROID_OAUTH = {
  clientId: "825594104011-h02pqq57t6iasr2h2qgnqceu1tbbp7oe.apps.googleusercontent.com"
};

/* Optional — only needed for Firebase Authentication / Firestore.
   Fill with your Firebase web app config to enable it. */
window.FIREBASE_CONFIG = {
  apiKey: "PASTE_FIREBASE_WEB_API_KEY",
  authDomain: "PASTE_PROJECT.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE_PROJECT.appspot.com",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};
