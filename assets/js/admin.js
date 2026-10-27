/* ============================================================
   ADMIN — dashboard de mensagens (briefings + contatos)
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
  var loginView    = document.getElementById("loginView");
  var dashView     = document.getElementById("dashView");
  var loginForm    = document.getElementById("loginForm");
  var loginBtn     = document.getElementById("loginBtn");
  var loginError   = document.getElementById("loginError");
  var loginErrorMsg= document.getElementById("loginErrorMsg");
  var userName     = document.getElementById("userName");
  var logoutBtn    = document.getElementById("logoutBtn");

  var skeletonGrid = document.getElementById("skeletonGrid");
  var cardsGrid    = document.getElementById("cardsGrid");
  var emptyState   = document.getElementById("emptyState");
  var emptyMsg     = document.getElementById("emptyMsg");
  var tabs         = [].slice.call(document.querySelectorAll(".tab"));
  var searchInput  = document.getElementById("searchInput");

  /* drawer */
  var drawer        = document.getElementById("drawer");
  var drawerOverlay = document.getElementById("drawerOverlay");
  var drawerPanel   = document.getElementById("drawerPanel");
  var drawerClose   = document.getElementById("drawerClose");
  var drawerScroll  = document.getElementById("drawerScroll");
  var drawerDate    = document.getElementById("drawerDate");
  var drawerTitle   = document.getElementById("drawerTitle");
  var drawerSub     = document.getElementById("drawerSub");
  var drawerBadges  = document.getElementById("drawerBadges");
  var drawerStatus  = document.getElementById("drawerStatus");
  var drawerLinks   = document.getElementById("drawerLinks");
  var drawerBody    = document.getElementById("drawerBody");

  /* confirmação de exclusão */
  var deleteModal       = document.getElementById("deleteModal");
  var deleteOverlay     = document.getElementById("deleteOverlay");
  var deleteDialog      = document.getElementById("deleteDialog");
  var deleteName        = document.getElementById("deleteName");
  var deleteFilesInfo   = document.getElementById("deleteFilesInfo");
  var deleteError       = document.getElementById("deleteError");
  var deleteProgress    = document.getElementById("deleteProgress");
  var deleteCancel      = document.getElementById("deleteCancel");
  var deleteConfirmBtn  = document.getElementById("deleteConfirmButton");

  var allItems    = [];
  var activeFilter = "all";
  var searchTerm   = "";
  var cardByKey    = {};

  var drawerItem        = null;
  var drawerFiles       = [];
  var drawerToken       = 0;
  var drawerReturnFocus = null;
  var drawerCloseTimer  = null;
  var deleteItem        = null;
  var deleteReturnFocus = null;
  var deleteBusy        = false;

  var BUCKET     = "briefing-arquivos";
  var URL_TTL    = 3600;

  var STATUS_LABELS = {
    novo:        "Novo",
    em_analise:  "Em análise",
    respondido:  "Respondido",
    arquivado:   "Arquivado"
  };
  var SVC_LABELS = {
    site: "Site", identidade: "Identidade", social: "Social", combo: "Combo"
  };
  var TIPO_CSS = {
    site: "site", marca: "identidade", social: "social", combo: "combo", outro: "combo"
  };
  var TIPO_LABELS = {
    site: "Site", marca: "Marca", social: "Social", combo: "Combo", outro: "Outro"
  };

  /* arquivos — categorias (slots) do briefing */
  var SLOT_ORDER  = ["logo", "manual", "materiais", "site_conteudo", "fotos", "referencias", "outros"];
  var SLOT_LABELS = {
    logo:          "Logo atual",
    manual:        "Manual de marca",
    materiais:     "Materiais atuais",
    site_conteudo: "Conteúdo do site",
    fotos:         "Fotos da empresa",
    referencias:   "Imagens de referência",
    outros:        "Outros arquivos"
  };
  var IMG_EXT     = { png: 1, jpg: 1, jpeg: 1, webp: 1, gif: 1, avif: 1, svg: 1 };
  var PREVIEW_EXT = { pdf: 1, txt: 1, mp4: 1 };
  var CONTAIN_SLOTS = { logo: 1, manual: 1 };

  /* redes sociais — normalização de @handle */
  var HANDLE_RE = /^[A-Za-z0-9._-]{1,100}$/;
  var NETS = {
    site:      { dom: [], handle: null },
    instagram: { dom: ["instagram.com", "instagr.am"], handle: function (h) { return "https://instagram.com/" + h; } },
    tiktok:    { dom: ["tiktok.com"], handle: function (h) { return "https://www.tiktok.com/@" + h; } },
    facebook:  { dom: ["facebook.com", "fb.com", "fb.me"], handle: function (h) { return "https://facebook.com/" + h; } },
    youtube:   { dom: ["youtube.com", "youtu.be"], handle: function (h) { return "https://www.youtube.com/@" + h; } },
    linkedin:  { dom: ["linkedin.com", "lnkd.in"], handle: null }
  };

  /* ---------- ícones ---------- */
  var SVG_OPEN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var ICON = {
    mail:  SVG_OPEN + '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
    phone: SVG_OPEN + '<path d="M21 15.46v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.11 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 21 15.46z"/></svg>',
    clip:  SVG_OPEN + '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
    copy:  SVG_OPEN + '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
    chat:  SVG_OPEN + '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
    send:  SVG_OPEN + '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
    panel: SVG_OPEN + '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="m8 9 3 3-3 3"/></svg>',
    down:  SVG_OPEN + '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>',
    ext:   SVG_OPEN + '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
    alert: SVG_OPEN + '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>',
    trash: SVG_OPEN + '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>'
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
    loadAll();
  }

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
    var pass  = document.getElementById("loginPass").value;
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
      closeDrawer(true);
      dashView.classList.remove("show");
      loginView.style.display = "grid";
      document.getElementById("loginPass").value = "";
      allItems = [];
    });
  });

  /* ============================================================
     CARREGAMENTO PARALELO — contatos + briefings
     ============================================================ */
  function loadAll() {
    skeletonGrid.style.display = "grid";
    cardsGrid.style.display    = "none";
    emptyState.classList.remove("show");

    Promise.all([
      supa.from("contatos").select("*").order("created_at", { ascending: false }),
      supa.from("briefings").select("*").order("created_at", { ascending: false })
    ]).then(function (results) {
      skeletonGrid.style.display = "none";

      if (results[0].error || results[1].error) {
        console.error("Erro ao buscar dados:", results[0].error || results[1].error);
        emptyMsg.textContent = "Erro ao carregar os dados. Recarregue a página.";
        emptyState.classList.add("show");
        return;
      }

      var contatos  = (results[0].data || []).map(function (c) {
        return Object.assign({}, c, { _origem: "contato" });
      });
      var briefings = (results[1].data || []).map(function (b) {
        return Object.assign({}, b, { _origem: "briefing" });
      });

      allItems = contatos.concat(briefings).sort(function (a, b) {
        return new Date(b.created_at) - new Date(a.created_at);
      });

      updateCounts();
      render();
    });
  }

  /* ---------- contadores das tabs ---------- */
  function updateCounts() {
    var counts = { all: allItems.length, novo: 0, em_analise: 0, respondido: 0, arquivado: 0 };
    allItems.forEach(function (item) {
      var st = item.status || "novo";
      if (counts[st] !== undefined) counts[st]++;
    });
    Object.keys(counts).forEach(function (k) {
      var el = document.querySelector('[data-count="' + k + '"]');
      if (el) el.textContent = counts[k];
    });
  }

  /* ---------- filtro + busca ---------- */
  function getFiltered() {
    return allItems.filter(function (item) {
      var st = item.status || "novo";
      if (activeFilter !== "all" && st !== activeFilter) return false;
      if (searchTerm) {
        var hay = [item.nome, item.email, item.empresa, item.segmento, item.id_segmento]
          .map(function (v) { return v == null ? "" : String(v); })
          .join(" ").toLowerCase();
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
    cardByKey = {};

    if (!list.length) {
      cardsGrid.style.display = "none";
      emptyState.classList.add("show");
      if (!allItems.length)   emptyMsg.textContent = "Nenhuma mensagem recebida ainda.";
      else if (searchTerm)    emptyMsg.textContent = "Nenhuma mensagem encontrada para essa busca.";
      else                    emptyMsg.textContent = "Nenhuma mensagem com esse status.";
      return;
    }

    emptyState.classList.remove("show");
    cardsGrid.style.display = "grid";

    list.forEach(function (item, i) {
      var card = buildCard(item);
      cardByKey[keyOf(item)] = card;
      cardsGrid.appendChild(card);
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
    if (isNaN(d.getTime())) return "";
    var meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
    var hh = ("0" + d.getHours()).slice(-2);
    var mm = ("0" + d.getMinutes()).slice(-2);
    return d.getDate() + " " + meses[d.getMonth()] + " " + d.getFullYear() + " às " + hh + "h" + mm;
  }
  function fmtSize(bytes) {
    var n = Number(bytes);
    if (!isFinite(n) || n <= 0) return "";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + " KB";
    return (n / (1024 * 1024)).toFixed(1).replace(".", ",") + " MB";
  }
  function filled(v) {
    return v != null && String(v).trim() !== "";
  }
  function pick(a, b) {
    return filled(a) ? a : (filled(b) ? b : null);
  }
  function plural(n, one, many) {
    return n + " " + (n === 1 ? one : many);
  }
  function keyOf(item) {
    return item._origem + ":" + item.id;
  }
  function tableOf(item) {
    return item._origem === "contato" ? "contatos" : "briefings";
  }
  function servicesOf(b) {
    return String(b.servico || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function isEmail(v) {
    return /^[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+\.[^\s@<>"'(),;:]+$/.test(String(v || "").trim());
  }
  function waHref(phone) {
    var digits = String(phone || "").replace(/\D/g, "");
    if (digits.length < 8) return null;
    if (!(digits.length >= 12 && digits.indexOf("55") === 0)) digits = "55" + digits;
    return "https://wa.me/" + digits;
  }
  function statusOptions(current) {
    return Object.keys(STATUS_LABELS).map(function (k) {
      return '<option value="' + k + '"' + (k === current ? " selected" : "") + ">" + STATUS_LABELS[k] + "</option>";
    }).join("");
  }
  function svcBadgesHtml(item) {
    return servicesOf(item).map(function (s) {
      var css = SVC_LABELS[s] ? s : "combo";
      return '<span class="svc-badge ' + css + '">' + esc(SVC_LABELS[s] || s) + "</span>";
    }).join("");
  }
  function filesPillHtml(n) {
    if (!n) return "";
    return '<span class="files-pill" title="Arquivos enviados no briefing">' + ICON.clip + plural(n, "arquivo", "arquivos") + "</span>";
  }

  /* ---------- links seguros ---------- */
  /* só aceita http/https com host válido; devolve href normalizado ou null */
  function safeHttpUrl(u) {
    if (!u) return null;
    var p;
    try { p = new URL(String(u)); } catch (e) { return null; }
    if (p.protocol !== "http:" && p.protocol !== "https:") return null;
    if (!p.hostname || p.hostname.indexOf(".") === -1) return null;
    return p.href;
  }
  function hasDomain(lower, list) {
    for (var i = 0; i < list.length; i++) {
      if (lower.indexOf(list[i]) !== -1) return true;
    }
    return false;
  }
  /* normaliza o que o cliente digitou (@handle, "instagram.com/x", "site.com.br") */
  function normalizeLink(raw, net) {
    var s = String(raw == null ? "" : raw).trim();
    if (!s || /\s/.test(s)) return null;
    var cfg = NETS[net] || null;

    if (s.charAt(0) === "@") {
      var h = s.replace(/^@+/, "");
      if (!HANDLE_RE.test(h) || !cfg || !cfg.handle) return null;
      return cfg.handle(h);
    }
    /* "minhaloja" ou "minha.loja" no campo de uma rede = handle sem @ */
    if (cfg && cfg.handle && s.indexOf("/") === -1 && HANDLE_RE.test(s) && !hasDomain(s.toLowerCase(), cfg.dom)) {
      return cfg.handle(s);
    }
    var url = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : "https://" + s.replace(/^\/+/, "");
    return safeHttpUrl(url);
  }
  function linkTag(href, text) {
    return '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(text) + "</a>";
  }
  /* texto livre → escapa tudo e transforma URLs http(s)/www em links */
  function linkify(text) {
    var s = String(text == null ? "" : text);
    var re = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
    var out = "";
    var last = 0;
    var m;
    while ((m = re.exec(s)) !== null) {
      var url = m[0];
      var trail = "";
      /* remove pontuação final que não faz parte do link */
      while (url.length) {
        var c = url.charAt(url.length - 1);
        if (".,;:!?]}»".indexOf(c) !== -1 ||
            (c === ")" && url.split("(").length < url.split(")").length)) {
          trail = c + trail;
          url = url.slice(0, -1);
        } else break;
      }
      out += esc(s.slice(last, m.index));
      var href = safeHttpUrl(/^https?:\/\//i.test(url) ? url : "https://" + url);
      out += href ? linkTag(href, url) : esc(url);
      out += esc(trail);
      last = m.index + m[0].length;
    }
    return out + esc(s.slice(last));
  }
  /* um link por linha (ex.: "Outros links") — linha "solta" vira link se for um endereço */
  function linkLines(text) {
    return String(text).split(/\r?\n/).map(function (line) {
      var t = line.trim();
      if (!t) return "";
      var href = /\s/.test(t) ? null : normalizeLink(t, null);
      return href ? linkTag(href, t) : linkify(t);
    }).filter(Boolean).join("\n");
  }

  /* ---------- toast ---------- */
  var toastEl = document.createElement("div");
  toastEl.className = "toast";
  toastEl.setAttribute("role", "status");
  toastEl.setAttribute("aria-live", "polite");
  document.body.appendChild(toastEl);
  var toastTimer = null;
  function toast(msg, kind) {
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.className = "toast show" + (kind ? " " + kind : "");
    toastTimer = setTimeout(function () { toastEl.className = "toast" + (kind ? " " + kind : ""); }, 3600);
  }

  /* ---------- excluir briefing (confirmação + Supabase) ---------- */
  function isDeleteConfirmOpen() {
    return !deleteModal.hidden;
  }

  function storagePathsForBriefing(item) {
    var refs = filesOf(item);
    var paths = [];
    var seen = Object.create(null);
    var invalid = false;
    var prefix = item && item.id ? String(item.id) + "/" : "";

    refs.forEach(function (f) {
      var path = String(f.path || "").trim();
      var parts = path.split("/");
      if (!prefix || path.indexOf(prefix) !== 0 || path.indexOf("\\") !== -1 ||
          parts.length < 2 || parts.some(function (part) { return part === "." || part === ".."; })) {
        invalid = true;
        return;
      }
      if (!seen[path]) { seen[path] = true; paths.push(path); }
    });

    return { paths: paths, invalid: invalid };
  }

  function removeBriefingFiles(item) {
    var refs = filesOf(item);
    var found = storagePathsForBriefing(item);
    if (!found.paths.length) return Promise.resolve({ warning: found.invalid || refs.length > 0 });

    var req;
    try { req = supa.storage.from(BUCKET).remove(found.paths); }
    catch (e) { return Promise.resolve({ warning: true }); }

    return Promise.resolve(req).then(function (res) {
      return { warning: found.invalid || !!(res && res.error) };
    }, function () {
      return { warning: true };
    });
  }

  function openDeleteConfirm(item, trigger) {
    if (!item || item._origem !== "briefing") return;
    if (!supa) { toast("Não foi possível conectar ao Supabase.", "error"); return; }

    deleteItem = item;
    deleteReturnFocus = trigger || document.activeElement;
    deleteName.textContent = item.nome || item.empresa || "Sem nome";
    var fileCount = filesOf(item).length;
    deleteFilesInfo.hidden = !fileCount;
    deleteFilesInfo.textContent = fileCount
      ? "Os " + plural(fileCount, "anexo também será excluído", "anexos também serão excluídos") + " do Storage."
      : "";
    deleteDialog.setAttribute("aria-describedby", fileCount
      ? "deleteMessage deleteFilesInfo"
      : "deleteMessage");
    deleteError.hidden = true;
    deleteError.textContent = "";
    deleteProgress.hidden = true;
    deleteProgress.textContent = "";
    deleteCancel.disabled = false;
    deleteConfirmBtn.disabled = false;
    deleteConfirmBtn.textContent = "Excluir briefing";

    deleteModal.hidden = false;
    dashView.setAttribute("aria-hidden", "true");
    dashView.setAttribute("inert", "");
    void deleteModal.offsetWidth;
    focusEl(deleteCancel);                 /* foco inicial na opção segura */
  }

  function closeDeleteConfirm(restoreFocus) {
    if (deleteBusy || deleteModal.hidden) return;
    deleteModal.hidden = true;
    dashView.removeAttribute("aria-hidden");
    dashView.removeAttribute("inert");

    var back = deleteReturnFocus;
    deleteItem = null;
    deleteReturnFocus = null;
    if (restoreFocus && back && document.body.contains(back)) focusEl(back);
  }

  function setDeleteBusy(on) {
    deleteBusy = on;
    deleteCancel.disabled = on;
    deleteConfirmBtn.disabled = on;
    deleteConfirmBtn.textContent = on ? "Excluindo…" : "Excluir briefing";
    deleteProgress.hidden = !on;
    deleteProgress.textContent = on ? "Removendo o briefing e limpando os anexos…" : "";
    deleteError.hidden = true;
  }

  function finishBriefingDeletion(item, cleanup, oldIndex) {
    var name = item.nome || item.empresa || "Sem nome";
    var itemKey = keyOf(item);
    allItems = allItems.filter(function (entry) { return keyOf(entry) !== itemKey; });
    updateCounts();
    render();
    setDeleteBusy(false);
    closeDeleteConfirm(false);

    if (cleanup && cleanup.warning) {
      toast("Briefing excluído, mas não foi possível remover todos os anexos do Storage.", "error");
    } else {
      toast("Briefing de “" + name + "” excluído.");
    }

    var visible = getFiltered();
    var nextItem = visible.length ? visible[Math.min(Math.max(oldIndex, 0), visible.length - 1)] : null;
    var nextCard = nextItem ? cardByKey[keyOf(nextItem)] : null;
    var nextFocus = nextCard && (nextCard.querySelector(".btn-delete-briefing") ||
      nextCard.querySelector(".btn-details") || nextCard.querySelector(".status-select"));
    focusEl(nextFocus || emptyState);
  }

  function deleteBriefing() {
    if (deleteBusy || !deleteItem) return;
    var item = deleteItem;
    var oldIndex = allItems.indexOf(item);
    setDeleteBusy(true);

    Promise.resolve()
      .then(function () {
        return supa.from("briefings").delete().eq("id", item.id).select("id").maybeSingle();
      })
      .then(function (res) {
        if (res && res.error) throw res.error;
        if (!res || !res.data || String(res.data.id) !== String(item.id)) {
          throw new Error("O briefing não foi encontrado ou seu usuário não tem permissão para excluí-lo.");
        }
        return removeBriefingFiles(item);
      })
      .then(function (cleanup) {
        finishBriefingDeletion(item, cleanup, oldIndex);
      })
      .catch(function (err) {
        console.error("Erro ao excluir briefing:", err);
        setDeleteBusy(false);
        deleteError.textContent = "Não foi possível excluir o briefing. Verifique sua permissão de administrador e tente novamente.";
        deleteError.hidden = false;
        focusEl(deleteConfirmBtn);
      });
  }

  function deleteDialogFocusables() {
    return [].slice.call(deleteDialog.querySelectorAll("button:not([disabled]), [href], [tabindex]:not([tabindex=\"-1\"])")).filter(function (el) {
      return !el.hidden && el.offsetParent !== null;
    });
  }

  deleteCancel.addEventListener("click", function () { closeDeleteConfirm(true); });
  deleteOverlay.addEventListener("click", function () { closeDeleteConfirm(true); });
  deleteConfirmBtn.addEventListener("click", deleteBriefing);

  document.addEventListener("keydown", function (e) {
    if (!isDeleteConfirmOpen()) return;
    if (e.key === "Escape" || e.key === "Esc") {
      e.preventDefault();
      closeDeleteConfirm(true);
      return;
    }
    if (e.key !== "Tab") return;
    var list = deleteDialogFocusables();
    if (!list.length) { e.preventDefault(); focusEl(deleteDialog); return; }
    var first = list[0];
    var last = list[list.length - 1];
    var active = document.activeElement;
    if (e.shiftKey && (active === first || active === deleteDialog || !deleteDialog.contains(active))) {
      e.preventDefault(); focusEl(last);
    } else if (!e.shiftKey && (active === last || !deleteDialog.contains(active))) {
      e.preventDefault(); focusEl(first);
    }
  });

  /* ---------- copiar para a área de transferência ---------- */
  function copyText(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }
  function fallbackCopy(text, done) {
    var prevFocus = document.activeElement;
    var t = document.createElement("textarea");
    t.value = text;
    t.setAttribute("readonly", "");
    t.style.position = "fixed";
    t.style.opacity = "0";
    (drawerPanel.contains(document.activeElement) ? drawerPanel : document.body).appendChild(t);
    t.select();
    try { if (document.execCommand("copy")) done(); } catch (e) { /* sem suporte */ }
    t.parentNode.removeChild(t);
    focusEl(prevFocus);
  }

  /* ============================================================
     STATUS — sincroniza card, drawer e contadores
     ============================================================ */
  function applyStatusUI(item, st) {
    item.status = st;
    var card = cardByKey[keyOf(item)];
    if (card) {
      card.setAttribute("data-status", st);
      var sel = card.querySelector(".status-select");
      if (sel && sel.value !== st) sel.value = st;
    }
    if (drawerItem === item) {
      if (drawerStatus.value !== st) drawerStatus.value = st;
      drawerPanel.setAttribute("data-status", st);
    }
    updateCounts();
  }

  function setStatus(item, newStatus) {
    var prev = item.status || "novo";
    if (newStatus === prev || !STATUS_LABELS[newStatus]) return;
    if (item._stConfirmed === undefined) item._stConfirmed = prev;   /* último status salvo no banco */
    item._stSeq = (item._stSeq || 0) + 1;
    var seq = item._stSeq;
    applyStatusUI(item, newStatus);

    function fail(err) {
      console.error("Erro ao atualizar status:", err);
      if (seq !== item._stSeq) return;          /* já houve outra mudança depois desta */
      applyStatusUI(item, item._stConfirmed);
      toast("Não foi possível atualizar o status. Tente novamente.", "error");
    }

    /* .select("id") confirma que a linha foi realmente alterada (RLS não devolve erro) */
    supa.from(tableOf(item)).update({ status: newStatus }).eq("id", item.id).select("id").then(function (res) {
      if (res.error || !res.data || !res.data.length) { fail(res.error || "nenhuma linha atualizada"); return; }
      item._stConfirmed = newStatus;
    }, fail);
  }

  /* ---------- monta um card ---------- */
  function buildCard(item) {
    var card   = document.createElement("article");
    card.className = "bcard";
    var status = item.status || "novo";
    var isBriefing = item._origem === "briefing";
    card.setAttribute("data-status", status);

    var origemLabel = item._origem === "contato" ? "Contato" : "Briefing";
    var origemBadge = '<span class="origem-badge ' + esc(item._origem) + '">' + origemLabel + '</span>';

    /* badges de serviço / tipo */
    var topBadges = "";
    if (isBriefing) {
      topBadges = svcBadgesHtml(item);
    } else if (item.tipo) {
      var css = TIPO_CSS[item.tipo] || "combo";
      topBadges = '<span class="svc-badge ' + esc(css) + '">' + esc(TIPO_LABELS[item.tipo] || item.tipo) + "</span>";
    }

    /* empresa · segmento (só briefing) */
    var subLine = "";
    if (isBriefing) {
      var subParts = [item.empresa, pick(item.segmento, item.id_segmento)].filter(filled).map(esc);
      if (subParts.length) subLine = '<p class="bcard-sub">' + subParts.join('<span class="sep" aria-hidden="true">·</span>') + "</p>";
    }

    /* links de contato */
    var contactLinks =
      '<a href="mailto:' + esc(item.email) + '">' + ICON.mail + esc(item.email) + "</a>";

    if (isBriefing && item.whatsapp) {
      var wa = waHref(item.whatsapp);
      contactLinks += wa
        ? '<a href="' + esc(wa) + '" target="_blank" rel="noopener noreferrer">' + ICON.phone + esc(item.whatsapp) + "</a>"
        : '<span class="bcard-phone">' + ICON.phone + esc(item.whatsapp) + "</span>";
    }

    /* indicador de arquivos (só briefing) */
    var nFiles = isBriefing ? filesOf(item).length : 0;
    var filesLine = nFiles ? '<div class="bcard-files">' + filesPillHtml(nFiles) + "</div>" : "";

    /* botão "ver detalhes" só para briefings → abre o drawer */
    var detailsBtn = isBriefing
      ? '<button class="btn-details" type="button" aria-haspopup="dialog" aria-controls="drawerPanel">Ver detalhes' + ICON.panel + "</button>"
      : "";
    var deleteBtn = isBriefing
      ? '<button class="btn-delete-briefing" type="button" aria-haspopup="dialog" aria-controls="deleteDialog" aria-label="Excluir briefing de ' + esc(item.nome || item.empresa || "Sem nome") + '">' + ICON.trash + "<span>Excluir</span></button>"
      : "";

    card.innerHTML =
      '<div class="bcard-top">' +
        '<div class="bcard-badges">' + origemBadge + topBadges + "</div>" +
        '<span class="bcard-date">' + esc(fmtDate(item.created_at)) + "</span>" +
      "</div>" +
      "<h3>" + esc(item.nome || "Sem nome") + "</h3>" +
      subLine +
      '<div class="bcard-contact">' + contactLinks + "</div>" +
      (item._origem === "contato" && item.mensagem
        ? '<p class="bcard-msg">' + esc(item.mensagem) + "</p>"
        : "") +
      filesLine +
      '<div class="bcard-foot">' +
        '<select class="status-select" aria-label="Mudar status">' + statusOptions(status) + "</select>" +
        '<div class="bcard-actions">' + detailsBtn + deleteBtn + "</div>" +
      "</div>";

    /* abrir detalhes (só briefing) */
    if (isBriefing) {
      var btn = card.querySelector(".btn-details");
      if (btn) btn.addEventListener("click", function () { openDrawer(item, btn); });
      var removeBtn = card.querySelector(".btn-delete-briefing");
      if (removeBtn) removeBtn.addEventListener("click", function () { openDeleteConfirm(item, removeBtn); });
    }

    /* mudança de status — atualiza a tabela correta */
    var sel = card.querySelector(".status-select");
    sel.addEventListener("change", function () { setStatus(item, sel.value); });

    return card;
  }

  /* ============================================================
     DRAWER — detalhes do briefing
     ============================================================ */
  function isDrawerOpen() {
    return !drawer.hidden && drawer.classList.contains("open");
  }

  function lockScroll(on) {
    var de = document.documentElement;
    if (on) {
      var sw = window.innerWidth - de.clientWidth;
      de.classList.add("drawer-lock");
      if (sw > 0) document.body.style.paddingRight = sw + "px";
    } else {
      de.classList.remove("drawer-lock");
      document.body.style.paddingRight = "";
    }
  }

  function setBackgroundInert(on) {
    if (on) {
      dashView.setAttribute("aria-hidden", "true");
      dashView.setAttribute("inert", "");
    } else {
      dashView.removeAttribute("aria-hidden");
      dashView.removeAttribute("inert");
    }
  }

  function focusEl(el) {
    if (!el || !el.focus) return;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }

  function openDrawer(item, trigger) {
    clearTimeout(drawerCloseTimer);
    var wasOpen = isDrawerOpen();
    drawerItem = item;
    if (!wasOpen) drawerReturnFocus = trigger || document.activeElement;
    drawerToken++;

    renderDrawer(item);

    drawer.hidden = false;
    if (!wasOpen) {
      lockScroll(true);
      setBackgroundInert(true);
      void drawer.offsetWidth;                 /* força reflow para a transição rodar */
      drawer.classList.add("open");
    }
    drawerScroll.scrollTop = 0;
    focusEl(drawerPanel);
    loadFileUrls(drawerToken);
  }

  function closeDrawer(immediate) {
    if (drawer.hidden) return;
    drawerToken++;
    drawer.classList.remove("open");
    setBackgroundInert(false);
    lockScroll(false);

    var back = drawerReturnFocus;
    var item = drawerItem;
    drawerItem = null;
    drawerReturnFocus = null;

    function finish() {
      drawer.hidden = true;
      drawerBody.innerHTML = "";
      drawerFiles = [];
    }
    clearTimeout(drawerCloseTimer);
    if (immediate) finish();
    else drawerCloseTimer = setTimeout(finish, 460);

    /* devolve o foco ao botão que abriu (ou ao botão do card, se o card foi re-renderizado) */
    if (!immediate) {
      if (!back || !document.body.contains(back)) {
        var card = item ? cardByKey[keyOf(item)] : null;
        back = card ? card.querySelector(".btn-details") : null;
      }
      focusEl(back);
    }
  }

  function renderDrawer(b) {
    var status = b.status || "novo";

    drawerDate.textContent = fmtDate(b.created_at);
    drawerTitle.textContent = b.nome || "Sem nome";

    var subParts = [b.empresa, pick(b.segmento, b.id_segmento), b.cidade].filter(filled).map(function (v) { return String(v).trim(); });
    drawerSub.textContent = subParts.join(" · ");
    drawerSub.hidden = !subParts.length;

    drawerFiles = prepareFiles(b);
    drawerBadges.innerHTML = svcBadgesHtml(b) + filesPillHtml(drawerFiles.length);
    drawerBadges.hidden = !drawerBadges.innerHTML;

    drawerStatus.innerHTML = statusOptions(status);
    drawerStatus.value = status;
    drawerStatus.setAttribute("aria-label", "Status do briefing");
    drawerPanel.setAttribute("data-status", status);

    /* atalhos: copiar e-mail / WhatsApp / mailto */
    var links = "";
    if (filled(b.email)) {
      links += '<button type="button" class="act-btn" data-act="copy-email">' + ICON.copy + "<span>Copiar e-mail</span></button>";
    }
    var wa = waHref(b.whatsapp);
    if (wa) {
      links += '<a class="act-btn wa" href="' + esc(wa) + '" target="_blank" rel="noopener noreferrer">' + ICON.chat + "<span>Abrir WhatsApp</span></a>";
    }
    if (isEmail(b.email)) {
      links += '<a class="act-btn" href="mailto:' + esc(String(b.email).trim()) + '">' + ICON.send + "<span>Enviar e-mail</span></a>";
    }
    drawerLinks.innerHTML = links;

    drawerBody.innerHTML = buildDrawerBody(b);
  }

  /* ---------- seções do drawer ---------- */
  function buildDrawerBody(b) {
    var html = "";
    var publicoAntigo = filled(b.publico_alvo) && filled(b.id_publico) &&
      String(b.id_publico).trim() !== String(b.publico_alvo).trim() ? b.id_publico : null;

    html += section("Contato", [
      ["Nome", b.nome],
      ["E-mail", b.email, "email"],
      ["WhatsApp", b.whatsapp, "whatsapp"],
      ["Cargo / função", b.cargo],
      ["Contato preferido", b.contato_preferido],
      ["Como conheceu", b.como_conheceu]
    ]);

    html += section("Empresa", [
      ["Empresa / projeto", b.empresa],
      ["Segmento", pick(b.segmento, b.id_segmento)],
      ["Cidade", b.cidade],
      ["Tempo de mercado", b.tempo_mercado],
      ["Tamanho da equipe", b.tamanho_equipe],
      ["O que faz", b.descricao_negocio],
      ["Produtos / serviços", b.produtos_servicos],
      ["Público-alvo", pick(b.publico_alvo, b.id_publico)],
      ["Público-alvo (identidade)", publicoAntigo],
      ["Diferenciais", b.diferenciais],
      ["Concorrentes", b.concorrentes, "linkify"],
      ["Missão e valores", b.missao_valores]
    ]);

    html += section("Presença online", [
      ["Site", b.link_site, "link", "site"],
      ["Instagram", b.link_instagram, "link", "instagram"],
      ["Facebook", b.link_facebook, "link", "facebook"],
      ["TikTok", b.link_tiktok, "link", "tiktok"],
      ["LinkedIn", b.link_linkedin, "link", "linkedin"],
      ["YouTube", b.link_youtube, "link", "youtube"],
      ["Outros links", b.link_outros, "lines"]
    ]);

    html += section("Marca atual", [
      ["Situação", b.marca_situacao],
      ["Já tem logo?", b.id_tem_logo],
      ["Slogan", b.marca_slogan],
      ["Cores", b.marca_cores, "colors"],
      ["Fontes", b.marca_fontes],
      ["Tem manual de marca?", b.marca_manual],
      ["O que gosta", b.marca_gosta],
      ["O que não gosta", b.marca_nao_gosta],
      ["O que precisa manter", b.marca_manter]
    ]);

    html += section("Site / Landing Page", [
      ["Tipo de site", b.site_tipo, "pills"],
      ["Objetivo principal", b.site_objetivo],
      ["Páginas imaginadas", b.site_paginas],
      ["Funcionalidades", b.site_funcionalidades, "pills"],
      ["Conteúdo", b.site_tem_conteudo],
      ["Referências", b.site_referencias, "linkify"],
      ["Tem domínio / hospedagem?", b.site_tem_dominio],
      ["Domínio", b.site_dominio, "link", "site"],
      ["Prazo", b.site_prazo],
      ["Orçamento", b.site_orcamento]
    ]);

    html += section("Identidade Visual", [
      ["Nome definido?", b.id_nome_definido],
      ["Entregáveis", b.id_entregaveis, "pills"],
      ["Personalidade da marca", b.id_personalidade, "pills"],
      ["Cores desejadas", b.id_cores, "colors"],
      ["O que evitar", b.id_evitar],
      ["Referências visuais", b.id_referencias, "linkify"],
      ["Prazo", b.id_prazo],
      ["Orçamento", b.id_orcamento]
    ]);

    html += section("Redes Sociais", [
      ["Plataformas", b.social_plataformas, "pills"],
      ["Serviços", b.social_servicos, "pills"],
      ["Seguidores", b.social_seguidores],
      ["Quem publica", b.social_quem_publica],
      ["Conteúdo próprio", b.social_conteudo_proprio],
      ["Frequência", b.social_frequencia],
      ["Objetivo", b.social_objetivo, "pills"],
      ["Tom de comunicação", b.social_tom, "pills"],
      ["Referências de perfis", b.social_referencias, "linkify"],
      ["Prazo", b.social_prazo],
      ["Orçamento", b.social_orcamento]
    ]);

    html += filesSection();

    html += section("Finalização", [
      ["Prazo geral", b.prazo_geral],
      ["Links de inspiração", b.referencias_links, "lines"],
      ["Link de arquivos grandes", b.arquivos_link, "lines"],
      ["Informações extras", b.informacoes_extras]
    ]);

    return html || '<p class="drawer-empty">Nenhuma informação adicional neste briefing.</p>';
  }

  /* rows: [rótulo, valor, tipo?, opção?] — só renderiza linhas preenchidas */
  function section(title, rows, extraHtml) {
    var inner = "";
    rows.forEach(function (r) {
      if (!r || !filled(r[1])) return;
      var v = renderValue(r[1], r[2], r[3]);
      if (!v) return;
      var raw = String(r[1]).trim();
      var wide = raw.length > 44 || /\n/.test(raw);
      inner += '<div class="detail-row' + (wide ? " wide" : "") + '"><span class="k">' + esc(r[0]) +
               '</span><div class="v">' + v + "</div></div>";
    });
    if (!inner && !extraHtml) return "";
    return '<section class="detail-sec"><h4>' + esc(title) + "</h4>" +
           (inner ? '<div class="detail-grid">' + inner + "</div>" : "") +
           (extraHtml || "") + "</section>";
  }

  function renderValue(value, type, opt) {
    var s = String(value).trim();
    var href;
    switch (type) {
      case "pills":
        var parts = s.split(/\s*,\s*/).filter(Boolean);
        if (!parts.length) return "";
        return '<span class="pills">' + parts.map(function (p) {
          return '<span class="pill">' + esc(p) + "</span>";
        }).join("") + "</span>";
      case "link":
        href = normalizeLink(s, opt);
        return href ? linkTag(href, s) : esc(s);
      case "lines":
        return linkLines(s);
      case "linkify":
        return linkify(s);
      case "email":
        return isEmail(s) ? '<a href="mailto:' + esc(s) + '">' + esc(s) + "</a>" : esc(s);
      case "whatsapp":
        href = waHref(s);
        return href ? linkTag(href, s) : esc(s);
      case "colors":
        var hexes = s.match(/#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi) || [];
        var sw = hexes.slice(0, 12).map(function (h) {
          return '<span class="swatch" style="background:' + h + '" title="' + h + '"></span>';
        }).join("");
        return esc(s) + (sw ? '<span class="swatches" aria-hidden="true">' + sw + "</span>" : "");
      default:
        return esc(s);
    }
  }

  /* ============================================================
     ARQUIVOS (Storage privado → signed URLs)
     ============================================================ */
  function filesOf(item) {
    var a = item ? item.arquivos : null;
    if (typeof a === "string") {
      try { a = JSON.parse(a); } catch (e) { a = null; }
    }
    if (!Array.isArray(a)) return [];
    return a.filter(function (f) {
      return f && typeof f === "object" && typeof f.path === "string" && f.path.trim() !== "";
    });
  }

  function extOf(name) {
    var m = String(name || "").match(/\.([a-z0-9]{1,6})$/i);
    return m ? m[1].toLowerCase() : "";
  }

  /* normaliza e ordena pelos slots conhecidos (desconhecidos no fim) */
  function prepareFiles(item) {
    var list = filesOf(item).map(function (f, k) {
      var path = f.path.trim();
      var nome = filled(f.nome) ? String(f.nome).trim() : path.split("/").pop();
      var ext  = extOf(nome) || extOf(path);
      var slot = filled(f.slot) ? String(f.slot).trim() : "";
      var order = SLOT_ORDER.indexOf(slot);
      return {
        path: path, nome: nome, ext: ext, slot: slot,
        size: Number(f.tamanho) || 0,
        img: !!IMG_EXT[ext],
        order: order === -1 ? SLOT_ORDER.length : order,
        k: k
      };
    });
    list.sort(function (a, b) {
      if (a.order !== b.order) return a.order - b.order;
      if (a.slot !== b.slot) return a.slot < b.slot ? -1 : 1;
      return a.k - b.k;
    });
    list.forEach(function (w, i) { w.i = i; });
    return list;
  }

  function slotLabel(slot) {
    if (!slot) return "Sem categoria";
    return SLOT_LABELS[slot] || slot.replace(/_/g, " ");
  }

  function filesSection() {
    if (!drawerFiles.length) return "";
    var total = 0;
    var groups = [];
    var bySlot = Object.create(null);
    drawerFiles.forEach(function (w) {
      total += w.size;
      if (!bySlot[w.slot]) { bySlot[w.slot] = { slot: w.slot, files: [] }; groups.push(bySlot[w.slot]); }
      bySlot[w.slot].files.push(w);
    });

    var html = '<section class="detail-sec files-sec"><h4>Arquivos</h4>';
    html += '<p class="files-summary">' + plural(drawerFiles.length, "arquivo", "arquivos") +
            (total ? " · " + esc(fmtSize(total)) : "") + "</p>";
    html += '<div class="files-error" role="alert" hidden>' + ICON.alert +
            "<span>Não foi possível carregar as prévias dos arquivos. Você ainda pode baixá-los um a um.</span>" +
            '<button type="button" class="files-retry" data-act="retry-files">Tentar novamente</button></div>';

    groups.forEach(function (g) {
      var imgs = g.files.filter(function (w) { return w.img; });
      var docs = g.files.filter(function (w) { return !w.img; });
      html += '<div class="file-group"><h5>' + esc(slotLabel(g.slot)) +
              ' <span class="file-group-n">' + g.files.length + "</span></h5>";
      if (imgs.length) {
        html += '<div class="thumb-grid' + (CONTAIN_SLOTS[g.slot] ? " contain" : "") + '">' +
                imgs.map(thumbHtml).join("") + "</div>";
      }
      if (docs.length) {
        html += '<ul class="file-cards">' + docs.map(fileCardHtml).join("") + "</ul>";
      }
      html += "</div>";
    });
    return html + "</section>";
  }

  function dlBtnHtml(w) {
    return '<button type="button" class="file-dl" data-fi="' + w.i + '" aria-label="Baixar ' + esc(w.nome) + '">' +
           ICON.down + '<span class="file-dl-lbl">Baixar</span></button>';
  }
  function metaText(w) {
    return [w.ext ? w.ext.toUpperCase() : "", fmtSize(w.size)].filter(Boolean).join(" · ");
  }

  function thumbHtml(w) {
    return '<figure class="thumb" data-fi="' + w.i + '">' +
             '<div class="thumb-media"><span class="skel thumb-skel" aria-hidden="true"></span></div>' +
             "<figcaption>" +
               '<span class="thumb-name" title="' + esc(w.nome) + '">' + esc(w.nome) + "</span>" +
               '<span class="thumb-meta">' + esc(metaText(w)) + "</span>" +
               dlBtnHtml(w) +
             "</figcaption>" +
           "</figure>";
  }

  function fileCardHtml(w) {
    return '<li class="file-card" data-fi="' + w.i + '">' +
             '<span class="file-ext" aria-hidden="true">' + esc(w.ext ? w.ext.toUpperCase().slice(0, 4) : "ARQ") + "</span>" +
             '<div class="file-info">' +
               '<span class="file-name" title="' + esc(w.nome) + '">' + esc(w.nome) + "</span>" +
               '<span class="file-meta">' + esc(metaText(w)) + "</span>" +
             "</div>" +
             '<div class="file-acts">' +
               (PREVIEW_EXT[w.ext]
                 ? '<a class="file-open" hidden target="_blank" rel="noopener noreferrer" aria-label="Abrir ' + esc(w.nome) + ' em nova aba">' + ICON.ext + "<span>Abrir</span></a>"
                 : "") +
               dlBtnHtml(w) +
             "</div>" +
           "</li>";
  }

  function thumbFallbackHtml(w, msg) {
    return '<span class="thumb-fallback"><span class="file-ext">' + esc(w.ext ? w.ext.toUpperCase().slice(0, 4) : "IMG") +
           "</span><small>" + esc(msg) + "</small></span>";
  }

  function fileEl(w) {
    return drawerBody.querySelector('[data-fi="' + w.i + '"].thumb, [data-fi="' + w.i + '"].file-card');
  }

  function applyFileUrl(w, url) {
    var el = fileEl(w);
    if (!el) return;
    if (el.classList.contains("thumb")) {
      var media = el.querySelector(".thumb-media");
      if (!media) return;
      media.innerHTML = url
        ? '<a class="thumb-link" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer" aria-label="Abrir ' + esc(w.nome) + ' em nova aba">' +
            '<img src="' + esc(url) + '" alt="' + esc(w.nome) + '" loading="lazy" decoding="async"></a>'
        : thumbFallbackHtml(w, "Prévia indisponível");
    } else {
      var open = el.querySelector(".file-open");
      if (open) {
        if (url) { open.setAttribute("href", url); open.hidden = false; }
        else { open.removeAttribute("href"); open.hidden = true; }
      }
    }
  }

  function resetFileMedia() {
    drawerFiles.forEach(function (w) {
      if (!w.img) return;
      var el = fileEl(w);
      var media = el ? el.querySelector(".thumb-media") : null;
      if (media) media.innerHTML = '<span class="skel thumb-skel" aria-hidden="true"></span>';
    });
  }

  function setFilesError(show) {
    var box = drawerBody.querySelector(".files-error");
    if (box) box.hidden = !show;
  }

  /* gera todas as signed URLs de visualização em lote */
  function loadFileUrls(token) {
    if (!drawerFiles.length || !supa) return;
    setFilesError(false);

    var seen = Object.create(null);
    var paths = [];
    drawerFiles.forEach(function (w) {
      if (!seen[w.path]) { seen[w.path] = 1; paths.push(w.path); }
    });

    function fail(err) {
      if (token !== drawerToken) return;
      console.error("Erro ao gerar links dos arquivos:", err);
      setFilesError(true);
      drawerFiles.forEach(function (w) { applyFileUrl(w, null); });
    }

    var req;
    try {
      req = supa.storage.from(BUCKET).createSignedUrls(paths, URL_TTL);
    } catch (e) { fail(e); return; }

    req.then(function (res) {
      if (token !== drawerToken) return;
      if (!res || res.error || !Array.isArray(res.data)) { fail(res && res.error); return; }
      var byPath = Object.create(null);
      res.data.forEach(function (d, k) {
        if (!d) return;
        var p = d.path || paths[k];
        var u = d.signedUrl || d.signedURL;
        if (p && u && !d.error) byPath[p] = safeHttpUrl(u);
      });
      drawerFiles.forEach(function (w) { applyFileUrl(w, byPath[w.path] || null); });
    }, fail);
  }

  /* nome seguro para o parâmetro ?download= (o SDK não codifica & # ? =) */
  function downloadName(w) {
    var n = String(w.nome || "").replace(/[\u0000-\u001f\u007f]/g, "").replace(/[\\\/:*?"<>|#&=+]/g, "-").trim();
    if (n.length > 150) n = n.slice(0, 150);
    return n || ("arquivo" + (w.ext ? "." + w.ext : ""));
  }

  function triggerDownload(url, name) {
    var a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    a.setAttribute("download", name || "");   /* também evita a transição de página do fx.js */
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 0);
  }

  function downloadFile(w, btn) {
    if (!w || !btn || btn.disabled) return;
    var lbl = btn.querySelector(".file-dl-lbl");
    var name = downloadName(w);
    btn.disabled = true;
    btn.classList.add("loading");
    if (lbl) lbl.textContent = "Gerando…";

    function done() {
      btn.disabled = false;
      btn.classList.remove("loading");
      if (lbl) lbl.textContent = "Baixar";
    }
    function fail(err) {
      done();
      console.error("Erro ao gerar download:", err);
      toast("Não foi possível baixar “" + w.nome + "”. Tente novamente.", "error");
    }

    var req;
    try {
      req = supa.storage.from(BUCKET).createSignedUrl(w.path, URL_TTL, { download: name });
    } catch (e) { fail(e); return; }

    req.then(function (res) {
      var url = res && res.data ? safeHttpUrl(res.data.signedUrl || res.data.signedURL) : null;
      if (!res || res.error || !url) { fail(res && res.error); return; }
      done();
      triggerDownload(url, name);
    }, fail);
  }

  /* ---------- eventos do drawer ---------- */
  drawerClose.addEventListener("click", function () { closeDrawer(); });
  drawerOverlay.addEventListener("click", function () { closeDrawer(); });

  drawerStatus.addEventListener("change", function () {
    if (drawerItem) setStatus(drawerItem, drawerStatus.value);
  });

  drawerPanel.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    var copyBtn = t.closest('[data-act="copy-email"]');
    if (copyBtn && drawerItem) {
      var lbl = copyBtn.querySelector("span");
      copyText(String(drawerItem.email || "").trim(), function () {
        copyBtn.classList.add("copied");
        if (lbl) lbl.textContent = "Copiado!";
        setTimeout(function () {
          copyBtn.classList.remove("copied");
          if (lbl) lbl.textContent = "Copiar e-mail";
        }, 1800);
      });
      return;
    }

    var dl = t.closest(".file-dl");
    if (dl) {
      downloadFile(drawerFiles[Number(dl.getAttribute("data-fi"))], dl);
      return;
    }

    if (t.closest('[data-act="retry-files"]')) {
      resetFileMedia();
      loadFileUrls(drawerToken);
    }
  });

  /* miniatura que não carregou (formato sem suporte, link expirado…) */
  drawerBody.addEventListener("error", function (e) {
    var img = e.target;
    if (!img || img.tagName !== "IMG") return;
    var fig = img.closest ? img.closest(".thumb") : null;
    var media = fig ? fig.querySelector(".thumb-media") : null;
    var w = fig ? drawerFiles[Number(fig.getAttribute("data-fi"))] : null;
    if (media && w) media.innerHTML = thumbFallbackHtml(w, "Prévia indisponível");
  }, true);

  /* Esc fecha · Tab fica preso dentro do painel */
  function focusables() {
    return [].slice.call(drawerPanel.querySelectorAll(
      'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(function (el) {
      return !el.hidden && el.offsetParent !== null;
    });
  }

  document.addEventListener("keydown", function (e) {
    if (!isDrawerOpen()) return;
    if (e.key === "Escape" || e.key === "Esc") {
      e.preventDefault();
      closeDrawer();
      return;
    }
    if (e.key === "Tab") {
      var list = focusables();
      if (!list.length) { e.preventDefault(); focusEl(drawerPanel); return; }
      var first = list[0];
      var last  = list[list.length - 1];
      var act   = document.activeElement;
      var inside = drawerPanel.contains(act);
      if (e.shiftKey) {
        if (!inside || act === first || act === drawerPanel) { e.preventDefault(); focusEl(last); }
      } else if (!inside || act === last) {
        e.preventDefault();
        focusEl(first);
      }
    }
  });
})();
