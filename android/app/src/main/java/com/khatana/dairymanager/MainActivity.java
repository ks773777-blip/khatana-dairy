package com.khatana.dairymanager;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.KeyEvent;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Properties;

/**
 * WebView shell for the Khatana Dairy Manager PWA.
 *
 * It also exposes a native bridge (window.AndroidBridge) that runs the
 * Google OAuth 2.0 Authorization Code + PKCE flow in the system browser,
 * talks to the Google Drive API, and handles sharing / downloading files
 * and sending SMS — all without any third-party SDK.
 */
public class MainActivity extends Activity {

    private static final String AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
    private static final String TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
    private static final String DRIVE_API = "https://www.googleapis.com/drive/v3";
    private static final String DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";
    private static final String SCOPES =
            "openid email profile https://www.googleapis.com/auth/drive.appdata";
    private static final String DRIVE_FILE = "khatana-dairy-backup.json";

    private WebView webView;
    private String clientId = "";
    private String redirectUri = "";
    private String pendingClientId = "";
    private String pendingRedirect = "";
    private String codeVerifier = "";
    private String accessToken = null;
    private String idToken = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        loadConfig();

        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setMediaPlaybackRequiresUserGesture(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url == null || url.startsWith("file://")) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception e) {
                    toastMsg("कोई ऐप नहीं मिला");
                }
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new Bridge(), "AndroidBridge");
        setContentView(webView);
        webView.loadUrl("file:///android_asset/www/index.html");

        handleIntent(getIntent());
    }

    private void loadConfig() {
        try {
            InputStream is = getAssets().open("oauth.properties");
            Properties p = new Properties();
            p.load(is);
            is.close();
            clientId = p.getProperty("client_id", "").trim();
        } catch (Exception e) {
            clientId = "";
        }
        redirectUri = redirectFor(clientId);
    }

    private boolean isConfigured() {
        return !clientId.isEmpty() && clientId.indexOf("PASTE") == -1;
    }

    private static String redirectFor(String cid) {
        if (cid != null && cid.contains(".apps.googleusercontent.com")) {
            String prefix = cid.substring(0, cid.indexOf(".apps.googleusercontent.com"));
            return "com.googleusercontent.apps." + prefix + ":/oauth2redirect";
        }
        return "com.khatana.dairymanager:/oauth2redirect";
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        Uri data = intent.getData();
        if (data.toString().indexOf("oauth2redirect") == -1) return;
        String code = data.getQueryParameter("code");
        String error = data.getQueryParameter("error");
        if (code != null) {
            exchangeCode(code);
        } else if (error != null) {
            callJs("window.onAndroidSignInError", error);
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView != null && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    /* -------------------- OAuth -------------------- */

    private void startSignIn(String cid) {
        String useId = (cid != null && cid.length() > 0 && cid.indexOf("PASTE") == -1) ? cid : clientId;
        if (useId == null || useId.isEmpty() || useId.indexOf("PASTE") != -1) {
            callJs("window.onAndroidSignInError", "OAuth client id not configured");
            return;
        }
        pendingClientId = useId;
        pendingRedirect = redirectFor(useId);
        try {
            codeVerifier = randomVerifier();
            String challenge = sha256Base64Url(codeVerifier);
            String url = AUTH_ENDPOINT
                    + "?client_id=" + enc(useId)
                    + "&redirect_uri=" + enc(pendingRedirect)
                    + "&response_type=code"
                    + "&scope=" + enc(SCOPES)
                    + "&code_challenge=" + enc(challenge)
                    + "&code_challenge_method=S256"
                    + "&access_type=offline"
                    + "&prompt=select_account";
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception e) {
            callJs("window.onAndroidSignInError", String.valueOf(e.getMessage()));
        }
    }

    private void exchangeCode(final String code) {
        new Thread(new Runnable() {
            public void run() {
                try {
                    String body = "grant_type=authorization_code"
                            + "&code=" + enc(code)
                            + "&client_id=" + enc(pendingClientId)
                            + "&redirect_uri=" + enc(pendingRedirect)
                            + "&code_verifier=" + enc(codeVerifier);
                    HttpURLConnection c = (HttpURLConnection) new URL(TOKEN_ENDPOINT).openConnection();
                    c.setRequestMethod("POST");
                    c.setDoOutput(true);
                    c.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
                    OutputStream os = c.getOutputStream();
                    os.write(body.getBytes("UTF-8"));
                    os.close();
                    JSONObject j = new JSONObject(readAll(c.getInputStream()));
                    accessToken = j.optString("access_token", null);
                    idToken = j.optString("id_token", null);
                    if (accessToken == null) throw new Exception("no access token");
                    JSONObject out = new JSONObject();
                    out.put("accessToken", accessToken);
                    out.put("idToken", idToken == null ? "" : idToken);
                    callJs("window.onAndroidSignInResult", out.toString());
                } catch (Exception e) {
                    callJs("window.onAndroidSignInError", String.valueOf(e.getMessage()));
                }
            }
        }).start();
    }

    /* -------------------- Drive -------------------- */

    private void driveBackup(final String json) {
        new Thread(new Runnable() {
            public void run() {
                try {
                    if (accessToken == null) throw new Exception("not signed in");
                    String fileId = findDriveFile();
                    if (fileId != null) {
                        HttpURLConnection c = (HttpURLConnection) new URL(
                                DRIVE_UPLOAD + "/files/" + fileId + "?uploadType=media").openConnection();
                        c.setRequestMethod("PATCH");
                        c.setDoOutput(true);
                        c.setRequestProperty("Authorization", "Bearer " + accessToken);
                        c.setRequestProperty("Content-Type", "application/json");
                        OutputStream os = c.getOutputStream();
                        os.write(json.getBytes("UTF-8"));
                        os.close();
                        readAll(c.getInputStream());
                    } else {
                        String boundary = "khatana" + System.currentTimeMillis();
                        String meta = "{\"name\":\"" + DRIVE_FILE + "\",\"parents\":[\"appDataFolder\"]}";
                        String multipart = "--" + boundary + "\r\n"
                                + "Content-Type: application/json; charset=UTF-8\r\n\r\n" + meta + "\r\n"
                                + "--" + boundary + "\r\n"
                                + "Content-Type: application/json\r\n\r\n" + json + "\r\n"
                                + "--" + boundary + "--";
                        HttpURLConnection c = (HttpURLConnection) new URL(
                                DRIVE_UPLOAD + "/files?uploadType=multipart&fields=id").openConnection();
                        c.setRequestMethod("POST");
                        c.setDoOutput(true);
                        c.setRequestProperty("Authorization", "Bearer " + accessToken);
                        c.setRequestProperty("Content-Type", "multipart/related; boundary=" + boundary);
                        OutputStream os = c.getOutputStream();
                        os.write(multipart.getBytes("UTF-8"));
                        os.close();
                        readAll(c.getInputStream());
                    }
                    callJs("window.onDriveBackupResult", "ok");
                } catch (Exception e) {
                    callJs("window.onDriveBackupError", String.valueOf(e.getMessage()));
                }
            }
        }).start();
    }

    private void driveRestore() {
        new Thread(new Runnable() {
            public void run() {
                try {
                    if (accessToken == null) throw new Exception("not signed in");
                    String fileId = findDriveFile();
                    if (fileId == null) throw new Exception("Drive में कोई बैकअप नहीं मिला");
                    HttpURLConnection c = (HttpURLConnection) new URL(
                            DRIVE_API + "/files/" + fileId + "?alt=media").openConnection();
                    c.setRequestProperty("Authorization", "Bearer " + accessToken);
                    callJs("window.onDriveRestoreResult", readAll(c.getInputStream()));
                } catch (Exception e) {
                    callJs("window.onDriveRestoreError", String.valueOf(e.getMessage()));
                }
            }
        }).start();
    }

    private String findDriveFile() throws Exception {
        String q = URLEncoder.encode("name='" + DRIVE_FILE + "' and trashed=false", "UTF-8");
        HttpURLConnection c = (HttpURLConnection) new URL(
                DRIVE_API + "/files?spaces=appDataFolder&fields=files(id,name)&q=" + q).openConnection();
        c.setRequestProperty("Authorization", "Bearer " + accessToken);
        JSONObject j = new JSONObject(readAll(c.getInputStream()));
        JSONArray files = j.optJSONArray("files");
        if (files != null && files.length() > 0) return files.getJSONObject(0).optString("id", null);
        return null;
    }

    /* -------------------- sharing / files / sms -------------------- */

    private void openUrl(String url) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception e) {
            toastMsg("कोई ऐप नहीं मिला");
        }
    }

    private void sendSms(String phone, String body) {
        try {
            Intent i = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + phone));
            i.putExtra("sms_body", body == null ? "" : body);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception e) {
            toastMsg("SMS ऐप नहीं मिला");
        }
    }

    private void shareText(String text) {
        try {
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("text/plain");
            i.putExtra(Intent.EXTRA_TEXT, text == null ? "" : text);
            startActivity(Intent.createChooser(i, "शेयर करें"));
        } catch (Exception e) {
            toastMsg("शेयर विफल");
        }
    }

    private File writeShareFile(String name, String base64) throws Exception {
        File dir = new File(getCacheDir(), "share");
        if (!dir.exists()) dir.mkdirs();
        File f = new File(dir, name);
        byte[] data = Base64.decode(base64, Base64.DEFAULT);
        FileOutputStream os = new FileOutputStream(f);
        os.write(data);
        os.close();
        return f;
    }

    private void shareFile(String name, String base64, String mime, String text) {
        try {
            writeShareFile(name, base64);
            Uri u = Uri.parse("content://" + ShareProvider.AUTHORITY + "/" + name);
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType(mime == null ? "application/octet-stream" : mime);
            i.putExtra(Intent.EXTRA_STREAM, u);
            if (text != null && text.length() > 0) i.putExtra(Intent.EXTRA_TEXT, text);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(i, "शेयर करें"));
        } catch (Exception e) {
            toastMsg("शेयर विफल: " + e.getMessage());
        }
    }

    private void saveFile(String name, String base64, String mime) {
        try {
            byte[] data = Base64.decode(base64, Base64.DEFAULT);
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                v.put(MediaStore.Downloads.MIME_TYPE, mime == null ? "application/octet-stream" : mime);
                Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                OutputStream os = getContentResolver().openOutputStream(u);
                os.write(data);
                os.close();
                toastMsg("डाउनलोड फ़ोल्डर में सेव हो गया");
            } else {
                File dir = new File(getExternalFilesDir(null), "downloads");
                if (!dir.exists()) dir.mkdirs();
                File f = new File(dir, name);
                FileOutputStream os = new FileOutputStream(f);
                os.write(data);
                os.close();
                toastMsg("सेव हो गया: " + f.getAbsolutePath());
            }
        } catch (Exception e) {
            toastMsg("सेव विफल: " + e.getMessage());
        }
    }

    /* -------------------- helpers -------------------- */

    private void toastMsg(final String msg) {
        runOnUiThread(new Runnable() {
            public void run() { Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show(); }
        });
    }

    private void callJs(final String fn, final String arg) {
        final String js = fn + "(" + JSONObject.quote(arg) + ")";
        runOnUiThread(new Runnable() {
            public void run() { if (webView != null) webView.evaluateJavascript(js, null); }
        });
    }

    private static String readAll(InputStream in) throws Exception {
        BufferedReader r = new BufferedReader(new InputStreamReader(in, "UTF-8"));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = r.readLine()) != null) sb.append(line);
        r.close();
        return sb.toString();
    }

    private static String enc(String v) throws Exception {
        return URLEncoder.encode(v, "UTF-8");
    }

    private static String randomVerifier() {
        byte[] b = new byte[32];
        new SecureRandom().nextBytes(b);
        return Base64.encodeToString(b, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
    }

    private static String sha256Base64Url(String input) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] d = md.digest(input.getBytes("UTF-8"));
        return Base64.encodeToString(d, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
    }

    /* -------------------- JS bridge -------------------- */

    private class Bridge {
        @JavascriptInterface
        public boolean isConfigured() { return MainActivity.this.isConfigured(); }

        @JavascriptInterface
        public boolean hasDrive() { return true; }

        @JavascriptInterface
        public boolean hasShare() { return true; }

        @JavascriptInterface
        public void signIn(final String cid) { runOnUiThread(new Runnable() { public void run() { startSignIn(cid); } }); }

        @JavascriptInterface
        public void signOut() { accessToken = null; idToken = null; }

        @JavascriptInterface
        public void driveBackup(final String json) { MainActivity.this.driveBackup(json); }

        @JavascriptInterface
        public void driveRestore() { MainActivity.this.driveRestore(); }

        @JavascriptInterface
        public void openUrl(final String url) {
            runOnUiThread(new Runnable() { public void run() { MainActivity.this.openUrl(url); } });
        }

        @JavascriptInterface
        public void sendSms(final String phone, final String body) {
            runOnUiThread(new Runnable() { public void run() { MainActivity.this.sendSms(phone, body); } });
        }

        @JavascriptInterface
        public void shareText(final String text) {
            runOnUiThread(new Runnable() { public void run() { MainActivity.this.shareText(text); } });
        }

        @JavascriptInterface
        public void shareFile(final String name, final String base64, final String mime, final String text) {
            runOnUiThread(new Runnable() { public void run() { MainActivity.this.shareFile(name, base64, mime, text); } });
        }

        @JavascriptInterface
        public void saveFile(final String name, final String base64, final String mime) {
            new Thread(new Runnable() { public void run() { MainActivity.this.saveFile(name, base64, mime); } }).start();
        }

        @JavascriptInterface
        public void toast(final String msg) { toastMsg(msg); }
    }
}
