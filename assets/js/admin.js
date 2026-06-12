/* ============================================================
   ADMIN — dashboard de briefings (login + listagem + status)
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
  } catch (e) { /* config ausente */ }

  /* ---------- elementos ---------- */
  var loginView = document.getElementById("loginView");
  var dashView = document.getElementById("dashView");
  var loginForm = document.getElementById("loginForm");
  var loginBtn = document.getElementById("loginBtn");
  var loginError = document.getElementById("loginError");
  var loginErrorMsg = document.getElementById("loginErrorMsg");
  var userName = document.getElementById("userName");
  var logoutBtn = document.getElementById("logoutBtn");

  var skeletonGrid = document.getElementById("skeletonGrid");
  var cardsGrid = document.getElementById("cardsGrid");
  var emptyState = document.getElementById("emptyState");
  var emptyMsg = document.getElementById("emptyMsg");
  var tabs = [].slice.call(document.querySelectorAll(".tab"));
  var searchInput = document.getElementById("searchInput");

  var allBriefings = [];
  var activeFilter = "all";
  var searchTerm = "";

  var STATUS_LABELS = {
    novo: "Novo",
    em_analise: "Em análise",
    respondido: "Respondido",
    arquivado: "Arquivado"
  };
  var SVC_LABELS = {
    site: "Site",
    identidade: "Identidade",
    social: "Social",
    combo: "Combo"
  };

  /* ============================================================
     AUTENTICAÇÃO
     ============================================================ */
  function showLoginConfigError() {
    loginErrorMsg.textContent = "Configuração do Supabase ausente. Preencha assets/js/supabase-config.js.";
    loginError.classList.add("show");
  }

  function enterDashboard(user) {
    var name = "equipe";
    if (user) {
      var meta = user.user_metadata || {};
      name = meta.name || meta.full_name || (user.email ? user.email.split("@")[0] : "equipe");
    }
    userName.textContent = name;
    loginView.style.display = "none";
    dashView.classList.add("show");
    loadBriefings();
  }

  // já autenticado? vai direto pro dashboard
  if (supa) {
    supa.auth.getSession().then(function (res) {
      if (res.data && res.data.session) {
        enterDashboard(res.data.session.user);
      }
    });
  }

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    loginError.classList.remove("show");

    if (!supa) { showLoginConfigError(); return; }

    var email = document.getElementById("loginEmail").value.trim();
    var pass = document.getElementById("loginPass").value;
    if (!email || !pass) {
      loginErrorMsg.textContent = "Preencha e-mail e senha.";
      loginError.classList.add("show");
      return;
    }

    loginBtn.classList.add("loading");
    loginBtn.disabled = true;

    supa.auth.signInWithPassword({ email: email, password: pass }).then(function (res) {
      loginBtn.classList.remove("loading");
      loginBtn.disabled = false;
      if (res.error) {
        loginErrorMsg.textContent = "E-mail ou senha incorretos.";
        loginError.classList.add("show");
        return;
      }
      enterDashboard(res.data.user);
    });
  });

  logoutBtn.addEventListener("click", function () {
    if (!supa) return;
    supa.auth.signOut().then(function () {
      dashView.classList.remove("show");
      loginView.style.display = "grid";
      document.getElementById("loginPass").value = "";
      allBriefings = [];
    });
  });

  /* ============================================================
     CARREGAMENTO DOS BRIEFINGS
     ============================================================ */
  function loadBriefings() {
    skeletonGrid.style.display = "grid";
    cardsGrid.style.display = "none";
    emptyState.classList.remove("show");

    supa.from("briefings").select("*").order("created_at", { ascending: false }).then(function (res) {
      skeletonGrid.style.display = "none";
      if (res.error) {
        console.error("Erro ao buscar briefings:", res.error);
        emptyMsg.textContent = "Erro ao carregar os briefings. Recarregue a página.";
        emptyState.classList.add("show");
        return;
      }
      allBriefings = res.data || [];
      updateCounts();
      render();
    });
  }

  /* ---------- contadores das tabs ---------- */
  function updateCounts() {
    var counts = { all: allBriefings.length, novo: 0, em_analise: 0, respondido: 0, arquivado: 0 };
    allBriefings.forEach(function (b) {
      var st = b.status || "novo";
      if (counts[st] !== undefined) counts[st]++;
    });
    Object.keys(counts).forEach(function (k) {
      var el = document.querySelector('[data-count="' + k + '"]');
      if (el) el.textContent = counts[k];
    });
  }

  /* ---------- filtro + busca ---------- */
  function getFiltered() {
    return allBriefings.filter(function (b) {
      var st = b.status || "novo";
      if (activeFilter !== "all" && st !== activeFilter) return false;
      if (searchTerm) {
        var hay = ((b.nome || "") + " " + (b.email || "")).toLowerCase();
        if (hay.indexOf(searchTerm) === -1) return false;
      }
      return true;
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      activeFilter = tab.getAttribute("data-filter");
      render();
    });
  });

  searchInput.addEventListener("input", function () {
    searchTerm = searchInput.value.trim().toLowerCase();
    render();
  });

  /* ============================================================
     RENDER
     ============================================================ */
  function render() {
    var list = getFiltered();
    cardsGrid.innerHTML = "";

    if (!list.length) {
      cardsGrid.style.display = "none";
      emptyState.classList.add("show");
      if (!allBriefings.length) emptyMsg.textContent = "Nenhum briefing recebido ainda.";
      else if (searchTerm) emptyMsg.textContent = "Nenhum briefing encontrado para essa busca.";
      else emptyMsg.textContent = "Nenhum briefing com esse status.";
      return;
    }

    emptyState.classList.remove("show");
    cardsGrid.style.display = "grid";

    list.forEach(function (b, i) {
      var card = buildCard(b);
      cardsGrid.appendChild(card);
      // fade-in com stagger (50ms por card)
      (function (el, delay) {
        setTimeout(function () { el.classList.add("in"); }, delay);
      })(card, i * 50);
    });
  }

  /* ---------- helpers de formatação ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    var meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    var hh = ("0" + d.getHours()).slice(-2);
    var mm = ("0" + d.getMinutes()).slice(-2);
    return d.getDate() + " " + meses[d.getMonth()] + " " + d.getFullYear() + " às " + hh + "h" + mm;
  }
  function servicesOf(b) {
    return String(b.servico || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  }

  /* ---------- monta um card ---------- */
  function buildCard(b) {
    var card = document.createElement("article");
    card.className = "bcard";
    var status = b.status || "novo";
    card.setAttribute("data-status", status);

    var svcs = servicesOf(b);
    var badges = svcs.map(function (s) {
      return '<span class="svc-badge ' + esc(s) + '">' + esc(SVC_LABELS[s] || s) + "</span>";
    }).join("");

    var statusOpts = Object.keys(STATUS_LABELS).map(function (k) {
      return '<option value="' + k + '"' + (k === status ? " selected" : "") + ">" + STATUS_LABELS[k] + "</option>";
    }).join("");

    var whatsLink = "";
    if (b.whatsapp) {
      var digits = String(b.whatsapp).replace(/\D/g, "");
      whatsLink =
        '<a href="https://wa.me/55' + digits + '" target="_blank" rel="noopener">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15.46v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.11 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 21 15.46z"/></svg>' +
        esc(b.whatsapp) + "</a>";
    }

    card.innerHTML =
      '<div class="bcard-top">' +
        '<div class="svc-badges">' + (badges || '<span class="svc-badge combo">—</span>') + "</div>" +
        '<span class="bcard-date">' + esc(fmtDate(b.created_at)) + "</span>" +
      "</div>" +
      "<h3>" + esc(b.nome || "Sem nome") + "</h3>" +
      '<div class="bcard-contact">' +
        '<a href="mailto:' + esc(b.email) + '">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>' +
          esc(b.email) + "</a>" +
        whatsLink +
      "</div>" +
      '<div class="bcard-foot">' +
        '<select class="status-select" aria-label="Mudar status">' + statusOpts + "</select>" +
        '<button class="btn-details" type="button">Ver detalhes' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>' +
        "</button>" +
      "</div>" +
      '<div class="bcard-details">' + buildDetails(b) + "</div>";

    // toggle detalhes
    card.querySelector(".btn-details").addEventListener("click", function () {
      card.classList.toggle("open");
    });

    // mudança de status
    var sel = card.querySelector(".status-select");
    sel.addEventListener("change", function () {
      var newStatus = sel.value;
      var prev = b.status;
      b.status = newStatus;
      card.setAttribute("data-status", newStatus);
      updateCounts();
      supa.from("briefings").update({ status: newStatus }).eq("id", b.id).then(function (res) {
        if (res.error) {
          console.error("Erro ao atualizar status:", res.error);
          // reverte em caso de falha
          b.status = prev;
          sel.value = prev;
          card.setAttribute("data-status", prev);
          updateCounts();
          alert("Não foi possível atualizar o status. Tente novamente.");
        }
      });
    });

    // copiar e-mail
    var copyBtn = card.querySelector(".copy-email");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var email = copyBtn.getAttribute("data-email");
        var done = function () {
          copyBtn.classList.add("copied");
          var lbl = copyBtn.querySelector("span");
          var old = lbl.textContent;
          lbl.textContent = "Copiado!";
          setTimeout(function () { copyBtn.classList.remove("copied"); lbl.textContent = old; }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(email).then(done, function () {});
        } else {
          var t = document.createElement("textarea");
          t.value = email; document.body.appendChild(t); t.select();
          try { document.execCommand("copy"); done(); } catch (e) {}
          document.body.removeChild(t);
        }
      });
    }

    return card;
  }

  /* ---------- monta as seções de detalhes (só as preenchidas) ---------- */
  function buildDetails(b) {
    var html = "";

    // Contato
    var contato = [
      ["Nome", b.nome],
      ["E-mail", b.email],
      ["WhatsApp", b.whatsapp],
      ["Empresa / projeto", b.empresa]
    ];
    html += section("Dados de contato", contato,
      '<button class="copy-btn copy-email" type="button" data-email="' + esc(b.email) + '">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>' +
        "<span>Copiar e-mail</span></button>");

    // Site
    html += section("Site / Landing Page", [
      ["Objetivo principal", b.site_objetivo],
      ["Páginas imaginadas", b.site_paginas],
      ["Referências", b.site_referencias],
      ["Domínio/hospedagem", b.site_tem_dominio],
      ["Prazo", b.site_prazo],
      ["Orçamento", b.site_orcamento]
    ]);

    // Identidade
    html += section("Identidade Visual", [
      ["Segmento", b.id_segmento],
      ["Público-alvo", b.id_publico],
      ["Personalidade da marca", b.id_personalidade],
      ["Preferência de cores", b.id_cores],
      ["Referências visuais", b.id_referencias],
      ["Já tem logo?", b.id_tem_logo],
      ["Prazo", b.id_prazo],
      ["Orçamento", b.id_orcamento]
    ]);

    // Social
    html += section("Redes Sociais", [
      ["Plataformas", b.social_plataformas],
      ["Frequência", b.social_frequencia],
      ["Objetivo", b.social_objetivo],
      ["Tom de comunicação", b.social_tom],
      ["Referências de perfis", b.social_referencias],
      ["Prazo", b.social_prazo],
      ["Orçamento", b.social_orcamento]
    ]);

    // Extras
    html += section("Informações extras", [
      ["Observações", b.informacoes_extras]
    ]);

    return html;
  }

  function section(title, rows, extraHtml) {
    var filled = rows.filter(function (r) { return r[1] != null && String(r[1]).trim() !== ""; });
    if (!filled.length) return "";
    var inner = filled.map(function (r) {
      return '<div class="detail-row"><span class="k">' + esc(r[0]) +
             '</span><span class="v">' + esc(r[1]) + "</span></div>";
    }).join("");
    return '<div class="detail-sec"><h4>' + esc(title) + "</h4>" + inner + (extraHtml || "") + "</div>";
  }
})();
