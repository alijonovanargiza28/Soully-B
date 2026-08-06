document.querySelectorAll('.bloom-select').forEach((select) => {
  const sync = () => select.classList.toggle('active', select.value === 'ACTIVE');
  select.addEventListener('change', sync);
  sync();
});

document.getElementById('logoutLink').addEventListener('click', (e) => {
  e.preventDefault();
  window.location.href = '/admin/login';
});
