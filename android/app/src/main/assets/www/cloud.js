/*
 * cloud.js — Google Sign-In + Google Drive backup + Firebase (optional)
 * for Khatana Dairy Manager.
 *
 * Design:
 *  - In a browser / installed PWA it uses Firebase Authentication (Google)
 *    and keeps the Google OAuth access token for Drive.
 *  - Inside the Android APK it uses the native OAuth bridge exposed as
 *    window.AndroidBridge and reads the user's identity from the Google
 *    ID token, so Drive backup works even without Firebase.
 *  - If firebase-config.js still has placeholder keys, everything is
 *    disabled gracefully and the app stays fully offline.
 */
(function () {
  'use strict';

  var CFG = window.FIREBASE_CONFIG || {};
  var PLACEHOLDER = function (v) { return !v || String(v).indexOf('PASTE') !== -1 || String(v).indexOf('YOUR_') !== -1; };
  var configured = !(PLACEHOLDER(CFG.apiKey) || PLACEHOLDER(CFG.projectId) || PLACEHOLDER(CFG.appId));

  var state = { user: null, accessToken: null, firebaseReady: false };

  var DRIVE_FILE = 'khatana-dairy-backup.json';
  var DRIVE = 'https://www.googleapis.com/drive/v3';
  var UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

  function $(id) { return document.getElementById(id); }
  function app() { return window.DairyApp || {}; }
  function toast(m) { if (app().showToast) app().showToast(m, 4500); else console.log(m); }
  function status(t) { var s = $('cloud-status'); if (s) s.textContent = t || ''; }

  function setBadge(text, off) {
    var b = $('cloud-badge'); if (!b) return;
    b.textContent = text;
    b.className = 'cloud-badge' + (off ? ' off' : '');
  }

  function updateUI() {
    var signedOut = $('cloud-signed-out'), signedIn = $('cloud-signed-in'), note = $('cloud-not-configured');
    if (!note) return;
    if (!configured && !(window.AndroidBridge && window.AndroidBridge.isConfigured && window.AndroidBridge.isConfigured())) {
      note.style.display = '';
      if (signedOut) signedOut.style.display = 'none';
      if (signedIn) signedIn.style.display = 'none';
      setBadge('● ऑफ़लाइन मोड (लॉगिन सेट नहीं)', true);
      return;
    }
    note.style.display = 'none';
    if (state.user) {
      if (signedOut) signedOut.style.display = 'none';
      if (signedIn) signedIn.style.display = '';
      var p = $('cloud-user-photo'), n = $('cloud-user-name'), e = $('cloud-user-email');
      if (p) { if (state.user.photoURL) p.src = state.user.photoURL; else p.style.display = 'none'; }
      if (n) n.textContent = state.user.displayName || 'उपयोगकर्ता';
      if (e) e.textContent = state.user.email || '';
      setBadge('● साइन इन: ' + (state.user.email || ''), false);
    } else {
      if (signedOut) signedOut.style.display = '';
      if (signedIn) signedIn.style.display = 'none';
      setBadge('● साइन इन नहीं', true);
    }
  }

  /* ---------------- Firebase (browser) ---------------- */
  function initFirebase() {
    if (!configured || typeof firebase === 'undefined') return;
    try {
      if (!firebase.apps.length) firebase.initializeApp(CFG);
      state.firebaseReady = true;
      firebase.auth().onAuthStateChanged(function (user) {
        if (user) {
          state.user = { displayName: user.displayName, email: user.email, photoURL: user.photoURL };
        } else if (!(window.AndroidBridge && state.accessToken)) {
          state.user = null; state.accessToken = null;
        }
        updateUI();
      });
      firebase.auth().getRedirectResult().then(function (res) {
        if (res && res.credential && res.credential.accessToken) {
          state.accessToken = res.credential.accessToken;
          updateUI();
        }
      }).catch(function () {});
    } catch (e) { console.error('Firebase init error', e); }
  }

  function googleProvider() {
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.appdata');
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    provider.setCustomParameters({ prompt: 'select_account' });
    return provider;
  }

  /* ---------------- Sign in ---------------- */
  function signIn() {
    // 1) Native bridge (inside the APK)
    if (window.AndroidBridge && window.AndroidBridge.signIn && window.AndroidBridge.isConfigured && window.AndroidBridge.isConfigured()) {
      status('साइन इन हो रहा है…');
      window.__signInDone = function (json) {
        var res = typeof json === 'string' ? JSON.parse(json) : json;
        nativeSignedIn(res);
      };
      window.__signInFail = function (msg) { status(''); toast('साइन इन विफल: ' + msg); };
      try { window.AndroidBridge.signIn(); } catch (e) { status(''); toast('साइन इन उपलब्ध नहीं।'); }
      return;
    }
    // 2) Firebase web flow
    if (!state.firebaseReady) {
      toast('क्लाउड सेट नहीं है। firebase-config.js में keys भरें।');
      return;
    }
    status('साइन इन हो रहा है…');
    firebase.auth().signInWithPopup(googleProvider()).then(function (res) {
      if (res.credential && res.credential.accessToken) state.accessToken = res.credential.accessToken;
      status('साइन इन सफल।');
    }).catch(function (err) {
      console.error('signin error', err);
      if (err && (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment')) {
        firebase.auth().signInWithRedirect(googleProvider()).catch(function () { status(''); toast('साइन इन विफल।'); });
      } else {
        status(''); toast('साइन इन विफल: ' + (err && err.message ? err.message : err));
      }
    });
  }

  function decodeJwt(token) {
    try {
      var p = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      var json = decodeURIComponent(atob(p).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(json);
    } catch (e) { return null; }
  }

  function nativeSignedIn(res) {
    state.accessToken = res.accessToken || null;
    var info = res.idToken ? decodeJwt(res.idToken) : null;
    state.user = {
      displayName: (info && info.name) || res.name || 'उपयोगकर्ता',
      email: (info && info.email) || res.email || '',
      photoURL: (info && info.picture) || res.picture || ''
    };
    status('साइन इन सफल।');
    updateUI();
    // Best-effort: also sign in to Firebase so Firestore sync can be used.
    if (state.firebaseReady && res.idToken) {
      try {
        var cred = firebase.auth.GoogleAuthProvider.credential(res.idToken, res.accessToken);
        firebase.auth().signInWithCredential(cred).catch(function () {});
      } catch (e) {}
    }
  }
  window.onAndroidSignInResult = function (json) { if (window.__signInDone) window.__signInDone(json); };
  window.onAndroidSignInError = function (msg) { if (window.__signInFail) window.__signInFail(msg); };
  window.onDriveBackupResult = function () { if (window.__driveBackupDone) window.__driveBackupDone(); };
  window.onDriveBackupError = function (msg) { if (window.__driveBackupFail) window.__driveBackupFail(msg); };
  window.onDriveRestoreResult = function (json) { if (window.__driveRestoreDone) window.__driveRestoreDone(json); };
  window.onDriveRestoreError = function (msg) { if (window.__driveRestoreFail) window.__driveRestoreFail(msg); };

  function nativeDrive() {
    return window.AndroidBridge && window.AndroidBridge.hasDrive && window.AndroidBridge.hasDrive() && window.AndroidBridge.driveBackup;
  }

  function signOut() {
    state.user = null; state.accessToken = null; updateUI(); status('साइन आउट हो गया।');
    if (window.AndroidBridge && window.AndroidBridge.signOut) { try { window.AndroidBridge.signOut(); } catch (e) {} }
    if (state.firebaseReady) { try { firebase.auth().signOut(); } catch (e) {} }
  }

  /* ---------------- Google Drive ---------------- */
  function authHeaders(extra) {
    var h = { 'Authorization': 'Bearer ' + state.accessToken };
    if (extra) { for (var k in extra) h[k] = extra[k]; }
    return h;
  }

  function driveList() {
    var q = encodeURIComponent("name='" + DRIVE_FILE + "' and trashed=false");
    return fetch(DRIVE + '/files?spaces=appDataFolder&fields=files(id,name,modifiedTime,size)&q=' + q, { headers: authHeaders() })
      .then(function (r) { if (!r.ok) throw new Error('Drive सूची विफल (' + r.status + ')'); return r.json(); });
  }

  function backupToDrive() {
    if (!state.user) return toast('पहले साइन इन करें।');
    if (!state.accessToken) return toast('Drive अनुमति नहीं मिली। दोबारा साइन इन करें।');
    if (nativeDrive()) {
      status('बैकअप अपलोड हो रहा है…');
      window.__driveBackupDone = function () {
        var now = new Date().toISOString();
        try { localStorage.setItem('khatana_last_drive_backup', now); } catch (e) {}
        status('बैकअप सफल: ' + new Date(now).toLocaleString());
        toast('Google Drive में बैकअप सफल!');
      };
      window.__driveBackupFail = function (m) { status(''); toast('बैकअप विफल: ' + m); };
      try { window.AndroidBridge.driveBackup(JSON.stringify(app().buildBackupObject ? app().buildBackupObject() : {})); }
      catch (e) { status(''); toast('बैकअप विफल।'); }
      return;
    }
    status('बैकअप अपलोड हो रहा है…');
    var body = JSON.stringify(app().buildBackupObject ? app().buildBackupObject() : {}, null, 2);
    driveList().then(function (list) {
      var existing = list.files && list.files[0];
      if (existing) {
        return fetch(UPLOAD + '/files/' + existing.id + '?uploadType=media', {
          method: 'PATCH', headers: authHeaders({ 'Content-Type': 'application/json' }), body: body
        });
      }
      var meta = JSON.stringify({ name: DRIVE_FILE, parents: ['appDataFolder'] });
      var b = 'khatana' + Date.now();
      var multipart = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta +
        '\r\n--' + b + '\r\nContent-Type: application/json\r\n\r\n' + body + '\r\n--' + b + '--';
      return fetch(UPLOAD + '/files?uploadType=multipart&fields=id,modifiedTime', {
        method: 'POST', headers: authHeaders({ 'Content-Type': 'multipart/related; boundary=' + b }), body: multipart
      });
    }).then(function (r) {
      if (!r.ok) throw new Error('अपलोड विफल (' + r.status + ')');
      var now = new Date().toISOString();
      try { localStorage.setItem('khatana_last_drive_backup', now); } catch (e) {}
      status('बैकअप सफल: ' + new Date(now).toLocaleString());
      toast('Google Drive में बैकअप सफल!');
    }).catch(function (e) { console.error(e); status(''); toast('बैकअप विफल: ' + e.message); });
  }

  function restoreFromDrive() {
    if (!state.user) return toast('पहले साइन इन करें।');
    if (!state.accessToken) return toast('Drive अनुमति नहीं मिली। दोबारा साइन इन करें।');
    if (!confirm('Google Drive से बैकअप पुनर्स्थापित करें? वर्तमान डेटा बदल जाएगा।')) return;
    if (nativeDrive()) {
      status('बैकअप डाउनलोड हो रहा है…');
      window.__driveRestoreDone = function (json) {
        try {
          var data = typeof json === 'string' ? JSON.parse(json) : json;
          app().applyBackupObject(data).then(function () {
            status('पुनर्स्थापित सफल।'); toast('डेटा पुनर्स्थापित हो गया!');
            if (app().renderDashboard) app().renderDashboard();
          }).catch(function (e) { status(''); toast('पुनर्स्थापित विफल: ' + e.message); });
        } catch (e) { status(''); toast('पुनर्स्थापित विफल।'); }
      };
      window.__driveRestoreFail = function (m) { status(''); toast('पुनर्स्थापित विफल: ' + m); };
      try { window.AndroidBridge.driveRestore(); } catch (e) { status(''); toast('पुनर्स्थापित विफल।'); }
      return;
    }
    status('बैकअप डाउनलोड हो रहा है…');
    driveList().then(function (list) {
      var f = list.files && list.files[0];
      if (!f) throw new Error('Drive में कोई बैकअप नहीं मिला');
      return fetch(DRIVE + '/files/' + f.id + '?alt=media', { headers: authHeaders() });
    }).then(function (r) {
      if (!r.ok) throw new Error('डाउनलोड विफल (' + r.status + ')');
      return r.json();
    }).then(function (data) {
      return app().applyBackupObject(data);
    }).then(function () {
      status('पुनर्स्थापित सफल।');
      toast('डेटा पुनर्स्थापित हो गया!');
      if (app().renderDashboard) app().renderDashboard();
    }).catch(function (e) { console.error(e); status(''); toast('पुनर्स्थापित विफल: ' + e.message); });
  }

  /* ---------------- Wiring ---------------- */
  function wire() {
    var b;
    if ((b = $('google-signin-btn'))) b.addEventListener('click', signIn);
    if ((b = $('cloud-backup-btn'))) b.addEventListener('click', backupToDrive);
    if ((b = $('cloud-restore-btn'))) b.addEventListener('click', restoreFromDrive);
    if ((b = $('cloud-signout-btn'))) b.addEventListener('click', signOut);
  }

  function registerSW() {
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('service-worker.js').catch(function () {});
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    wire();
    initFirebase();
    updateUI();
    registerSW();
  });
})();
