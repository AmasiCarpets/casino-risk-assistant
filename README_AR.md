# Limbo Provably Fair — 10,000 لوحة

هذه نسخة تعليمية مستقلة، وليست مرتبطة بـ Stake ولا تتنبأ بنتائجه.

## التشغيل على الكمبيوتر

1. ثبّت Node.js إصدار 18 أو أحدث.
2. افتح Terminal داخل المجلد.
3. نفّذ:

```bash
npm install
npm start
```

4. افتح:

```text
http://localhost:3000
```

## لماذا لا يعمل مباشرة على GitHub Pages؟

GitHub Pages يستضيف ملفات ثابتة فقط. نظام Provably Fair الحقيقي يحتاج خادمًا يحتفظ بـ Server Seed سريًا.
لو وضعت Server Seed داخل JavaScript في GitHub Pages، يستطيع أي شخص رؤيته قبل اللعب، وبالتالي لا يكون النظام آمنًا.

## طريقة النظام

- الخادم ينشئ Server Seed سري.
- يعرض SHA-256 Hash فقط قبل اللعب.
- كل نتيجة تستخدم:
  - Server Seed
  - Client Seed
  - Nonce
  - HMAC-SHA256
- عند تغيير Server Seed، يكشف الخادم القديم ويبدأ Seed جديد.
- يمكنك التحقق من أي جولة قديمة بعد الكشف.

## الملفات

- `server.js`: الخادم ومحرك Provably Fair.
- `public/index.html`: الواجهة.
- `public/styles.css`: التصميم.
- `public/app.js`: تشغيل الواجهة ورسم 10,000 نتيجة على Canvas.
- `package.json`: الحزم وأمر التشغيل.

## ملاحظة مهمة

المشروع يستخدم رصيدًا ونتائج تجريبية فقط، ولا يحتوي على إيداع أو سحب أو أموال حقيقية.
