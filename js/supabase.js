
(function(global){
  'use strict';

  const CONFIG = Object.freeze({
    url: 'https://qaytmydpamtyyanxholt.supabase.co',
    publishableKey: 'sb_publishable_Cid02Bn9hFnu0iy_AJ2LFQ_AxqXCLNl',
    table: 'crm_records',
    queueKey: 'jc_cloud_queue',
    lastSyncKey: 'jc_cloud_last_sync',
    deviceKey: 'jc_cloud_device_id',
    syncIntervalMs: 60000,
    collections: {
      jc_customers: 'customers',
      jc_properties: 'properties',
      jc_jobs: 'jobs',
      jc_estimates: 'estimates',
      jc_invoices: 'invoices',
      jc_schedule: 'schedule',
      jc_inspections: 'inspections',
      jc_photo_docs: 'photo_docs',
      jc_property_notes: 'property_notes'
    }
  });

  const nativeSetItem = localStorage.setItem.bind(localStorage);
  const nativeRemoveItem = localStorage.removeItem.bind(localStorage);
  const listeners = new Set();
  let client = null;
  let session = null;
  let syncing = false;
  let debounceTimer = null;
  let initialized = false;

  function safeParse(value, fallback){
    try { return JSON.parse(value); } catch { return fallback; }
  }

  function uid(){
    return (global.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function deviceId(){
    let id = localStorage.getItem(CONFIG.deviceKey);
    if(!id){
      id = uid();
      nativeSetItem(CONFIG.deviceKey, id);
    }
    return id;
  }

  function emit(type, detail={}){
    const event = { type, detail, at: new Date().toISOString() };
    listeners.forEach(fn => { try { fn(event); } catch(e) { console.error(e); } });
    global.dispatchEvent(new CustomEvent('jc-cloud-sync', {detail:event}));
  }

  function getQueue(){
    return safeParse(localStorage.getItem(CONFIG.queueKey), []);
  }

  function setQueue(queue){
    nativeSetItem(CONFIG.queueKey, JSON.stringify(queue));
    emit('queue-change', { count: queue.length });
  }

  function getRecordId(record, index){
    return String(record?.id || record?.uuid || record?.recordId || `legacy-${index}`);
  }

  function normalizeRecords(key){
    const value = safeParse(localStorage.getItem(key), []);
    return Array.isArray(value) ? value : [];
  }

  function queueCollection(key){
    const collection = CONFIG.collections[key];
    if(!collection) return;
    const records = normalizeRecords(key);
    const now = new Date().toISOString();
    const queue = getQueue().filter(item => item.collection !== collection);

    records.forEach((record,index) => {
      const recordId = getRecordId(record,index);
      queue.push({
        operation:'upsert',
        collection,
        recordId,
        data:{...record,id:recordId,_cloudUpdatedAt:now,_deviceId:deviceId()},
        queuedAt:now
      });
    });

    setQueue(queue);
    scheduleSync();
  }

  function installLocalStorageWatcher(){
    if(localStorage.__jcCloudPatched) return;

    localStorage.setItem = function(key,value){
      nativeSetItem(key,value);
      if(CONFIG.collections[key]) queueCollection(key);
    };

    localStorage.removeItem = function(key){
      nativeRemoveItem(key);
      if(CONFIG.collections[key]){
        const queue = getQueue();
        queue.push({
          operation:'delete-collection',
          collection:CONFIG.collections[key],
          queuedAt:new Date().toISOString()
        });
        setQueue(queue);
        scheduleSync();
      }
    };

    Object.defineProperty(localStorage,'__jcCloudPatched',{value:true});
  }

  function scheduleSync(){
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if(navigator.onLine && session) syncNow().catch(console.error);
    }, 1200);
  }

  async function ensureClient(){
    if(client) return client;
    if(!global.supabase?.createClient){
      throw new Error('Supabase library not loaded. Add the Supabase CDN script before js/supabase.js.');
    }
    client = global.supabase.createClient(CONFIG.url, CONFIG.publishableKey, {
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    const result = await client.auth.getSession();
    session = result.data.session || null;

    client.auth.onAuthStateChange((_event,newSession) => {
      session = newSession;
      emit('auth-change', { user:newSession?.user || null });
      if(session && navigator.onLine) syncNow().catch(console.error);
    });

    return client;
  }

  async function signUp(email,password){
    const supa = await ensureClient();
    const {data,error} = await supa.auth.signUp({email,password});
    if(error) throw error;
    return data;
  }

  async function signIn(email,password){
    const supa = await ensureClient();
    const {data,error} = await supa.auth.signInWithPassword({email,password});
    if(error) throw error;
    session = data.session;
    return data;
  }

  async function signOut(){
    const supa = await ensureClient();
    const {error} = await supa.auth.signOut();
    if(error) throw error;
    session = null;
  }

  async function currentUser(){
    const supa = await ensureClient();
    const {data,error} = await supa.auth.getUser();
    if(error && error.message !== 'Auth session missing!') throw error;
    return data?.user || null;
  }

  async function flushQueue(){
    if(!session) throw new Error('Sign in before syncing.');
    if(!navigator.onLine) return {offline:true,count:getQueue().length};

    const supa = await ensureClient();
    let queue = getQueue();
    if(!queue.length) return {uploaded:0};

    let uploaded = 0;
    const remaining = [];

    for(const item of queue){
      try{
        if(item.operation === 'delete-collection'){
          const {error} = await supa.from(CONFIG.table)
            .delete()
            .eq('user_id',session.user.id)
            .eq('collection',item.collection);
          if(error) throw error;
        }else{
          const payload = {
            user_id:session.user.id,
            collection:item.collection,
            record_id:item.recordId,
            data:item.data,
            device_id:deviceId(),
            updated_at:item.queuedAt || new Date().toISOString(),
            deleted_at:null
          };
          const {error} = await supa.from(CONFIG.table)
            .upsert(payload,{onConflict:'user_id,collection,record_id'});
          if(error) throw error;
        }
        uploaded++;
      }catch(error){
        remaining.push(item);
        emit('error',{message:error.message});
      }
    }

    setQueue(remaining);
    return {uploaded,remaining:remaining.length};
  }

  async function pullFromCloud({replace=false}={}){
    if(!session) throw new Error('Sign in before restoring cloud data.');
    if(!navigator.onLine) throw new Error('Internet connection is required to restore cloud data.');

    const supa = await ensureClient();
    const {data,error} = await supa.from(CONFIG.table)
      .select('collection,record_id,data,updated_at,deleted_at')
      .eq('user_id',session.user.id)
      .is('deleted_at',null)
      .order('updated_at',{ascending:true});
    if(error) throw error;

    const reverse = Object.fromEntries(Object.entries(CONFIG.collections).map(([k,v])=>[v,k]));
    const grouped = {};

    (data||[]).forEach(row => {
      const key = reverse[row.collection];
      if(!key) return;
      (grouped[key] ||= []).push({...row.data,id:row.record_id,_cloudUpdatedAt:row.updated_at});
    });

    Object.entries(grouped).forEach(([key,cloudRecords]) => {
      const local = replace ? [] : normalizeRecords(key);
      const map = new Map(local.map((record,index)=>[getRecordId(record,index),record]));

      cloudRecords.forEach(record => {
        const existing = map.get(record.id);
        const existingTime = Date.parse(existing?._cloudUpdatedAt || existing?.updatedAt || existing?.createdAt || 0);
        const cloudTime = Date.parse(record._cloudUpdatedAt || 0);
        if(!existing || cloudTime >= existingTime) map.set(record.id,record);
      });

      nativeSetItem(key,JSON.stringify([...map.values()]));
    });

    return {downloaded:(data||[]).length};
  }

  async function migrateLocalData(){
    if(!session) throw new Error('Sign in before migrating local data.');
    Object.keys(CONFIG.collections).forEach(queueCollection);
    return syncNow({pullAfter:false});
  }

  async function syncNow({pullAfter=true}={}){
    if(syncing) return {busy:true};
    syncing = true;
    emit('sync-start');

    try{
      if(!navigator.onLine){
        emit('offline',{queue:getQueue().length});
        return {offline:true};
      }
      if(!session) return {signedOut:true};

      const pushed = await flushQueue();
      const pulled = pullAfter ? await pullFromCloud() : {downloaded:0};
      const at = new Date().toISOString();
      nativeSetItem(CONFIG.lastSyncKey,at);
      emit('sync-success',{...pushed,...pulled,at});
      return {...pushed,...pulled,at};
    }catch(error){
      emit('error',{message:error.message});
      throw error;
    }finally{
      syncing = false;
    }
  }

  async function cloudCount(){
    if(!session) return 0;
    const supa = await ensureClient();
    const {count,error} = await supa.from(CONFIG.table)
      .select('*',{count:'exact',head:true})
      .eq('user_id',session.user.id)
      .is('deleted_at',null);
    if(error) throw error;
    return count || 0;
  }

  function localCounts(){
    return Object.fromEntries(
      Object.entries(CONFIG.collections).map(([key,collection])=>[collection,normalizeRecords(key).length])
    );
  }

  async function init(){
    if(initialized) return;
    initialized = true;
    installLocalStorageWatcher();
    await ensureClient();

    global.addEventListener('online',()=>{
      emit('online');
      syncNow().catch(console.error);
    });
    global.addEventListener('offline',()=>emit('offline',{queue:getQueue().length}));
    global.addEventListener('storage',event=>{
      if(CONFIG.collections[event.key]) queueCollection(event.key);
    });

    setInterval(()=>{
      if(navigator.onLine && session) syncNow().catch(console.error);
    },CONFIG.syncIntervalMs);

    if(navigator.onLine && session) syncNow().catch(console.error);
    emit('ready',{signedIn:!!session});
  }

  global.JCCloud = Object.freeze({
    config:CONFIG,
    init,
    signUp,
    signIn,
    signOut,
    currentUser,
    syncNow,
    pullFromCloud,
    migrateLocalData,
    cloudCount,
    localCounts,
    queueCount:()=>getQueue().length,
    lastSync:()=>localStorage.getItem(CONFIG.lastSyncKey),
    on:fn=>{listeners.add(fn);return()=>listeners.delete(fn)}
  });

  init().catch(error=>emit('error',{message:error.message}));
})(window);
