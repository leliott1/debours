/* Débours — frais de déplacement
 * Vanilla JS + Supabase (auth + base) + SheetJS (export Excel). */

(function () {
  "use strict";

  // Catégories = colonnes du tableau de frais compta
  const CATEGORIES = {
    train_sncf:  { label: "Train SNCF",                   icon: "🚆", col: "TRAIN SNCF" },
    peage:       { label: "Péage",                        icon: "🛣️", col: "PEAGE HT" },
    carburant:   { label: "Carburant",                    icon: "⛽", col: "CARBURANT HT" },
    fournitures: { label: "Fournitures / Matériel",       icon: "🔧", col: "FOURNITURES-MATERIEL CHANTIER" },
    divers:      { label: "Divers (RATP…)",               icon: "🚇", col: "DIVERS : RATP,…." },
  };
  const CAT_ORDER = ["train_sncf", "peage", "carburant", "fournitures", "divers"];

  const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
  const $ = (s) => document.querySelector(s);

  const els = {
    authScreen: $("#auth-screen"), appScreen: $("#app-screen"), configBanner: $("#config-banner"),
    recoveryScreen: $("#recovery-screen"), recoveryForm: $("#recovery-form"),
    recoveryPassword: $("#recovery-password"), recoveryError: $("#recovery-error"),
    authForm: $("#auth-form"), authEmail: $("#auth-email"), authPassword: $("#auth-password"),
    authSubmit: $("#auth-submit"), authError: $("#auth-error"), authInfo: $("#auth-info"),
    authToggle: $("#auth-toggle"), authSwitchText: $("#auth-switch-text"),
    authForgot: $("#auth-forgot"),
    userEmail: $("#user-email"), logoutBtn: $("#logout-btn"),
    prevMonth: $("#prev-month"), nextMonth: $("#next-month"), monthPicker: $("#month-picker"),
    sumTotal: $("#sum-total"), sumTva: $("#sum-tva"), sumCount: $("#sum-count"),
    exportBtn: $("#export-btn"), list: $("#expense-list"), emptyState: $("#empty-state"),
    addBtn: $("#add-btn"),
    modal: $("#modal"), modalBackdrop: $("#modal-backdrop"), modalTitle: $("#modal-title"),
    form: $("#expense-form"), fId: $("#expense-id"), fDate: $("#f-date"),
    fFournisseur: $("#f-fournisseur"), fCategorie: $("#f-categorie"), fTtc: $("#f-ttc"),
    fTva: $("#f-tva"), fHt: $("#f-ht"), fChantier: $("#f-chantier"),
    formError: $("#form-error"), deleteBtn: $("#delete-btn"), cancelBtn: $("#cancel-btn"),
    saveBtn: $("#save-btn"),
    scanBtn: $("#scan-btn"), scanInput: $("#scan-input"), scanStatus: $("#scan-status"),
    chantiersBtn: $("#chantiers-btn"), chantiersModal: $("#chantiers-modal"),
    chantiersBackdrop: $("#chantiers-backdrop"), chantiersClose: $("#chantiers-close"),
    chantierForm: $("#chantier-form"), chantierNom: $("#chantier-nom"),
    chantierError: $("#chantier-error"), chantiersList: $("#chantiers-list"),
    chantiersEmpty: $("#chantiers-empty"),
  };

  let sb = null;
  let isSignup = false;
  let expenses = [];          // dépenses du mois courant
  let chantiers = [];         // liste des chantiers de l'utilisateur
  let currentMonth = "";      // "YYYY-MM"
  // L'utilisateur arrive-t-il via un lien de réinitialisation de mot de passe ?
  let inRecovery = location.hash.includes("type=recovery");

  function isConfigured() {
    const c = window.APP_CONFIG || {};
    return c.SUPABASE_URL && c.SUPABASE_ANON_KEY &&
      !c.SUPABASE_URL.includes("TON-PROJET") && !c.SUPABASE_ANON_KEY.includes("TA_CLE");
  }

  // ---------- Authentification ----------
  const showAuthError = (m) => { els.authError.textContent = m; els.authError.classList.remove("hidden"); els.authInfo.classList.add("hidden"); };
  const showAuthInfo = (m) => { els.authInfo.textContent = m; els.authInfo.classList.remove("hidden"); els.authError.classList.add("hidden"); };
  const clearAuthError = () => { els.authError.classList.add("hidden"); els.authInfo.classList.add("hidden"); };

  // URL de retour pour les emails (réinitialisation / lien magique)
  const APP_URL = location.origin + location.pathname;

  els.authToggle.addEventListener("click", () => {
    isSignup = !isSignup;
    clearAuthError();
    els.authSubmit.textContent = isSignup ? "Créer mon compte" : "Se connecter";
    els.authSwitchText.textContent = isSignup ? "Déjà un compte ?" : "Pas encore de compte ?";
    els.authToggle.textContent = isSignup ? "Se connecter" : "Créer un compte";
    els.authPassword.setAttribute("autocomplete", isSignup ? "new-password" : "current-password");
  });

  els.authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAuthError();
    const email = els.authEmail.value.trim();
    const password = els.authPassword.value;
    els.authSubmit.disabled = true;
    try {
      if (isSignup) {
        const { error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        showAuthError("✅ Compte créé. Si une confirmation email est demandée, valide-la puis connecte-toi.");
        els.authToggle.click();
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      showAuthError(translateError(err.message));
    } finally {
      els.authSubmit.disabled = false;
      els.authSubmit.textContent = isSignup ? "Créer mon compte" : "Se connecter";
    }
  });

  els.logoutBtn.addEventListener("click", () => sb.auth.signOut());

  // Mot de passe oublié → email de réinitialisation
  els.authForgot.addEventListener("click", async () => {
    clearAuthError();
    const email = els.authEmail.value.trim();
    if (!email) { showAuthError("Saisis d'abord ton email ci-dessus, puis reclique sur « Mot de passe oublié »."); return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: APP_URL });
    if (error) showAuthError(translateError(error.message));
    else showAuthInfo("📧 Email envoyé à " + email + ". Clique le lien pour choisir un nouveau mot de passe.");
  });

  // Définir un nouveau mot de passe (après clic sur le lien de réinitialisation)
  els.recoveryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.recoveryError.classList.add("hidden");
    const pwd = els.recoveryPassword.value;
    if (pwd.length < 6) { els.recoveryError.textContent = "6 caractères minimum."; els.recoveryError.classList.remove("hidden"); return; }
    const { error } = await sb.auth.updateUser({ password: pwd });
    if (error) { els.recoveryError.textContent = translateError(error.message); els.recoveryError.classList.remove("hidden"); return; }
    inRecovery = false;
    els.recoveryScreen.classList.add("hidden");
    // la session est déjà active → on entre dans l'app
    const { data } = await sb.auth.getSession();
    if (data.session) showApp(data.session);
  });

  function translateError(msg) {
    const m = (msg || "").toLowerCase();
    if (m.includes("invalid login")) return "Email ou mot de passe incorrect.";
    if (m.includes("already registered")) return "Cet email a déjà un compte.";
    if (m.includes("password")) return "Mot de passe trop court (6 caractères minimum).";
    if (m.includes("email")) return "Adresse email invalide.";
    return msg || "Une erreur est survenue.";
  }

  // ---------- Mois courant ----------
  function monthBounds(ym) {
    const [y, m] = ym.split("-").map(Number);
    const start = `${ym}-01`;
    const end = new Date(y, m, 1).toISOString().slice(0, 10); // 1er du mois suivant
    return { start, end };
  }
  function shiftMonth(ym, delta) {
    const [y, m] = ym.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  function monthLabel(ym) {
    const [y, m] = ym.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }

  els.prevMonth.addEventListener("click", () => setMonth(shiftMonth(currentMonth, -1)));
  els.nextMonth.addEventListener("click", () => setMonth(shiftMonth(currentMonth, +1)));
  els.monthPicker.addEventListener("change", () => { if (els.monthPicker.value) setMonth(els.monthPicker.value); });

  function setMonth(ym) {
    currentMonth = ym;
    els.monthPicker.value = ym;
    loadExpenses();
  }

  // ---------- Données ----------
  async function loadExpenses() {
    const { start, end } = monthBounds(currentMonth);
    const { data, error } = await sb.from("depenses").select("*")
      .gte("date", start).lt("date", end)
      .order("date", { ascending: true }).order("created_at", { ascending: true });
    if (error) { console.error(error); return; }
    expenses = data || [];
    render();
  }

  // ---------- Chantiers ----------
  async function loadChantiers() {
    const { data, error } = await sb.from("chantiers").select("*")
      .order("nom", { ascending: true });
    if (error) { console.error(error); return; }
    chantiers = data || [];
    renderChantiers();
  }

  function renderChantiers() {
    els.chantiersList.innerHTML = "";
    els.chantiersEmpty.classList.toggle("hidden", chantiers.length > 0);
    for (const c of chantiers) {
      const li = document.createElement("li");
      li.className = "chantier-item";
      const nom = document.createElement("span");
      nom.className = "nom"; nom.textContent = c.nom;
      const del = document.createElement("button");
      del.type = "button"; del.textContent = "Supprimer";
      del.addEventListener("click", async () => {
        if (!confirm("Supprimer le chantier « " + c.nom + " » ?")) return;
        const { error } = await sb.from("chantiers").delete().eq("id", c.id);
        if (error) { alert("Erreur : " + error.message); return; }
        await loadChantiers();
      });
      li.appendChild(nom); li.appendChild(del);
      els.chantiersList.appendChild(li);
    }
  }

  const openChantiers = () => { els.chantierError.classList.add("hidden"); renderChantiers(); els.chantiersModal.classList.remove("hidden"); };
  const closeChantiers = () => els.chantiersModal.classList.add("hidden");
  els.chantiersBtn.addEventListener("click", openChantiers);
  els.chantiersClose.addEventListener("click", closeChantiers);
  els.chantiersBackdrop.addEventListener("click", closeChantiers);

  els.chantierForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.chantierError.classList.add("hidden");
    const nom = els.chantierNom.value.trim();
    if (!nom) return;
    if (chantiers.some((c) => c.nom.toLowerCase() === nom.toLowerCase())) {
      els.chantierError.textContent = "Ce chantier existe déjà."; els.chantierError.classList.remove("hidden"); return;
    }
    const { error } = await sb.from("chantiers").insert({ nom });
    if (error) { els.chantierError.textContent = "Erreur : " + error.message; els.chantierError.classList.remove("hidden"); return; }
    els.chantierNom.value = "";
    await loadChantiers();
  });
  const saveExpense = (payload, id) =>
    id ? sb.from("depenses").update(payload).eq("id", id) : sb.from("depenses").insert(payload);
  const deleteExpense = (id) => sb.from("depenses").delete().eq("id", id);

  // ---------- Rendu ----------
  const htOf = (e) => (Number(e.montant_ttc) || 0) - (Number(e.tva) || 0);

  function render() {
    let total = 0, tva = 0;
    for (const e of expenses) { total += Number(e.montant_ttc) || 0; tva += Number(e.tva) || 0; }
    els.sumTotal.textContent = eur.format(total);
    els.sumTva.textContent = eur.format(tva);
    els.sumCount.textContent = String(expenses.length);

    els.list.innerHTML = "";
    els.emptyState.classList.toggle("hidden", expenses.length > 0);

    for (const e of expenses) {
      const cat = CATEGORIES[e.categorie] || CATEGORIES.divers;
      const li = document.createElement("li");
      li.className = "expense-item";
      li.innerHTML = `
        <span class="expense-icon">${cat.icon}</span>
        <div class="expense-main">
          <div class="expense-desc">${escapeHtml(e.fournisseur || cat.label)}</div>
          <div class="expense-meta">${formatDate(e.date)} · ${cat.label}${e.chantier ? " · " + escapeHtml(e.chantier) : ""}</div>
        </div>
        <div class="expense-right">
          <div class="expense-amount">${eur.format(Number(e.montant_ttc) || 0)}</div>
          ${Number(e.tva) ? `<span class="badge">TVA ${eur.format(Number(e.tva))}</span>` : ""}
        </div>`;
      li.addEventListener("click", () => openModal(e));
      els.list.appendChild(li);
    }
  }

  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function formatDate(d) { if (!d) return ""; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; }

  // ---------- Modale ----------
  function recomputeHt() {
    const ttc = parseFloat(els.fTtc.value) || 0;
    const tva = parseFloat(els.fTva.value) || 0;
    els.fHt.textContent = eur.format(Math.max(0, ttc - tva));
  }
  els.fTtc.addEventListener("input", recomputeHt);
  els.fTva.addEventListener("input", recomputeHt);

  function openModal(e) {
    els.formError.classList.add("hidden");
    setScan("", "");
    if (e) {
      els.modalTitle.textContent = "Modifier la dépense";
      els.fId.value = e.id;
      els.fDate.value = e.date;
      els.fFournisseur.value = e.fournisseur || "";
      els.fCategorie.value = e.categorie;
      els.fTtc.value = e.montant_ttc;
      els.fTva.value = e.tva || "";
      fillChantierSelect(e.chantier || "");
      els.deleteBtn.classList.remove("hidden");
    } else {
      els.modalTitle.textContent = "Nouvelle dépense";
      els.form.reset();
      els.fId.value = "";
      fillChantierSelect("");
      // date par défaut : aujourd'hui si dans le mois affiché, sinon le 1er du mois
      const today = new Date().toISOString().slice(0, 10);
      els.fDate.value = today.startsWith(currentMonth) ? today : currentMonth + "-01";
      els.deleteBtn.classList.add("hidden");
    }
    recomputeHt();
    els.modal.classList.remove("hidden");
  }

  // Remplit la liste déroulante des chantiers (en gardant la valeur déjà saisie)
  function fillChantierSelect(ensureValue) {
    const sel = els.fChantier;
    sel.innerHTML = '<option value="">— Aucun —</option>';
    const noms = chantiers.map((c) => c.nom);
    if (ensureValue && !noms.includes(ensureValue)) noms.push(ensureValue);
    for (const nom of noms) {
      const o = document.createElement("option");
      o.value = nom; o.textContent = nom;
      sel.appendChild(o);
    }
    sel.value = ensureValue || "";
  }
  const closeModal = () => els.modal.classList.add("hidden");

  els.addBtn.addEventListener("click", () => openModal(null));
  els.cancelBtn.addEventListener("click", closeModal);
  els.modalBackdrop.addEventListener("click", closeModal);

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.formError.classList.add("hidden");
    const id = els.fId.value || null;
    const ttc = parseFloat(els.fTtc.value);
    const tva = parseFloat(els.fTva.value) || 0;
    if (isNaN(ttc) || ttc < 0) {
      els.formError.textContent = "Montant TTC invalide."; els.formError.classList.remove("hidden"); return;
    }
    if (tva > ttc) {
      els.formError.textContent = "La TVA ne peut pas dépasser le montant TTC."; els.formError.classList.remove("hidden"); return;
    }
    const payload = {
      date: els.fDate.value,
      fournisseur: els.fFournisseur.value.trim() || null,
      categorie: els.fCategorie.value,
      montant_ttc: ttc,
      tva: tva,
      chantier: els.fChantier.value.trim() || null,
    };
    els.saveBtn.disabled = true;
    const { error } = await saveExpense(payload, id);
    els.saveBtn.disabled = false;
    if (error) { els.formError.textContent = "Erreur : " + error.message; els.formError.classList.remove("hidden"); return; }
    closeModal();
    // si la date change de mois, on suit la dépense
    const ym = payload.date.slice(0, 7);
    if (ym !== currentMonth) setMonth(ym); else loadExpenses();
  });

  els.deleteBtn.addEventListener("click", async () => {
    const id = els.fId.value;
    if (!id || !confirm("Supprimer cette dépense ?")) return;
    const { error } = await deleteExpense(id);
    if (error) { els.formError.textContent = "Erreur : " + error.message; els.formError.classList.remove("hidden"); return; }
    closeModal();
    loadExpenses();
  });

  // ---------- Scan d'un ticket (photo → pré-remplissage via Gemini) ----------
  const setScan = (msg, cls) => {
    els.scanStatus.textContent = msg;
    els.scanStatus.className = "scan-status" + (cls ? " " + cls : "");
    els.scanStatus.classList.toggle("hidden", !msg);
  };

  els.scanBtn.addEventListener("click", () => els.scanInput.click());

  els.scanInput.addEventListener("change", async () => {
    const file = els.scanInput.files && els.scanInput.files[0];
    els.scanInput.value = ""; // permet de re-sélectionner le même fichier
    if (!file) return;
    els.scanBtn.disabled = true;
    setScan("🔎 Analyse du ticket en cours…", "working");
    try {
      const image = await fileToResizedDataUrl(file, 1600);
      const { data, error } = await sb.functions.invoke("extract-ticket", {
        body: { image, mimeType: "image/jpeg" },
      });
      if (error) throw new Error(error.message || "Échec de l'analyse.");
      if (data && data.error) throw new Error(data.error);
      applyExtraction(data || {});
      setScan("✅ Ticket lu ! Vérifie les champs puis enregistre.", "ok");
    } catch (e) {
      setScan("⚠️ " + (e.message || "Lecture impossible. Saisis à la main."), "ko");
    } finally {
      els.scanBtn.disabled = false;
    }
  });

  // Remplit le formulaire à partir des données extraites
  function applyExtraction(d) {
    if (d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date)) els.fDate.value = d.date;
    if (d.fournisseur) els.fFournisseur.value = d.fournisseur;
    if (d.categorie && CATEGORIES[d.categorie]) els.fCategorie.value = d.categorie;
    if (d.montant_ttc != null && !isNaN(Number(d.montant_ttc)) && Number(d.montant_ttc) > 0)
      els.fTtc.value = Number(d.montant_ttc);
    if (d.tva != null && !isNaN(Number(d.tva)) && Number(d.tva) > 0)
      els.fTva.value = Number(d.tva);
    recomputeHt();
  }

  // Lit un fichier image, le redimensionne (max `maxPx`) et renvoie un dataURL JPEG
  function fileToResizedDataUrl(file, maxPx) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Image illisible."));
        img.onload = () => {
          let { width, height } = img;
          if (width > maxPx || height > maxPx) {
            const r = Math.min(maxPx / width, maxPx / height);
            width = Math.round(width * r);
            height = Math.round(height * r);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // ---------- Export Excel (format compta) ----------
  els.exportBtn.addEventListener("click", () => {
    if (!expenses.length) { alert("Aucune dépense à exporter pour ce mois."); return; }
    const cfg = window.APP_CONFIG;
    const colKeys = CAT_ORDER; // train_sncf, peage, carburant, fournitures, divers
    const headers = ["DATE", "LIBELLE FOURNISSEUR",
      ...colKeys.map((k) => CATEGORIES[k].col), "TVA", "TOTAL", "chantier"];

    const aoa = [
      [cfg.SOCIETE || ""],
      ["TABLEAU DE FRAIS DE DEPLACEMENT DU MOIS", monthLabel(currentMonth)],
      ["NOM DU SALARIE : " + (cfg.SALARIE || "")],
      ["PENSEZ A AGRAFER TOUS VOS JUSTIFICATIFS"],
      headers,
    ];

    const totals = { train_sncf: 0, peage: 0, carburant: 0, fournitures: 0, divers: 0, tva: 0, total: 0 };
    for (const e of expenses) {
      const ht = htOf(e);
      const row = [formatDate(e.date), e.fournisseur || ""];
      for (const k of colKeys) row.push(e.categorie === k ? round2(ht) : "");
      row.push(round2(Number(e.tva) || 0));
      row.push(round2(Number(e.montant_ttc) || 0));
      row.push(e.chantier || "");
      aoa.push(row);
      totals[e.categorie] += ht;
      totals.tva += Number(e.tva) || 0;
      totals.total += Number(e.montant_ttc) || 0;
    }
    aoa.push(["", "TOTAL",
      round2(totals.train_sncf), round2(totals.peage), round2(totals.carburant),
      round2(totals.fournitures), round2(totals.divers), round2(totals.tva), round2(totals.total), ""]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 11 }, { wch: 22 }, { wch: 11 }, { wch: 10 }, { wch: 12 },
                   { wch: 22 }, { wch: 14 }, { wch: 9 }, { wch: 11 }, { wch: 28 }];
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 9 } },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Frais " + currentMonth);
    XLSX.writeFile(wb, `frais_deplacement_${currentMonth}.xlsx`);
  });

  const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

  // ---------- Navigation écrans ----------
  function showApp(session) {
    els.authScreen.classList.add("hidden");
    els.recoveryScreen.classList.add("hidden");
    els.appScreen.classList.remove("hidden");
    els.userEmail.textContent = session.user.email;
    loadChantiers();
    if (!currentMonth) setMonth(new Date().toISOString().slice(0, 7));
    else loadExpenses();
  }
  function showAuth() {
    els.appScreen.classList.add("hidden");
    els.recoveryScreen.classList.add("hidden");
    els.authScreen.classList.remove("hidden");
    expenses = [];
  }
  function showRecovery() {
    els.appScreen.classList.add("hidden");
    els.authScreen.classList.add("hidden");
    els.recoveryScreen.classList.remove("hidden");
  }

  // ---------- Init ----------
  async function init() {
    if (!isConfigured()) {
      els.configBanner.classList.remove("hidden");
      els.authScreen.classList.remove("hidden");
      els.authSubmit.disabled = els.authEmail.disabled = els.authPassword.disabled = true;
      return;
    }
    sb = window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY);
    sb.auth.onAuthStateChange((event, session) => {
      // Lien de réinitialisation cliqué : on FORCE l'écran "nouveau mot de passe",
      // même si une session vient d'être ouverte.
      if (event === "PASSWORD_RECOVERY") { inRecovery = true; showRecovery(); return; }
      if (inRecovery) { showRecovery(); return; }
      if (session) showApp(session); else showAuth();
    });
    const { data } = await sb.auth.getSession();
    // Si on arrive par un lien de récupération, on impose l'écran "nouveau mot de passe".
    if (inRecovery) showRecovery();
    else if (data.session) showApp(data.session);
    else showAuth();
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(() => {}));
  }

  init();
})();
