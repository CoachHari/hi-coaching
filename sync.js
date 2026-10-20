/* H.I. – Coaching · Sync über Supabase
   Stellt dieselbe Speicher-Schnittstelle bereit, die die Seite in claude.ai nutzt,
   und speichert Trainingseinheiten, Termine und den Kader in Supabase. Ohne Anmeldung
   arbeitet die Seite wie gewohnt nur auf dem Gerät. */
(function(){
  const cfg=window.HI_CONFIG||{};
  const ready=!!(cfg.supabaseUrl&&cfg.supabaseAnonKey&&window.supabase&&window.supabase.createClient);
  const sb=ready?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
  const CACHE='hi-cache-';
  const load=k=>{try{return JSON.parse(localStorage.getItem(k));}catch(_){return null;}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(_){}};
  const sessionP=sb?sb.auth.getSession().then(r=>r.data&&r.data.session||null).catch(()=>null):Promise.resolve(null);
  let trainerP=null;
  const isTrainer=()=>{if(!trainerP)trainerP=sessionP.then(async s=>{if(!s)return false;
    try{const {data,error}=await sb.from('trainer').select('email').limit(1);if(error)return null;return data.length>0;}catch(_){return null;}});return trainerP;};
  const uid=()=>(window.crypto&&crypto.randomUUID)?crypto.randomUUID():'d'+Date.now().toString(36)+Math.random().toString(36).slice(2,10);
  const toErr=e=>{const m=String((e&&e.message)||e||''),c=String((e&&e.code)||'');
    return{code:(c==='42501'||/row-level security|permission|not allowed|JWT/i.test(m))?'invalid_argument':'unavailable',message:m};};
  const cols={};
  function collection(name){if(cols[name])return cols[name];
    let rows=load(CACHE+name)||[];const ls=new Set();let started=false;
    const snap=()=>({docs:rows.map(r=>({id:r.id,exists:true,data:()=>r.data,metadata:{fromCache:false,hasPendingWrites:false}})),size:rows.length,empty:!rows.length,docChanges:()=>[],metadata:{fromCache:false,hasPendingWrites:false}});
    const emit=()=>ls.forEach(f=>{try{f(snap());}catch(_){}});
    async function refresh(){const {data,error}=await sb.from(name).select('id,data,updated_at').order('updated_at',{ascending:false}).limit(1000);
      if(error)throw error;rows=data.map(r=>({id:r.id,data:r.data}));save(CACHE+name,rows);emit();}
    function start(){if(started)return;started=true;const go=()=>refresh().catch(()=>{});go();
      setInterval(()=>{if(document.visibilityState==='visible')go();},45000);
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')go();});window.addEventListener('online',go);}
    const c={path:name,
      doc(id){id=id||uid();return{id,path:name+'/'+id,
        async set(body){const {error}=await sb.from(name).upsert({id,data:body,updated_at:new Date().toISOString()});if(error)throw toErr(error);
          const i=rows.findIndex(r=>r.id===id);if(i>=0)rows[i]={id,data:body};else rows.unshift({id,data:body});save(CACHE+name,rows);emit();},
        async delete(){const {error}=await sb.from(name).delete().eq('id',id);if(error)throw toErr(error);rows=rows.filter(r=>r.id!==id);save(CACHE+name,rows);emit();}};},
      onSnapshot(next){ls.add(next);setTimeout(()=>next(snap()),0);start();return()=>ls.delete(next);}};
    cols[name]=c;return c;}
  window.HI_SB=sb;window.HI_isTrainer=()=>sb?isTrainer():Promise.resolve(false);
  const db={collection,doc(p){const i=p.lastIndexOf('/');return collection(p.slice(0,i)).doc(p.slice(i+1));}};
  window.claude={use:async name=>{const s=await sessionP;if(!s)return null;
    if(name==='db'){const t=await isTrainer();return t===false?null:db;}
    if(name==='user'){const t=await isTrainer();return{can:async()=>t!==false,canEdit:async()=>t!==false,isOwner:async()=>false};}
    return null;}};

  /* ---------- Anmeldung ---------- */
  function ui(){const host=document.getElementById('sync');if(!host)return;
    if(!sb){host.innerHTML='';return;}
    sessionP.then(async s=>{
      if(s){const t=await isTrainer();const mail=(s.user&&s.user.email)||'';
        host.innerHTML='<span class="sync-state'+(t===false?' warn':'')+'" title="'+esc(mail)+'"><i aria-hidden="true"></i>'+(t===false?'Nicht freigeschaltet':'Sync aktiv')+'</span><button type="button" class="sync-btn" id="sync-out">Abmelden</button>';
        document.getElementById('sync-out').addEventListener('click',async()=>{try{await sb.auth.signOut();}catch(_){}
          Object.keys(localStorage).filter(k=>k.indexOf(CACHE)===0).forEach(k=>{try{localStorage.removeItem(k);}catch(_){}});location.reload();});
        if(t===false)host.querySelector('.sync-state').title=mail+' ist noch nicht als Trainer freigeschaltet.';}
      else{host.innerHTML='<button type="button" class="sync-btn primary" id="sync-in">Anmelden für Sync</button>';
        document.getElementById('sync-in').addEventListener('click',openLogin);}});}
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function openLogin(){let d=document.getElementById('login-dlg');
    if(!d){d=document.createElement('dialog');d.id='login-dlg';d.className='picker login-dlg';d.setAttribute('aria-labelledby','login-h');
      d.innerHTML='<form id="login-form" novalidate><div class="pk-head"><div class="pk-top"><h3 id="login-h">Anmelden</h3><button type="button" class="btn ghost" id="login-x">Schließen</button></div></div>'+
        '<div class="login-body"><p class="login-lead">Mit deiner E-Mail-Adresse anmelden. Du bekommst eine E-Mail mit einem Anmeldelink. Öffne sie auf diesem Gerät und tippe auf den Link. Danach sind Trainingseinheiten, Kalender, Kader, Spiele und Matchplan auf allen deinen Geräten gleich.</p>'+
        '<label class="fld">E-Mail-Adresse<input type="email" name="email" autocomplete="email" inputmode="email" required></label>'+
        '<label class="fld" id="login-code-wrap" hidden>Code aus der E-Mail (nur falls die E-Mail einen Code enthält)<input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="123456"></label>'+
        '<div class="tfoot"><button type="submit" class="btn primary" id="login-go">Code senden</button><p id="login-msg" role="status" aria-live="polite"></p></div></div></form>';
      document.body.appendChild(d);
      const f=d.querySelector('form'),msg=d.querySelector('#login-msg'),go=d.querySelector('#login-go');let sent=false;
      d.querySelector('#login-x').addEventListener('click',()=>d.close());
      d.addEventListener('click',e=>{if(e.target===d)d.close();});
      f.addEventListener('submit',async e=>{e.preventDefault();const email=f.email.value.trim();
        if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){msg.textContent='Bitte eine gültige E-Mail-Adresse eingeben.';return;}
        go.disabled=true;
        try{
          if(!sent){const {error}=await sb.auth.signInWithOtp({email,options:{shouldCreateUser:true,emailRedirectTo:location.origin+location.pathname}});
            if(error)throw error;sent=true;d.querySelector('#login-code-wrap').hidden=false;go.textContent='Mit Code anmelden';f.email.readOnly=true;
            msg.textContent='E-Mail an '+email+' ist unterwegs. Öffne sie auf diesem Gerät und tippe auf den Link. Die Seite meldet dich dann automatisch an.';}
          else{const token=f.code.value.replace(/\D/g,'');if(token.length<6){msg.textContent='Bitte den Code aus der E-Mail eingeben.';go.disabled=false;return;}
            const {error}=await sb.auth.verifyOtp({email,token,type:'email'});if(error)throw error;msg.textContent='Angemeldet. Die Seite wird neu geladen …';location.reload();}
        }catch(err){const m=String(err&&err.message||'');
          msg.textContent=/rate|seconds/i.test(m)?'Bitte kurz warten und dann noch einmal versuchen.':/expired|invalid/i.test(m)?'Der Code ist falsch oder abgelaufen. Fordere einen neuen an.':'Das hat nicht geklappt. Prüfe die Internetverbindung und versuche es noch einmal.';
          if(/expired|invalid/i.test(m)){sent=false;go.textContent='Neuen Code senden';f.email.readOnly=false;}}
        go.disabled=false;});}
    d.querySelector('#login-msg').textContent='';if(d.showModal)d.showModal();else d.setAttribute('open','');}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ui);else ui();
  if(sb)sb.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_IN'&&location.hash.indexOf('access_token')>=0){history.replaceState(null,'',location.pathname);location.reload();}});
})();
