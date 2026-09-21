# MangoSphere Preview

Folder ini adalah playground statis untuk memprototipekan tampilan captive portal. Visualnya sengaja memakai stylesheet dan struktur form dari codebase asli.

## Menjalankan

Buka `index.html` langsung di browser, atau jalankan server lokal dari folder project:

```powershell
python -m http.server 5500
```

Kemudian buka `http://localhost:5500/preview/`.

Halaman preview yang tersedia:

- `index.html` - login
- `status.html` - status koneksi
- `logout.html` - ringkasan setelah logout
- `error.html` - pesan error login

## Batasan preview

- Login hanya simulasi dan tidak mengirim request ke MikroTik.
- Login dan pembelian voucher hanya menampilkan pesan simulasi.
- Gambar menggunakan aset bersama dari folder `../img`.
- Placeholder MikroTik dihilangkan hanya agar halaman dapat dirender di browser.

## Saat dipindahkan ke MikroTik

Gunakan file asli di root project sebagai sumber produksi. Preview ini hanya untuk eksplorasi layout dan interaksi visual. Setelah desain disetujui, implementasikan perubahan ke template asli sambil mempertahankan placeholder MikroTik seperti `$(link-login-only)`, `$(chap-id)`, dan `$(endif)`.
