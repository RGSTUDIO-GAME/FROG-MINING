# Frog Runner — Asset Folder

Saat ini game memakai **aset PNG asli** untuk karakter dan background.

## Cara ganti karakter dengan PNG sendiri

1. Taruh frame PNG kamu di folder ini, misal: `frames/` (nama bebas, urut).
2. Buka `src/screens/RunnerScreen.js`, ubah:

   ```js
   const FROG_ART = 'frames'; // 'builtin' | 'frames'
   const ASSETS = {
     IDLE: 'idle.png',
     BLINK: 'blink.png',
     RUN:  ['run-1.png', 'run-2.png', 'run-3.png', 'run-4.png'],
     DUCK: ['duck-1.png', 'duck-2.png'],
     JUMP: ['jump-start.png', 'jump.png', 'fall.png', 'landing.png'],
   };
   ```

   - `RUN` = animasi lari, `DUCK` = jongkok, `JUMP` = loncat + fall + landing.
   - `IDLE` dan `BLINK` dipakai saat awal / reaksi idle.
   - Hitbox memakai `FROG_BOUNDS` di file yang sama — sesuaikan dengan gambar baru kalau perlu.

3. Build & deploy ulang. Semua rintangan, tanah, dan efek lain tetap otomatis.

## Ukuran aset yang paling pas untuk runner ini

Ukuran di bawah ini mengikuti layout dan scaling yang sudah dipakai game:

| Aset | Ukuran yang disarankan | Catatan |
|------|------------------------|---------|
| Background langit utama | `1672x941` | File yang sudah dipasang: `background/sky.png` |
| Awan | `1536x1024` | File yang sudah dipasang: `background/clouds.png` |
| Bukit jauh | `1536x1024` | File yang sudah dipasang: `background/hill-far.png` |
| Bukit dekat | `1536x1024` | File yang sudah dipasang: `background/hill-near.png` |
| Ground tile | `1536x1024` | File yang sudah dipasang: `background/ground.png` |
| Karakter katak | frame individual, dibungkus ke canvas `240x240` saat runtime | File yang sudah dipasang ada di `character/` |

Kalau kamu mau kirim background dan ground, paling aman kirim sebagai layer terpisah, bukan 1 gambar besar campur semua.
