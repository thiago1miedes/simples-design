/* ============================================================
   BRIEFING v2 — formulário multi-step (6 etapas), uploads no
   Supabase Storage (bucket privado) e insert em public.briefings.
   Vanilla JS (ES5), sem frameworks.
   ============================================================ */
(function () {
  "use strict";

  /* ===== Configuração ===== */
  var TABLE = "briefings";
  var BUCKET = "briefing-arquivos";
  var TOTAL_STEPS = 6;
  var MAX_FILE = 8388608;                          // 8 MB por arquivo (file_size_limit do bucket)
  var MAX_TOTAL = 62914560;                        // 60 MB somando todos os campos de upload
  var UPLOAD_CONCURRENCY = 3;
  var DRAFT_KEY = "sd_briefing_rascunho_v2";
  var DRAFT_MAX_AGE = 30 * 24 * 60 * 60 * 1000;    // rascunhos com mais de 30 dias são descartados
  var NAV_OFFSET = 96;                             // nav fixo + respiro ao rolar até as etapas
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var SEM_MARCA = "Ainda não tenho marca";
  var SERVICES = ["site", "identidade", "social"]; // ordem em que "servico" é salvo

  /* extensão → MIME (precisa casar com allowed_mime_types do bucket) */
  var MIME = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
    svg: "image/svg+xml", heic: "image/heic", heif: "image/heif", avif: "image/avif",
    tif: "image/tiff", tiff: "image/tiff", psd: "image/vnd.adobe.photoshop",
    pdf: "application/pdf", ai: "application/postscript", eps: "application/postscript",
    cdr: "application/x-coreldraw", zip: "application/zip",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain", mp4: "video/mp4", mov: "video/quicktime"
  };

  /* categorias de upload (data-slot): extensões aceitas + máximo de arquivos */
  var SLOT_CONFIG = {
    logo:          { exts: ["png", "jpg", "jpeg", "svg", "pdf", "ai", "eps", "psd", "cdr", "webp", "zip"], max: 6 },
    manual:        { exts: ["pdf", "png", "jpg", "jpeg", "zip", "pptx"], max: 3 },
    materiais:     { exts: ["png", "jpg", "jpeg", "webp", "heic", "pdf"], max: 8 },
    site_conteudo: { exts: ["pdf", "doc", "docx", "txt", "pptx", "png", "jpg", "jpeg"], max: 5 },
    fotos:         { exts: ["png", "jpg", "jpeg", "webp", "heic", "heif"], max: 12 },
    referencias:   { exts: ["png", "jpg", "jpeg", "webp", "gif", "pdf"], max: 10 },
    outros:        { exts: Object.keys(MIME), max: 8,
                     formats: "Imagens, PDF, AI, EPS, PSD, CDR, documentos, ZIP e vídeos curtos" }
  };
  var SLOT_ORDER = ["logo", "manual", "materiais", "site_conteudo", "fotos", "referencias", "outros"];
  var PREVIEW_EXTS = ["png", "jpg", "jpeg", "webp", "gif"];   // miniatura via object URL

  /* colunas enviadas — id/name do campo = nome da coluna em public.briefings */
  var TEXT_FIELDS = [
    // você
    "nome", "email", "whatsapp", "cargo", "como_conheceu",
    // empresa
    "empresa", "segmento", "cidade", "tempo_mercado", "tamanho_equipe", "descricao_negocio",
    "produtos_servicos", "publico_alvo", "diferenciais", "concorrentes", "missao_valores",
    // presença online
    "link_site", "link_instagram", "link_facebook", "link_tiktok", "link_linkedin", "link_youtube", "link_outros",
    // marca atual
    "marca_slogan", "marca_cores", "marca_fontes", "marca_gosta", "marca_nao_gosta", "marca_manter",
    // site
    "site_objetivo", "site_paginas", "site_referencias", "site_dominio", "site_prazo", "site_orcamento",
    // identidade visual
    "id_cores", "id_evitar", "id_referencias", "id_prazo", "id_orcamento",
    // redes sociais
    "social_seguidores", "social_frequencia", "social_referencias", "social_prazo", "social_orcamento",
    // arquivos / finalização
    "referencias_links", "arquivos_link", "prazo_geral", "informacoes_extras"
  ];
  var RADIO_FIELDS = [
    "contato_preferido", "marca_situacao", "marca_manual", "site_tem_conteudo", "site_tem_dominio",
    "id_nome_definido", "social_quem_publica", "social_conteudo_proprio"
  ];
  var CHECK_FIELDS = [
    "site_tipo", "site_funcionalidades", "id_entregaveis", "id_personalidade",
    "social_plataformas", "social_servicos", "social_objetivo", "social_tom"
  ];
  /* campos validados por etapa (whatsapp é opcional, mas se preenchido precisa estar completo) */
  var STEP_FIELDS = { 1: ["nome", "email", "whatsapp"], 2: ["empresa"] };

  /* ---------- Supabase client ---------- */
  var supa = null;
  try {
    if (window.supabase && typeof SUPABASE_URL === "string" && SUPABASE_URL.indexOf("COLE_SUA") === -1) {
      supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  } catch (e) { /* config ausente — tratado no submit */ }

  /* ============================================================
     Utilitários
     ============================================================ */
  var reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return [].slice.call((ctx || document).querySelectorAll(sel)); }
  function byId(id) { return document.getElementById(id); }
  function toInt(v) { return parseInt(v, 10) || 0; }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function pad2(n) { return n < 10 ? "0" + n : String(n); }
  function hasOwn(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  /* cria um elemento com classe e texto (texto sempre via textContent) */
  function h(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function extOf(name) {
    var s = String(name || "");
    var i = s.lastIndexOf(".");
    return i > 0 ? s.slice(i + 1).toLowerCase() : "";
  }

  /* "2,4 MB" / "830 KB" — roundUp arredonda para cima (mensagens de limite) */
  function fmtSize(bytes, roundUp) {
    var n = Number(bytes) || 0;
    if (n >= 1024000) {
      var mb = n / 1048576;
      mb = roundUp ? Math.ceil(mb * 10) / 10 : Math.round(mb * 10) / 10;
      return mb.toFixed(1).replace(".", ",") + " MB";
    }
    if (n >= 1024) return Math.round(n / 1024) + " KB";
    return n + " bytes";
  }

  /* nome seguro para o Storage: sem acentos, minúsculo, só [a-z0-9-_], máx. 60 chars */
  function sanitizeBase(name) {
    var base = String(name || "").replace(/\.[^.]*$/, "");
    if (base.normalize) base = base.normalize("NFD");
    base = base.replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9_-]/g, "")
      .replace(/-{2,}/g, "-")
      .replace(/^[-_]+|[-_]+$/g, "")
      .slice(0, 60)
      .replace(/[-_]+$/, "");
    return base || "arquivo";
  }

  /* UUID v4 minúsculo — a policy do bucket exige a 1ª pasta nesse formato */
  function uuidv4() {
    var c = window.crypto || window.msCrypto;
    if (c && typeof c.randomUUID === "function") {
      try { return c.randomUUID().toLowerCase(); } catch (e) { /* contexto não seguro — usa o fallback */ }
    }
    var bytes = [], i;
    if (c && typeof c.getRandomValues === "function") {
      var arr = new Uint8Array(16);
      c.getRandomValues(arr);
      for (i = 0; i < 16; i++) bytes.push(arr[i]);
    } else {
      for (i = 0; i < 16; i++) bytes.push(Math.floor(Math.random() * 256));
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    var hex = bytes.map(function (b) { return (b + 0x100).toString(16).slice(1); }).join("");
    return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" +
           hex.slice(16, 20) + "-" + hex.slice(20);
  }

  function debounce(fn, ms) {
    var t = null;
    function run() { clearTimeout(t); t = setTimeout(fn, ms); }
    run.cancel = function () { clearTimeout(t); };
    return run;
  }

  function focusNoScroll(el) {
    if (!el) return;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }

  /* anúncio para leitores de tela (região aria-live) */
  var liveRegion = byId("liveRegion");
  function announce(msg) {
    if (!liveRegion) return;
    liveRegion.textContent = "";
    setTimeout(function () { liveRegion.textContent = msg; }, 60);
  }

  /* ---------- barra de progresso (scroll) ---------- */
  var progress = byId("progress");
  function onScroll() {
    var root = document.documentElement;
    var max = root.scrollHeight - root.clientHeight;
    progress.style.width = (max > 0 ? (root.scrollTop / max) * 100 : 0) + "%";
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- reveal no scroll (mesmo padrão do index) ---------- */
  var revealEls = $$(".reveal");
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
  var form = byId("briefingForm");
  var panels = $$(".step-panel", form);
  var stepper = byId("stepper");
  var nodes = $$(".node", stepper);
  var bars = $$(".bar", stepper);
  var svcInputs = $$('input[name="servico"]', form);
  var svcAllBtn = byId("svcAll");
  var svcError = byId("svcError");
  var marcaAtual = byId("marcaAtual");
  var marcaNova = byId("marcaNova");
  var dominioField = byId("siteDominioField");
  var filesSummary = byId("filesSummary");
  var sendError = byId("sendError");
  var sendErrorText = $(".send-error-text", sendError);
  var submitBtn = byId("submitBtn");
  var submitLabel = $(".btn-label", submitBtn);
  var successScreen = byId("bfSuccess");
  var successFiles = byId("successFiles");
  var draftNote = byId("draftNote");
  var draftFiles = byId("draftFiles");
  var draftReset = byId("draftReset");
  var reqNote = $(".req-note");

  /* ---------- estado ---------- */
  var state = {
    current: 1,          // etapa visível
    maxReached: 1,       // etapa mais avançada já visitada (libera nós do stepper)
    sending: false,
    submitted: false,
    briefingId: null,    // gerado no 1º envio e reutilizado nas re-tentativas
    insertAttempts: 0
  };
  var radioLast = {};    // último valor marcado de cada grupo de radio (permite desmarcar)
  var slots = {};        // nome do slot → estado do upload
  var fileUid = 0;
  var scheduleSave = debounce(saveDraft, 400);

  /* ---------- WhatsApp: máscara brasileira ---------- */
  var whats = byId("whatsapp");
  function maskPhone(value, final) {
    var d = value.replace(/\D/g, "").slice(0, 11);
    // ao sair do campo, fixo com 10 dígitos vira (00) 0000-0000
    if (final && d.length === 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    var out = "";
    if (d.length > 0) out = "(" + d.slice(0, 2);
    if (d.length >= 3) out += ") " + d.slice(2, 7);
    if (d.length >= 8) out += "-" + d.slice(7, 11);
    return out;
  }
  whats.addEventListener("input", function () { whats.value = maskPhone(whats.value, false); });
  whats.addEventListener("blur", function () { whats.value = maskPhone(whats.value, true); });

  /* ---------- estado inválido dos campos ---------- */
  // inclui/remove um id em aria-describedby (o erro só é descrito enquanto aparece)
  function toggleDescribedBy(el, id, on) {
    var ids = (el.getAttribute("aria-describedby") || "").split(/\s+/).filter(function (t) { return t && t !== id; });
    if (on) ids.push(id);
    if (ids.length) el.setAttribute("aria-describedby", ids.join(" "));
    else el.removeAttribute("aria-describedby");
  }
  function setInvalid(el, invalid) {
    var wrap = el.closest(".field");
    if (wrap) wrap.classList.toggle("invalid", invalid);
    if (invalid) el.setAttribute("aria-invalid", "true");
    else el.removeAttribute("aria-invalid");
    if (byId(el.id + "-erro")) toggleDescribedBy(el, el.id + "-erro", invalid);
  }
  function validatedIds() {
    var ids = [];
    Object.keys(STEP_FIELDS).forEach(function (k) { ids = ids.concat(STEP_FIELDS[k]); });
    return ids;
  }
  validatedIds().forEach(function (id) {
    var el = byId(id);
    function clear() { setInvalid(el, false); }
    el.addEventListener("input", clear);
    el.addEventListener("change", clear);
  });

  /* ============================================================
     Pílulas (checkbox / radio)
     ============================================================ */
  function radioValRaw(name) {
    var el = form.querySelector('input[type="radio"][name="' + name + '"]:checked');
    return el ? el.value : null;
  }
  function refreshChoice(inp) {
    if (inp.type === "radio") {
      $$('input[type="radio"][name="' + inp.name + '"]', form).forEach(function (r) {
        var label = r.closest(".choice");
        if (label) label.classList.toggle("selected", r.checked);
      });
    } else {
      var label = inp.closest(".choice");
      if (label) label.classList.toggle("selected", inp.checked);
    }
  }
  function refreshAllChoices() {
    $$(".choice input", form).forEach(function (inp) {
      inp.closest(".choice").classList.toggle("selected", inp.checked);
    });
  }
  function syncRadioMemory() {
    radioLast = {};
    RADIO_FIELDS.forEach(function (name) { radioLast[name] = radioValRaw(name); });
  }

  // clicar num radio já marcado desmarca (todas as perguntas de escolha única são opcionais)
  form.addEventListener("click", function (e) {
    var inp = e.target;
    if (inp.tagName !== "INPUT" || inp.type !== "radio" || !inp.closest(".choice")) return;
    if (radioLast[inp.name] === inp.value) {
      inp.checked = false;
      radioLast[inp.name] = null;
    } else {
      radioLast[inp.name] = inp.value;
    }
    refreshChoice(inp);
    onRadioChange(inp.name);
    scheduleSave();
  });
  form.addEventListener("change", function (e) {
    var inp = e.target;
    if (inp.tagName !== "INPUT" || !inp.closest(".choice")) return;
    if (inp.type === "radio") {
      radioLast[inp.name] = radioValRaw(inp.name);
      onRadioChange(inp.name);
    }
    refreshChoice(inp);
  });

  /* ---------- blocos condicionais ---------- */
  function applyMarca() {
    var semMarca = radioValRaw("marca_situacao") === SEM_MARCA;
    marcaAtual.hidden = semMarca;      // escondido → campos viram null e arquivos não sobem
    marcaNova.hidden = !semMarca;
    updateFilesSummary();
  }
  function applyDominio() {
    dominioField.hidden = radioValRaw("site_tem_dominio") !== "Sim";
  }
  function onRadioChange(name) {
    if (name === "marca_situacao") applyMarca();
    else if (name === "site_tem_dominio") applyDominio();
  }

  /* ============================================================
     Serviços — multi-seleção livre + "Quero tudo"
     ============================================================ */
  function selectedServices() {
    return SERVICES.filter(function (svc) {
      return svcInputs.some(function (i) { return i.value === svc && i.checked; });
    });
  }
  function setSvcError(show) {
    svcError.classList.toggle("show", show);
    svcInputs.forEach(function (i) { toggleDescribedBy(i, "svcError", show); });
  }

  function syncServices() {
    var sel = selectedServices();
    var all = sel.length === SERVICES.length;
    svcInputs.forEach(function (i) {
      var card = i.closest(".svc-card");
      if (card) card.classList.toggle("selected", i.checked);
    });
    // "Quero tudo" é um estado derivado (não é um serviço salvo)
    svcAllBtn.classList.toggle("selected", all);
    svcAllBtn.setAttribute("aria-pressed", all ? "true" : "false");
    if (sel.length) setSvcError(false);
    // etapa 5: só as seções dos serviços escolhidos ficam visíveis (e são enviadas)
    $$(".dyn-section[data-section]", form).forEach(function (sec) {
      sec.hidden = sel.indexOf(sec.getAttribute("data-section")) === -1;
    });
    updateFilesSummary();
  }
  svcInputs.forEach(function (i) { i.addEventListener("change", syncServices); });

  svcAllBtn.addEventListener("click", function () {
    var all = selectedServices().length === SERVICES.length;
    svcInputs.forEach(function (i) { i.checked = !all; });
    syncServices();
    scheduleSave();
    announce(all ? "Serviços desmarcados." : "Todos os serviços selecionados.");
  });

  /* ============================================================
     Uploads — uma dropzone por categoria (data-slot)
     ============================================================ */
  var STATUS_TEXT = {
    pending: "Pronto para enviar",
    uploading: "Enviando…",
    done: "Enviado ✓",
    error: "Falha no envio"
  };
  var ICON_X = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

  function formatsLabel(cfg) {
    if (cfg.formats) return cfg.formats;
    return cfg.exts.filter(function (ext) {
      return !(ext === "jpeg" && cfg.exts.indexOf("jpg") !== -1) && !(ext === "tiff" && cfg.exts.indexOf("tif") !== -1);
    }).map(function (ext) { return ext.toUpperCase(); }).join(", ");
  }
  /* extensões + MIME de imagem/vídeo (ajuda o seletor do celular a oferecer a galeria) */
  function acceptAttr(exts) {
    var list = [];
    exts.forEach(function (ext) {
      list.push("." + ext);
      var mime = MIME[ext];
      if (mime && /^(image|video)\//.test(mime) && list.indexOf(mime) === -1) list.push(mime);
    });
    return list.join(",");
  }

  function initSlots() {
    $$(".upload[data-slot]", form).forEach(function (el) {
      var name = el.getAttribute("data-slot");
      var cfg = SLOT_CONFIG[name];
      if (!cfg) return;
      var panel = el.closest(".step-panel");
      var slot = {
        name: name, cfg: cfg, el: el,
        step: panel ? toInt(panel.getAttribute("data-step")) : 0,
        label: $(".upload-label", el),
        zone: $(".dropzone", el),
        input: $('input[type="file"]', el),
        hint: $(".dz-hint", el),
        help: $(".upload-help", el),
        list: $(".file-list", el),
        error: $(".upload-error", el),
        items: [],
        pathSeq: 0,      // contador do "NN" do caminho — atribuído no 1º upload, nunca reutilizado
        dragDepth: 0
      };

      // acessibilidade: nome = rótulo do slot; descrição = formatos + ajuda + erro
      var base = "up-" + name;
      var described = [];
      slot.label.id = base + "-label";
      slot.hint.id = base + "-hint";
      described.push(slot.hint.id);
      if (slot.help) { slot.help.id = base + "-ajuda"; described.push(slot.help.id); }
      slot.error.id = base + "-erro";
      described.push(slot.error.id);

      slot.input.multiple = true;
      slot.input.accept = acceptAttr(cfg.exts);
      slot.input.setAttribute("aria-labelledby", slot.label.id);
      slot.input.setAttribute("aria-describedby", described.join(" "));
      slot.hint.textContent = formatsLabel(cfg) + " · até 8 MB cada · máx. " + plural(cfg.max, "arquivo", "arquivos");

      bindSlot(slot);
      slots[name] = slot;
    });
  }

  function hasFiles(e) {
    var types = e.dataTransfer && e.dataTransfer.types;
    if (!types) return false;
    for (var i = 0; i < types.length; i++) { if (types[i] === "Files") return true; }
    return false;
  }

  function bindSlot(slot) {
    slot.input.addEventListener("change", function () {
      var files = [].slice.call(slot.input.files || []);
      slot.input.value = "";                      // permite escolher o mesmo arquivo de novo
      if (files.length) addFiles(slot, files);
    });

    // teclado: Enter/Espaço no input (visualmente escondido, mas focável) abrem o seletor
    slot.input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        slot.input.click();
      }
    });
    slot.input.addEventListener("keyup", function (e) {
      if (e.key === " " || e.key === "Spacebar") e.preventDefault();   // evita abrir duas vezes
    });

    // arrastar e soltar
    slot.zone.addEventListener("dragenter", function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      slot.dragDepth++;
      slot.zone.classList.add("dragging");
    });
    slot.zone.addEventListener("dragover", function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = state.sending ? "none" : "copy";
    });
    slot.zone.addEventListener("dragleave", function () {
      slot.dragDepth = Math.max(0, slot.dragDepth - 1);
      if (!slot.dragDepth) slot.zone.classList.remove("dragging");
    });
    slot.zone.addEventListener("drop", function (e) {
      e.preventDefault();
      slot.dragDepth = 0;
      slot.zone.classList.remove("dragging");
      var files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) addFiles(slot, files);
    });

    // remover arquivo
    slot.list.addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest(".fi-remove");
      if (btn) removeItem(slot, toInt(btn.getAttribute("data-uid")));
    });
  }

  // arquivo solto fora de uma dropzone não pode abrir no navegador (perderia o formulário)
  function outsideDropzone(e) { return !(e.target && e.target.closest && e.target.closest(".dropzone")); }
  window.addEventListener("dragover", function (e) {
    if (hasFiles(e) && outsideDropzone(e)) { e.preventDefault(); e.dataTransfer.dropEffect = "none"; }
  });
  window.addEventListener("drop", function (e) {
    if (hasFiles(e) && outsideDropzone(e)) e.preventDefault();
  });

  /* ---------- adicionar arquivos (com validação) ---------- */
  function addFiles(slot, fileList) {
    if (state.sending) return;
    var files = [].slice.call(fileList || []);
    var msgs = [];
    var added = 0, overCount = 0, overTotal = 0;
    var total = sumBytes(allItems(false));
    var bigTip = slot.step === TOTAL_STEPS
      ? "cole um link no campo de arquivos grandes, logo abaixo."
      : "cole um link na etapa Arquivos.";

    files.forEach(function (file) {
      var name = file.name || "arquivo";
      var ext = extOf(name);

      // duplicado (mesmo nome + tamanho no mesmo slot) → ignora em silêncio
      var dup = slot.items.some(function (it) { return it.name === name && it.size === file.size; });
      if (dup) return;
      if (!file.size) { msgs.push("“" + name + "” está vazio (0 bytes) e não foi adicionado."); return; }
      if (slot.cfg.exts.indexOf(ext) === -1 || !MIME[ext]) { msgs.push("“" + name + "” não é um formato aceito aqui."); return; }
      if (file.size > MAX_FILE) {
        msgs.push("“" + name + "” tem " + fmtSize(file.size, true) + " — o limite é 8 MB por arquivo. Para arquivos maiores, " + bigTip);
        return;
      }
      if (slot.items.length >= slot.cfg.max) { overCount++; return; }
      if (total + file.size > MAX_TOTAL) { overTotal++; return; }

      total += file.size;
      var item = createItem(slot, file, ext);
      slot.items.push(item);
      slot.list.appendChild(item.li);
      added++;
    });

    if (overCount) {
      msgs.push("Este campo aceita no máximo " + plural(slot.cfg.max, "arquivo", "arquivos") + " — " +
        (overCount === 1 ? "1 arquivo ficou de fora." : overCount + " arquivos ficaram de fora."));
    }
    if (overTotal) msgs.push("Limite total de 60 MB atingido. Use um link para os demais.");
    setSlotError(slot, msgs);

    if (added) {
      announce(plural(added, "arquivo adicionado", "arquivos adicionados") + " em " + slot.label.textContent + ".");
      updateFilesSummary();
      scheduleSave();
    }
  }

  function extBadge(ext) { return h("span", "fi-ext", (ext || "?").toUpperCase()); }

  function createItem(slot, file, ext) {
    var item = {
      uid: ++fileUid, slot: slot.name, seq: 0,
      file: file, name: file.name, size: file.size, ext: ext, mime: MIME[ext],
      url: null, img: null, status: "pending", path: null, uploaded: false,
      li: null, statusEl: null, removeBtn: null
    };

    var li = h("li", "file-item");

    // miniatura (raster) ou selo com a extensão
    var thumb = h("span", "fi-thumb");
    thumb.setAttribute("aria-hidden", "true");
    if (PREVIEW_EXTS.indexOf(ext) !== -1 && window.URL && URL.createObjectURL) {
      try {
        item.url = URL.createObjectURL(file);
        var img = document.createElement("img");
        img.alt = "";
        img.decoding = "async";
        img.onerror = function () {
          item.img = null;
          revokeItemUrl(item);
          thumb.textContent = "";
          thumb.appendChild(extBadge(ext));
        };
        img.src = item.url;
        item.img = img;
        thumb.appendChild(img);
      } catch (e) {
        item.url = null;
        thumb.appendChild(extBadge(ext));
      }
    } else {
      thumb.appendChild(extBadge(ext));
    }

    var meta = h("span", "fi-meta");
    var nameEl = h("span", "fi-name", file.name);
    nameEl.title = file.name;
    var sub = h("span", "fi-sub");
    sub.appendChild(h("span", "fi-size", fmtSize(file.size)));
    item.statusEl = h("span", "fi-status");
    sub.appendChild(item.statusEl);
    meta.appendChild(nameEl);
    meta.appendChild(sub);

    var rm = h("button", "fi-remove");
    rm.type = "button";
    rm.setAttribute("data-uid", String(item.uid));
    rm.setAttribute("aria-label", "Remover " + file.name);
    rm.innerHTML = ICON_X;
    item.removeBtn = rm;

    li.appendChild(thumb);
    li.appendChild(meta);
    li.appendChild(rm);
    item.li = li;
    setItemStatus(item, "pending");
    return item;
  }

  function setItemStatus(item, status) {
    item.status = status;
    item.li.setAttribute("data-status", status);
    item.statusEl.textContent = "";
    if (status === "uploading") item.statusEl.appendChild(h("span", "fi-spin"));
    item.statusEl.appendChild(document.createTextNode(STATUS_TEXT[status]));
  }

  /* libera o object URL da miniatura (espera a imagem terminar de carregar, se ainda estiver) */
  function revokeItemUrl(item) {
    var url = item.url;
    item.url = null;
    if (!url || !window.URL || !URL.revokeObjectURL) return;
    function revoke() {
      try { URL.revokeObjectURL(url); } catch (e) { /* nada a fazer */ }
    }
    if (item.img && !item.img.complete) item.img.onload = item.img.onerror = revoke;
    else revoke();
  }

  function setSlotError(slot, msgs) {
    slot.error.textContent = "";
    msgs.forEach(function (m) { slot.error.appendChild(h("span", null, m)); });
  }

  function removeItem(slot, uid) {
    if (state.sending) return;
    var idx = -1;
    slot.items.forEach(function (it, i) { if (it.uid === uid) idx = i; });
    if (idx === -1) return;
    var item = slot.items[idx];
    revokeItemUrl(item);
    slot.items.splice(idx, 1);
    if (item.li.parentNode) item.li.parentNode.removeChild(item.li);
    setSlotError(slot, []);
    // foco vai para o próximo item (ou anterior, ou a própria dropzone)
    var next = slot.items[idx] || slot.items[idx - 1];
    focusNoScroll(next ? next.removeBtn : slot.input);
    announce("Arquivo “" + item.name + "” removido.");
    updateFilesSummary();
    scheduleSave();
  }

  function clearAllFiles() {
    SLOT_ORDER.forEach(function (name) {
      var slot = slots[name];
      if (!slot) return;
      slot.items.forEach(revokeItemUrl);
      slot.items = [];
      slot.pathSeq = 0;              // só é chamado junto com um briefingId novo
      slot.list.textContent = "";
      setSlotError(slot, []);
    });
    updateFilesSummary();
  }

  /* ---------- totais / resumo ---------- */
  function slotActive(slot) { return !slot.el.closest("[hidden]"); }
  function isUploaded(item) { return item.uploaded; }
  function allItems(onlyActive) {
    var out = [];
    SLOT_ORDER.forEach(function (name) {
      var slot = slots[name];
      if (!slot || (onlyActive && !slotActive(slot))) return;
      out = out.concat(slot.items);
    });
    return out;
  }
  function sumBytes(items) {
    return items.reduce(function (t, it) { return t + it.size; }, 0);
  }

  function updateFilesSummary() {
    if (!filesSummary) return;
    var active = allItems(true);
    var hiddenCount = allItems(false).length - active.length;
    var main = active.length
      ? plural(active.length, "arquivo selecionado", "arquivos selecionados") + " · " + fmtSize(sumBytes(active))
      : "Nenhum arquivo selecionado";
    var extra = hiddenCount
      ? "(" + plural(hiddenCount, "arquivo está numa seção oculta e não será enviado", "arquivos estão em seções ocultas e não serão enviados") + ")"
      : (active.length ? "· limite de 60 MB no total" : "— todos os envios são opcionais.");
    var mainEl = $(".fs-main", filesSummary);
    var extraEl = $(".fs-extra", filesSummary);
    if (mainEl.textContent !== main) mainEl.textContent = main;
    if (extraEl.textContent !== extra) extraEl.textContent = extra;
    filesSummary.classList.toggle("has-files", active.length > 0);
  }

  /* ============================================================
     Validação
     ============================================================ */
  function fieldValid(id) {
    var v = String(byId(id).value || "").trim();
    if (id === "email") return EMAIL_RE.test(v);
    if (id === "whatsapp") {
      var digits = v.replace(/\D/g, "").length;
      return digits === 0 || digits >= 10;
    }
    return v !== "";
  }

  /* devolve os elementos inválidos da etapa n; show = marca os erros na tela */
  function validateStep(n, show) {
    var bad = [];
    (STEP_FIELDS[n] || []).forEach(function (id) {
      var ok = fieldValid(id);
      if (show) setInvalid(byId(id), !ok);
      if (!ok) bad.push(byId(id));
    });
    if (n === 4) {
      var hasSvc = selectedServices().length > 0;
      if (show) setSvcError(!hasSvc);
      if (!hasSvc) bad.push(svcInputs[0]);
    }
    return bad;
  }
  function firstInvalidStep(upTo) {
    for (var s = 1; s <= upTo; s++) { if (validateStep(s, false).length) return s; }
    return 0;
  }
  function focusField(el) {
    var box = el.closest(".field") || el.closest(".svc-fieldset") || el;
    focusNoScroll(el);
    box.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }

  /* ============================================================
     Navegação entre etapas
     ============================================================ */
  function activePanel() {
    return panels.filter(function (p) { return toInt(p.getAttribute("data-step")) === state.current; })[0];
  }

  function renderStepper() {
    var cur = state.current;
    nodes.forEach(function (node) {
      var i = toInt(node.getAttribute("data-node"));
      node.classList.toggle("active", i === cur);
      node.classList.toggle("done", i < cur);
      node.classList.toggle("visited", i > cur && i <= state.maxReached);
      node.disabled = state.sending || i > state.maxReached;   // não deixa pular etapas não visitadas
      if (i === cur) node.setAttribute("aria-current", "step");
      else node.removeAttribute("aria-current");
    });
    bars.forEach(function (bar) {
      bar.classList.toggle("filled", toInt(bar.getAttribute("data-bar")) < cur);
    });
  }

  /* opts.scroll: rola até as etapas · opts.focus: foca o título da etapa (leitores de tela) */
  function showStep(n, opts) {
    opts = opts || {};
    state.current = clamp(n, 1, TOTAL_STEPS);
    if (state.current > state.maxReached) state.maxReached = state.current;
    panels.forEach(function (p) {
      p.classList.toggle("active", toInt(p.getAttribute("data-step")) === state.current);
    });
    renderStepper();
    if (opts.scroll) scrollToSteps();
    if (opts.focus) focusNoScroll($(".step-title", activePanel()));
    scheduleSave();
  }

  function scrollToSteps() {
    var top = stepper.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop) - NAV_OFFSET;
    window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
  }

  function goNext() {
    if (state.sending) return;
    var bad = validateStep(state.current, true);
    if (bad.length) { focusField(bad[0]); return; }
    showStep(state.current + 1, { scroll: true, focus: true });
  }

  /* clique no stepper: volta livremente; avança só validando as etapas do meio */
  function goTo(n) {
    if (state.sending || n === state.current || n > state.maxReached) return;
    if (n > state.current) {
      for (var s = state.current; s < n; s++) {
        var bad = validateStep(s, true);
        if (bad.length) {
          if (s !== state.current) showStep(s);
          focusField(bad[0]);
          return;
        }
      }
    }
    showStep(n, { scroll: true, focus: true });
  }

  form.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest) return;
    if (t.closest("[data-next]")) goNext();
    else if (t.closest("[data-prev]") && !state.sending) showStep(state.current - 1, { scroll: true, focus: true });
  });

  stepper.addEventListener("click", function (e) {
    var node = e.target.closest && e.target.closest(".node");
    if (node && !node.disabled) goTo(toInt(node.getAttribute("data-node")));
  });

  // Enter num campo avança de etapa (em vez de enviar o formulário antes da hora)
  form.addEventListener("keydown", function (e) {
    if (e.defaultPrevented || e.key !== "Enter") return;
    var t = e.target;
    if (t.tagName !== "INPUT" || /^(file|submit|button)$/.test(t.type)) return;
    e.preventDefault();
    if (state.current < TOTAL_STEPS) goNext();
  });

  /* ============================================================
     Rascunho automático (localStorage) — sempre em try/catch
     ============================================================ */
  function readFields() {
    var data = {};
    [].slice.call(form.elements).forEach(function (el) {
      var name = el.name;
      if (!name || el.type === "file" || el.tagName === "BUTTON" || el.tagName === "FIELDSET") return;
      if (el.type === "checkbox") {
        if (!data[name]) data[name] = [];
        if (el.checked) data[name].push(el.value);
      } else if (el.type === "radio") {
        if (el.checked) data[name] = el.value;
        else if (!hasOwn(data, name)) data[name] = "";
      } else {
        data[name] = el.value;
      }
    });
    return data;
  }

  function writeFields(data) {
    [].slice.call(form.elements).forEach(function (el) {
      var name = el.name;
      if (!name || el.type === "file" || el.tagName === "BUTTON" || !hasOwn(data, name)) return;
      var v = data[name];
      if (el.type === "checkbox") {
        el.checked = Array.isArray(v) && v.indexOf(el.value) !== -1;
      } else if (el.type === "radio") {
        el.checked = v === el.value;
      } else if (typeof v === "string") {
        el.value = v;
        if (el.tagName === "SELECT" && el.selectedIndex === -1) el.selectedIndex = 0;
      }
    });
  }

  function hasContent(data) {
    for (var k in data) {
      if (!hasOwn(data, k)) continue;
      var v = data[k];
      if (typeof v === "string" ? v.trim() !== "" : (v && v.length)) return true;
    }
    return false;
  }

  function saveDraft() {
    if (state.submitted) return;
    var fields = readFields();
    var files = allItems(false).length;
    try {
      if (!hasContent(fields) && !files) { localStorage.removeItem(DRAFT_KEY); return; }
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        v: 2, savedAt: Date.now(), step: state.current, maxReached: state.maxReached,
        files: files, fields: fields
      }));
    } catch (e) { /* sem localStorage (aba anônima, cota cheia…) — segue sem rascunho */ }
  }

  function clearDraft() {
    scheduleSave.cancel();
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* idem */ }
  }

  function loadDraft() {
    var raw = null, d = null;
    try { raw = localStorage.getItem(DRAFT_KEY); } catch (e) { return null; }
    if (!raw) return null;
    try { d = JSON.parse(raw); } catch (e) { d = null; }
    var valid = d && d.v === 2 && d.fields && typeof d.fields === "object" && hasContent(d.fields) &&
                !(d.savedAt && Date.now() - d.savedAt > DRAFT_MAX_AGE);
    if (!valid) { clearDraft(); return null; }
    return d;
  }

  function syncAllUI() {
    refreshAllChoices();
    syncRadioMemory();
    syncServices();
    applyMarca();
    applyDominio();
    updateFilesSummary();
  }

  function restoreDraft() {
    var d = loadDraft();
    if (!d) return false;
    writeFields(d.fields);
    syncAllUI();
    // volta para a etapa salva, mas nunca além de uma etapa obrigatória incompleta
    var step = clamp(toInt(d.step) || 1, 1, TOTAL_STEPS);
    var bad = firstInvalidStep(step - 1);
    if (bad) step = bad;
    state.maxReached = clamp(Math.max(toInt(d.maxReached), step), 1, TOTAL_STEPS);
    showStep(step);
    draftFiles.hidden = !(toInt(d.files) > 0);
    draftNote.hidden = false;
    return true;
  }

  draftReset.addEventListener("click", function () {
    if (state.sending) return;
    clearDraft();
    form.reset();
    clearAllFiles();
    validatedIds().forEach(function (id) { setInvalid(byId(id), false); });
    setSvcError(false);
    hideSendError();
    syncAllUI();
    state.briefingId = null;
    state.insertAttempts = 0;
    state.maxReached = 1;
    setSubmitLabel("Enviar briefing");
    draftNote.hidden = true;
    showStep(1, { scroll: true, focus: true });
    announce("Formulário limpo. Você pode começar do zero.");
  });

  form.addEventListener("input", function () { scheduleSave(); });
  form.addEventListener("change", function () { scheduleSave(); });

  /* ============================================================
     Payload — colunas de public.briefings
     ============================================================ */
  function isActive(el) { return !el.closest("[hidden]"); }   // seção/bloco escondido → null

  function textVal(name) {
    var el = byId(name);
    if (!el || !isActive(el)) return null;
    var v = String(el.value || "").trim();
    return v === "" ? null : v;
  }
  function radioVal(name) {
    var el = form.querySelector('input[type="radio"][name="' + name + '"]:checked');
    return el && isActive(el) ? el.value : null;
  }
  function checkVal(name) {
    var vals = $$('input[type="checkbox"][name="' + name + '"]', form)
      .filter(function (i) { return i.checked && isActive(i); })
      .map(function (i) { return i.value; });
    return vals.length ? vals.join(", ") : null;
  }

  function buildPayload(items) {
    var p = { id: state.briefingId, servico: selectedServices().join(",") };
    TEXT_FIELDS.forEach(function (n) { p[n] = textVal(n); });
    RADIO_FIELDS.forEach(function (n) { p[n] = radioVal(n); });
    CHECK_FIELDS.forEach(function (n) { p[n] = checkVal(n); });
    p.arquivos = items.filter(isUploaded).map(function (it) {
      return { slot: it.slot, nome: it.name, path: it.path, tamanho: it.size, tipo: it.mime };
    });
    return p;
  }

  /* ============================================================
     Envio: uploads (Storage) → insert (briefings)
     ============================================================ */
  function setSubmitLabel(text) { submitLabel.textContent = text; }
  function hideSendError() { sendError.classList.remove("show"); }
  function showSendError(msg) {
    sendErrorText.textContent = msg;
    sendError.classList.add("show");
    sendError.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }

  function setSending(on) {
    state.sending = on;
    form.classList.toggle("is-sending", on);
    submitBtn.disabled = on;
    submitBtn.classList.toggle("loading", on);
    submitBtn.setAttribute("aria-busy", on ? "true" : "false");
    $$("[data-prev]", form).forEach(function (b) { b.disabled = on; });
    draftReset.disabled = on;
    SLOT_ORDER.forEach(function (name) {
      var slot = slots[name];
      if (!slot) return;
      slot.input.disabled = on;
      slot.el.classList.toggle("is-disabled", on);
      slot.items.forEach(function (it) { it.removeBtn.disabled = on; });
    });
    renderStepper();
  }

  /* {uuid}/{slot}/{NN}-{nome-sanitizado}.{ext} */
  function storagePath(item) {
    return state.briefingId + "/" + item.slot + "/" + pad2(item.seq) + "-" + sanitizeBase(item.name) + "." + item.ext;
  }
  function errText(err) { return String((err && (err.message || err.error)) || ""); }
  // o mesmo caminho já existe → foi enviado numa tentativa anterior cuja resposta se perdeu
  function isDuplicateError(err) {
    return !!err && (String(err.statusCode) === "409" || err.status === 409 || /already exists|duplicate/i.test(errText(err)));
  }
  function isRejectedFileError(err) {
    if (!err) return false;
    var code = String(err.statusCode || err.status || "");
    return code === "413" || code === "415" || /mime|not supported|exceeded|too large/i.test(errText(err));
  }

  function isStorageUnavailableError(err) {
    if (!err) return false;
    var code = String(err.statusCode || err.status || "");
    return code === "404" || /no such bucket|bucket not found/i.test(errText(err));
  }

  function uploadOne(item) {
    // o caminho é fixado na 1ª tentativa e reaproveitado nas seguintes
    if (!item.path) {
      var slot = slots[item.slot];
      slot.pathSeq += 1;
      item.seq = slot.pathSeq;
      item.path = storagePath(item);
    }
    setItemStatus(item, "uploading");
    // reembrulha com o MIME da extensão (.ai/.eps/.cdr costumam vir sem type e o bucket recusaria)
    var body;
    try { body = new Blob([item.file], { type: item.mime }); } catch (e) { body = item.file; }
    return Promise.resolve()
      .then(function () {
        return supa.storage.from(BUCKET).upload(item.path, body, {
          contentType: item.mime, upsert: false, cacheControl: "3600"
        });
      })
      .then(function (res) {
        if (res && res.error && !isDuplicateError(res.error)) throw res.error;
        item.uploaded = true;
        setItemStatus(item, "done");
      })
      .catch(function (err) {
        setItemStatus(item, "error");
        throw { kind: "upload", item: item, error: err };
      });
  }

  /* sobe os pendentes com concorrência limitada; para no primeiro erro (sem reenviar os já enviados) */
  function uploadAll(items, onProgress) {
    var queue = items.filter(function (it) { return !it.uploaded; });
    return new Promise(function (resolve, reject) {
      var next = 0, running = 0, failure = null;
      function pump() {
        if (failure) { if (!running) reject(failure); return; }
        if (next >= queue.length) { if (!running) resolve(); return; }
        while (running < UPLOAD_CONCURRENCY && next < queue.length) start(queue[next++]);
      }
      function start(item) {
        running++;
        uploadOne(item).then(function () {
          running--;
          onProgress();
          pump();
        }, function (err) {
          running--;
          if (!failure) failure = err;
          pump();
        });
      }
      pump();
    });
  }

  /* insert simples (sem .select(): o anônimo não tem SELECT na tabela) */
  function insertBriefing(items) {
    var payload = buildPayload(items);
    state.insertAttempts++;
    var isRetry = state.insertAttempts > 1;
    return Promise.resolve()
      .then(function () { return supa.from(TABLE).insert([payload]); })
      .then(function (res) {
        var err = res && res.error;
        if (!err) return;
        // re-tentativa e a chave primária já existe → a tentativa anterior tinha entrado
        var pkDup = err.code === "23505" && /pkey|\(id\)/i.test(errText(err) + " " + String(err.details || ""));
        if (isRetry && pkDup) return;
        throw { kind: "insert", error: err };
      }, function (err) {
        throw { kind: "insert", error: err };
      });
  }

  function onSendError(err, items) {
    setSending(false);
    setSubmitLabel("Tentar novamente");
    var msg;
    if (err && err.kind === "upload") {
      var name = err.item ? err.item.name : "um dos arquivos";
      msg = isStorageUnavailableError(err.error)
        ? "O envio de arquivos está indisponível no momento. Seus arquivos continuam selecionados; tente novamente mais tarde ou cole um link para eles na etapa Arquivos."
        : isRejectedFileError(err.error)
        ? "O arquivo “" + name + "” foi recusado (formato ou tamanho não aceito). Remova-o e tente novamente — o que já foi enviado não será perdido."
        : "Não conseguimos enviar “" + name + "”. Verifique sua conexão e tente novamente — o que já foi enviado não será perdido.";
    } else if (items.some(isUploaded)) {
      msg = "Seus arquivos já foram enviados, mas não conseguimos registrar o briefing. Verifique sua conexão e tente novamente.";
    } else {
      msg = "Não conseguimos enviar agora. Verifique sua conexão e tente novamente.";
    }
    if (window.console) console.error("Briefing — erro no envio:", err && err.error ? err.error : err);
    showSendError(msg);
  }

  function onSuccess(items) {
    state.submitted = true;
    state.sending = false;
    clearDraft();
    var sent = items.filter(isUploaded).length;
    allItems(false).forEach(revokeItemUrl);

    form.style.display = "none";
    stepper.style.display = "none";
    draftNote.hidden = true;
    if (reqNote) reqNote.hidden = true;
    if (sent) {
      successFiles.textContent = "Recebemos também " + plural(sent, "arquivo", "arquivos") + ".";
      successFiles.hidden = false;
    }
    successScreen.classList.add("show");

    var top = successScreen.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop) - NAV_OFFSET - 24;
    window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
    focusNoScroll($("h2", successScreen));
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (state.sending || state.submitted) return;
    hideSendError();

    // 1) obrigatórios — leva até a etapa do primeiro problema
    for (var s = 1; s <= TOTAL_STEPS; s++) {
      var bad = validateStep(s, true);
      if (bad.length) {
        if (s !== state.current) showStep(s);
        focusField(bad[0]);
        return;
      }
    }
    if (!supa) {
      showSendError("Configuração do Supabase ausente. Preencha assets/js/supabase-config.js.");
      return;
    }

    // 2) id do briefing: um por sessão, reutilizado nas re-tentativas
    if (!state.briefingId) state.briefingId = uuidv4();

    // 3) só os arquivos dos slots visíveis/ativos
    var items = allItems(true);
    var total = items.length;
    function progressLabel() {
      setSubmitLabel("Enviando arquivos (" + items.filter(isUploaded).length + "/" + total + ")…");
    }

    setSending(true);
    if (total) {
      progressLabel();
      announce("Enviando " + plural(total, "arquivo", "arquivos") + "…");
    } else {
      setSubmitLabel("Enviando…");
    }

    // 4) uploads → 5) insert → 6) sucesso
    uploadAll(items, progressLabel)
      .then(function () {
        setSubmitLabel("Finalizando…");
        return insertBriefing(items);
      })
      .then(function () { onSuccess(items); })
      .catch(function (err) { onSendError(err, items); });
  });

  /* ============================================================
     Inicialização
     ============================================================ */
  initSlots();
  syncAllUI();
  if (!restoreDraft()) showStep(1);
})();
