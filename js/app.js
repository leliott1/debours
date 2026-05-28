/* Débours — logique de l'application
 * Vanilla JS + Supabase (auth + base de données). Aucun build nécessaire. */

(function () {
  "use strict";

  // ----- Constantes d'affichage -----
  const CATEGORIES = {
    repas: { label: "Repas", icon: "🍽️" },
    transport: { label: "Transport", icon: "🚗" },
    hebergement: { label: "Hébergement", icon: "🏨" },
    fournitures: { label: "Fournitures", icon: "📦" },
    autre: { label: "Autre", icon: "💳" },
  };
  const STATUTS = {
    a_valider: "À valider",
    valide: "Validé",
    rembourse: "Remboursé",
  };

  const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

  // ----- Raccourcis DOM -----
  const $ = (sel) => document.querySelector(sel);

  const els = {
    authScreen: $("#auth-screen"),
    appScreen: $("#app-screen"),
    configBanner: $("#config-banner"),
    // auth
    authForm: $("#auth-form"),
    authEmail: $("#auth-email"),
    authPassword: $("#auth-password"),
    authSubmit: $("#auth-submit"),
    authError: $("#auth-error"),
    authToggle: $("#auth-toggle"),
    authSwitchText: $("#auth-switch-text"),
    // app
    userEmail: $("#user-email"),
    logoutBtn: $("#logout-btn"),
    sumTotal: $("#sum-total"),
    sumPending: $("#sum-pending"),
    sumPaid: $("#sum-paid"),
    filterStatut: $("#filter-statut"),
    filterCategorie: $("#filter-categorie"),
    list: $("#expense-list"),
    emptyState: $("#empty-state"),
    addBtn: $("#add-btn"),
    // modale
    modal: $("#modal"),
    modalBackdrop: $("#modal-backdrop"),
    modalTitle: $("#modal-title"),
    form: $("#expense-form"),
    fId: $("#expense-id"),
    fMontant: $("#f-montant"),
    fDate: $("#f-date"),
    fCategorie: $("#f-categorie"),
    fDescription: $("#f-description"),
    fStatut: $("#f-statut"),
    formError: $("#form-error"),
    deleteBtn: $("#delete-btn"),
    cancelBtn: $("#cancel-btn"),
    saveBtn: $("#save-btn"),
  };

  // ----- État -----
  let sb = null;          // client supabase
  let isSignup = false;   // mode connexion vs création de compte
  let expenses = [];      // dépenses chargées

  // ----- Vérification de la config -----
  function isConfigured() {
    const c = window.APP_CONFIG || {};
    return (
      c.SUPABASE_URL &&
      c.SUPABASE_ANON_KEY &&
      !c.SUPABASE_URL.includes("TON-PROJET") &&
      !c.SUPABASE_ANON_KEY.includes("TA_CLE")
    );
  }

  // ============================================================
  //  AUTHENTIFICATION
  // ============================================================
  function showAuthError(msg) {
    els.authError.textContent = msg;
    els.authError.classList.remove("hidden");
  }
  function clearAuthError() {
    els.authError.classList.add("hidden");
  }

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
    els.authSubmit.textContent = "…";

    try {
      if (isSignup) {
        const { error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        showAuthError("✅ Compte créé. Vérifie tes emails si une confirmation est demandée, puis connecte-toi.");
        isSignup = false;
        els.authToggle.click(); // remet en mode connexion (toggle inverse l'état)
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

  els.logoutBtn.addEventListener("click", async () => {
    await sb.auth.signOut();
  });

  function translateError(msg) {
    if (!msg) return "Une erreur est survenue.";
    const m = msg.toLowerCase();
    if (m.includes("invalid login")) return "Email ou mot de passe incorrect.";
    if (m.includes("already registered")) return "Cet email a déjà un compte.";
    if (m.includes("password")) return "Mot de passe trop court (6 caractères minimum).";
    if (m.includes("email")) return "Adresse email invalide.";
    return msg;
  }

  // ============================================================
  //  DONNÉES (CRUD)
  // ============================================================
  async function loadExpenses() {
    const { data, error } = await sb
      .from("depenses")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    expenses = data || [];
    render();
  }

  async function saveExpense(payload, id) {
    if (id) {
      return sb.from("depenses").update(payload).eq("id", id);
    }
    return sb.from("depenses").insert(payload);
  }

  async function deleteExpense(id) {
    return sb.from("depenses").delete().eq("id", id);
  }

  // ============================================================
  //  RENDU
  // ============================================================
  function getFiltered() {
    const fs = els.filterStatut.value;
    const fc = els.filterCategorie.value;
    return expenses.filter(
      (e) => (!fs || e.statut === fs) && (!fc || e.categorie === fc)
    );
  }

  function render() {
    // Totaux (sur l'ensemble, pas seulement le filtre)
    let total = 0, pending = 0, paid = 0;
    for (const e of expenses) {
      const m = Number(e.montant) || 0;
      total += m;
      if (e.statut === "a_valider") pending += m;
      if (e.statut === "rembourse") paid += m;
    }
    els.sumTotal.textContent = eur.format(total);
    els.sumPending.textContent = eur.format(pending);
    els.sumPaid.textContent = eur.format(paid);

    // Liste filtrée
    const items = getFiltered();
    els.list.innerHTML = "";
    els.emptyState.classList.toggle("hidden", items.length > 0);

    for (const e of items) {
      const cat = CATEGORIES[e.categorie] || CATEGORIES.autre;
      const li = document.createElement("li");
      li.className = "expense-item";
      li.innerHTML = `
        <span class="expense-icon">${cat.icon}</span>
        <div class="expense-main">
          <div class="expense-desc">${escapeHtml(e.description || cat.label)}</div>
          <div class="expense-meta">${formatDate(e.date)} · ${cat.label}</div>
        </div>
        <div class="expense-right">
          <div class="expense-amount">${eur.format(Number(e.montant) || 0)}</div>
          <span class="badge badge-${e.statut}">${STATUTS[e.statut] || e.statut}</span>
        </div>`;
      li.addEventListener("click", () => openModal(e));
      els.list.appendChild(li);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function formatDate(d) {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  }

  // ============================================================
  //  MODALE
  // ============================================================
  function openModal(expense) {
    els.formError.classList.add("hidden");
    if (expense) {
      els.modalTitle.textContent = "Modifier la dépense";
      els.fId.value = expense.id;
      els.fMontant.value = expense.montant;
      els.fDate.value = expense.date;
      els.fCategorie.value = expense.categorie;
      els.fDescription.value = expense.description || "";
      els.fStatut.value = expense.statut;
      els.deleteBtn.classList.remove("hidden");
    } else {
      els.modalTitle.textContent = "Nouvelle dépense";
      els.form.reset();
      els.fId.value = "";
      els.fDate.value = new Date().toISOString().slice(0, 10);
      els.fStatut.value = "a_valider";
      els.deleteBtn.classList.add("hidden");
    }
    els.modal.classList.remove("hidden");
  }

  function closeModal() {
    els.modal.classList.add("hidden");
  }

  els.addBtn.addEventListener("click", () => openModal(null));
  els.cancelBtn.addEventListener("click", closeModal);
  els.modalBackdrop.addEventListener("click", closeModal);
  els.filterStatut.addEventListener("change", render);
  els.filterCategorie.addEventListener("change", render);

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.formError.classList.add("hidden");
    const id = els.fId.value || null;
    const payload = {
      montant: parseFloat(els.fMontant.value),
      date: els.fDate.value,
      categorie: els.fCategorie.value,
      description: els.fDescription.value.trim() || null,
      statut: els.fStatut.value,
    };
    if (isNaN(payload.montant) || payload.montant < 0) {
      els.formError.textContent = "Montant invalide.";
      els.formError.classList.remove("hidden");
      return;
    }
    els.saveBtn.disabled = true;
    els.saveBtn.textContent = "…";
    const { error } = await saveExpense(payload, id);
    els.saveBtn.disabled = false;
    els.saveBtn.textContent = "Enregistrer";
    if (error) {
      els.formError.textContent = "Erreur d'enregistrement : " + error.message;
      els.formError.classList.remove("hidden");
      return;
    }
    closeModal();
    await loadExpenses();
  });

  els.deleteBtn.addEventListener("click", async () => {
    const id = els.fId.value;
    if (!id) return;
    if (!confirm("Supprimer cette dépense ?")) return;
    const { error } = await deleteExpense(id);
    if (error) {
      els.formError.textContent = "Erreur de suppression : " + error.message;
      els.formError.classList.remove("hidden");
      return;
    }
    closeModal();
    await loadExpenses();
  });

  // ============================================================
  //  NAVIGATION ENTRE ÉCRANS
  // ============================================================
  function showApp(session) {
    els.authScreen.classList.add("hidden");
    els.appScreen.classList.remove("hidden");
    els.userEmail.textContent = session.user.email;
    loadExpenses();
  }
  function showAuth() {
    els.appScreen.classList.add("hidden");
    els.authScreen.classList.remove("hidden");
    expenses = [];
  }

  // ============================================================
  //  INITIALISATION
  // ============================================================
  async function init() {
    if (!isConfigured()) {
      els.configBanner.classList.remove("hidden");
      els.authScreen.classList.remove("hidden");
      els.authSubmit.disabled = true;
      els.authEmail.disabled = true;
      els.authPassword.disabled = true;
      return;
    }

    sb = window.supabase.createClient(
      window.APP_CONFIG.SUPABASE_URL,
      window.APP_CONFIG.SUPABASE_ANON_KEY
    );

    // Réagit aux changements de session (connexion / déconnexion)
    sb.auth.onAuthStateChange((_event, session) => {
      if (session) showApp(session);
      else showAuth();
    });

    const { data } = await sb.auth.getSession();
    if (data.session) showApp(data.session);
    else showAuth();
  }

  // Enregistre le service worker (mode hors-ligne / installable)
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }

  init();
})();
