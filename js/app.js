
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


 // Jobs Center (Build 5)
 let jobData=jobs;
 const jobList=document.getElementById('jobList'),jobForm=document.getElementById('jobForm');
 const jobCustomer=document.getElementById('jobCustomer'),jobProperty=document.getElementById('jobProperty');
 function populateJobCustomers(){if(!jobCustomer)return;jobCustomer.innerHTML='<option value="">Select customer</option>'+customers.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}
 function populateJobProperties(customerId,selected=''){if(!jobProperty)return;jobProperty.innerHTML='<option value="">Select property</option>'+properties.filter(p=>p.customerId===customerId).map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${esc(p.address)}</option>`).join('')}
 function jobAmount(j){return Number(j.labor||0)+Number(j.materials||0)}
 function recalcJob(){if(!jobForm)return;set('jobTotal',money(Number(jobForm.labor.value||0)+Number(jobForm.materials.value||0)))}
 function openJob(j){if(!jobForm)return;jobForm.reset();populateJobCustomers();jobForm.id.value=j?.id||'';jobForm.customerId.value=j?.customerId||'';populateJobProperties(j?.customerId||'',j?.propertyId||'');jobForm.title.value=j?.title||'';jobForm.date.value=j?.date||new Date().toISOString().slice(0,10);jobForm.time.value=j?.time||'';jobForm.status.value=j?.status||'Scheduled';jobForm.estimatedHours.value=j?.estimatedHours||1;jobForm.actualHours.value=j?.actualHours||0;jobForm.labor.value=j?.labor||0;jobForm.materials.value=j?.materials||0;jobForm.scope.value=j?.scope||'';jobForm.notes.value=j?.notes||'';jobForm.paid.checked=Boolean(j?.paid);document.getElementById('jobModalTitle').textContent=j?'Edit Job':'New Job';document.getElementById('jobModal').classList.add('open');recalcJob()}
 function renderJobs(items=jobData){if(!jobList)return;jobList.innerHTML='';if(!items.length)jobList.innerHTML='<div class="empty-state"><span>🔨</span><p>No jobs yet. Schedule your first job.</p></div>';items.slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).forEach(j=>{const c=customers.find(x=>x.id===j.customerId),p=properties.find(x=>x.id===j.propertyId),card=document.createElement('article');card.className='job-card';card.innerHTML=`<div><h3>${esc(j.title)}</h3><p><strong>${esc(c?.name||'Unknown customer')}</strong></p><p>🏠 ${esc(p?.address||c?.address||'No property selected')}</p><p>📅 ${esc(j.date)} ${esc(j.time||'')}</p>${j.scope?`<p>${esc(j.scope)}</p>`:''}<span class="status-pill">${esc(j.status)}</span><div class="job-actions"><button data-edit-job="${j.id}">Edit</button><button data-job-status="${j.id}" data-status="In Progress">Start</button><button data-job-status="${j.id}" data-status="Complete">Complete</button>${c?.phone?`<a href="tel:${esc(c.phone)}">Call</a>`:''}<button data-delete-job="${j.id}">Delete</button></div></div><div class="job-side"><strong>${money(jobAmount(j))}</strong><small>${Number(j.actualHours||0)} hours</small><br><small>${j.paid?'Paid':'Unpaid'}</small></div>`;jobList.appendChild(card)});set('scheduledJobCount',jobData.filter(j=>j.status==='Scheduled').length);set('progressJobCount',jobData.filter(j=>j.status==='In Progress'||j.status==='Waiting on Materials').length);set('completedJobCount',jobData.filter(j=>j.status==='Complete').length);jobList.querySelectorAll('[data-edit-job]').forEach(b=>b.onclick=()=>openJob(jobData.find(j=>j.id===b.dataset.editJob)));jobList.querySelectorAll('[data-job-status]').forEach(b=>b.onclick=()=>{jobData=jobData.map(j=>j.id===b.dataset.jobStatus?{...j,status:b.dataset.status}:j);save('jc_jobs',jobData);jobs=jobData;renderJobs()});jobList.querySelectorAll('[data-delete-job]').forEach(b=>b.onclick=()=>{if(confirm('Delete this job?')){jobData=jobData.filter(j=>j.id!==b.dataset.deleteJob);save('jc_jobs',jobData);jobs=jobData;renderJobs()}})}
 populateJobCustomers();renderJobs();const newJobButton=document.getElementById('newJobButton');if(newJobButton)newJobButton.onclick=()=>openJob();if(location.hash==='#new'&&jobForm)setTimeout(()=>openJob(),0);if(jobCustomer)jobCustomer.onchange=()=>populateJobProperties(jobCustomer.value);if(jobForm){jobForm.labor.addEventListener('input',recalcJob);jobForm.materials.addEventListener('input',recalcJob);jobForm.onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(jobForm));d.paid=jobForm.paid.checked;d.estimatedHours=Number(d.estimatedHours||0);d.actualHours=Number(d.actualHours||0);d.labor=Number(d.labor||0);d.materials=Number(d.materials||0);if(d.id)jobData=jobData.map(j=>j.id===d.id?{...j,...d}:j);else{d.id=uid();jobData.push(d)}save('jc_jobs',jobData);jobs=jobData;document.getElementById('jobModal').classList.remove('open');renderJobs();jobForm.reset()}}
 const jobSearch=document.getElementById('jobSearch'),jobStatus=document.getElementById('jobStatusFilter');function filterJobs(){if(!jobList)return;const q=(jobSearch?.value||'').toLowerCase(),s=jobStatus?.value||'';renderJobs(jobData.filter(j=>{const c=customers.find(x=>x.id===j.customerId),p=properties.find(x=>x.id===j.propertyId);return(!s||j.status===s)&&[j.title,j.scope,j.status,c?.name,p?.address].join(' ').toLowerCase().includes(q)}))}if(jobSearch)jobSearch.oninput=filterJobs;if(jobStatus)jobStatus.onchange=filterJobs;
 set('jobCount',jobData.filter(j=>j.status!=='Complete'&&j.status!=='Cancelled').length);
 const todayJobs=document.getElementById('todayJobs');if(todayJobs){const today=new Date().toISOString().slice(0,10),items=jobData.filter(j=>j.date===today&&j.status!=='Cancelled').sort((a,b)=>(a.time||'').localeCompare(b.time||''));todayJobs.innerHTML=items.length?items.map(j=>{const c=customers.find(x=>x.id===j.customerId);return `<div class="schedule-item"><strong>${esc(j.time||'Any time')}</strong><div><b>${esc(j.title)}</b><br><small>${esc(c?.name||'Unknown customer')}</small></div><span class="status-pill">${esc(j.status)}</span></div>`}).join(''):'<div class="empty-state"><span>📅</span><p>No jobs scheduled today.</p><a class="primary-btn" href="jobs.html#new">Schedule a job</a></div>'}
 const calendarList=document.getElementById('calendarList'),calendarSummary=document.getElementById('calendarSummary');function renderCalendar(items=jobData){if(!calendarList)return;const sorted=items.filter(j=>j.status!=='Cancelled').sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)),groups={};sorted.forEach(j=>(groups[j.date]??=[]).push(j));calendarList.innerHTML=Object.keys(groups).length?Object.entries(groups).map(([date,arr])=>`<section class="calendar-day"><h3>${new Date(date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}</h3>${arr.map(j=>{const c=customers.find(x=>x.id===j.customerId),p=properties.find(x=>x.id===j.propertyId);return `<div class="schedule-item"><strong>${esc(j.time||'Any time')}</strong><div><b>${esc(j.title)}</b><br><small>${esc(c?.name||'')} • ${esc(p?.address||c?.address||'')}</small></div><span class="status-pill">${esc(j.status)}</span></div>`}).join('')}</section>`).join(''):'<div class="empty-state"><span>📅</span><p>No jobs scheduled.</p></div>';if(calendarSummary)calendarSummary.textContent=`${sorted.length} job${sorted.length===1?'':'s'}`}renderCalendar();const calendarSearch=document.getElementById('calendarSearch');if(calendarSearch)calendarSearch.oninput=()=>{const q=calendarSearch.value.toLowerCase();renderCalendar(jobData.filter(j=>{const c=customers.find(x=>x.id===j.customerId);return[j.title,j.status,j.date,c?.name].join(' ').toLowerCase().includes(q)}))};

})();
