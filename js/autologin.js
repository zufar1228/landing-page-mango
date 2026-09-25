/* Auto-login voucher dari link, misalnya tombol di halaman invoice:
 *   http://tsat.zone/login?voucher=KODE   atau   http://tsat.zone/connect.html?voucher=KODE
 *
 * Masalah yang diatasi: saat membeli voucher, perangkat biasanya masih dalam
 * sesi TRIAL. MikroTik lalu menampilkan alogin/status (bukan login), halaman
 * trial melakukan logout, dan parameter ?voucher hilang di tengah redirect.
 *
 * Solusi: kode disimpan sementara di sessionStorage begitu halaman mana pun
 * menerimanya. Jika masih trial, sesi trial diakhiri sekali, lalu halaman login
 * mengirim kode lewat alur Login biasa (doLogin + CHAP). Jika sessionStorage
 * tidak tersedia, kode dibawa lewat URL (?voucher=...&al=1) sebagai cadangan.
 *
 * Pengaman loop: logout paling banyak sekali, submit paling banyak sekali per
 * tahap, dan status kedaluwarsa setelah 3 menit.
 */
var BriteAutoLogin = (function () {
    var KEY = 'brite-autologin';
    var TTL = 3 * 60 * 1000;
    var CODE_RE = /^[A-Za-z0-9_-]{1,64}$/;
    var LOGOUT_PATH = '/logout';

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
            return true;
        } catch (e) {
            return false;
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
                if (q[i] && !/^(voucher|al)=/.test(q[i])) {
                    keep.push(q[i]);
                }
            }
            window.history.replaceState(null, '',
                window.location.pathname + (keep.length ? '?' + keep.join('&') : ''));
        } catch (e) {
            // Browser lama: dibiarkan.
        }
    }

    // State aktif: dari URL (link baru) digabung dengan sessionStorage.
    function current() {
        var fromUrl = param('voucher');
        var loggedOutFlag = param('al') === '1';
        var s = read();

        if (fromUrl !== null) {
            stripUrl();
            if (!CODE_RE.test(fromUrl)) {
                return { invalid: true, code: fromUrl };
            }
            if (!s || s.code !== fromUrl) {
                s = { code: fromUrl, ts: now(), loggedOut: false, submitted: false, submittedAfterLogout: false };
            }
            if (loggedOutFlag) {
                s.loggedOut = true;
            }
            write(s);
        }
        return s;
    }

    function withVoucher(url, s) {
        return url + (url.indexOf('?') === -1 ? '?' : '&') +
            'voucher=' + encodeURIComponent(s.code) + (s.loggedOut ? '&al=1' : '');
    }

    function prefill(form, code) {
        if (form && form.username && !form.username.value && CODE_RE.test(code)) {
            form.username.value = code;
        }
    }

    // Keluar dari sesi trial satu kali, lalu logout.html kembali ke login.
    function logoutOnce(s) {
        s.loggedOut = true;
        write(s);
        window.location.replace(withVoucher(LOGOUT_PATH + '?erase-cookie=on', s));
    }

    return {
        /* login.html. errorMsg = pesan $(error) (sudah diterjemahkan).
           Mengembalikan true jika sedang mengirim login otomatis. */
        onLoginPage: function (errorMsg, form) {
            var s = current();
            if (!s) {
                return false;
            }
            if (s.invalid) {
                return false;
            }

            // Router bilang perangkat masih login (trial): logout dulu, sekali.
            if (errorMsg && /sudah login|already logged in/i.test(errorMsg) && !s.loggedOut) {
                logoutOnce(s);
                return true;
            }

            var alreadyTried = s.loggedOut ? s.submittedAfterLogout : s.submitted;
            if (alreadyTried) {
                // Percobaan sebelumnya ditolak router: berhenti, tampilkan
                // pesan error apa adanya, kode tetap terisi untuk dicoba manual.
                clear();
                prefill(form, s.code);
                return false;
            }

            if (s.loggedOut) {
                s.submittedAfterLogout = true;
            } else {
                s.submitted = true;
            }
            write(s);

            form.username.value = s.code;
            if (!form.onsubmit || form.onsubmit() !== false) {
                form.submit();
            }
            return true;
        },

        /* alogin.html dan status.html. isTrial dari $(login-by).
           Mengembalikan true jika sedang berpindah halaman. */
        onLoggedInPage: function (isTrial) {
            var s = current();
            if (!s || s.invalid) {
                return false;
            }
            if (!isTrial) {
                // Sesi voucher sudah aktif: auto-login selesai.
                clear();
                return false;
            }
            if (s.loggedOut) {
                // Sudah pernah logout tapi masih trial: menyerah, alur normal.
                clear();
                return false;
            }
            logoutOnce(s);
            return true;
        },

        /* logout.html: alamat login berikutnya, membawa kode bila ada. */
        loginUrlFor: function (loginUrl) {
            var s = current();
            return (s && !s.invalid) ? withVoucher(loginUrl, s) : loginUrl;
        },

        /* connect.html: simpan kode, lalu buka halaman login. */
        startFromEntry: function () {
            var s = current();
            window.location.replace(s && !s.invalid ? withVoucher('/login', s) : '/login');
        }
    };
})();
