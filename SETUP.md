# Panduan setup automasi tempahan Spa SAM

Masa diperlukan: lebih kurang **15 minit**, sekali sahaja. Buat di **komputer / laptop** (lebih mudah daripada telefon).

## Apa yang sistem ini buat

1. Pelanggan tempah di web app → pilih servis, tarikh & masa (slot yang sudah diambil ditanda **Penuh**).
2. Tempahan **masuk automatik** ke Google Sheet "Tempahan" dan **Google Calendar** akaun `syafiqaurawellness@gmail.com`.
3. **Emel** dihantar ke `syafiqaurawellness@gmail.com` untuk setiap tempahan baharu.
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

## Langkah 1 — Buat Google Sheet

1. Log masuk ke Google sebagai **syafiqaurawellness@gmail.com**.
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
3. Selepas siap, tab **Tempahan** muncul dalam Sheet dengan tajuk lajur, dan folder **SAM - Resit Deposit** dibuat dalam Google Drive.

## Langkah 4 — Deploy sebagai Web app

1. Klik **Deploy › New deployment**.
2. ⚙ di sebelah "Select type" → pilih **Web app**.
3. Tetapkan:
   - **Execute as:** Me (syafiqaurawellness@gmail.com)
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
2. Semak: baris baharu dalam Sheet ✓ · acara kuning dalam Calendar ✓ · emel "Tempahan baharu" ✓.
3. Muat naik gambar resit → acara jadi oren ✓ · emel dengan lampiran ✓.
4. "Tempahan saya" → tukar tarikh → acara bergerak ✓.
5. Tukar Status ujian kepada **Batal** dalam Sheet untuk memadam acara ujian.

## Kerja harian Sam

- Emel **"Resit deposit diterima"** masuk → semak resit → tukar Status kepada **Disahkan** dalam Sheet (acara jadi hijau) → tekan butang **WhatsApp pelanggan (sahkan)** dalam emel untuk hantar mesej pengesahan.
- Selepas sesi → Status **Selesai**.
- Batal → Status **Batal** (slot dibuka semula).

- Mahu tutup masa tertentu? Tambah acara dalam Google Calendar (cth. "Rehat") — slot itu jadi kelabu di website.
- Cuti sehari? Tambah acara **sepanjang hari** — seluruh hari ditutup.

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
