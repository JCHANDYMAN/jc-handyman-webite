// Build 12.1 Repair Patch
(function(){
const original=window.JCCloud;
if(!original)return;
const safe=v=>Array.isArray(v)?v:[];
const oldLocalCounts=original.localCounts;
const wrapped={
  ...original,
  localCounts(){
    const c=oldLocalCounts();
    Object.keys(c).forEach(k=>{ if(c[k]==null||Number.isNaN(c[k])) c[k]=0;});
    return c;
  }
};
window.JCCloud=wrapped;
})();