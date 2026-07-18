
(function(){
  const load = key => {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch { return []; }
  };
  const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const money = value => Number(value || 0).toLocaleString('en-US',{style:'currency',currency:'USD'});
  const esc = value => String(value || '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  let customers = load('jc_customers');
  let properties = load('jc_properties');
  let invoices = load('jc_invoices');

  const sidebar = document.getElementById('sidebar');
  document.getElementById('menuButton')?.addEventListener('click', () => sidebar.classList.toggle('open'));

  const invoiceModal = document.getElementById('invoiceModal');
  const paymentModal = document.getElementById('paymentModal');
  const invoiceForm = document.getElementById('invoiceForm');
  const paymentForm = document.getElementById('paymentForm');
  const customerSelect = document.getElementById('invoiceCustomer');
  const propertySelect = document.getElementById('invoiceProperty');
  const lineItems = document.getElementById('invoiceLineItems');
  const invoiceList = document.getElementById('invoiceList');
  const search = document.getElementById('invoiceSearch');
  const statusFilter = document.getElementById('invoiceStatusFilter');

  function openModal(modal){ modal.classList.add('open'); }
  function closeModal(modal){ modal.classList.remove('open'); }

  document.querySelectorAll('[data-close]').forEach(button => {
    button.addEventListener('click', () => closeModal(document.getElementById(button.dataset.close)));
  });
  [invoiceModal,paymentModal].forEach(modal => {
    modal.addEventListener('click', e => { if(e.target === modal) closeModal(modal); });
  });

  function populateCustomers(){
    customerSelect.innerHTML = '<option value="">Select customer</option>' +
      customers.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  }

  function populateProperties(customerId, selected=''){
    const matches = properties.filter(p => p.customerId === customerId);
    propertySelect.innerHTML = '<option value="">Select property</option>' +
      matches.map(p => `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${esc(p.address)}</option>`).join('');
  }

  function addLine(data={description:'Labor',qty:1,rate:0}){
    const row = document.createElement('div');
    row.className = 'line-row';
    row.innerHTML = `
      <input class="line-description" placeholder="Labor or material description" value="${esc(data.description)}">
      <input class="line-qty" type="number" min="0" step="0.01" value="${Number(data.qty || 0)}">
      <input class="line-rate" type="number" min="0" step="0.01" value="${Number(data.rate || 0)}">
      <button type="button" title="Remove">✕</button>
    `;
    row.querySelectorAll('input').forEach(input => input.addEventListener('input', recalculate));
    row.querySelector('button').addEventListener('click', () => { row.remove(); recalculate(); });
    lineItems.appendChild(row);
    recalculate();
  }

  function getLines(){
    return [...document.querySelectorAll('.line-row')].map(row => ({
      description: row.querySelector('.line-description').value,
      qty: Number(row.querySelector('.line-qty').value || 0),
      rate: Number(row.querySelector('.line-rate').value || 0)
    }));
  }

  function recalculate(){
    const subtotal = getLines().reduce((sum,line) => sum + line.qty * line.rate, 0);
    const taxRate = Number(invoiceForm.elements.taxRate.value || 0);
    const discount = Number(invoiceForm.elements.discount.value || 0);
    const tax = subtotal * taxRate / 100;
    const total = Math.max(0, subtotal + tax - discount);

    document.getElementById('invoiceSubtotal').textContent = money(subtotal);
    document.getElementById('invoiceTax').textContent = money(tax);
    document.getElementById('invoiceDiscount').textContent = money(discount);
    document.getElementById('invoiceTotal').textContent = money(total);

    return {subtotal,tax,discount,total};
  }

  function openInvoice(invoice){
    invoiceForm.reset();
    lineItems.innerHTML = '';
    populateCustomers();

    invoiceForm.elements.id.value = invoice?.id || '';
    invoiceForm.elements.customerId.value = invoice?.customerId || '';
    populateProperties(invoice?.customerId || '', invoice?.propertyId || '');
    invoiceForm.elements.invoiceDate.value = invoice?.invoiceDate || new Date().toISOString().slice(0,10);

    const due = new Date();
    due.setDate(due.getDate() + 7);
    invoiceForm.elements.dueDate.value = invoice?.dueDate || due.toISOString().slice(0,10);

    invoiceForm.elements.description.value = invoice?.description || '';
    invoiceForm.elements.taxRate.value = invoice?.taxRate || 0;
    invoiceForm.elements.discount.value = invoice?.discount || 0;
    invoiceForm.elements.notes.value = invoice?.notes || '';

    (invoice?.lines?.length ? invoice.lines : [{description:'Labor',qty:1,rate:0},{description:'Materials',qty:1,rate:0}]).forEach(addLine);

    document.getElementById('invoiceModalTitle').textContent = invoice ? 'Edit Invoice' : 'New Invoice';
    openModal(invoiceModal);
    recalculate();
  }

  function invoicePaid(invoice){
    return (invoice.payments || []).reduce((sum,p) => sum + Number(p.amount || 0), 0);
  }

  function invoiceBalance(invoice){
    return Math.max(0, Number(invoice.total || 0) - invoicePaid(invoice));
  }

  function invoiceStatus(invoice){
    const paid = invoicePaid(invoice);
    const balance = invoiceBalance(invoice);
    const today = new Date().toISOString().slice(0,10);

    if(balance <= 0 && Number(invoice.total || 0) > 0) return 'Paid';
    if(paid > 0) return 'Partial';
    if(invoice.dueDate && invoice.dueDate < today) return 'Overdue';
    return 'Unpaid';
  }

  function filteredInvoices(){
    const q = search.value.trim().toLowerCase();
    const filter = statusFilter.value;

    return invoices.filter(invoice => {
      const customer = customers.find(c => c.id === invoice.customerId);
      const property = properties.find(p => p.id === invoice.propertyId);
      const status = invoiceStatus(invoice);
      const haystack = [
        invoice.number,invoice.description,status,
        customer?.name,customer?.phone,property?.address
      ].join(' ').toLowerCase();

      return (!filter || status === filter) && haystack.includes(q);
    });
  }

  function render(){
    const items = filteredInvoices();
    invoiceList.innerHTML = '';

    const outstanding = invoices.reduce((sum,invoice) => sum + invoiceBalance(invoice), 0);
    const collected = invoices.reduce((sum,invoice) => sum + invoicePaid(invoice), 0);
    const invoiced = invoices.reduce((sum,invoice) => sum + Number(invoice.total || 0), 0);
    const unpaid = invoices.filter(invoice => invoiceBalance(invoice) > 0).length;

    document.getElementById('outstandingTotal').textContent = money(outstanding);
    document.getElementById('collectedTotal').textContent = money(collected);
    document.getElementById('unpaidCount').textContent = unpaid;
    document.getElementById('invoicedTotal').textContent = money(invoiced);

    if(!items.length){
      invoiceList.innerHTML = '<div class="ic-empty"><span>💵</span><p>No invoices found. Create your first invoice.</p></div>';
      return;
    }

    items.slice().reverse().forEach(invoice => {
      const customer = customers.find(c => c.id === invoice.customerId);
      const property = properties.find(p => p.id === invoice.propertyId);
      const status = invoiceStatus(invoice);
      const paid = invoicePaid(invoice);
      const balance = invoiceBalance(invoice);
      const card = document.createElement('article');
      card.className = 'invoice-card';

      card.innerHTML = `
        <div>
          <h3>Invoice #${esc(invoice.number)}</h3>
          <p><strong>${esc(customer?.name || 'Unknown customer')}</strong></p>
          <p>🏠 ${esc(property?.address || customer?.address || 'No property selected')}</p>
          <p>${esc(invoice.description)}</p>
          <p>Invoice: ${esc(invoice.invoiceDate)} • Due: ${esc(invoice.dueDate)}</p>
          <span class="status-pill status-${status}">${status}</span>

          <div class="invoice-actions">
            <button data-edit="${invoice.id}">Edit</button>
            <button data-payment="${invoice.id}">Record Payment</button>
            <button data-print="${invoice.id}">Print / Receipt</button>
            <button data-delete="${invoice.id}">Delete</button>
          </div>

          <div class="payment-history">
            <strong>${(invoice.payments || []).length} Payment${(invoice.payments || []).length === 1 ? '' : 's'}</strong>
            ${(invoice.payments || []).map(payment => `
              <div class="payment-item">
                ${money(payment.amount)} • ${esc(payment.method)} • ${esc(payment.date)}
                ${payment.reference ? '<br><small>Ref: ' + esc(payment.reference) + '</small>' : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <div class="amount">
          <strong>${money(invoice.total)}</strong>
          <small>Paid: ${money(paid)}</small>
          <small>Balance: ${money(balance)}</small>
        </div>
      `;
      invoiceList.appendChild(card);
    });

    invoiceList.querySelectorAll('[data-edit]').forEach(button => {
      button.addEventListener('click', () => openInvoice(invoices.find(i => i.id === button.dataset.edit)));
    });

    invoiceList.querySelectorAll('[data-payment]').forEach(button => {
      button.addEventListener('click', () => {
        const invoice = invoices.find(i => i.id === button.dataset.payment);
        paymentForm.reset();
        paymentForm.elements.invoiceId.value = invoice.id;
        paymentForm.elements.amount.value = invoiceBalance(invoice).toFixed(2);
        paymentForm.elements.date.value = new Date().toISOString().slice(0,10);
        openModal(paymentModal);
      });
    });

    invoiceList.querySelectorAll('[data-print]').forEach(button => {
      button.addEventListener('click', () => window.print());
    });

    invoiceList.querySelectorAll('[data-delete]').forEach(button => {
      button.addEventListener('click', () => {
        if(!confirm('Delete this invoice?')) return;
        invoices = invoices.filter(i => i.id !== button.dataset.delete);
        save('jc_invoices', invoices);
        render();
      });
    });
  }

  document.getElementById('newInvoiceButton').addEventListener('click', () => openInvoice());
  document.getElementById('topNewInvoice').addEventListener('click', () => openInvoice());
  document.getElementById('addInvoiceLine').addEventListener('click', () => addLine({description:'',qty:1,rate:0}));

  customerSelect.addEventListener('change', () => populateProperties(customerSelect.value));
  invoiceForm.elements.taxRate.addEventListener('input', recalculate);
  invoiceForm.elements.discount.addEventListener('input', recalculate);

  invoiceForm.addEventListener('submit', event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(invoiceForm).entries());
    const totals = recalculate();

    data.lines = getLines();
    data.taxRate = Number(data.taxRate || 0);
    data.discount = Number(data.discount || 0);
    Object.assign(data, totals);

    if(data.id){
      const existing = invoices.find(i => i.id === data.id);
      data.number = existing.number;
      data.payments = existing.payments || [];
      invoices = invoices.map(i => i.id === data.id ? data : i);
    }else{
      data.id = uid();
      data.number = String(1001 + invoices.length);
      data.payments = [];
      invoices.push(data);
    }

    save('jc_invoices', invoices);
    closeModal(invoiceModal);
    invoiceForm.reset();
    render();
  });

  paymentForm.addEventListener('submit', event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(paymentForm).entries());
    const invoice = invoices.find(i => i.id === data.invoiceId);
    if(!invoice) return;

    data.id = uid();
    data.amount = Number(data.amount || 0);
    invoice.payments = invoice.payments || [];
    invoice.payments.push(data);

    save('jc_invoices', invoices);
    closeModal(paymentModal);
    paymentForm.reset();
    render();
  });

  search.addEventListener('input', render);
  statusFilter.addEventListener('change', render);

  populateCustomers();
  if(location.hash === '#new') openInvoice();
  render();
})();
