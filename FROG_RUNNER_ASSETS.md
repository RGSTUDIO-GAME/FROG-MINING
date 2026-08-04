# 🐸 Frog Runner — Daftar Aset (Checklist)

Dokumen ini adalah daftar aset yang akan dikirim oleh pemilik project secara bertahap.
**Status: game sudah berjalan dengan art buatan kode (builtin).**

> ⚠️ **Update 2026-08-02:** aset A1 (JPEG/PNG frame katak) sudah **dihapus** dari repo
> dan diganti **art procedural buatan kode** (katak hijau beranimasi). Ini diputuskan
> karena frame A1 tidak terlihat hidup di ukuran kecil & rintangan darat tidak kontras
> dengan background. Semua aset lain (tanah, kaktus, batu, burung, kayu, koin, awan,
> kunang-kunang, debu) juga digambar dengan kode Phaser.
>
> Kalau nanti mau kirim aset pengganti, lihat `public/assets/frog-runner/README.md`
> untuk cara pasang PNG frame karakter baru (cukup ubah `FROG_ART` di
> `src/screens/RunnerScreen.js`).

---

## Cara Pengiriman (yang diminta saat kirim aset)

Untuk setiap aset, mohon sertakan:
- **Nama file** (mis. `frog-run.png`)
- **Format**: PNG (transparan) untuk sprite/UI, MP3/OGG untuk audio
- **Sprite sheet**: jumlah kolom × baris, ukuran frame (lebar × tinggi px)
- **Jumlah frame per animasi** (jika berupa sheet animasi)
- **Catatan skala** jika ada (mis. karakter 2× dari ukuran asli)

## Ukuran Final yang Disarankan

Ukuran di bawah ini sudah disesuaikan dengan cara render di `src/screens/RunnerScreen.js`.
Kalau kamu kirim aset baru, paling aman ikuti ukuran target ini supaya tinggal pasang.

| Aset | Ukuran sumber yang disarankan | Cara dipakai di game |
|------|------------------------------|----------------------|
| **Background langit utama** | `1920x1080` atau `1600x900` | Full-screen cover di belakang canvas. Kalau ingin parallax, bisa dikirim sebagai beberapa layer. |
| **Awan** | `200x64` atau `400x128` | Dipakai sebagai tile/background layer yang bisa diulang horizontal. |
| **Bukit jauh** | `400x220` | Layer parallax jauh, idealnya seamless horizontal. |
| **Bukit dekat / semak** | `320x140` | Layer parallax dekat, idealnya seamless horizontal. |
| **Tanah / ground tile** | `96x64` | Tile yang diulang sepanjang lantai. Bagian atas harus nyambung mulus. |
| **Karakter katak** | Disarankan 1 ukuran kanvas konsisten, mis. `128x128` atau `240x240` | Semua pose sebaiknya punya canvas yang sama supaya anchor dan hitbox stabil. |

### Catatan penting untuk tanah

- Ground di runner saat ini bukan 1 gambar besar, tapi **tile berulang**.
- Jadi yang dibutuhkan bukan gambar panjang, melainkan **1 potong tile yang seamless**.
- Bagian atas tanah harus rapi kalau disambung ke kiri/kanan.
- Kalau mau ada variasi, kirim:
  - permukaan rumput
  - badan tanah
  - transisi tanah ke bawah

### Catatan penting untuk langit

- Langit paling aman dikirim sebagai **background lebar**.
- Jika kamu ingin ada awan/bukit terpisah, lebih bagus dipisah jadi layer:
  - `sky` / gradient
  - `cloud`
  - `hill-far`
  - `hill-near`
- Dengan begitu saya bisa pasang parallax tanpa gambar jadi pecah.

---

## Urutan Prioritas Aset

### 📦 Grup A — Inti Gameplay (paling penting, dikirim pertama)
| No | Aset | Detail | Status |
|----|------|--------|--------|
| A1 | **Sprite karakter katak** | PNG frame individual di `public/assets/frog-runner/character/` — dipakai via `FROG_ART='frames'` | Terpasang ✅ |
| A2 | **Background (latar belakang)** | Langit + awan + bukit parallax dari PNG di `public/assets/frog-runner/background/` | Terpasang ✅ |
| A3 | **Ground / tanah** | Tile rumput + tanah dari `public/assets/frog-runner/background/ground.png` | Terpasang ✅ |

### 📦 Grup B — Rintangan
| No | Aset | Detail | Status |
|----|------|--------|--------|
| B1 | **Rintangan Darat 1 — Batu** | Sprite batu (buatan kode) | Terpasang ✅ |
| B2 | **Rintangan Darat 2 — Kaktus** | Sprite kaktus + bunga (buatan kode, warna kontras) | Terpasang ✅ |
| B3 | **Rintangan Darat 3 — Tunggul** | Sprite tunggul pohon | Menunggu |
| B4 | **Rintangan Darat 4 — Jamur** | Sprite jamur | Menunggu |
| B5 | **Rintangan Darat 5 — Tanaman berduri** | Sprite tanaman berduri | Menunggu |
| B6 | **Jurang** | Visual lubang/jurang di tanah (bisa berupa gap pada ground) | Menunggu |
| B7 | **Rintangan Udara 1 — Burung** | Sprite burung animasi sayap 2 frame (buatan kode) | Terpasang ✅ |
| B8 | **Rintangan Udara 2 — Lebah** | Sprite lebah (terbang, bisa 2–4 frame) | Menunggu |
| B9 | **Rintangan Udara 3 — Capung** | Sprite capung (terbang, bisa 2–4 frame) | Menunggu |

### 📦 Grup C — UI
| No | Aset | Detail | Status |
|----|------|--------|--------|
| C1 | **Tombol Jump ⬆️** | Tombol besar untuk melompat (normal + pressed) | Menunggu |
| C2 | **Tombol Duck ⬇️** | Tombol besar untuk menunduk (normal + pressed) | Menunggu |
| C3 | **Tombol Pause ⏸️** | Tombol pause di HUD | Menunggu |
| C4 | **Tombol Restart 🔄** | Tombol restart di layar Game Over | Menunggu |
| C5 | **Tombol Kembali ke Menu 🏠** | Tombol kembali ke menu Home | Menunggu |
| C6 | **Panel/Overlay Game Over** | Panel "Game Over" (styling CSS, dengan animasi masuk) | Terpasang ✅ |
| C7 | **Elemen HUD** | Box skor + tombol pause/keluar + kontrol bawah (CSS) | Terpasang ✅ |

### 📦 Grup D — Audio
| No | Aset | Detail | Status |
|----|------|--------|--------|
| D1 | **SFX Jump** | Suara lompat | Menunggu |
| D2 | **SFX Hit/Kecelakaan** | Suara tabrakan/game over | Menunggu |
| D3 | **SFX Poin/Score** | Suara saat skor bertambah (opsional) | Menunggu |
| D4 | **Musik Background** | Musik latar game runner (opsional, bisa reuse musik yang sudah ada) | Menunggu |

### ⭐ Grup E — Opsional (jika ada)
| No | Aset | Detail | Status |
|----|------|--------|--------|
| E1 | **Efek partikel** (debu lari, kilat jump) | Debu kaki, kilau koin, garis kecepatan, kunang-kunang (kode Phaser) | Terpasang ✅ |
| E2 | **Icon game runner** | Untuk tombol PLAY GAME di Home / high score (opsional) | Menunggu |

---

## Log Penerimaan Aset

| Tanggal | Aset | Status | Catatan |
|---------|------|--------|---------|
2026-08-02 | A1 — Karakter katak | Diganti art kode 🔄 | Frame A1 dihapus. Katak digambar ulang dengan Phaser Graphics (4 frame lari, 2 jongkok, 2 lompat, 1 kedip) supaya animasi jelas & mudah diganti nanti |
2026-08-04 | A2 — Background | Diterima & dipasang | File sky/cloud/hill masuk ke `public/assets/frog-runner/background/` dan dipakai di runner |
2026-08-04 | A3 — Ground / tanah | Diterima & dipasang | File `public/assets/frog-runner/background/ground.png` dipakai sebagai ground layer |

## Catatan

- Semua aset disimpan di folder `public/assets/frog-runner/` saat eksekusi.
- Ground yang sudah diterima tersimpan di `public/assets/frog-runner/background/ground.png`.
- Sekarang game memakai art kode — instruksi ganti aset ada di `public/assets/frog-runner/README.md`.
- Jika ada aset yang kurang jelas (mis. ukuran frame tidak konsisten), saya akan tanya sebelum dipakai.
