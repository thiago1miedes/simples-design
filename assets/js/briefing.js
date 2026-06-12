/* ============================================================
   BRIEFING — formulário multi-step + envio ao Supabase
   Vanilla JS, sem frameworks.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Supabase client ---------- */
  var supa = null;
  try {
    if (window.supabase && typeof SUPABASE_URL === "string" && SUPABASE_URL.indexOf("COLE_SUA") === -1) {
      supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  } catch (e) { /* config ausente — tratado no submit */ }

  var reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches;

  /* ---------- barra de progresso (scroll) ---------- */
  var progress = document.getElementById("progress");
  function onScroll() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    progress.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + "%";
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- reveal no scroll (mesmo padrão do index) ---------- */
  var revealEls = [].slice.call(document.querySelectorAll(".reveal"));
  if (reduce || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("in-view"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in-view"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ---------- elementos ---------- */
  var form = document.getElementById("briefingForm");
  var panels = [].slice.call(form.querySelectorAll(".step-panel"));
  var stepper = document.getElementById("stepper");
  var nodes = [].slice.call(stepper.querySelectorAll(".node"));
  var bars = [].slice.call(stepper.querySelectorAll(".bar"));
  var svcGrid = document.getElementById("svcGrid");
  var svcCards = [].slice.call(svcGrid.querySelectorAll(".svc-card"));
  var svcError = document.getElementById("svcError");
  var sendError = document.getElementById("sendError");
  var submitBtn = document.getElementById("submitBtn");
  var successScreen = document.getElementById("bfSuccess");
  var current = 1;

  /* ---------- WhatsApp: máscara brasileira ---------- */
  var whats = document.getElementById("whatsapp");
  whats.addEventListener("input", function () {
    var v = whats.value.replace(/\D/g, "").slice(0, 11);
    var out = "";
    if (v.length > 0) out = "(" + v.slice(0, 2);
    if (v.length >= 3) out += ") " + v.slice(2, 7);
    if (v.length >= 8) out += "-" + v.slice(7, 11);
    whats.value = out;
  });

  /* ---------- limpa estado inválido ao editar ---------- */
  [].slice.call(form.querySelectorAll("[required]")).forEach(function (input) {
    var clear = function () { setInvalid(input, false); };
    input.addEventListener("input", clear);
    input.addEventListener("change", clear);
  });
  function setInvalid(field, invalid) {
    var w = field.closest(".field");
    if (w) w.classList.toggle("invalid", invalid);
  }

  /* ---------- cards de serviço: seleção (combo é exclusivo) ---------- */
  function selectedServices() {
    return svcCards.filter(function (c) { return c.querySelector("input").checked; })
                   .map(function (c) { return c.getAttribute("data-svc"); });
  }
  svcCards.forEach(function (card) {
    var input = card.querySelector("input");
    // o <label> alterna o checkbox nativamente; reagimos ao change
    input.addEventListener("change", function () {
      applyExclusive(card, input);
    });
  });
  function applyExclusive(card, input) {
    var svc = card.getAttribute("data-svc");
    if (svc === "combo" && input.checked) {
      // combo selecionado → desmarca os demais
      svcCards.forEach(function (c) {
        if (c !== card) { c.querySelector("input").checked = false; }
      });
    } else if (svc !== "combo" && input.checked) {
      // qualquer outro selecionado → desmarca o combo
      svcCards.forEach(function (c) {
        if (c.getAttribute("data-svc") === "combo") c.querySelector("input").checked = false;
      });
    }
    syncSvcUI();
  }
  function syncSvcUI() {
    svcCards.forEach(function (c) {
      c.classList.toggle("selected", c.querySelector("input").checked);
    });
    if (selectedServices().length) svcError.style.display = "none";
  }

  /* ---------- pílulas (choice): estado visual ---------- */
  [].slice.call(document.querySelectorAll(".choice input")).forEach(function (inp) {
    var refresh = function () {
      var label = inp.closest(".choice");
      if (inp.type === "radio") {
        // limpa irmãos do mesmo name
        [].slice.call(document.getElementsByName(inp.name)).forEach(function (sib) {
          var l = sib.closest(".choice");
          if (l) l.classList.toggle("selected", sib.checked);
        });
      } else {
        label.classList.toggle("selected", inp.checked);
      }
    };
    inp.addEventListener("change", refresh);
  });

  /* ============================================================
     Navegação entre steps
     ============================================================ */
  function showStep(n) {
    current = n;
    panels.forEach(function (p) {
      p.classList.toggle("active", parseInt(p.getAttribute("data-step"), 10) === n);
    });
    // stepper visual
    nodes.forEach(function (node) {
      var idx = parseInt(node.getAttribute("data-node"), 10);
      node.classList.toggle("active", idx === n);
      node.classList.toggle("done", idx < n);
    });
    bars.forEach(function (bar) {
      var idx = parseInt(bar.getAttribute("data-bar"), 10);
      bar.classList.toggle("filled", idx < n);
    });
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  function validateStep1() {
    var ok = true, first = null;
    [].slice.call(panels[0].querySelectorAll("[required]")).forEach(function (input) {
      var valid = input.checkValidity() && input.value.trim() !== "";
      setInvalid(input, !valid);
      if (!valid) { ok = false; if (!first) first = input; }
    });
    if (first) first.focus();
    return ok;
  }
  function validateStep2() {
    if (!selectedServices().length) {
      svcError.style.display = "block";
      return false;
    }
    return true;
  }

  form.addEventListener("click", function (e) {
    var nextBtn = e.target.closest("[data-next]");
    var prevBtn = e.target.closest("[data-prev]");
    if (nextBtn) {
      if (current === 1 && !validateStep1()) return;
      if (current === 2) {
        if (!validateStep2()) return;
        buildStep3();
      }
      showStep(current + 1);
    } else if (prevBtn) {
      showStep(current - 1);
    }
  });

  /* ---------- step 3: mostra apenas as seções relevantes ---------- */
  function buildStep3() {
    var svcs = selectedServices();
    var show = {
      site: svcs.indexOf("site") !== -1 || svcs.indexOf("combo") !== -1,
      identidade: svcs.indexOf("identidade") !== -1 || svcs.indexOf("combo") !== -1,
      social: svcs.indexOf("social") !== -1 || svcs.indexOf("combo") !== -1
    };
    ["site", "identidade", "social"].forEach(function (key) {
      var sec = form.querySelector('.dyn-section[data-section="' + key + '"]');
      if (sec) sec.hidden = !show[key];
    });
  }

  /* ============================================================
     Coleta de dados + envio
     ============================================================ */
  function collectChecks(wrapperAttr) {
    var wrap = form.querySelector('[' + wrapperAttr + ']');
    if (!wrap) return "";
    return [].slice.call(wrap.querySelectorAll("input:checked"))
             .map(function (i) { return i.value; }).join(", ");
  }
  function val(id) {
    var el = document.getElementById(id);
    return el && el.value.trim() ? el.value.trim() : null;
  }
  function radioVal(name) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : null;
  }

  function buildPayload() {
    var svcs = selectedServices();
    return {
      nome: val("nome"),
      email: val("email"),
      whatsapp: val("whatsapp"),
      empresa: val("empresa"),
      servico: svcs.join(","),

      // Site
      site_objetivo: val("site_objetivo"),
      site_paginas: val("site_paginas"),
      site_referencias: val("site_referencias"),
      site_tem_dominio: radioVal("site_tem_dominio"),
      site_prazo: val("site_prazo"),
      site_orcamento: val("site_orcamento"),

      // Identidade
      id_segmento: val("id_segmento"),
      id_publico: val("id_publico"),
      id_personalidade: collectChecks('data-check="id_personalidade"') || null,
      id_cores: val("id_cores"),
      id_referencias: val("id_referencias"),
      id_tem_logo: radioVal("id_tem_logo"),
      id_prazo: val("id_prazo"),
      id_orcamento: val("id_orcamento"),

      // Social
      social_plataformas: collectChecks('data-check="social_plataformas"') || null,
      social_frequencia: val("social_frequencia"),
      social_objetivo: collectChecks('data-check="social_objetivo"') || null,
      social_tom: collectChecks('data-check="social_tom"') || null,
      social_referencias: val("social_referencias"),
      social_prazo: val("social_prazo"),
      social_orcamento: val("social_orcamento"),

      // Geral
      informacoes_extras: val("informacoes_extras")
    };
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    sendError.classList.remove("show");

    if (!supa) {
      sendError.querySelector("span").textContent =
        "Configuração do Supabase ausente. Preencha assets/js/supabase-config.js.";
      sendError.classList.add("show");
      return;
    }

    submitBtn.classList.add("loading");
    submitBtn.disabled = true;

    supa.from("briefings").insert([buildPayload()]).then(function (res) {
      submitBtn.classList.remove("loading");
      submitBtn.disabled = false;
      if (res.error) {
        console.error("Supabase insert error:", res.error);
        sendError.querySelector("span").textContent =
          "Não conseguimos enviar agora. Verifique sua conexão e tente novamente.";
        sendError.classList.add("show");
        return;
      }
      // sucesso
      form.style.display = "none";
      stepper.style.display = "none";
      successScreen.classList.add("show");
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    });
  });
})();
