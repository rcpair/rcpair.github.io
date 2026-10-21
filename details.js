(function(){
  function openHash(){
    var id; try{ id=decodeURIComponent(location.hash.slice(1)); }catch(error){ return; }
    var target=document.getElementById(id);
    if(!target){ return; } for(var node=target; node; node=node.parentElement){
      if(node.tagName==='DETAILS'){ node.open=true; }
    }
    target.scrollIntoView({block:'start'});
  }
  window.addEventListener('hashchange', openHash);
  document.addEventListener('click', function(e){ var a=e.target.closest('a[href]'); if(a && a.origin===location.origin && a.pathname===location.pathname && a.hash){ setTimeout(openHash,0); } }); openHash();
})();
