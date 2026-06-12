/* ============================================================
   FX compartilhado (sem handlers inline; tudo via addEventListener)
   - Transição de página (entrada fade-up + saída wipe)
   - Cursor customizado (ponteiro fino)
   - Botões magnéticos
   - Abertura do Calendly em popup (com fallback)
   ============================================================ */
(function(){
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
  var fine   = window.matchMedia("(pointer:fine)").matches && window.matchMedia("(hover:hover)").matches;

  /* ---------- entrada da página ---------- */
  function reveal(){ document.documentElement.classList.remove("pg-enter"); }
  if(document.readyState === "complete" || document.readyState === "interactive"){ reveal(); }
  else { document.addEventListener("DOMContentLoaded", reveal); }
  window.addEventListener("pageshow", reveal);        /* volta do histórico */
  setTimeout(reveal, 1200);                            /* segurança */

  /* ---------- transição de saída (wipe) ---------- */
  var overlay = null;
  if(!reduce){
    overlay = document.createElement("div");
    overlay.className = "pt";
    document.body.appendChild(overlay);
  }

  function isInternalNav(a, e){
    if(!a || !a.getAttribute("href")) return false;
    var href = a.getAttribute("href");
    if(a.target === "_blank" || a.hasAttribute("download")) return false;
    if(a.hasAttribute("data-calendly")) return false;
    if(e && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return false;
    if(href.charAt(0) === "#") return false;                 /* âncora na própria página */
    var url;
    try { url = new URL(a.href, location.href); } catch(_) { return false; }
    if(url.origin !== location.origin) return false;          /* externo */
    if(url.pathname === location.pathname && url.hash) return false; /* âncora mesma página */
    return true;
  }

  document.addEventListener("click", function(e){
    var a = e.target.closest && e.target.closest("a");
    if(!a) return;
    if(reduce || !overlay) return;
    if(!isInternalNav(a, e)) return;
    e.preventDefault();
    var dest = a.href;
    overlay.classList.add("cover");
    setTimeout(function(){ window.location.href = dest; }, 500);
  });

  /* ---------- cursor customizado ---------- */
  if(fine && !reduce){
    var ring = document.createElement("div"); ring.className = "cur";
    var dot  = document.createElement("div"); dot.className  = "cur-dot";
    document.body.appendChild(ring); document.body.appendChild(dot);
    document.documentElement.classList.add("has-cursor");

    var mx = window.innerWidth/2, my = window.innerHeight/2;   /* alvo (mouse) */
    var rx = mx, ry = my;                                      /* ring com lag */
    document.addEventListener("mousemove", function(e){
      mx = e.clientX; my = e.clientY;
      dot.style.transform = "translate("+mx+"px,"+my+"px) translate(-50%,-50%)";
    }, {passive:true});

    (function loop(){
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      ring.style.transform = "translate("+rx+"px,"+ry+"px) translate(-50%,-50%)";
      requestAnimationFrame(loop);
    })();

    var growSel = "a,button,.case,.filter,summary,.qa-q,input,textarea,select,.plan,.tool";
    document.addEventListener("mouseover", function(e){
      if(e.target.closest && e.target.closest(growSel)) ring.classList.add("grow");
    });
    document.addEventListener("mouseout", function(e){
      if(e.target.closest && e.target.closest(growSel)) ring.classList.remove("grow");
    });
    document.addEventListener("mouseleave", function(){ ring.style.opacity = "0"; dot.style.opacity = "0"; });
    document.addEventListener("mouseenter", function(){ ring.style.opacity = ""; dot.style.opacity = ""; });
  }

  /* ---------- botões magnéticos ---------- */
  if(fine && !reduce){
    var magnets = [].slice.call(document.querySelectorAll(".btn, [data-magnetic]"));
    magnets.forEach(function(el){
      var strength = el.classList.contains("btn") ? 0.35 : 0.25;
      el.addEventListener("mousemove", function(e){
        var r = el.getBoundingClientRect();
        var x = e.clientX - (r.left + r.width/2);
        var y = e.clientY - (r.top + r.height/2);
        el.style.transform = "translate("+(x*strength)+"px,"+(y*strength)+"px)";
      });
      el.addEventListener("mouseleave", function(){
        el.style.transform = "";
      });
    });
  }

  /* ---------- Calendly (popup) ---------- */
  window.openCalendly = function(){
    var url = document.body.getAttribute("data-calendly") || "";
    var ready = window.Calendly && url && url.indexOf("SEU-USUARIO") === -1;
    if(ready){
      window.Calendly.initPopupWidget({ url: url });
      return;
    }
    /* fallback: rola até o contato (ou navega para a home + contato) */
    var c = document.getElementById("contato");
    if(c){ c.scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); }
    else { window.location.href = "index.html#contato"; }
  };
  [].slice.call(document.querySelectorAll("[data-calendly]:not(body)")).forEach(function(el){
    el.addEventListener("click", function(e){
      e.preventDefault();
      window.openCalendly();
    });
  });
})();
