
(function(){
  const load = key => {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch { return []; }
  };
  const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2));
  const money = value => Number(value || 0).toLocaleString('en-US',{style:'currency',currency:'USD'});
  const esc = value => String(value || '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  const customers = load('jc_customers');
  const properties = load('jc_properties');
  const jobs = load('jc_jobs');
  const estimates = load('jc_estimates');
  const invoices = load('jc_invoices');
  const photoDocs = load('jc_photo_docs');
  let notes = load('jc_property_notes');

  const customerFilter = document.getElementById('customerFilter');
  const propertyFilter = document.getElementById('propertyFilter');
  const historySearch = document.getElementById('historySearch');
  const typeFilter = document.getElementById('typeFilter');
  const timeline = document.getElementById('timeline');
  const propertySummary = document.getElementById('propertySummary');
  const noteModal = document.getElementById('noteModal');
  const noteForm = document.getElementById('noteForm');

  document.getElementById('menuButton')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });

  function openModal(){ noteModal.classList.add('open'); }
  function closeModal(){ noteModal.classList.remove('open'); }

  document.querySelectorAll('[data-close]').forEach(button => {
    button.addEventListener('click', closeModal);
  });
  noteModal.addEventListener('click', event => {
    if(event.target === noteModal) closeModal();
  });

  function customerName(customerId){
    return customers.find(c => c.id === customerId)?.name || 'Unknown customer';
  }

  function propertyAddress(propertyId){
    const p = properties.find(item => item.id === propertyId);
    return p?.address || p?.propertyAddress || '';
  }

  function populateCustomers(){
    customerFilter.innerHTML = '<option value="">All customers</option>' +
      customers.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  }

  function populateProperties(selected=''){
    const customerId = customerFilter.value;
    const matches = customerId ? properties.filter(p => p.customerId === customerId) : properties;
    propertyFilter.innerHTML = '<option value="">Select a property</option>' +
      matches.map(p => `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${esc(p.address || p.propertyAddress || 'Property')}</option>`).join('');
  }

  function invoicePaid(invoice){
    return (invoice.payments || []).reduce((sum,p) => sum + Number(p.amount || 0), 0);
  }

  function sameProperty(record, property){
    if(!property) return false;
    if(record.propertyId) return record.propertyId === property.id;

    const address = (property.address || property.propertyAddress || '').trim().toLowerCase();
    const recordAddress = String(record.property || record.address || '').trim().toLowerCase();
    return Boolean(address && recordAddress && address === recordAddress);
  }

  function buildEvents(property){
    const events = [];

    jobs.filter(item => sameProperty(item, property)).forEach(item => {
      events.push({
        id:item.id,type:'Job',date:item.date || item.createdAt || '',
        title:item.title || item.job || 'Job',
        detail:item.scope || item.description || item.notes || '',
        amount:Number(item.labor || 0)+Number(item.materials || 0),
        status:item.status || ''
      });
    });

    estimates.filter(item => sameProperty(item, property)).forEach(item => {
      events.push({
        id:item.id,type:'Estimate',date:item.date || item.estimateDate || '',
        title:item.title || item.description || `Estimate #${item.number || ''}`,
        detail:item.notes || '',
        amount:Number(item.total || 0),
        status:item.status || ''
      });
    });

    invoices.filter(item => sameProperty(item, property)).forEach(item => {
      events.push({
        id:item.id,type:'Invoice',date:item.invoiceDate || item.date || '',
        title:`Invoice #${item.number || ''}`,
        detail:item.description || '',
        amount:Number(item.total || 0),
        status:(Number(item.total || 0)-invoicePaid(item) <= 0 ? 'Paid' : 'Balance due')
      });

      (item.payments || []).forEach(payment => {
        events.push({
          id:payment.id || uid(),type:'Payment',date:payment.date || '',
          title:`Payment received — ${money(payment.amount)}`,
          detail:[payment.method,payment.reference,payment.note].filter(Boolean).join(' • '),
          amount:Number(payment.amount || 0),
          status:'Received'
        });
      });
    });

    photoDocs.filter(item => {
      const address = (property.address || property.propertyAddress || '').trim().toLowerCase();
      return item.propertyId === property.id || String(item.property || '').trim().toLowerCase() === address;
    }).forEach(item => {
      events.push({
        id:item.id || uid(),type:'Photo / Document',date:item.date || '',
        title:item.category || 'Photo / Document',
        detail:[item.job,(item.files || []).join(', ')].filter(Boolean).join(' • '),
        amount:0,status:''
      });
    });

    notes.filter(item => item.propertyId === property.id).forEach(item => {
      events.push({
        id:item.id,type:'Property Note',date:item.date || '',
        title:item.title || 'Property Note',
        detail:item.note || '',
        amount:0,status:''
      });
    });

    return events.sort((a,b) => String(b.date).localeCompare(String(a.date)));
  }

  function render(){
    const property = properties.find(p => p.id === propertyFilter.value);

    if(!property){
      propertySummary.innerHTML = '<div class="empty-state"><span>🏡</span><h3>Select a property</h3><p>Choose a customer and property to view its complete history.</p></div>';
      timeline.innerHTML = '<div class="empty-state"><p>No property selected.</p></div>';
      ['jobCount','estimateCount','invoiceCount','photoCount'].forEach(id => document.getElementById(id).textContent='0');
      ['totalInvoiced','totalPaid','balanceDue'].forEach(id => document.getElementById(id).textContent='$0.00');
      return;
    }

    const owner = customers.find(c => c.id === property.customerId);
    propertySummary.innerHTML = `
      <div class="property-header">
        <div>
          <h2>${esc(property.address || property.propertyAddress || 'Property')}</h2>
          <p><strong>Customer:</strong> ${esc(owner?.name || 'Unknown')}</p>
          <p><strong>Phone:</strong> ${esc(owner?.phone || 'Not listed')}</p>
          <p><strong>Email:</strong> ${esc(owner?.email || 'Not listed')}</p>
          ${property.notes ? `<p><strong>Property notes:</strong> ${esc(property.notes)}</p>` : ''}
        </div>
        <span class="property-badge">Complete Property Record</span>
      </div>
    `;

    const allEvents = buildEvents(property);
    const q = historySearch.value.trim().toLowerCase();
    const type = typeFilter.value;
    const filtered = allEvents.filter(item => {
      const haystack = [item.type,item.title,item.detail,item.status,item.date].join(' ').toLowerCase();
      return (!type || item.type === type) && haystack.includes(q);
    });

    timeline.innerHTML = filtered.length ? filtered.map(item => `
      <article class="timeline-item">
        <span class="type">${esc(item.type)}</span>
        <div class="meta">${esc(item.date || 'Date not recorded')} ${item.status ? ' • ' + esc(item.status) : ''}</div>
        <h3>${esc(item.title)}</h3>
        ${item.detail ? `<p>${esc(item.detail)}</p>` : ''}
        ${item.amount ? `<p><strong>${money(item.amount)}</strong></p>` : ''}
        ${item.type === 'Property Note' ? `
          <div class="timeline-actions">
            <button data-edit-note="${item.id}">Edit note</button>
            <button data-delete-note="${item.id}">Delete note</button>
          </div>` : ''}
      </article>
    `).join('') : '<div class="empty-state"><span>📚</span><p>No matching history found for this property.</p></div>';

    const propertyJobs = jobs.filter(item => sameProperty(item, property));
    const propertyEstimates = estimates.filter(item => sameProperty(item, property));
    const propertyInvoices = invoices.filter(item => sameProperty(item, property));
    const propertyPhotos = photoDocs.filter(item => {
      const address = (property.address || property.propertyAddress || '').trim().toLowerCase();
      return item.propertyId === property.id || String(item.property || '').trim().toLowerCase() === address;
    });

    const totalInvoiced = propertyInvoices.reduce((sum,item) => sum + Number(item.total || 0),0);
    const totalPaid = propertyInvoices.reduce((sum,item) => sum + invoicePaid(item),0);

    document.getElementById('jobCount').textContent = propertyJobs.length;
    document.getElementById('estimateCount').textContent = propertyEstimates.length;
    document.getElementById('invoiceCount').textContent = propertyInvoices.length;
    document.getElementById('totalInvoiced').textContent = money(totalInvoiced);
    document.getElementById('totalPaid').textContent = money(totalPaid);
    document.getElementById('balanceDue').textContent = money(Math.max(0,totalInvoiced-totalPaid));
    document.getElementById('photoCount').textContent = propertyPhotos.length;

    timeline.querySelectorAll('[data-edit-note]').forEach(button => {
      button.addEventListener('click', () => {
        const note = notes.find(n => n.id === button.dataset.editNote);
        if(!note) return;
        noteForm.elements.id.value = note.id;
        noteForm.elements.date.value = note.date || '';
        noteForm.elements.title.value = note.title || '';
        noteForm.elements.note.value = note.note || '';
        openModal();
      });
    });

    timeline.querySelectorAll('[data-delete-note]').forEach(button => {
      button.addEventListener('click', () => {
        if(!confirm('Delete this property note?')) return;
        notes = notes.filter(n => n.id !== button.dataset.deleteNote);
        save('jc_property_notes', notes);
        render();
      });
    });
  }

  document.getElementById('newNoteButton').addEventListener('click', () => {
    if(!propertyFilter.value){
      alert('Select a property first.');
      return;
    }
    noteForm.reset();
    noteForm.elements.id.value = '';
    noteForm.elements.date.value = new Date().toISOString().slice(0,10);
    openModal();
  });

  noteForm.addEventListener('submit', event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(noteForm).entries());
    data.propertyId = propertyFilter.value;
    data.customerId = properties.find(p => p.id === propertyFilter.value)?.customerId || '';

    if(data.id){
      notes = notes.map(note => note.id === data.id ? data : note);
    }else{
      data.id = uid();
      notes.push(data);
    }

    save('jc_property_notes', notes);
    closeModal();
    render();
  });

  customerFilter.addEventListener('change', () => {
    populateProperties();
    render();
  });
  propertyFilter.addEventListener('change', render);
  historySearch.addEventListener('input', render);
  typeFilter.addEventListener('change', render);

  populateCustomers();
  populateProperties();
  render();
})();
