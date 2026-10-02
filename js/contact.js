/* "Hubungi Kami" di layar lebar: buka saat kursor menunjuk, tutup sendiri
   saat kursor pergi. Hanya aktif untuk perangkat ber-mouse (hover) dengan
   lebar >= 960px; di HP tetap buka-tutup dengan ketukan (<details> bawaan),
   dan tanpa JavaScript semuanya tetap berfungsi lewat klik. */
(function () {
    var mq = window.matchMedia
        ? window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 960px)')
        : null;

    function hoverMode() {
        return !!(mq && mq.matches);
    }

    // Jeda kecil supaya panel tidak menutup saat kursor melintasi celah
    // antara tombol dan panel.
    var CLOSE_DELAY = 200;

    function setup(details) {
        var summary = details.querySelector('summary');
        var timer = null;

        details.addEventListener('mouseenter', function () {
            if (!hoverMode()) {
                return;
            }
            clearTimeout(timer);
            details.open = true;
        });

        details.addEventListener('mouseleave', function () {
            if (!hoverMode()) {
                return;
            }
            clearTimeout(timer);
            timer = setTimeout(function () {
                details.open = false;
            }, CLOSE_DELAY);
        });

        // Di HP, setelah dibuka gulir panel ke dalam pandangan (panel ada
        // di bawah baris footer, menambah tinggi halaman).
        details.addEventListener('toggle', function () {
            if (!details.open || hoverMode()) {
                return;
            }
            var panel = details.querySelector('.contact-panel');
            if (!panel || !panel.scrollIntoView) {
                return;
            }
            try {
                panel.scrollIntoView({ behavior: 'smooth', block: 'end' });
            } catch (err) {
                panel.scrollIntoView(false);
            }
        });

        if (summary) {
            summary.addEventListener('click', function (e) {
                // Klik mouse saat mode hover tidak menutup panel yang sedang
                // ditunjuk. Enter/Spasi dari keyboard (detail === 0) tetap
                // buka-tutup seperti biasa.
                if (hoverMode() && e.detail > 0) {
                    e.preventDefault();
                    details.open = true;
                }
            });
        }
    }

    var list = document.querySelectorAll('details.contact');
    for (var i = 0; i < list.length; i++) {
        setup(list[i]);
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
            for (var j = 0; j < list.length; j++) {
                list[j].open = false;
            }
        }
    });
})();
