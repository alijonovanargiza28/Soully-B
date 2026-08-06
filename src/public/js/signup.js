// signup.ejs uchun skript — forma haqiqiy POST orqali /signup ga yuboriladi,
// bu yerda faqat rasm preview logikasi bor.

const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const preview = document.getElementById('preview');

uploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const url = URL.createObjectURL(file);
    preview.style.backgroundImage = `url(${url})`;
    preview.style.display = 'block';
  }
});
