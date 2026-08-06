document.querySelectorAll(".bloom-select").forEach((select) => {
  const sync = () =>
    select.classList.toggle("active", select.value === "ACTIVE");
  select.addEventListener("change", sync);
  sync();
});

document.getElementById("logoutLink").addEventListener("click", (e) => {
  e.preventDefault();
  window.location.href = "/admin/login";
});

// --- New Product Modal ---

const modalOverlay = document.getElementById("modalOverlay");
const newProductBtn = document.getElementById("newProductBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const newProductForm = document.getElementById("newProductForm");
const productErrorMsg = document.getElementById("productErrorMsg");
const productImagesInput = document.getElementById("productImages");
const uploadImagesBtn = document.getElementById("uploadImagesBtn");
const previewGrid = document.getElementById("previewGrid");

function openModal() {
  modalOverlay.classList.add("is-open");
}

function closeModal() {
  modalOverlay.classList.remove("is-open");
  newProductForm.reset();
  previewGrid.innerHTML = "";
  productErrorMsg.textContent = "";
}

newProductBtn.addEventListener("click", openModal);
closeModalBtn.addEventListener("click", closeModal);
cancelModalBtn.addEventListener("click", closeModal);

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

uploadImagesBtn.addEventListener("click", () => productImagesInput.click());

productImagesInput.addEventListener("change", (e) => {
  previewGrid.innerHTML = "";
  Array.from(e.target.files).forEach((file) => {
    const url = URL.createObjectURL(file);
    const img = document.createElement("img");
    img.src = url;
    previewGrid.appendChild(img);
  });
});
