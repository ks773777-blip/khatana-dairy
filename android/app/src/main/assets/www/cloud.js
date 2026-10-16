/*
 * cloud.js — Google Sign-In + Google Drive backup (+ optional Firebase)
 * for Khatana Dairy Manager.
 *
 * Sign-in paths, in order of preference:
 *   1. Android APK  -> native OAuth bridge (window.AndroidBridge)
 *   2. Browser/PWA  -> Google Identity Services (token client)
 *   3. Firebase     -> Firebase Authentication (only if fully configured)
 *
 * Multiple OAuth client ids can be configured; they are tried in order and
 * the app falls back to the next one automatically, so it does not matter
 * which id is the "Android" client and which is the "Web application" client.
 *
 * Google Drive backup only needs a Google access token, so it works without
 * Firebase.
 */
(function () {
  'use strict';

  var CFG = window.FIREBASE_CONFIG || {};
  var OAUTH = window.GOOGLE_OAUTH || {};
  var PLACEHOLDER = function (v) { return !v || String(v).indexOf('PASTE') !== -1 || String(v).indexOf('YOUR_') !== -1; };

  var CLIENT_IDS = (OAUTH.clientIds && OAUTH.clientIds.length ? OAUTH.clientIds : [OAUTH.clientId])
    .filter(function (c) { return c && !PLACEHOLDER(c); });
  var firebaseConfigured = !(PLACEHOLDER(CFG.apiKey) || PLACEHOLDER(CFG.projectId) || PLACEHOLDER(CFG.appId));
  var idx = 0;

  var DRIVE_FILE = 'khatana-dairy-backup.json';
  var DRIVE = 'https://www.googleapis.com/drive/v3';
  var UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
  var SCOPE = 'openid email profile https://www.googleapis.com/auth/drive.appdata';

  var state = { user: null, accessToken: null, firebaseReady: false };

  function $(id) { return document.getElementById(id); }
  function app() { return window.DairyApp || {}; }
  function toast(m) { if (app().showToast) app().showToast(m, 4500); else console.log(m); }
  function status(t) { var s = $('cloud-status'); if (s) s.textContent = t || ''; }
  function nativeOn() { return !!(window.AndroidBridge && window.AndroidBridge.isConfigured && window.AndroidBridge.isConfigured()); }
  function currentClient() { return CLIENT_IDS[idx % Math.max(CLIENT_IDS.length, 1)]; }
  function advance() { if (CLIENT_IDS.length > 1) idx = (idx + 1) % CLIENT_IDS.length; }
  function lockClient(cid) { var i = CLIENT_IDS.indexOf(cid); if (i >= 0) idx = i; }

  function setBadge(text, off) {
    var b = $('cloud-badge'); if (!b) return;
    b.textContent = text;
    b.className = 'cloud-badge' + (off ? ' off' : '');
  }

  function updateUI() {
    var signedOut = $('cloud-signed-out'), signedIn = $('cloud-signed-in'), note = $('cloud-not-configured');
    if (!note) return;
    if (!CLIENT_IDS.length && !firebaseConfigured && !nativeOn()) {
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
      if (p) { if (state.user.photoURL) { p.src = state.user.photoURL; p.style.display = ''; } else { p.style.display = 'none'; } }
      if (n) n.textContent = state.user.displayName || 'उपयोगकर्ता';
      if (e) e.textContent = state.user.email || '';
      setBadge('● साइन इन: ' + (state.user.email || ''), false);
    } else {
      if (signedOut) signedOut.style.display = '';
      if (signedIn) signedIn.style.display = 'none';
      setBadge('● साइन इन नहीं', true);
    }
  }

  /* ---------------- optional Firebase ---------------- */
  function initFirebase() {
    if (!firebaseConfigured || typeof firebase === 'undefined') return;
    try {
      if (!firebase.apps.length) firebase.initializeApp(CFG);
      state.firebaseReady = true;
      firebase.auth().onAuthStateChanged(function (user) {
        if (user && !state.user) {
          state.user = { displayName: user.displayName, email: user.email, photoURL: user.photoURL };
          updateUI();
        }
      });
    } catch (e) { console.error('Firebase init error', e); }
  }

  /* ---------------- Google Identity Services (browser) ---------------- */
  function loadGis(cb) {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return cb(null);
    var s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = function () { cb(null); };
    s.onerror = function () { cb(new Error('load failed')); };
    document.head.appendChild(s);
  }

  function fetchUserInfo() {
    fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + state.accessToken } })
      .then(function (r) { return r.json(); })
      .then(function (u) {
        state.user = { displayName: u.name, email: u.email, photoURL: u.picture };
        status('साइन इन सफल।'); updateUI();
      })
      .catch(function () { state.user = { displayName: 'उपयोगकर्ता', email: '' }; updateUI(); });
  }

  function gisSignIn(cid) {
    status('साइन इन हो रहा है…');
    loadGis(function (err) {
      if (err || !window.google || !window.google.accounts) {
        status(''); toast('Google साइन-इन लोड नहीं हुआ — इंटरनेट कनेक्शन ज़रूरी है।');
        return;
      }
      try {
        var tc = google.accounts.oauth2.initTokenClient({
          client_id: cid,
          scope: SCOPE,
          prompt: 'select_account',
          callback: function (resp) {
            if (resp && resp.access_token) { lockClient(cid); state.accessToken = resp.access_token; fetchUserInfo(); }
            else { status(''); advance(); toast('साइन इन पूरा नहीं हुआ — दोबारा "साइन इन" दबाएँ।'); }
          },
          error_callback: function (e) {
            status(''); advance();
            toast('साइन इन विफल (' + ((e && e.type) || 'error') + ') — दोबारा "साइन इन" दबाएँ।');
          }
        });
        tc.requestAccessToken();
      } catch (e) { status(''); advance(); toast('साइन इन विफल: ' + e.message); }
    });
  }

  function firebaseSignIn() {
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.appdata');
    provider.setCustomParameters({ prompt: 'select_account' });
    status('साइन इन हो रहा है…');
    firebase.auth().signInWithPopup(provider).then(function (res) {
      if (res.credential && res.credential.accessToken) state.accessToken = res.credential.accessToken;
      status('साइन इन सफल।');
    }).catch(function (err) {
      console.error(err);
      status(''); toast('साइन इन विफल: ' + (err && err.message ? err.message : err));
    });
  }

  function signIn() {
    var cid = currentClient();
    if (nativeOn()) {
      status('साइन इन हो रहा है…');
      window.__signInDone = function (json) { nativeSignedIn(typeof json === 'string' ? JSON.parse(json) : json, cid); };
      window.__signInFail = function (m) { status(''); advance(); toast('साइन इन विफल — दोबारा "साइन इन" दबाएँ।'); };
      try { window.AndroidBridge.signIn(cid || ''); } catch (e) { status(''); advance(); toast('साइन इन उपलब्ध नहीं।'); }
      return;
    }
    if (CLIENT_IDS.length) return gisSignIn(cid);
    if (firebaseConfigured && state.firebaseReady) return firebaseSignIn();
    toast('क्लाउड सेट नहीं है।');
  }

  function decodeJwt(t) {
    try {
      var p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      var j = decodeURIComponent(atob(p).split('').map(function (c) { return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join(''));
      return JSON.parse(j);
    } catch (e) { return null; }
  }

  function nativeSignedIn(res, cid) {
    lockClient(cid);
    state.accessToken = res.accessToken || null;
    var info = res.idToken ? decodeJwt(res.idToken) : null;
    state.user = {
      displayName: (info && info.name) || 'उपयोगकर्ता',
      email: (info && info.email) || '',
      photoURL: (info && info.picture) || ''
    };
    status('साइन इन सफल।'); updateUI();
  }
  window.onAndroidSignInResult = function (json) { if (window.__signInDone) window.__signInDone(json); };
  window.onAndroidSignInError = function (m) { if (window.__signInFail) window.__signInFail(m); };

  function signOut() {
    var t = state.accessToken;
    state.user = null; state.accessToken = null; updateUI(); status('साइन आउट हो गया।');
    if (window.AndroidBridge && window.AndroidBridge.signOut) { try { window.AndroidBridge.signOut(); } catch (e) {} }
    if (t && window.google && window.google.accounts && window.google.accounts.oauth2) {
      try { google.accounts.oauth2.revoke(t, function () {}); } catch (e) {}
    }
    if (state.firebaseReady) { try { firebase.auth().signOut(); } catch (e) {} }
  }

  /* ---------------- Google Drive ---------------- */
  function nativeDrive() {
    return !!(window.AndroidBridge && window.AndroidBridge.hasDrive && window.AndroidBridge.hasDrive() && window.AndroidBridge.driveBackup);
  }
  function authHeaders(extra) {
    var h = { 'Authorization': 'Bearer ' + state.accessToken };
    if (extra) { for (var k in extra) h[k] = extra[k]; }
    return h;
  }
  function driveList() {
    var q = encodeURIComponent("name='" + DRIVE_FILE + "' and trashed=false");
    return fetch(DRIVE + '/files?spaces=appDataFolder&fields=files(id,name,modifiedTime)&q=' + q, { headers: authHeaders() })
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
        status('बैकअप सफल: ' + new Date(now).toLocaleString()); toast('Google Drive में बैकअप सफल!');
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
      return fetch(UPLOAD + '/files?uploadType=multipart&fields=id', {
        method: 'POST', headers: authHeaders({ 'Content-Type': 'multipart/related; boundary=' + b }), body: multipart
      });
    }).then(function (r) {
      if (!r.ok) throw new Error('अपलोड विफल (' + r.status + ')');
      var now = new Date().toISOString();
      try { localStorage.setItem('khatana_last_drive_backup', now); } catch (e) {}
      status('बैकअप सफल: ' + new Date(now).toLocaleString()); toast('Google Drive में बैकअप सफल!');
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
    }).then(function (data) { return app().applyBackupObject(data); })
      .then(function () {
        status('पुनर्स्थापित सफल।'); toast('डेटा पुनर्स्थापित हो गया!');
        if (app().renderDashboard) app().renderDashboard();
      })
      .catch(function (e) { console.error(e); status(''); toast('पुनर्स्थापित विफल: ' + e.message); });
  }

  window.onDriveBackupResult = function () { if (window.__driveBackupDone) window.__driveBackupDone(); };
  window.onDriveBackupError = function (m) { if (window.__driveBackupFail) window.__driveBackupFail(m); };
  window.onDriveRestoreResult = function (j) { if (window.__driveRestoreDone) window.__driveRestoreDone(j); };
  window.onDriveRestoreError = function (m) { if (window.__driveRestoreFail) window.__driveRestoreFail(m); };

  /* ---------------- wiring ---------------- */
  function wire() {
    var b;
    if ((b = $('google-signin-btn'))) b.addEventListener('click', signIn);
    if ((b = $('cloud-backup-btn'))) b.addEventListener('click', backupToDrive);
    if ((b = $('cloud-restore-btn'))) b.addEventListener('click', restoreFromDrive);
    if ((b = $('cloud-signout-btn'))) b.addEventListener('click', signOut);
  }

  function registerSW() {
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      window.addEventListener('load', function () { navigator.serviceWorker.register('service-worker.js').catch(function () {}); });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    wire(); initFirebase(); updateUI(); registerSW();
  });
})();
