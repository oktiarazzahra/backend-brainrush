# Cara Membuat Akun Admin

## Langkah-langkah:

1. **Buka terminal di folder backend:**
   ```bash
   cd backend
   ```

2. **Jalankan script create admin:**
   ```bash
   node createAdmin.js
   ```

3. **Akun admin akan dibuat dengan kredensial:**
   - Email: `admin@brainrush.com`
   - Password: `admin123`
   - Role: `admin`

4. **Login sebagai admin:**
   - Buka aplikasi
   - Login dengan email dan password di atas
   - Anda akan otomatis diarahkan ke `/admin/support`

## Catatan Penting:

⚠️ **SEGERA GANTI PASSWORD** setelah login pertama kali untuk keamanan!

## Fitur Admin:

Setelah login sebagai admin, Anda dapat:
- Melihat semua support tickets/laporan
- Filter berdasarkan status dan kategori  
- Update status ticket (Open, In Progress, Resolved, Closed)
- Update priority ticket (Low, Medium, High, Urgent)
- Lihat detail lengkap setiap laporan
- Balas laporan via email

## Mengganti Password Admin:

Untuk mengganti password, hubungi developer atau jalankan script berikut di MongoDB:

```javascript
db.users.updateOne(
  { email: "admin@brainrush.com" },
  { $set: { password: "password_baru_yang_sudah_di_hash" } }
)
```

Atau update melalui halaman profile setelah login.
