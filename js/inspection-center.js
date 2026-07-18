
(function(){
  const STORAGE_KEY = 'jc_inspections';
  const customers = safeLoad('jc_customers');
  const properties = safeLoad('jc_properties');
  let inspections = safeLoad(STORAGE_KEY);

  const defaultAreas = [
    'Living Room','Kitchen','Dining Room','Primary Bedroom','Bedroom 2',
    'Bedroom 3','Bathroom 1','Bathroom 2','Laundry Room','Garage','Attic','Exterior'
  ];

  const $ = id => document.getElementById(id);
  const form = $('inspectionForm');
  const modal = $('inspectionModal');
  const areasContainer = $('areasContainer');
  const template = $('areaTemplate');

  function safeLoad(key){
    try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return []}
  }
  function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(inspections))}
  function uid(){return crypto?.randomUUID?.() || Date.now().toString(36)+Math.random().toString(36).slice(2)}
  function money(v){return Number(v||0).toLocaleString('en-US',{style:'currency',currency:'USD'})}
  function esc(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function today(){return new Date().toISOString().slice(0,10)}

  function customerName(id){return customers.find(c=>c.id===id)?.name || 'No customer selected'}
  function propertyAddress(id){
    const p=properties.find(p=>p.id===id);
    return p?.address || p?.propertyAddress || 'No property selected';
  }

  function populateCustomers(){
    $('customerSelect').innerHTML='<option value="">Select customer</option>'+
      customers.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  }

  function populateProperties(customerId='', selected=''){
    const list=customerId ? properties.filter(p=>p.customerId===customerId) : properties;
    $('propertySelect').innerHTML='<option value="">Select property</option>'+
      list.map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${esc(p.address||p.propertyAddress||'Property')}</option>`).join('');
  }

  function addArea(area={name:'',condition:'Good',repairNeeded:'No',notes:''}){
    const node=template.content.firstElementChild.cloneNode(true);
    node.querySelector('.area-name').value=area.name||'';
    node.querySelector('.area-condition').value=area.condition||'Good';
    node.querySelector('.area-repair').value=area.repairNeeded||'No';
    node.querySelector('.area-notes').value=area.notes||'';
    node.querySelector('.remove-area-btn').addEventListener('click',()=>node.remove());
    areasContainer.appendChild(node);
  }

  function resetAreas(areas){
    areasContainer.innerHTML='';
    (areas?.length?areas:defaultAreas.map(name=>({name,condition:'Good',repairNeeded:'No',notes:''}))).forEach(addArea);
  }

  function collectAreas(){
    return [...areasContainer.querySelectorAll('.area-card')].map(card=>({
      name:card.querySelector('.area-name').value.trim(),
      condition:card.querySelector('.area-condition').value,
      repairNeeded:card.querySelector('.area-repair').value,
      notes:card.querySelector('.area-notes').value.trim()
    })).filter(a=>a.name);
  }

  function openNew(){
    form.reset();
    form.elements.id.value='';
    form.elements.date.value=today();
    form.elements.inspector.value='Jerry Cook';
    form.elements.status.value='Draft';
    populateProperties('');
    resetAreas();
    $('formTitle').textContent='New Inspection';
    $('deleteBtn').style.display='none';
    modal.classList.add('open');
  }

  function openEdit(id){
    const item=inspections.find(i=>i.id===id);
    if(!item)return;
    form.reset();
    Object.entries(item).forEach(([key,value])=>{
      if(key==='areas')return;
      if(form.elements[key])form.elements[key].value=value??'';
    });
    populateProperties(item.customerId,item.propertyId);
    resetAreas(item.areas);
    $('formTitle').textContent=`Edit ${item.type} Inspection`;
    $('deleteBtn').style.display='';
    modal.classList.add('open');
  }

  function close(){modal.classList.remove('open')}

  function render(){
    const q=$('searchInput').value.trim().toLowerCase();
    const type=$('typeFilter').value;
    const status=$('statusFilter').value;

    const filtered=[...inspections].sort((a,b)=>String(b.date).localeCompare(String(a.date))).filter(i=>{
      const hay=[customerName(i.customerId),propertyAddress(i.propertyId),i.inspector,i.tenant,i.generalNotes,i.repairNotes,i.damageNotes,i.type,i.status].join(' ').toLowerCase();
      return (!type||i.type===type)&&(!status||i.status===status)&&hay.includes(q);
    });

    $('inspectionList').innerHTML=filtered.length?filtered.map(i=>`
      <article class="inspection-card">
        <div>
          <span class="type-badge">${esc(i.type)}</span>
          <h3>${esc(propertyAddress(i.propertyId))}</h3>
          <p><strong>${esc(customerName(i.customerId))}</strong></p>
          <p>${esc(i.date||'No date')} • Inspector: ${esc(i.inspector||'Not listed')}</p>
        </div>
        <div>
          <span class="status-badge">${esc(i.status||'Draft')}</span>
          <p>Repair estimate: <strong>${money(i.estimatedRepairCost)}</strong></p>
          <p>${i.areas?.filter(a=>a.repairNeeded==='Yes').length||0} area(s) marked for repair</p>
        </div>
        <div class="card-actions">
          <button class="secondary-btn" data-edit="${i.id}">Open</button>
          <button class="secondary-btn" data-copy="${i.id}">Duplicate</button>
          <button class="primary-btn" data-print="${i.id}">Print</button>
        </div>
      </article>`).join(''):
      '<div class="empty-state"><h3>No inspections found</h3><p>Create your first move-in or move-out inspection.</p></div>';

    $('totalInspections').textContent=inspections.length;
    $('moveInCount').textContent=inspections.filter(i=>i.type==='Move-In').length;
    $('moveOutCount').textContent=inspections.filter(i=>i.type==='Move-Out').length;
    $('repairTotal').textContent=money(inspections.reduce((s,i)=>s+Number(i.estimatedRepairCost||0),0));

    document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEdit(b.dataset.edit));
    document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>duplicateInspection(b.dataset.copy));
    document.querySelectorAll('[data-print]').forEach(b=>b.onclick=()=>{openEdit(b.dataset.print);setTimeout(()=>window.print(),120)});
  }

  function duplicateInspection(id){
    const original=inspections.find(i=>i.id===id);
    if(!original)return;
    const copy={...original,id:uid(),date:today(),status:'Draft',type:original.type,areas:(original.areas||[]).map(a=>({...a}))};
    inspections.push(copy);save();render();openEdit(copy.id);
  }

  form.addEventListener('submit',e=>{
    e.preventDefault();
    const data=Object.fromEntries(new FormData(form).entries());
    data.areas=collectAreas();
    data.estimatedRepairCost=Number(data.estimatedRepairCost||0);
    data.updatedAt=new Date().toISOString();

    if(data.id){
      inspections=inspections.map(i=>i.id===data.id?{...i,...data}:i);
    }else{
      data.id=uid();
      data.createdAt=data.updatedAt;
      inspections.push(data);
    }
    save();close();render();
  });

  $('customerSelect').addEventListener('change',e=>populateProperties(e.target.value));
  $('newInspectionBtn').addEventListener('click',openNew);
  $('closeModalBtn').addEventListener('click',close);
  $('addAreaBtn').addEventListener('click',()=>addArea({name:'New Area'}));
  $('printCurrentBtn').addEventListener('click',()=>window.print());
  $('duplicateBtn').addEventListener('click',()=>{
    if(form.elements.id.value)duplicateInspection(form.elements.id.value);
  });
  $('deleteBtn').addEventListener('click',()=>{
    const id=form.elements.id.value;
    if(!id||!confirm('Delete this inspection?'))return;
    inspections=inspections.filter(i=>i.id!==id);save();close();render();
  });
  modal.addEventListener('click',e=>{if(e.target===modal)close()});
  ['searchInput','typeFilter','statusFilter'].forEach(id=>$(id).addEventListener(id==='searchInput'?'input':'change',render));

  populateCustomers();
  populateProperties();
  render();
})();
