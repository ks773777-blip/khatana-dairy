/*
 * ============================================================
 *  Khatana Dairy Manager — cloud configuration
 * ============================================================
 *  Google Sign-In and Google Drive backup only need a Google
 *  OAuth *client ID* (GOOGLE_OAUTH below). They do NOT need
 *  Firebase and do NOT need an API key.
 *
 *  Firebase Authentication is OPTIONAL. On this project it is
 *  NOT enabled yet. To use it:
 *    1. Firebase Console -> Authentication -> Get started
 *    2. Sign-in method -> Google -> Enable
 *    3. Copy the full web app config (apiKey, authDomain,
 *       projectId, storageBucket, messagingSenderId, appId)
 *       into FIREBASE_CONFIG below.
 *  A Firebase web apiKey starts with "AIzaSy".
 *
 *  Until then the app works 100% offline and the cloud section
 *  shows a "not set up" note.
 * ============================================================
 */
window.GOOGLE_OAUTH = {
  clientId: "825594104011-h02pqq57t6iasr2h2qgnqceu1tbbp7oe.apps.googleusercontent.com"
};

/* Used by the Android app (see android/app/src/main/assets/oauth.properties).
 * For the APK to sign in this must be an "Android" OAuth client registered
 * with package com.khatana.dairymanager and the app's SHA-1. For the
 * browser/PWA it must be a "Web application" client with the site origin
 * authorised. Both may be different client ids. */
window.ANDROID_OAUTH = {
  clientId: "825594104011-h02pqq57t6iasr2h2qgnqceu1tbbp7oe.apps.googleusercontent.com"
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
