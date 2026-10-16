/*
 * ============================================================
 *  Khatana Dairy Manager — cloud configuration
 * ============================================================
 *  Paste your own Firebase project's web config below to turn on
 *  Google login, Firestore sync and Google Drive backup.
 *
 *  Firebase Console -> Project settings (gear) -> General ->
 *  "Your apps" -> Web app (</>) -> Config -> copy the values here.
 *
 *  Until you fill these in, the app still works 100% offline —
 *  the login/backup buttons just show a "not configured" note.
 * ============================================================
 */
window.FIREBASE_CONFIG = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_PROJECT.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE_PROJECT.appspot.com",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};

/*
 * Optional: only needed so Google Sign-In also works INSIDE the
 * Android APK (the app already signs in through your browser/Chrome
 * Custom Tabs). Create an OAuth client of type "Android" in
 * Google Cloud Console with:
 *     Package name : com.khatana.dairymanager
 *     SHA-1        : (printed by the build — see README)
 * then paste its client id below and rebuild the APK.
 */
window.ANDROID_OAUTH = {
  clientId: "PASTE_ANDROID_OAUTH_CLIENT_ID.apps.googleusercontent.com"
};
