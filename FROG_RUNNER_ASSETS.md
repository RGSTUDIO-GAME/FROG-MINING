# 🐸 Frog Runner — Daftar Aset (Checklist)

Dokumen ini adalah daftar aset yang akan dikirim oleh pemilik project secara bertahap.
**Status: rencana — belum ada eksekusi kode.**
Setiap aset yang sudah diterima akan dicentang di bagian bawah + dicatat tanggalnya.

---

## Cara Pengiriman (yang diminta saat kirim aset)

Untuk setiap aset, mohon sertakan:
- **Nama file** (mis. `frog-run.png`)
- **Format**: PNG (transparan) untuk sprite/UI, MP3/OGG untuk audio
- **Sprite sheet**: jumlah kolom × baris, ukuran frame (lebar × tinggi px)
- **Jumlah frame per animasi** (jika berupa sheet animasi)
- **Catatan skala** jika ada (mis. karakter 2× dari ukuran asli)

---

## Urutan Prioritas Aset

### 📦 Grup A — Inti Gameplay (paling penting, dikirim pertama)
| No | Aset | Detail | Status |
|----|------|--------|--------|
| A1 | **Sprite sheet karakter katak** | Animasi: Idle, Run, Jump Start, Jump, Fall, Landing, Duck, Hit, Game Over — satu sheet berisi semua atau dipisah per animasi | Diterima 2026-08-01 (JPEG) — grid sudah dianalisis ✅ |
| A2 | **Background (latar belakang)** | Langit + elemen parallax (bisa 1–3 lapisan) | Menunggu |
| A3 | **Ground / tanah** | Tile tanah/lantai untuk area lari (bisa pattern yang diulang) | Menunggu |

### 📦 Grup B — Rintangan
| No | Aset | Detail | Status |
|----|------|--------|--------|
| B1 | **Rintangan Darat 1 — Batu** | Sprite batu, satu atau beberapa variasi | Menunggu |
| B2 | **Rintangan Darat 2 — Kayu** | Sprite kayu/batang | Menunggu |
| B3 | **Rintangan Darat 3 — Tunggul** | Sprite tunggul pohon | Menunggu |
| B4 | **Rintangan Darat 4 — Jamur** | Sprite jamur | Menunggu |
| B5 | **Rintangan Darat 5 — Tanaman berduri** | Sprite tanaman berduri | Menunggu |
| B6 | **Jurang** | Visual lubang/jurang di tanah (bisa berupa gap pada ground) | Menunggu |
| B7 | **Rintangan Udara 1 — Burung** | Sprite burung (terbang, bisa 2–4 frame animasi sayap) | Menunggu |
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
| C6 | **Panel/Overlay Game Over** | Background/latar panel "Game Over" (bisa berupa gambar atau cukup styling CSS) | Menunggu |
| C7 | **Elemen HUD** | Box/panel untuk Score & High Score (opsional, bisa cukup pakai CSS) | Menunggu |

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
| E1 | **Efek partikel** (debu lari, kilat jump) | Jika ada; jika tidak, efek dibuat dari kode Phaser (bukan aset baru) | Menunggu |
| E2 | **Icon game runner** | Untuk tombol PLAY GAME di Home / high score (opsional) | Menunggu |

---

## Log Penerimaan Aset

| Tanggal | Aset | Status | Catatan |
|---------|------|--------|---------|
| 2026-08-01 | A1 — Karakter katak | Diterima ✅ | File: `public/assets/frog-runner/frog-char-01.jpg` — JPEG 1080×576. Konfirmasi user: **satu gambar = semua gerakan (sprite sheet)**. Grid terdeteksi: 4 baris (4-4-3-4 frame). Masih menunggu: urutan animasi per baris, jumlah frame per animasi, dan versi PNG transparan |

---

## Analisis Grid A1 (2026-08-01)

File: `public/assets/frog-runner/frog-char-01.jpg` — JPEG **1080×576 px** (belum transparan).

Grid terdeteksi otomatis (pemisahan background putih, threshold >245 RGB):

| Baris | Batas Y | Frame terdeteksi | Batas X per frame | Perkiraan ukuran frame |
|-------|---------|------------------|-------------------|------------------------|
| 1 | 44–202 | **4** (R1C1–R1C4) | 51–277 \| 295–505 \| 520–755 \| 766–1024 | ±211–259 × 156–159 px |
| 2 | 213–256 | **4** (R2C1–R2C4) | 66–265 \| 299–482 \| 539–694 \| 761–992 | ±156–232 × 43–44 px |
| 3 | 291–501 | **3** (R3C1–R3C3) | 55–266 \| 270–787 \| 798–1020 | ±212–518 × 105–202 px (R3C2 sangat lebar ⚠️) |
| 4 | 509–551 | **4** (R4C1–R4C4) | 51–247 \| 300–496 \| 529–732 \| 818–1005 | ±188–204 × 42–43 px |

Catatan:
- Baris 2 & 4 mirip bentuk (pendek/lebar) → kemungkinan pose menunduk (duck) atau lompat rendah.
- Baris 1 & 3 lebih besar/tall → kemungkinan pose berdiri, lari, lompat.
- R3C2 (270–787, lebar ±518 px) kemungkinan berisi **lebih dari 1 pose** (ada lembah tipis di x≈267–269 & 789–796, tapi tidak konsisten). Perlu dicek manual saat potong.
- Masih JPEG (tidak transparan) → untuk hasil terbaik butuh versi **PNG transparan**.

## Catatan

- Semua aset disimpan di folder `public/assets/frog-runner/` saat eksekusi (belum dibuat).
- Kode game **tidak akan disentuh** sampai pemilik project menyuruh **"seting"**.
- Jika ada aset yang kurang jelas (mis. ukuran frame tidak konsisten), saya akan tanya sebelum dipakai.
