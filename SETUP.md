# Panduan setup automasi tempahan SAM Terapi

Masa diperlukan: lebih kurang **15 minit**, sekali sahaja. Buat di **komputer / laptop** (lebih mudah daripada telefon).

## Akaun yang digunakan

| Akaun | Peranan |
|---|---|
| **muhdyusry.abdullah@gmail.com** | **Backend** — memiliki Google Sheet, Apps Script, folder resit. Semua setup dibuat di sini. |
| **syafiqaurawellness@gmail.com** | **Akaun perniagaan Sam** — kalendar Sam (slot kosong/penuh), menerima emel notifikasi, dan **alamat yang pelanggan nampak** pada emel pengesahan. |

## Apa yang sistem ini buat

1. Pelanggan tempah di web app → pilih servis, tarikh & masa (slot yang sudah diambil ditanda **Penuh**).
2. Tempahan **masuk automatik** ke Google Sheet "Tempahan" dan **Google Calendar** akaun `syafiqaurawellness@gmail.com`.
3. **Emel notifikasi** dihantar ke `syafiqaurawellness@gmail.com` dan `muhdyusry.abdullah@gmail.com` untuk setiap tempahan baharu.
   Jika pelanggan isi emel, mereka terima emel **daripada syafiqaurawellness@gmail.com**: tempahan diterima (dengan butiran deposit), resit diterima, **disahkan**, tarikh ditukar, dibatalkan.
4. Pelanggan pilih **cara deposit** (slot tetap ditahan untuk kedua-dua pilihan):
   - **Bayar deposit sekarang** → QR DuitNow + Maybank 1630 4662 3774 → **muat naik resit** di web app → resit disimpan dalam Google Drive dan **emel dengan resit** dihantar kepada Sam.
   - **Bayar kemudian melalui WhatsApp** → mesej WhatsApp meminta Sam hantar butiran deposit. Lajur **Cara deposit** dalam Sheet tertulis "Melalui WhatsApp".
5. Pelanggan tekan **Hantar ke WhatsApp** → butiran tempahan + ID siap ditulis.
6. **Tukar tarikh — semua ikut serentak:**
   - Pelanggan tukar di web app ("Tempahan saya") → Sheet + Calendar bertukar + emel kepada Sam.
   - Sam tukar **Tarikh / Masa / Status** dalam Sheet → Calendar bertukar.
   - Sam **seret acara** dalam Google Calendar → Sheet dikemas kini (setiap 10 minit).

**Slot ikut jadual Sam:** website hanya membenarkan masa yang kosong dalam Google Calendar Sam. Slot yang sudah ditempah, atau bertembung dengan apa-apa acara dalam kalendar Sam (cth. "Rehat 1–2 petang"), dipaparkan **kelabu "Penuh"** dan tidak boleh dipilih. Acara **sepanjang hari** (cth. "Cuti") menutup seluruh hari itu. Dua orang tidak boleh tempah slot yang sama.

Warna acara Calendar: **Kuning** = menunggu deposit · **Oren** = semak resit · **Hijau** = disahkan · **Kelabu** = selesai. Status **Batal** memadam acara dan membuka semula slot.

## Langkah 0 — Sediakan akaun Sam (sekali sahaja)

**A. Sam kongsi kalendar dengan akaun backend** (log masuk sebagai syafiqaurawellness@gmail.com, di komputer):
1. Buka **calendar.google.com** → ⚙ **Settings**.
2. Di kiri, bawah "Settings for my calendars", klik kalendar **Sam** (nama akaun).
3. **Share with specific people or groups** → **+ Add people and groups** → `muhdyusry.abdullah@gmail.com`.
4. Kebenaran: **Make changes to events** → **Send**.
5. Yusri buka emel jemputan di muhdyusry.abdullah@gmail.com dan klik pautan untuk **tambah kalendar**.

**B. Emel pelanggan keluar dari alamat Sam** (log masuk sebagai muhdyusry.abdullah@gmail.com):
1. Gmail → ⚙ → **See all settings** → tab **Accounts and Import**.
2. **Send mail as** → **Add another email address**.
3. Name: `SAM Terapi — Syafiq Aura Massage` · Email: `syafiqaurawellness@gmail.com` · biarkan "Treat as an alias" bertanda → **Next Step** → **Send Verification**.
4. Sam buka Gmail **syafiqaurawellness@gmail.com** → klik pautan pengesahan (atau salin kod dan masukkan).

> Jika langkah B belum dibuat, sistem tetap hantar emel — dari muhdyusry.abdullah@gmail.com dengan "Reply-To" ke syafiqaurawellness@gmail.com.

## Langkah 1 — Buat Google Sheet

1. Log masuk ke Google sebagai **muhdyusry.abdullah@gmail.com** (akaun backend).
2. Buka **sheets.new** → namakan fail **SAM Tempahan**.

## Langkah 2 — Tampal kod Apps Script

1. Dalam Sheet itu: **Extensions › Apps Script**.
2. Padam semua kod dalam `Code.gs`, kemudian tampal **seluruh** isi fail [`apps-script/Code.gs`](apps-script/Code.gs) dari repo ini.
3. Klik ikon **⚙ Project Settings** → tandakan **Show "appsscript.json"** → buka `appsscript.json` dan gantikan dengan isi [`apps-script/appsscript.json`](apps-script/appsscript.json) (ini menetapkan zon masa Malaysia).
4. Klik **💾 Save**.

## Langkah 3 — Jalankan setup sekali

1. Di bahagian atas, pilih fungsi **setup** → klik **▶ Run**.
2. Google akan minta kebenaran: **Review permissions** → pilih akaun → **Advanced** → **Go to project (unsafe)** → **Allow**.
   (Amaran "unsafe" ini biasa untuk skrip peribadi — skrip ini hanya berjalan dalam akaun Sam sendiri.)
   Google akan minta kebenaran Gmail, Calendar, Drive dan Sheets — ini untuk hantar emel dari alamat Sam, tulis ke kalendar Sam, simpan resit dan rekod tempahan.
3. Selepas siap, tab **Tempahan** muncul dalam Sheet dengan tajuk lajur, dan folder **SAM - Resit Deposit** dibuat dalam Google Drive.
4. Klik **Execution log** di bawah. Pastikan ada **"Calendar OK"** dan **"Sender alias OK"**. Jika tertulis *CALENDAR NOT FOUND*, ulang Langkah 0A.

## Langkah 4 — Deploy sebagai Web app

1. Klik **Deploy › New deployment**.
2. ⚙ di sebelah "Select type" → pilih **Web app**.
3. Tetapkan:
   - **Execute as:** Me (muhdyusry.abdullah@gmail.com)
   - **Who has access:** **Anyone**
4. Klik **Deploy** → salin **Web app URL** (berakhir dengan `/exec`).

## Langkah 5 — Sambungkan ke website

1. Di GitHub, buka repo **SPASAM** → branch **gh-pages** → fail **`config.js`** → ikon ✏️ (Edit).
2. Tampal URL tadi:
   ```js
   window.SAM_CONFIG = {
     apiUrl: "https://script.google.com/macros/s/XXXXXXXX/exec"
   };
   ```
3. **Commit changes**. Website dikemas kini dalam ~1 minit.

## Langkah 6 — Uji

1. Buka website di telefon → tempah satu sesi ujian.
2. Isi emel anda sendiri dalam borang. Semak: baris baharu dalam Sheet ✓ · acara kuning dalam **kalendar Sam** ✓ · emel "Tempahan baharu" kepada Sam & Yusri ✓ · emel "Tempahan diterima" kepada pelanggan **daripada syafiqaurawellness@gmail.com** ✓.
3. Muat naik gambar resit → acara jadi oren ✓ · emel dengan lampiran ✓.
4. "Tempahan saya" → tukar tarikh → acara bergerak ✓.
5. Tukar Status ujian kepada **Batal** dalam Sheet untuk memadam acara ujian.

## Kerja harian Sam

- Emel **"Resit deposit diterima"** masuk → semak resit → tukar Status kepada **Disahkan** dalam Sheet (acara jadi hijau) → tekan butang **WhatsApp pelanggan (sahkan)** dalam emel untuk hantar mesej pengesahan.
- Selepas sesi → Status **Selesai**.
- Batal → Status **Batal** (slot dibuka semula).

- Mahu tutup masa tertentu? Tambah acara dalam Google Calendar (cth. "Rehat") — slot itu jadi kelabu di website.
- Cuti sehari? Tambah acara **sepanjang hari** — seluruh hari ditutup.

## Media sosial di website

Bahagian **"Lihat Sam beraksi"** menunjukkan video terkini TikTok **@urutkt** secara automatik (setiap hantaran baharu muncul sendiri).
Untuk suapan Facebook secara langsung, buka `config.js` dan isi `facebookPage` dengan alamat **Page** Facebook (cth. `https://www.facebook.com/SpaSamKT`). Pautan kongsi (`facebook.com/share/...`) dan profil peribadi tidak boleh dipaparkan sebagai suapan — hanya **Facebook Page**.

## Kongsi maklumat pelanggan dengan rakan kongsi

Tak perlu Google Forms — kongsi terus fail yang sistem ini guna:

1. **Google Sheet "SAM Tempahan"** → butang **Share** (Kongsi) → masukkan **syafiqaurawellness@gmail.com** (Editor, supaya Sam boleh tukar Status) dan emel rakan kongsi → pilih **Viewer** (lihat sahaja) atau **Editor** (boleh tukar status/tarikh) → **Send**. Mereka nampak semua tempahan secara langsung.
2. **Google Calendar** → ⚙ **Settings** → pilih kalendar Sam → **Share with specific people** → **Add people** → emel rakan kongsi → **See all event details** (atau **Make changes to events**).
3. **Emel notifikasi kepada lebih dari seorang:** dalam `Code.gs`, tukar baris
   `NOTIFY_EMAIL: 'syafiqaurawellness@gmail.com, muhdyusry.abdullah@gmail.com',` kepada
   `NOTIFY_EMAIL: 'syafiqaurawellness@gmail.com, muhdyusry.abdullah@gmail.com, rakan@gmail.com',`
   kemudian **Deploy › Manage deployments › ✏️ › New version › Deploy**.
4. **Folder Drive "SAM - Resit Deposit"** → Share → emel rakan kongsi (jika mereka perlu lihat resit).

Mahu tarik balik akses? Buka Share yang sama dan buang emel tersebut.

## Tetapan pilihan (bahagian `CONFIG` dalam Code.gs)

| Tetapan | Maksud |
|---|---|
| `SLOTS` | Masa mula sesi (mesti sama dengan website) |
| `MAX_PER_DAY` | Maksimum pelanggan sehari (5) |
| `HOLD_HOURS` | Batal automatik tempahan tanpa deposit selepas N jam (0 = tutup) |
| `MIN_LEAD_MINUTES` | Tidak boleh tempah slot yang bermula dalam masa N minit |

Jika anda ubah `Code.gs` selepas deploy: **Deploy › Manage deployments › ✏️ › Version: New version › Deploy** (URL kekal sama).

## Had yang perlu tahu

- WhatsApp biasa **tidak boleh** mengesan resit yang dihantar dalam chat secara automatik. Sebab itu resit dimuat naik di website (automatik emel), dan pelanggan juga melampirkannya di WhatsApp. Automasi penuh dalam WhatsApp memerlukan **WhatsApp Business Platform (API berbayar oleh Meta)**.
- Jika `apiUrl` kosong atau sistem tidak dapat dihubungi, website masih berfungsi: tempahan dihantar melalui WhatsApp sahaja dan Sam rekod secara manual.
