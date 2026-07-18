
(function(){
  const load = key => {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch { return []; }
  };
  const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString());
  const esc = value => String(value || '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  let customers = load('jc_customers');
  let properties = load('jc_properties');

  const sidebar = document.getElementById('sidebar');
  document.getElementById('menuButton')?.addEventListener('click', () => sidebar.classList.toggle('open'));

  const customerModal = document.getElementById('customerModal');
  const propertyModal = document.getElementById('propertyModal');
  const customerForm = document.getElementById('customerForm');
  const propertyForm = document.getElementById('propertyForm');
  const list = document.getElementById('customerList');
  const search = document.getElementById('customerSearch');
  const sort = document.getElementById('customerSort');

  function openModal(modal){ modal.classList.add('open'); }
  function closeModal(modal){ modal.classList.remove('open'); }

  document.querySelectorAll('[data-close]').forEach(button => {
    button.addEventListener('click', () => closeModal(document.getElementById(button.dataset.close)));
  });

  [customerModal, propertyModal].forEach(modal => {
    modal.addEventListener('click', e => { if(e.target === modal) closeModal(modal); });
  });

  function openCustomer(customer){
    customerForm.reset();
    customerForm.elements.id.value = customer?.id || '';
    customerForm.elements.name.value = customer?.name || '';
    customerForm.elements.phone.value = customer?.phone || '';
    customerForm.elements.email.value = customer?.email || '';
    customerForm.elements.address.value = customer?.address || '';
    customerForm.elements.notes.value = customer?.notes || '';
    document.getElementById('customerModalTitle').textContent = customer ? 'Edit Customer' : 'Add Customer';
    openModal(customerModal);
  }

  document.getElementById('addCustomerButton').addEventListener('click', () => openCustomer());
  document.getElementById('topAddCustomer').addEventListener('click', () => openCustomer());

  customerForm.addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(customerForm).entries());

    if(data.id){
      customers = customers.map(c => c.id === data.id ? {...c, ...data} : c);
    }else{
      data.id = uid();
      data.createdAt = new Date().toISOString();
      customers.push(data);
    }

    save('jc_customers', customers);
    closeModal(customerModal);
    render();
  });

  propertyForm.addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(propertyForm).entries());
    data.id = uid();
    properties.push(data);
    save('jc_properties', properties);
    closeModal(propertyModal);
    propertyForm.reset();
    render();
  });

  function filteredCustomers(){
    const q = search.value.trim().toLowerCase();
    let result = customers.filter(c =>
      [c.name,c.phone,c.email,c.address,c.notes].join(' ').toLowerCase().includes(q)
    );

    if(sort.value === 'name'){
      result.sort((a,b) => (a.name || '').localeCompare(b.name || ''));
    }else{
      result.sort((a,b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    }

    return result;
  }

  function render(){
    const items = filteredCustomers();
    list.innerHTML = '';

    document.getElementById('totalCustomers').textContent = customers.length;
    document.getElementById('totalProperties').textContent = properties.length;
    document.getElementById('customersWithNotes').textContent = customers.filter(c => c.notes?.trim()).length;

    if(!items.length){
      list.innerHTML = '<div class="cc-empty"><span>👥</span><p>No customers found. Add your first customer.</p></div>';
      return;
    }

    items.forEach(customer => {
      const customerProperties = properties.filter(p => p.customerId === customer.id);
      const card = document.createElement('article');
      card.className = 'cc-card';
      card.innerHTML = `
        <h3>${esc(customer.name)}</h3>
        <p>📞 ${esc(customer.phone || 'No phone')}</p>
        <p>✉️ ${esc(customer.email || 'No email')}</p>
        <p>🏠 ${esc(customer.address || 'No address')}</p>
        ${customer.notes ? `<p>📝 ${esc(customer.notes)}</p>` : ''}
        <div class="cc-actions">
          ${customer.phone ? `<a href="tel:${esc(customer.phone)}">Call</a><a href="sms:${esc(customer.phone)}">Text</a>` : ''}
          ${customer.email ? `<a href="mailto:${esc(customer.email)}">Email</a>` : ''}
          <button data-edit="${customer.id}">Edit</button>
          <button data-property="${customer.id}">+ Property</button>
          <button data-delete="${customer.id}">Delete</button>
        </div>
        <div class="cc-properties">
          <strong>${customerProperties.length} Propert${customerProperties.length === 1 ? 'y' : 'ies'}</strong>
          ${customerProperties.map(p => `
            <div class="cc-property">
              <strong>${esc(p.type)}</strong><br>
              ${esc(p.address)}<br>
              <small>${esc(p.status)}${p.notes ? ' • ' + esc(p.notes) : ''}</small>
            </div>
          `).join('')}
        </div>
      `;
      list.appendChild(card);
    });

    list.querySelectorAll('[data-edit]').forEach(button => {
      button.addEventListener('click', () => openCustomer(customers.find(c => c.id === button.dataset.edit)));
    });

    list.querySelectorAll('[data-property]').forEach(button => {
      button.addEventListener('click', () => {
        propertyForm.reset();
        propertyForm.elements.customerId.value = button.dataset.property;
        openModal(propertyModal);
      });
    });

    list.querySelectorAll('[data-delete]').forEach(button => {
      button.addEventListener('click', () => {
        if(!confirm('Delete this customer and their saved properties?')) return;
        customers = customers.filter(c => c.id !== button.dataset.delete);
        properties = properties.filter(p => p.customerId !== button.dataset.delete);
        save('jc_customers', customers);
        save('jc_properties', properties);
        render();
      });
    });
  }

  search.addEventListener('input', render);
  sort.addEventListener('change', render);

  if(location.hash === '#new') openCustomer();
  render();
})();
