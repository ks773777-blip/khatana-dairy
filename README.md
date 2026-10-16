# डेयरी दूध प्रबंधक (Khatana Dairy Manager)

दूध बिक्री, ग्राहक और भुगतान प्रबंधन के लिए एक ऑफ़लाइन-फर्स्ट ऐप — अब **Google लॉगिन**, **Firebase** और **Google Drive बैकअप** के साथ, और **Android APK** के रूप में भी।

A dairy/milk sales manager for small vendors: customers, daily sales, payments, dues, reports and invoices. Works fully offline, is installable as an Android app (APK) or a PWA, and can optionally back up to Google Drive after a Google sign-in.

---

## ✨ फीचर्स (Features)

- **पूरी तरह ऑफ़लाइन** — सारा डेटा फ़ोन में IndexedDB में सुरक्षित रहता है, इंटरनेट की ज़रूरत नहीं।
- **डैशबोर्ड** — महीने की कुल बिक्री, भुगतान और बकाया।
- **बिक्री (Sell)** — सुबह/शाम शिफ्ट के हिसाब से दूध बिक्री दर्ज करें।
- **ग्राहक** — ग्राहक जोड़ें/एडिट करें, डिफ़ॉल्ट मात्रा व दर सेट करें।
- **भुगतान** — भुगतान दर्ज करें, बकाया अपने-आप जुड़ता/घटता है।
- **रिपोर्ट** — मासिक रिपोर्ट, CSV एक्सपोर्ट, चालान (invoice) प्रिंट/PDF, WhatsApp रिमाइंडर।
- **डेटा प्रबंधन** — JSON बैकअप/रिस्टोर, डुप्लीकेट सफ़ाई, बल्क दर/मात्रा अपडेट।
- **Google लॉगिन + Google Drive बैकअप** — साइन इन करके एक टैप में डेटा Drive में सुरक्षित करें और किसी भी फ़ोन पर वापस पाएँ।
- **Firebase** — वेब/PWA संस्करण में Firebase Auth (और Firestore के लिए तैयार)।

---

## 📦 इस रिपॉज़िटरी में क्या है

| फ़ाइल / फ़ोल्डर | विवरण |
|---|---|
| `index.html` | पूरा ऐप (UI + लॉजिक + cloud.js का इस्तेमाल) |
| `cloud.js` | Google साइन-इन + Google Drive बैकअप/रिस्टोर मॉड्यूल |
| `firebase-config.js` | **आपकी** Firebase keys यहाँ भरनी हैं |
| `manifest.json`, `service-worker.js` | PWA (होम-स्क्रीन पर इंस्टॉल + ऑफ़लाइन कैश) |
| `vendor/` | Firebase JS SDK (लोकल, ऑफ़लाइन के लिए) |
| `icons/` | ऐप आइकन |
| `android/` | Android ऐप प्रोजेक्ट (WebView + native Google OAuth bridge) |
| `tools/build_apk.sh` | बिना Gradle के APK बनाने की स्क्रिप्ट |
| `dist/` | तैयार APK |

---

## 🚀 तुरंत इस्तेमाल करें

### विकल्प 1 — APK इंस्टॉल करें (सबसे आसान)
1. `dist/khatana-dairy-v1.0.apk` डाउनलोड करें।
2. फ़ोन में उसे खोलें → "अज्ञात स्रोत से इंस्टॉल करने दें" (Allow install from unknown sources) चुनें।
3. ऐप इंस्टॉल हो जाएगा और पूरी तरह ऑफ़लाइन काम करेगा।

### विकल्प 2 — वेब / PWA
रिपॉज़िटरी को **GitHub Pages** पर ऑन करें (Settings → Pages → Branch: `main` → `/ (root)`), फिर उस लिंक को फ़ोन के Chrome में खोलकर "Add to Home screen" करें।

---

## ☁️ Google लॉगिन + Drive बैकअप सेट करना (एक बार का काम)

> बिना यह सेट किए भी ऐप पूरी तरह काम करता है — सिर्फ़ लॉगिन/ड्राइव बटन "सेट नहीं" दिखाएँगे। सब कुछ **मुफ़्त** है (Firebase Spark plan)।

### 1) Firebase प्रोजेक्ट
1. [Firebase Console](https://console.firebase.google.com/) → **Add project**।
2. **Authentication → Sign-in method → Google → Enable**।
3. **Project settings → General → Your apps → Web app (</>)** जोड़ें और उसका config कॉपी करें।
4. `firebase-config.js` में उसे पेस्ट करें:

```js
window.FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```

### 2) Authorized domains
Firebase Console → **Authentication → Settings → Authorized domains** में अपना GitHub Pages डोमेन (जैसे `username.github.io`) जोड़ें।

### 3) Google Drive बैकअप
`cloud.js` पहले से `drive.appdata` स्कोप माँगता है, इसलिए अलग से कुछ नहीं करना — साइन इन के बाद **"Google Drive में बैकअप लें"** बटन काम करेगा। (यह डेटा ऐप के निजी Drive फ़ोल्डर में जाता है, आपके सामान्य Drive में नहीं दिखता।)

### 4) APK में लॉगिन (वैकल्पिक)
APK के अंदर लॉगिन के लिए एक **Android** OAuth client चाहिए:
1. [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) → **Create credentials → OAuth client ID → Android**।
2. **Package name:** `com.khatana.dairymanager`
3. **SHA-1:** (नीचे दिया गया, या `tools/build_apk.sh` चलाने पर प्रिंट होता है)

   ```
   0C:96:F6:B6:8D:01:70:59:51:4F:90:D2:3B:AF:7D:5A:67:81:89:2C
   ```
4. बनने वाली client id को `android/app/src/main/assets/oauth.properties` में `client_id=` के आगे पेस्ट करें, और `AndroidManifest.xml` में `android:scheme` को `com.googleusercontent.apps.<client-id-का-पहला-भाग>` से बदलें।
5. दोबारा `tools/build_apk.sh` चलाकर APK बनाएँ।

---

## 🛠️ खुद APK बनाना (without Gradle)

ज़रूरी चीज़ें: **JDK 17**, Android **build-tools** (aapt2/d8/apksigner/zipalign) और किसी platform का **android.jar** (API 34)।

```bash
export JAVA_HOME=/path/to/jdk-17
export BUILD_TOOLS=/path/to/android-sdk/build-tools/34.0.0
export ANDROID_JAR=/path/to/android-sdk/platforms/android-34/android.jar
bash tools/build_apk.sh
# => android/build/app-release.apk
```

पहली बार चलाने पर एक signing keystore `android/keystore/release.keystore` बन जाता है — इसे संभालकर रखें, इसी से ऐप के अपडेट साइन होंगे।

---

## 🔐 नोट्स
- साइनिंग keystore और build फ़ाइलें git में शामिल नहीं हैं (`.gitignore` देखें)।
- कोई भी paid सेवा नहीं — Firebase का मुफ़्त Spark plan और Google Drive की मुफ़्त कोटा ही काफ़ी है।
- डेटा पूरी तरह आपके पास: ऑफ़लाइन डेटा फ़ोन में, क्लाउड बैकअप (अगर चालू करें) आपके ही Drive में।

---

## 📄 License
MIT — मनचाहे तरीके से इस्तेमाल और बदलाव करें।
