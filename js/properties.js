document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("propertiesList");
  if (!container) return;

  const customers = JSON.parse(localStorage.getItem("customers") || "[]");

  let html = "";

  customers.forEach(customer => {
    (customer.properties || []).forEach(property => {
      html += `
        <div class="card">
          <h3>${property.name || "Property"}</h3>
          <p><strong>Owner:</strong> ${customer.name}</p>
          <p>${property.address || ""}</p>
          <p>Status: ${property.status || "Active"}</p>
        </div>
      `;
    });
  });

  if (!html) {
    html = "<p>No properties found.</p>";
  }

  container.innerHTML = html;
});