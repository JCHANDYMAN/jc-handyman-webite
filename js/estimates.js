(function(){
  const form=document.getElementById('estimateForm');
  if(!form) return;
  const load=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return[]}};
  const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const money=n=>Number(n||0).toLocaleString('en-US',{style:'currency',currency:'USD'});
  const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const uid=()=>crypto.randomUUID();
  let customers=load('jc_customers'),properties=load('jc_properties'),estimates=load('jc_estimates');
  const list=document.getElementById('estimateList');
  const customerSelect=document.getElementById('estimateCustomer');
  const propertySelect=document.getElementById('estimateProperty');
  const lineItems=document.getElementById('lineItems');
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
  function populateCustomers(){customerSelect.innerHTML='<option value="">Select customer</option>'+customers.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}
  function populateProperties(customerId,selected=''){const matches=properties.filter(p=>p.customerId===customerId);propertySelect.innerHTML='<option value="">Select property</option>'+matches.map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${esc(p.address)}</option>`).join('')}
  function addLine(data={description:'',qty:1,rate:0}){
    const row=document.createElement('div');row.className='line-row';
    row.innerHTML=`<input class="item-desc" placeholder="Labor or material description" value="${esc(data.description)}"><input class="item-qty" type="number" min="0" step="0.01" value="${data.qty}"><input class="item-rate" type="number" min="0" step="0.01" value="${data.rate}"><button type="button">✕</button>`;
    row.querySelectorAll('input').forEach(i=>i.addEventListener('input',recalc));
    row.querySelector('button').onclick=()=>{row.remove();recalc()};lineItems.appendChild(row);recalc();
  }
  function lines(){return [...document.querySelectorAll('.line-row')].map(r=>({description:r.querySelector('.item-desc').value,qty:Number(r.querySelector('.item-qty').value||0),rate:Number(r.querySelector('.item-rate').value||0)}))}
  function recalc(){const subtotal=lines().reduce((s,l)=>s+l.qty*l.rate,0),taxRate=Number(form.taxRate.value||0),tax=subtotal*taxRate/100,total=subtotal+tax;set('estimateSubtotal',money(subtotal));set('estimateTax',money(tax));set('estimateTotal',money(total));return{subtotal,tax,total}}
  function openEstimate(e){form.reset();lineItems.innerHTML='';populateCustomers();form.id.value=e?.id||'';form.customerId.value=e?.customerId||'';populateProperties(e?.customerId||'',e?.propertyId||'');form.date.value=e?.date||new Date().toISOString().slice(0,10);form.status.value=e?.status||'Draft';form.description.value=e?.description||'';form.taxRate.value=e?.taxRate||0;form.deposit.value=e?.deposit||0;form.notes.value=e?.notes||'';(e?.lines?.length?e.lines:[{description:'Labor',qty:1,rate:0}]).forEach(addLine);document.getElementById('estimateModalTitle').textContent=e?'Edit Estimate':'New Estimate';document.getElementById('estimateModal').classList.add('open');recalc()}
  function render(items=estimates){
    list.innerHTML='';
    if(!items.length)list.innerHTML='<div class="empty-state"><span>📝</span><p>No estimates yet. Create your first estimate.</p></div>';
    items.slice().reverse().forEach(e=>{const c=customers.find(x=>x.id===e.customerId),p=properties.find(x=>x.id===e.propertyId),card=document.createElement('article');card.className='estimate-card';card.innerHTML=`<div><h3>Estimate #${esc(e.number)}</h3><p><strong>${esc(c?.name||'Unknown customer')}</strong></p><p>${esc(p?.address||c?.address||'No property selected')}</p><p>${esc(e.description)}</p><span class="status-pill">${esc(e.status)}</span><div class="estimate-actions"><button data-edit="${e.id}">Edit</button><button data-status="Sent" data-id="${e.id}">Mark Sent</button><button data-status="Approved" data-id="${e.id}">Approve</button><button onclick="window.print()">Print</button><button data-delete="${e.id}">Delete</button></div></div><div class="estimate-amount"><strong>${money(e.total)}</strong><small>${esc(e.date)}</small></div>`;list.appendChild(card)});
    set('pendingEstimateCount',estimates.filter(e=>e.status==='Draft'||e.status==='Sent').length);set('approvedEstimateCount',estimates.filter(e=>e.status==='Approved').length);set('estimateValue',money(estimates.reduce((s,e)=>s+Number(e.total||0),0)));
    list.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEstimate(estimates.find(e=>e.id===b.dataset.edit)));
    list.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>{estimates=estimates.map(e=>e.id===b.dataset.id?{...e,status:b.dataset.status}:e);save('jc_estimates',estimates);render()});
    list.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{if(confirm('Delete this estimate?')){estimates=estimates.filter(e=>e.id!==b.dataset.delete);save('jc_estimates',estimates);render()}})
  }
  populateCustomers();render();
  document.getElementById('newEstimateButton').onclick=()=>openEstimate();
  document.getElementById('addLineItem').onclick=()=>addLine();
  customerSelect.onchange=()=>populateProperties(customerSelect.value);
  form.taxRate.addEventListener('input',recalc);
  form.onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(form));Object.assign(d,recalc());d.lines=lines();d.taxRate=Number(d.taxRate||0);d.deposit=Number(d.deposit||0);if(d.id)estimates=estimates.map(x=>x.id===d.id?{...x,...d}:x);else{d.id=uid();d.number=String(1001+estimates.length);estimates.push(d)}save('jc_estimates',estimates);document.getElementById('estimateModal').classList.remove('open');render()};
  const search=document.getElementById('estimateSearch'),status=document.getElementById('estimateStatusFilter');
  function filter(){const q=search.value.toLowerCase(),s=status.value;render(estimates.filter(e=>{const c=customers.find(x=>x.id===e.customerId),p=properties.find(x=>x.id===e.propertyId);return(!s||e.status===s)&&[e.number,e.description,e.status,c?.name,p?.address].join(' ').toLowerCase().includes(q)}))}
  search.oninput=filter;status.onchange=filter;
  if(location.hash==='#new')openEstimate();
})();
