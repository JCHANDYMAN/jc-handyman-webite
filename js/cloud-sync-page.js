// Build 12.1 page repair
(function(){
const old=window.JCCloud?.localCounts;
if(old){
  const counts=old();
  Object.keys(counts).forEach(k=>{if(counts[k]==null)counts[k]=0;});
}
window.addEventListener('error',e=>{
 console.error('Cloud Sync:',e.error||e.message);
});
})();