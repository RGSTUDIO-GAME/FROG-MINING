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
