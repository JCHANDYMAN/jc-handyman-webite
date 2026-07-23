
(function(){
  "use strict";
  const $ = id => document.getElementById(id);

  function safeParse(value, fallback){
    try{
      const parsed = JSON.parse(value);
      return parsed == null ? fallback : parsed;
    }catch{
      return fallback;
    }
  }

  function readArray(keys){
    for(const key of keys){
      const value = safeParse(localStorage.getItem(key), null);
      if(Array.isArray(value)) return value;
    }
    return [];
  }

  function esc(value){
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[ch]));
  }

  function normalizeData(){
    const customers = readArray(["jc_customers","customers","crm_customers","jcCustomers"]);
    const standalone = readArray(["jc_properties","properties","crm_properties","jcProperties"]);
    const map = new Map();

    function addProperty(property, customer){
      if(!property || typeof property !== "object") return;
      const id = String(property.id || property.propertyId ||
        `${customer?.id || customer?.name || "customer"}-${property.address || property.name || Math.random()}`);

      map.set(id,{
        id,
        customerId:String(property.customerId || customer?.id || ""),
        owner:property.owner || property.customerName || customer?.name || customer?.fullName || "Unknown customer",
        name:property.name || property.propertyName || property.type || "Property",
        type:property.type || property.propertyType || "Home",
        address:property.address || property.street || property.propertyAddress || "No address",
        city:property.city || "",
        state:property.state || "",
        zip:property.zip || property.postalCode || "",
        status:property.status || "Active",
        notes:property.notes || ""
      });
    }

    customers.forEach(customer=>{
      [customer.properties,customer.propertyList,customer.locations].forEach(list=>{
        if(Array.isArray(list)) list.forEach(property=>addProperty(property,customer));
      });
      if(customer.property && typeof customer.property === "object"){
        addProperty(customer.property,customer);
      }
    });

    standalone.forEach(property=>{
      const owner = customers.find(customer =>
        String(customer.id) === String(property.customerId || property.ownerId)
      );
      addProperty(property,owner);
    });

    return {customers,properties:[...map.values()]};
  }

  function fullAddress(property){
    return [property.address,property.city,property.state,property.zip].filter(Boolean).join(", ");
  }

  function render(){
    const {properties} = normalizeData();
    const query = $("propertySearch").value.trim().toLowerCase();
    const status = $("statusFilter").value.toLowerCase();

    const filtered = properties.filter(property=>{
      const haystack = [property.owner,property.name,property.type,fullAddress(property),property.notes,property.status]
        .join(" ").toLowerCase();
      return haystack.includes(query) &&
        (!status || String(property.status).toLowerCase() === status);
    });

    $("totalProperties").textContent = properties.length;
    $("activeProperties").textContent = properties.filter(property =>
      String(property.status).toLowerCase() !== "inactive"
    ).length;
    $("customerCount").textContent = new Set(properties.map(property =>
      property.customerId || property.owner
    )).size;

    if(!filtered.length){
      $("propertiesList").innerHTML = `
        <div class="empty-state">
          <h2>${properties.length ? "No matching properties" : "No properties found"}</h2>
          <p>${properties.length ? "Try a different search or status." :
          "Add a property from the Customers page and it will appear here automatically."}</p>
          <a class="primary-btn" href="customers.html">Open Customers</a>
        </div>`;
      return;
    }

    $("propertiesList").innerHTML = filtered.map(property=>`
      <article class="property-card">
        <div class="top">
          <h2>${esc(property.name)}</h2>
          <span class="badge">${esc(property.type)}</span>
          <span class="badge">${esc(property.status)}</span>
        </div>
        <div class="body">
          <p><strong>Owner:</strong> ${esc(property.owner)}</p>
          <p><strong>Address:</strong> ${esc(fullAddress(property))}</p>
          ${property.notes ? `<p><strong>Notes:</strong> ${esc(property.notes)}</p>` : ""}
          <div class="card-actions">
            <a href="customers.html">Customer</a>
            <a href="jobs.html">Create Job</a>
            <a href="estimates.html">Estimate</a>
          </div>
        </div>
      </article>
    `).join("");
  }

  document.addEventListener("DOMContentLoaded",()=>{
    $("propertySearch").addEventListener("input",render);
    $("statusFilter").addEventListener("change",render);
    window.addEventListener("storage",render);
    render();
  });
})();
