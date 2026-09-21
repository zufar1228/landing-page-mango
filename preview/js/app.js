const loginForm = document.querySelector('#formLogin');
const voucherInput = document.querySelector('input[name="username"]');

loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!voucherInput.value.trim()) voucherInput.focus();
});

document.querySelector('#btn-buy-vchr').addEventListener('click', (event) => {
    event.preventDefault();
});
