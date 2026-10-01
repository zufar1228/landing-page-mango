/* Auto-login voucher dari link, misalnya tombol di halaman invoice:
 *   tsat.zone/login?voucher=KODE   atau   tsat.zone/connect.html?voucher=KODE
 *
 * Kode ditangkap dari URL, disimpan sementara di sessionStorage, dan segera
 * dihapus dari address bar. Halaman login lalu mengirim kode lewat form login
 * cadangan (alur Login biasa: doLogin + CHAP), paling banyak sekali.
 *
 * Pengaman loop: bila halaman login muncul lagi setelah pengiriman, atau
 * router menampilkan error (#hs-error), auto-login berhenti dan pengguna bisa
 * mencoba manual. State dibersihkan oleh done() di alogin/status dan
 * kedaluwarsa setelah 3 menit.
 *
 * Pesan router hanya dibaca lewat textContent, tidak pernah ditulis sebagai HTML.
 */
var BriteAutoLogin = (function () {
    var KEY = 'brite-autologin';
    var TTL = 3 * 60 * 1000;
    // Link voucher baru yang dibuka >= 30 detik setelah percobaan sebelumnya
    // dianggap permintaan baru (percobaan boleh diulang). Loop tetap aman:
    // URL dibersihkan dan respons POST router tidak membawa ?voucher.
    var RETRY_AFTER = 30 * 1000;
    var CODE_RE = /^[A-Za-z0-9_-]{1,64}$/;

    function now() {
        return new Date().getTime();
    }

    function read() {
        try {
            var s = JSON.parse(window.sessionStorage.getItem(KEY));
            if (s && s.code && now() - s.ts < TTL) {
                return s;
            }
        } catch (e) {
            // Storage tidak tersedia / isi rusak: anggap tidak ada.
        }
        return null;
    }

    function write(s) {
        try {
            window.sessionStorage.setItem(KEY, JSON.stringify(s));
        } catch (e) {
            // Diabaikan: tanpa storage tetap aman, tidak ada loop.
        }
    }

    function clear() {
        try {
            window.sessionStorage.removeItem(KEY);
        } catch (e) {
            // Diabaikan.
        }
    }

    function param(name) {
        var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(window.location.search || '');
        if (!m) {
            return null;
        }
        try {
            return decodeURIComponent(m[1].replace(/\+/g, ' ')).replace(/^\s+|\s+$/g, '');
        } catch (e) {
            return '';
        }
    }

    // Hapus kode dari address bar / riwayat, pertahankan parameter lain.
    function stripUrl() {
        try {
            var q = (window.location.search || '').replace(/^\?/, '').split('&');
            var keep = [];
            for (var i = 0; i < q.length; i++) {
                if (q[i] && !/^voucher=/.test(q[i])) {
                    keep.push(q[i]);
                }
            }
            window.history.replaceState(null, '',
                window.location.pathname + (keep.length ? '?' + keep.join('&') : ''));
        } catch (e) {
            // Browser lama: dibiarkan.
        }
    }

    // Pesan error router: isi elemen #hs-error, dibaca sebagai teks biasa.
    function routerError() {
        var el = document.getElementById('hs-error');
        var t = el ? el.textContent : '';
        return (t || '').replace(/^\s+|\s+$/g, '');
    }

    // State aktif: dari URL (link baru) digabung dengan sessionStorage.
    function current() {
        var fromUrl = param('voucher');
        var s = read();

        if (fromUrl !== null) {
            stripUrl();
            if (!CODE_RE.test(fromUrl)) {
                return { invalid: true };
            }
            if (!s || s.code !== fromUrl || now() - s.ts >= RETRY_AFTER) {
                s = { code: fromUrl, ts: now(), submitted: false };
            }
            write(s);
        }
        return s;
    }

    return {
        /* login.html. form = document.login (form login cadangan).
           Mengembalikan true jika sedang mengirim login otomatis. */
        onLoginPage: function (form) {
            var s = current();
            if (!s || s.invalid || !form || !form.username) {
                return false;
            }

            // Sudah pernah dikirim (login muncul lagi) atau router menolak:
            // berhenti, pesan error tampil apa adanya. Kolom diisi kembali
            // dengan kode supaya bisa dicoba manual.
            if (s.submitted || routerError()) {
                if (!form.username.value) {
                    form.username.value = s.code;
                }
                clear();
                return false;
            }

            s.submitted = true;
            write(s);

            form.username.value = s.code;
            if (!form.onsubmit || form.onsubmit() !== false) {
                form.submit();
            }
            return true;
        },

        /* alogin.html dan status.html: login berhasil, bersihkan state. */
        done: function () {
            clear();
        },

        /* connect.html: simpan kode, lalu buka halaman login. */
        startFromEntry: function () {
            var s = current();
            window.location.replace(s && !s.invalid
                ? '/login?voucher=' + encodeURIComponent(s.code)
                : '/login');
        }
    };
})();
