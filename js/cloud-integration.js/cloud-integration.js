// JC Handyman CRM — Build 12.5 V2 Cloud Integration
(function(window,document){
  "use strict";
  if(window.__JC_CLOUD_INTEGRATION_V2__) return;
  window.__JC_CLOUD_INTEGRATION_V2__=true;

  const CDN="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  const current=document.currentScript;
  const currentUrl=current?.src||new URL("js/cloud-integration.js",document.baseURI).href;
  const engineUrl=new URL("supabase.js",currentUrl).href;
  const keys=["jc_customers","jc_properties","jc_jobs","jc_estimates","jc_invoices","jc_schedule","jc_inspections","jc_photo_docs","jc_property_notes"];
  let badge,busy=false,last="",timer;

  function load(src,id){
    return new Promise((resolve,reject)=>{
      const old=document.getElementById(id);
      if(old){
        if(old.dataset.loaded==="true") return resolve();
        old.addEventListener("load",resolve,{once:true});
        old.addEventListener("error",()=>reject(new Error("Unable to load "+src)),{once:true});
        return;
      }
      const s=document.createElement("script");
      s.id=id;s.src=src;s.async=false;
      s.onload=()=>{s.dataset.loaded="true";resolve();};
      s.onerror=()=>reject(new Error("Unable to load "+src));
      document.head.appendChild(s);
    });
  }

  function show(text,color){
    if(!badge){
      badge=document.createElement("button");
      badge.type="button";
      badge.style.cssText="position:fixed;right:14px;bottom:14px;z-index:99999;border:1px solid;border-radius:999px;padding:8px 12px;background:#1b1e24;font:700 12px Arial;box-shadow:0 4px 18px rgba(0,0,0,.35);cursor:pointer";
      badge.onclick=()=>location.href=new URL("cloud-sync.html",document.baseURI).href;
      document.body.appendChild(badge);
    }
    badge.textContent=text;badge.style.color=color;badge.style.borderColor=color;
  }

  function snap(){return JSON.stringify(keys.map(k=>[k,localStorage.getItem(k)||"[]"]));}

  async function sync(){
    if(busy) return;
    if(!navigator.onLine){show("Cloud: Offline","#d65757");return;}
    const user=await window.JCCloud.getUser().catch(()=>null);
    if(!user){show("Cloud: Sign in","#d6a236");return;}
    busy=true;show("Cloud: Syncing…","#f47b20");
    try{
      await window.JCCloud.syncNow();
      last=snap();show("Cloud: Synced","#39b978");
    }catch(e){
      console.error(e);show("Cloud: Error","#ff6b6b");
    }finally{busy=false;}
  }

  async function start(){
    show("Cloud: Loading…","#aeb4c2");
    try{
      if(!window.supabase?.createClient) await load(CDN,"jc-supabase-cdn");
      if(!window.JCCloud) await load(engineUrl,"jc-supabase-engine");
      const user=await window.JCCloud.getUser().catch(()=>null);
      if(user&&navigator.onLine){
        await window.JCCloud.pullCloud().catch(console.warn);
        show("Cloud: Synced","#39b978");
      }else if(!navigator.onLine) show("Cloud: Offline","#d65757");
      else show("Cloud: Sign in","#d6a236");
      last=snap();
      setInterval(()=>{const n=snap();if(n!==last){last=n;clearTimeout(timer);timer=setTimeout(sync,1500);}},5000);
      setInterval(sync,60000);
      addEventListener("online",sync);
      addEventListener("offline",()=>show("Cloud: Offline","#d65757"));
    }catch(e){
      console.error(e);show("Cloud: Load error","#ff6b6b");
    }
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})(window,document);
