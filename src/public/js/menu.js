const overlay = document.getElementById("modalOverlay");
const form = document.getElementById("newProductForm");
const errorMessage = document.getElementById("productErrorMsg");
const imageInput = document.getElementById("productImages");
const preview = document.getElementById("previewGrid");
const saveButton = form.querySelector('button[type="submit"]');
const title = overlay.querySelector("h2");
let editingId = null;
let submitting = false;
let previewUrls = [];

function clearPreview() {
  previewUrls.forEach((url) => URL.revokeObjectURL(url));
  previewUrls = [];
  preview.replaceChildren();
}
function openProduct(product) {
  form.reset();
  clearPreview();
  errorMessage.textContent = "";
  editingId = product ? product._id : null;
  title.textContent = product ? "Edit Product" : "New Product";
  imageInput.required = !product;
  if (product) {
    for (const field of ["productName", "productCollection", "productPrice", "productLeftCount", "productSize", "productStatus", "productDesc"]) {
      const value = product[field] ?? "";
      form.elements.namedItem(field).value = field === "productCollection" && value === "WEDDING" ? "WEDDING_BOUQUET" : value;
    }
  }
  overlay.classList.add("is-open");
  document.getElementById("productName").focus();
}
function closeProduct() {
  if (submitting) return;
  overlay.classList.remove("is-open");
  clearPreview();
}
document.getElementById("newProductBtn").addEventListener("click", () => openProduct(null));
document.querySelectorAll(".edit-product").forEach((button) => button.addEventListener("click", () => openProduct(JSON.parse(button.dataset.product))));
for (const id of ["closeModalBtn", "cancelModalBtn"]) document.getElementById(id).addEventListener("click", closeProduct);
overlay.addEventListener("click", (event) => { if (event.target === overlay) closeProduct(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeProduct(); });
document.getElementById("uploadImagesBtn").addEventListener("click", () => imageInput.click());
imageInput.addEventListener("change", () => {
  clearPreview();
  errorMessage.textContent = "";
  const files = Array.from(imageInput.files);
  if (files.length > 5 || files.some((file) => !["image/jpeg", "image/png"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
    errorMessage.textContent = "Upload at most 5 JPG/PNG images, each up to 5 MB.";
    imageInput.value = "";
    return;
  }
  for (const file of files) {
    const image = document.createElement("img");
    image.src = URL.createObjectURL(file);
    image.alt = file.name;
    previewUrls.push(image.src);
    preview.appendChild(image);
  }
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitting || !form.reportValidity()) return;
  submitting = true;
  saveButton.disabled = true;
  saveButton.textContent = "Saving...";
  errorMessage.textContent = "";
  try {
    const response = await fetch(editingId ? `/admin/product/${editingId}` : "/admin/product/create", { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Product could not be saved.");
    window.location.assign(`/admin/product/all?saved=${editingId ? "updated" : "created"}`);
  } catch (error) {
    errorMessage.textContent = error.message || "Product could not be saved. Please try again.";
    submitting = false;
    saveButton.disabled = false;
    saveButton.textContent = "Save Product";
  }
});
async function updateProductStatus(productId, select) {
  const previous = select.dataset.previous || select.querySelector("option[selected]")?.value;
  select.disabled = true;
  try {
    const response = await fetch(`/admin/product/${productId}`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ productStatus: select.value }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Status update failed.");
    select.dataset.previous = select.value;
    select.classList.toggle("active", select.value === "PROCESS");
  } catch (error) {
    select.value = previous;
    window.alert(error.message || "Status update failed.");
  } finally { select.disabled = false; }
}
