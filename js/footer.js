const footerHeader = document.querySelector('#footer-header');
const footerContent = document.querySelector('#footer-content');

function scrollToFooterContent() {
    footerContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

footerHeader.addEventListener('click', scrollToFooterContent);
footerHeader.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        scrollToFooterContent();
    }
});
