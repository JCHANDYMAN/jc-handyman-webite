
(function(){
  "use strict";

  const $ = id => document.getElementById(id);
  const FALLBACK_CUSTOMER_KEY = "jc_customers";
  let customerKey = null;
  let customers = [];
  let allProperties = [];

  function parse(value){
    try{return JSON.parse(value)}catch{return null}
  }

  function uid(){
    return crypto?.randomUUID?.() || Date.now().toString(36)+Math.random().toString(36).slice(2);
  }

  function esc(value){
    return String(value ?? "").replace(/[&<>"']/g,ch=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[ch]));
  }

  function looksLikeCustomer(item){
    if(!item || typeof item !== "object" || Array.isArray(item)) return false;
    const keys = Object.keys(item).map(k=>k.toLowerCase());
    return keys.some(k=>["name","fullname","phone","email","address"].includes(k)) &&
           !keys.includes("storagpath") &&
           !keys.includes("invoiceitems");
  }

  function scoreCustomerArray(key, arr){
    if(!Array.isArray(arr) || !arr.length) return -1;
    let score = arr.filter(looksLikeCustomer).length * 10;
    const lower = key.toLowerCase();
    if(lower.includes("customer")) score += 50;
    if(lower.includes("jc_")) score += 10;
    if(arr.some(x=>Array.isArray(x?.properties))) score += 30;
    return score;
  }

  function detectCustomerStorage(){
    const preferred = [
      "jc_customers","customers","cc_customers","crm_customers",
      "jcCustomers","customerRecords","customer_records"
    ];

    let best = {key:null,arr:[],score:-1};

    for(const key of preferred){
      const value = parse(localStorage.getItem(key));
      const score = scoreCustomerArray(key,value);
      if(score > best.score) best = {key,arr:value,score};
    }

    for(let i=0;i<localStorage.length;i++){
      const key = localStorage.key(i);
      const value = parse(localStorage.getItem(key));
      const score = scoreCustomerArray(key,value);
      if(score > best.score) best = {key,arr:value,score};
    }

    if(best.key){
      customerKey = best.key;
      customers = best.arr;
      return;
    }

    customerKey = FALLBACK_CUSTOMER_KEY;
    customers = [];
  }

  function customerName(customer){
    return customer?.name || customer?.fullName || customer?.customerName || customer?.company || "Unnamed customer";
  }

  function customerId(customer,index){
    return String(customer?.id || customer?.customerId || customer?._id || `customer-${index}`);
  }

  function getCustomerProperties(customer){
    const candidates = [customer.properties,customer.propertyList,customer.locations,customer.addresses];
    for(const list of candidates){
      if(Array.isArray(list)) return list;
    }
    if(customer.property && typeof customer.property === "object") return [customer.property];
    return [];
  }

  function ensurePropertyArray(customer){
    if(Array.isArray(customer.properties)) return customer.properties;
    if(Array.isArray(customer.propertyList)){
      customer.properties = customer.propertyList;
      return customer.properties;
    }
    if(Array.isArray(customer.locations)){
      customer.properties = customer.locations;
      return customer.properties;
    }
    if(customer.property && typeof customer.property === "object"){
      customer.properties = [customer.property];
      return customer.properties;
    }
    customer.properties = [];
    return customer.properties;
  }

  function normalizeProperty(property,customer,index){
    return {
      id:String(property.id || property.propertyId || `property-${index}-${uid()}`),
      customerId:customerId(customer,index),
      owner:customerName(customer),
      name:property.name || property.propertyName || property.type || "Property",
      type:property.type || property.propertyType || "Home",
      address:property.address || property.street || property.propertyAddress || "",
      city:property.city || "",
      state:property.state || "",
      zip:property.zip || property.postalCode || "",
      status:property.status || "Active",
      notes:property.notes || "",
      _customer:customer,
      _source:property
    };
  }

  function rebuildProperties(){
    allProperties = [];
    customers.forEach((customer,customerIndex)=>{
      getCustomerProperties(customer).forEach((property,propertyIndex)=>{
        allProperties.push(normalizeProperty(property,customer,customerIndex+"-"+propertyIndex));
      });
    });
  }

  function saveCustomers(){
    localStorage.setItem(customerKey || FALLBACK_CUSTOMER_KEY,JSON.stringify(customers));
    window.dispatchEvent(new StorageEvent("storage",{
      key:customerKey || FALLBACK_CUSTOMER_KEY,
      newValue:JSON.stringify(customers)
    }));
  }

  function fullAddress(property){
    return [property.address,property.city,property.state,property.zip].filter(Boolean).join(", ");
  }

  function showNotice(message){
    $("notice").textContent = message;
    $("notice").classList.toggle("hidden",!message);
  }

  function fillCustomerSelect(selected=""){
    $("customerSelect").innerHTML = '<option value="">Select customer</option>' +
      customers.map((customer,index)=>{
        const id = customerId(customer,index);
        return `<option value="${esc(id)}"${String(selected)===id?" selected":""}>${esc(customerName(customer))}</option>`;
      }).join("");
  }

  function render(){
    rebuildProperties();
    const q = $("propertySearch").value.trim().toLowerCase();
    const status = $("statusFilter").value;

    const filtered = allProperties.filter(property=>{
      const hay = [property.owner,property.name,property.type,fullAddress(property),property.notes,property.status]
        .join(" ").toLowerCase();
      return hay.includes(q) && (!status || property.status===status);
    });

    $("totalProperties").textContent = allProperties.length;
    $("activeProperties").textContent = allProperties.filter(p=>String(p.status).toLowerCase()!=="inactive").length;
    $("customerCount").textContent = customers.length;

    if(!customers.length){
      showNotice("No customer records were found in this browser. Open Customers first and confirm the customers are visible.");
    }else{
      showNotice("");
    }

    if(!filtered.length){
      $("propertiesList").innerHTML = `
        <div class="empty-state">
          <h2>${allProperties.length ? "No matching properties" : "No properties found"}</h2>
          <p>${customers.length ? "Click + Add Property to connect a property to a customer." :
            "Open Customers and confirm your customer records are visible."}</p>
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
          <p><strong>Address:</strong> ${esc(fullAddress(property) || "No address")}</p>
          ${property.notes ? `<p><strong>Notes:</strong> ${esc(property.notes)}</p>` : ""}
          <div class="card-actions">
            <button class="secondary-btn" data-edit="${esc(property.id)}">Edit</button>
            <button class="danger-btn" data-delete="${esc(property.id)}">Delete</button>
            <a class="secondary-btn" href="jobs.html">Create Job</a>
          </div>
        </div>
      </article>
    `).join("");

    document.querySelectorAll("[data-edit]").forEach(button=>{
      button.onclick = ()=>openEdit(button.dataset.edit);
    });
    document.querySelectorAll("[data-delete]").forEach(button=>{
      button.onclick = ()=>removeProperty(button.dataset.delete);
    });
  }

  function openModal(){
    $("propertyModal").classList.add("open");
    $("propertyModal").setAttribute("aria-hidden","false");
  }

  function closeModal(){
    $("propertyModal").classList.remove("open");
    $("propertyModal").setAttribute("aria-hidden","true");
    $("propertyForm").reset();
    $("propertyForm").elements.propertyId.value = "";
    $("modalTitle").textContent = "Add Property";
  }

  function openAdd(){
    if(!customers.length){
      alert("No customers were found. Open the Customers page first.");
      return;
    }
    fillCustomerSelect();
    $("modalTitle").textContent = "Add Property";
    openModal();
  }

  function openEdit(id){
    const property = allProperties.find(item=>item.id===id);
    if(!property) return;
    const form = $("propertyForm");
    fillCustomerSelect(property.customerId);
    form.elements.propertyId.value = property.id;
    form.elements.customerId.value = property.customerId;
    form.elements.name.value = property.name;
    form.elements.type.value = property.type;
    form.elements.address.value = property.address;
    form.elements.city.value = property.city;
    form.elements.state.value = property.state;
    form.elements.zip.value = property.zip;
    form.elements.status.value = property.status;
    form.elements.notes.value = property.notes;
    $("modalTitle").textContent = "Edit Property";
    openModal();
  }

  function findCustomerById(id){
    return customers.find((customer,index)=>customerId(customer,index)===String(id));
  }

  function removeProperty(id){
    const property = allProperties.find(item=>item.id===id);
    if(!property || !confirm("Delete this property?")) return;

    const owner = property._customer;
    const list = ensurePropertyArray(owner);
    const index = list.findIndex(item=>
      String(item.id || item.propertyId)===String(id) || item===property._source
    );
    if(index>=0) list.splice(index,1);
    saveCustomers();
    render();
  }

  $("propertyForm").addEventListener("submit",event=>{
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selectedCustomer = findCustomerById(form.get("customerId"));
    if(!selectedCustomer){
      alert("Please select a customer.");
      return;
    }

    const id = String(form.get("propertyId") || uid());
    const newData = {
      id,
      name:String(form.get("name") || "Property"),
      type:String(form.get("type") || "Home"),
      address:String(form.get("address") || ""),
      city:String(form.get("city") || ""),
      state:String(form.get("state") || ""),
      zip:String(form.get("zip") || ""),
      status:String(form.get("status") || "Active"),
      notes:String(form.get("notes") || "")
    };

    const existing = allProperties.find(item=>item.id===id);

    if(existing){
      if(existing._customer !== selectedCustomer){
        const oldList = ensurePropertyArray(existing._customer);
        const oldIndex = oldList.findIndex(item=>item===existing._source ||
          String(item.id || item.propertyId)===id);
        if(oldIndex>=0) oldList.splice(oldIndex,1);
        ensurePropertyArray(selectedCustomer).push(newData);
      }else{
        Object.assign(existing._source,newData);
      }
    }else{
      ensurePropertyArray(selectedCustomer).push(newData);
    }

    saveCustomers();
    closeModal();
    render();
  });

  document.addEventListener("DOMContentLoaded",()=>{
    detectCustomerStorage();
    rebuildProperties();
    fillCustomerSelect();
    $("addPropertyBtn").onclick = openAdd;
    $("closeModalBtn").onclick = closeModal;
    $("cancelBtn").onclick = closeModal;
    $("propertyModal").onclick = event=>{
      if(event.target===$("propertyModal")) closeModal();
    };
    $("propertySearch").addEventListener("input",render);
    $("statusFilter").addEventListener("change",render);
    window.addEventListener("storage",()=>{
      detectCustomerStorage();
      render();
    });
    render();
  });
})();
