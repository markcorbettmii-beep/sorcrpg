document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.getElementById('menuToggle');
    const navLinks = document.getElementById('navLinks');
    menuToggle.addEventListener('click', function() {
        navLinks.classList.toggle('active');
    });
});
