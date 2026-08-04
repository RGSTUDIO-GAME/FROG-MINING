# Frog Runner — Asset Folder

Saat ini game memakai **art buatan kode (builtin)** — tidak butuh file gambar.

## Cara ganti karakter dengan PNG sendiri

1. Taruh frame PNG kamu di folder ini, misal: `frames/` (nama bebas, urut).
2. Buka `src/screens/RunnerScreen.js`, ubah:

   ```js
   const FROG_ART = 'frames'; // 'builtin' | 'frames'
   const ASSETS = {
     RUN:  ['frog-r1-0.png', 'frog-r1-1.png', 'frog-r1-2.png', 'frog-r1-3.png'],
     DUCK: ['frog-r2-0.png', 'frog-r2-1.png', 'frog-r2-2.png', 'frog-r2-3.png'],
     JUMP: ['frog-r3-0.png', 'frog-r3-1.png', 'frog-r3-2.png'],
   };
   ```

   - `RUN` = animasi lari (4 frame), `DUCK` = jongkok, `JUMP` = lompat.
   - Hitbox memakai `FROG_BOUNDS` di file yang sama — sesuaikan dengan gambar baru kalau perlu.

3. Build & deploy ulang. Semua rintangan, tanah, dan efek lain tetap otomatis.

## Ukuran aset yang paling pas untuk runner ini

Ukuran di bawah ini mengikuti layout dan scaling yang sudah dipakai game:

| Aset | Ukuran yang disarankan | Catatan |
|------|------------------------|---------|
| Background langit utama | `1920x1080` atau `1600x900` | Pakai untuk full-screen background. |
| Awan | `200x64` | Cocok untuk layer awan yang diulang. |
| Bukit jauh | `400x220` | Layer parallax jauh. |
| Bukit dekat | `320x140` | Layer parallax dekat. |
| Ground tile | `96x64` | Harus seamless kiri/kanan. |
| Karakter katak | `128x128` atau `240x240` | Sebaiknya semua pose punya canvas konsisten agar posisi tidak loncat. |

Kalau kamu mau kirim background dan ground, paling aman kirim sebagai layer terpisah, bukan 1 gambar besar campur semua.
