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

---

## Urutan Prioritas Aset

### 📦 Grup A — Inti Gameplay (paling penting, dikirim pertama)
| No | Aset | Detail | Status |
|----|------|--------|--------|
| A1 | **Sprite karakter katak** | Sementara: art kode (builtin) — `FROG_ART='builtin'`. Frame PNG pengganti bisa dipasang via `FROG_ART='frames'` | Dihapus 2026-08-02 (diganti builtin) 🔄 |
| A2 | **Background (latar belakang)** | Langit + awan + bukit parallax (buatan kode) | Terpasang ✅ |
| A3 | **Ground / tanah** | Tile rumput + tanah (buatan kode) | Terpasang ✅ |

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

## Catatan

- Semua aset disimpan di folder `public/assets/frog-runner/` saat eksekusi (belum dibuat).
- Sekarang game memakai art kode — instruksi ganti aset ada di `public/assets/frog-runner/README.md`.
- Jika ada aset yang kurang jelas (mis. ukuran frame tidak konsisten), saya akan tanya sebelum dipakai.
