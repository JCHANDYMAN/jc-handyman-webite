
(function(){
  const $=id=>document.getElementById(id);
  const logLines=[];

  function log(message){
    logLines.unshift(`[${new Date().toLocaleTimeString()}] ${message}`);
    $('activityLog').textContent=logLines.slice(0,25).join('\n');
  }

  function message(id,text,type=''){
    const el=$(id);
    el.textContent=text;
    el.className='message '+type;
  }

  function updateOnline(){
    const online=navigator.onLine;
    $('internetStatus').textContent=online?'Online':'Offline';
    $('connectionBadge').textContent=online?'Online':'Offline';
    $('connectionBadge').className='badge '+(online?'online':'offline');
  }

  function refreshCounts(){
    const counts=JCCloud.localCounts();
    $('migrationSummary').innerHTML=Object.entries(counts).map(([name,count])=>
      `<div class="collection"><span>${name.replaceAll('_',' ')}</span><strong>${count}</strong></div>`
    ).join('');
    $('queueCount').textContent=JCCloud.queueCount();
    $('lastSync').textContent=JCCloud.lastSync()?new Date(JCCloud.lastSync()).toLocaleString():'Never';
  }

  async function refreshUser(){
    try{
      const user=await JCCloud.currentUser();
      $('signedInAs').textContent=user?.email||'Not signed in';
      $('signOutBtn').classList.toggle('hidden',!user);
      $('cloudCount').textContent=user?await JCCloud.cloudCount():'—';
    }catch(error){
      log(error.message);
    }
  }

  $('authForm').addEventListener('submit',async e=>{
    e.preventDefault();
    try{
      message('authMessage','Signing in…');
      await JCCloud.signIn($('emailInput').value.trim(),$('passwordInput').value);
      message('authMessage','Signed in successfully.','success');
      log('Signed in.');
      await refreshUser();
      await JCCloud.syncNow();
    }catch(error){
      message('authMessage',error.message,'error');
      log(`Sign-in error: ${error.message}`);
    }
  });

  $('signUpBtn').addEventListener('click',async()=>{
    try{
      message('authMessage','Creating account…');
      const data=await JCCloud.signUp($('emailInput').value.trim(),$('passwordInput').value);
      const needsEmail=!data.session;
      message('authMessage',needsEmail?'Account created. Check your email to confirm it.':'Account created and signed in.','success');
      log('Account created.');
      await refreshUser();
    }catch(error){
      message('authMessage',error.message,'error');
      log(`Account error: ${error.message}`);
    }
  });

  $('signOutBtn').addEventListener('click',async()=>{
    try{
      await JCCloud.signOut();
      message('authMessage','Signed out.','success');
      log('Signed out.');
      await refreshUser();
    }catch(error){message('authMessage',error.message,'error')}
  });

  $('syncNowBtn').addEventListener('click',async()=>{
    try{
      log('Manual sync started.');
      const result=await JCCloud.syncNow();
      log(`Sync complete: ${result.uploaded||0} uploaded, ${result.downloaded||0} downloaded.`);
      refreshCounts();await refreshUser();
    }catch(error){log(`Sync error: ${error.message}`)}
  });

  $('pullBtn').addEventListener('click',async()=>{
    if(!confirm('Restore and merge cloud records into this browser?'))return;
    try{
      const result=await JCCloud.pullFromCloud();
      log(`Restored ${result.downloaded} cloud records.`);
      refreshCounts();
      alert('Cloud records restored. Refresh your CRM pages to see them.');
    }catch(error){log(`Restore error: ${error.message}`)}
  });

  $('migrateBtn').addEventListener('click',async()=>{
    if(!confirm('Copy all current browser CRM records to your cloud account?'))return;
    try{
      message('migrationMessage','Migration running…');
      const result=await JCCloud.migrateLocalData();
      message('migrationMessage',`Migration complete. ${result.uploaded||0} records uploaded.`,'success');
      log(`Migration complete: ${result.uploaded||0} records uploaded.`);
      refreshCounts();await refreshUser();
    }catch(error){
      message('migrationMessage',error.message,'error');
      log(`Migration error: ${error.message}`);
    }
  });

  $('refreshSummaryBtn').addEventListener('click',refreshCounts);

  JCCloud.on(event=>{
    if(event.type==='queue-change')$('queueCount').textContent=event.detail.count;
    if(event.type==='sync-success'){
      $('lastSync').textContent=new Date(event.detail.at).toLocaleString();
      log(`Automatic sync complete: ${event.detail.uploaded||0} uploaded, ${event.detail.downloaded||0} downloaded.`);
      refreshUser();
    }
    if(event.type==='error')log(`Cloud error: ${event.detail.message}`);
    if(event.type==='online'||event.type==='offline')updateOnline();
    if(event.type==='auth-change')refreshUser();
  });

  updateOnline();
  refreshCounts();
  refreshUser();
})();
