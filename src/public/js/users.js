document.querySelectorAll(".member-status").forEach((select) => {
  let previous = select.value;
  select.addEventListener("change", async () => {
    select.disabled = true;
    try {
      const response = await fetch("/admin/user/edit", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ _id: select.dataset.id, memberStatus: select.value }) });
      const result = await response.json();
      if (!response.ok || !result.data) throw new Error(result.message || "Member status update failed.");
      previous = select.value;
    } catch (error) {
      select.value = previous;
      window.alert(error.message || "Member status update failed.");
    } finally {
      select.className = `spec-select member-status status-${select.value.toLowerCase()}`;
      select.disabled = false;
    }
  });
});
