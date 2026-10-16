# डेयरी दूध प्रबंधक (Khatana Dairy Manager)

दूध बिक्री, ग्राहक और भुगतान प्रबंधन के लिए एक ऑफ़लाइन-फर्स्ट ऐप — **Google लॉगिन**, **Google Drive बैकअप**, **WhatsApp/SMS बिल** और **PDF चालान** के साथ। Android **APK** और PWA दोनों के रूप में चलता है।

A dairy/milk sales manager for small vendors: customers, daily sales, payments, dues, reports and invoices. Works fully offline, installs as an Android app (APK) or a PWA, and can back up to Google Drive after a Google sign-in.

**Current release: v1.1** — `dist/khatana-dairy-v1.1.apk`

---

## ✨ फीचर्स (Features)

- **पूरी तरह ऑफ़लाइन** — सारा डेटा फ़ोन में IndexedDB में; इंटरनेट की ज़रूरत नहीं।
- **डैशबोर्ड** — महीने की कुल बिक्री, भुगतान और बकाया।
- **बिक्री (Sell)** — सुबह/शाम शिफ्ट के हिसाब से दूध बिक्री।
- **ग्राहक** — जोड़ें/एडिट करें, डिफ़ॉल्ट मात्रा व दर।
- **भुगतान** — भुगतान दर्ज करें, बकाया अपने-आप अपडेट।
- **रिपोर्ट** — मासिक रिपोर्ट, CSV एक्सपोर्ट, चालान प्रिंट/PDF।
- **डेटा प्रबंधन** — JSON बैकअप/रिस्टोर, डुप्लीकेट सफ़ाई, बल्क दर/मात्रा अपडेट।
- **Google लॉगिन / लॉगआउट** — Google Identity Services (ब्राउज़र) या native OAuth (APK)।
- **Google Drive बैकअप/रिस्टोर** — साइन इन के बाद एक टैप में।
- **बिल शेयरिंग (नया)** — ग्राहक के WhatsApp नंबर पर बिल भेजें, SMS भेजें।
- **PDF चालान (नया)** — PDF डाउनलोड करें और PDF को WhatsApp/Drive/किसी भी ऐप पर शेयर करें (देवनागरी सही रेंडर होता है)।

---

## 📦 रिपॉज़िटरी संरचना

| फ़ाइल / फ़ोल्डर | विवरण |
|---|---|
| `index.html` | पूरा ऐप |
| `cloud.js` | Google साइन-इन (GIS + native) + Drive बैकअप |
| `extras.js` | WhatsApp/SMS बिल, PDF बनाना व शेयर करना |
| `firebase-config.js` | Google OAuth client id (और वैकल्पिक Firebase) |
| `manifest.json`, `service-worker.js` | PWA (होम-स्क्रीन इंस्टॉल + ऑफ़लाइन कैश) |
| `vendor/` | Firebase JS SDK + jsPDF (लोकल, ऑफ़लाइन के लिए) |
| `icons/` | ऐप आइकन |
| `android/` | Android प्रोजेक्ट (WebView + native OAuth + ShareProvider) |
| `tools/build_apk.sh` | बिना Gradle के APK बनाने की स्क्रिप्ट |
| `dist/` | तैयार APK |

---

## 🚀 तुरंत इस्तेमाल करें

**APK:** `dist/khatana-dairy-v1.1.apk` डाउनलोड करें → फ़ोन में खोलें → "अज्ञात स्रोत से इंस्टॉल" की अनुमति दें। ऐप पूरी तरह ऑफ़लाइन काम करता है।

**वेब/PWA:** रिपॉज़िटरी को GitHub Pages पर ऑन करें (Settings → Pages → Branch: `main` → `/ (root)`)। लाइव लिंक: `https://<username>.github.io/khatana-dairy/`

---

## ☁️ Google लॉगिन सेटअप

ऐप में पहले से आपका client id भरा है। पूरा काम करने के लिए Google Cloud Console में **दो** OAuth clients बनाएँ (एक ही प्रोजेक्ट में):

**1) Android client (APK के लिए)**
- Type: **Android**
- Package name: `com.khatana.dairymanager`
- SHA-1: `0C:96:F6:B6:8D:01:70:59:51:4F:90:D2:3B:AF:7D:5A:67:81:89:2C`

**2) Web client (ब्राउज़र/PWA के लिए)**
- Type: **Web application**
- Authorized JavaScript origins: `https://<username>.github.io` (और `http://localhost` टेस्ट के लिए)
- Authorized redirect URIs: वही origin

दोनों की client id को इन जगहों पर डालें:
- ब्राउज़र: `firebase-config.js` → `GOOGLE_OAUTH.clientId`
- APK: `android/app/src/main/assets/oauth.properties` → `client_id=`
- APK का redirect scheme: `AndroidManifest.xml` में `android:scheme` = `com.googleusercontent.apps.<client-id-का-पहला-भाग>`

फिर `tools/build_apk.sh` चलाकर APK दोबारा बनाएँ।

> **Firebase (वैकल्पिक):** Firestore सिंक चाहिए तो `firebase-config.js` में Firebase **web** config भरें (apiKey `AIzaSy…` से शुरू होती है)। ध्यान दें: `AQ.…` से शुरू होने वाली key Gemini/Vertex AI की होती है, Firebase के लिए काम नहीं करती। लॉगिन और Drive बैकअप के लिए Firebase की ज़रूरत नहीं है।

---

## 🛠️ खुद APK बनाना (without Gradle)

ज़रूरी: **JDK 17**, Android **build-tools** (aapt2/d8/apksigner/zipalign), platform **android.jar** (API 34)।

```bash
export JAVA_HOME=/path/to/jdk-17
export BUILD_TOOLS=/path/to/android-sdk/build-tools/34.0.0
export ANDROID_JAR=/path/to/android-sdk/platforms/android-34/android.jar
bash tools/build_apk.sh
# => android/build/app-release.apk
```

पहली बार चलाने पर signing keystore `android/keystore/release.keystore` बनता है — इसे सुरक्षित रखें (इसी से ऐप के अपडेट साइन होते हैं)। पासवर्ड `KS_PASS` env var से सेट करें।

---

## 🔐 नोट्स
- कोई paid सेवा नहीं — Firebase का मुफ़्त Spark plan और Google Drive की मुफ़्त कोटा काफ़ी है।
- डेटा आपके पास: ऑफ़लाइन डेटा फ़ोन में, क्लाउड बैकअप आपके ही Drive की निजी app-data फ़ोल्डर में।
- किसी भी API key को सार्वजनिक रिपॉज़िटरी में न रखें।

## 📄 License
MIT
