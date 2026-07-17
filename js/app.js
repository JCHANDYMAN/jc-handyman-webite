
(function(){
 const page=document.body.dataset.page;
 document.querySelectorAll('.nav a').forEach(a=>{if(a.dataset.page===page)a.classList.add('active')});
 const sidebar=document.getElementById('sidebar'),menu=document.getElementById('menuButton');
 if(menu)menu.onclick=()=>sidebar.classList.toggle('open');

 document.querySelectorAll('[data-open-modal]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.openModal).classList.add('open'));
 document.querySelectorAll('[data-close-modal]').forEach(b=>b.onclick=()=>b.closest('.modal').classList.remove('open'));
 document.querySelectorAll('.modal').forEach(m=>m.onclick=e=>{if(e.target===m)m.classList.remove('open')});

 const load=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return[]}};
 const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
 let customers=load('jc_customers'),properties=load('jc_properties'),jobs=load('jc_jobs'),invoices=load('jc_invoices');

 const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val};
 set('customerCount',customers.length);set('propertyCount',properties.length);set('jobCount',jobs.filter(j=>j.status!=='Complete').length);
 set('invoiceTotal',invoices.reduce((s,i)=>s+Number(i.balance||0),0).toLocaleString('en-US',{style:'currency',currency:'USD'}));

 const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 const list=document.getElementById('customerList'),summary=document.getElementById('customerSummary');

 function render(items=customers){
   if(!list)return;
   list.innerHTML='';
   if(!items.length){list.innerHTML='<div class="empty-state"><span>👥</span><p>No customers yet. Add your first customer.</p></div>';}
   items.forEach(c=>{
     const props=properties.filter(p=>p.customerId===c.id);
     const card=document.createElement('article');card.className='customer-card';
     card.innerHTML=`<h3>${esc(c.name)}</h3>
       <p>📞 ${esc(c.phone||'No phone')}</p><p>✉️ ${esc(c.email||'No email')}</p><p>🏠 ${esc(c.address||'No address')}</p>
       ${c.notes?`<p>📝 ${esc(c.notes)}</p>`:''}
       <div class="customer-actions">
         ${c.phone?`<a href="tel:${esc(c.phone)}">Call</a><a href="sms:${esc(c.phone)}">Text</a>`:''}
         ${c.email?`<a href="mailto:${esc(c.email)}">Email</a>`:''}
         <button data-edit="${c.id}">Edit</button><button data-property="${c.id}">+ Property</button><button data-delete="${c.id}">Delete</button>
       </div>
       <div class="property-list"><strong>${props.length} Propert${props.length===1?'y':'ies'}</strong>
       ${props.map(p=>`<div class="property-item"><strong>${esc(p.type)}</strong>${esc(p.address)}<br><small>${esc(p.status)}${p.notes?' • '+esc(p.notes):''}</small></div>`).join('')}</div>`;
     list.appendChild(card);
   });
   if(summary)summary.textContent=`${items.length} customer${items.length===1?'':'s'}`;
   list.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{if(confirm('Delete this customer?')){customers=customers.filter(c=>c.id!==b.dataset.delete);properties=properties.filter(p=>p.customerId!==b.dataset.delete);save('jc_customers',customers);save('jc_properties',properties);render()}});
   list.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openCustomer(customers.find(c=>c.id===b.dataset.edit)));
   list.querySelectorAll('[data-property]').forEach(b=>b.onclick=()=>{document.querySelector('#propertyForm [name=customerId]').value=b.dataset.property;document.getElementById('propertyModal').classList.add('open')});
 }
 render();

 function openCustomer(c){
   const form=document.getElementById('customerForm');if(!form)return;
   form.id.value=c?.id||'';form.name.value=c?.name||'';form.phone.value=c?.phone||'';form.email.value=c?.email||'';form.address.value=c?.address||'';form.notes.value=c?.notes||'';
   document.getElementById('customerModalTitle').textContent=c?'Edit Customer':'Add Customer';
   document.getElementById('customerModal').classList.add('open');
 }
 if(location.hash==='#new'&&document.getElementById('customerModal'))openCustomer();

 const cf=document.getElementById('customerForm');
 if(cf)cf.onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(cf));if(d.id){customers=customers.map(c=>c.id===d.id?d:c)}else{d.id=crypto.randomUUID();customers.push(d)}save('jc_customers',customers);document.getElementById('customerModal').classList.remove('open');cf.reset();render()};

 const pf=document.getElementById('propertyForm');
 if(pf)pf.onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(pf));d.id=crypto.randomUUID();properties.push(d);save('jc_properties',properties);document.getElementById('propertyModal').classList.remove('open');pf.reset();render()};

 const search=document.getElementById('customerSearch');
 if(search)search.oninput=()=>{const q=search.value.toLowerCase();render(customers.filter(c=>Object.values(c).join(' ').toLowerCase().includes(q)))};
  const estimateCount = document.getElementById('estimateCount');
  if (estimateCount) {
    const estimates = read('jc_estimates');
    estimateCount.textContent = estimates.filter(e => e.status !== 'Approved' && e.status !== 'Declined').length;
  }
})();
