// JC Handyman Build 12.2 — Clean Supabase Cloud Sync
(function (window) {
  "use strict";

  const PROJECT_URL = "https://qaytmydpamtyyanxholt.supabase.co";
  const PUBLISHABLE_KEY = "sb_publishable_Cid02Bn9hFnu0iy_AJ2LFQ_AxqXCLNl";
  const TABLE = "crm_records";
  const LAST_SYNC_KEY = "jc_cloud_last_sync";
  const COLLECTIONS = {
    jc_customers: "customers",
    jc_properties: "properties",
    jc_jobs: "jobs",
    jc_estimates: "estimates",
    jc_invoices: "invoices",
    jc_schedule: "schedule",
    jc_inspections: "inspections",
    jc_photo_docs: "photo_docs",
    jc_property_notes: "property_notes"
  };

  let client = null;
  let session = null;
  let syncing = false;
  let lastSnapshot = "";
  const listeners = new Set();

  function emit(type, detail = {}) {
    const event = { type, detail, at: new Date().toISOString() };
    listeners.forEach(fn => {
      try { fn(event); } catch (error) { console.error(error); }
    });
  }

  function readArray(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("Invalid local data for", key, error);
      return [];
    }
  }

  function recordId(record, index) {
    return String(record?.id || record?.uuid || record?.recordId || `legacy-${index}`);
  }

  function createSnapshot() {
    return JSON.stringify(
      Object.keys(COLLECTIONS).map(key => [key, localStorage.getItem(key) || "[]"])
    );
  }

  async function init() {
    if (!window.supabase?.createClient) {
      throw new Error("The Supabase browser library did not load.");
    }

    client = window.supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    session = data.session || null;
    lastSnapshot = createSnapshot();

    client.auth.onAuthStateChange((event, newSession) => {
      session = newSession || null;
      emit("auth", { event, user: session?.user || null });
    });

    window.addEventListener("online", () => {
      emit("connection", { online: true });
      if (session) syncNow().catch(error => emit("error", { message: error.message }));
    });

    window.addEventListener("offline", () => emit("connection", { online: false }));

    setInterval(async () => {
      const snapshot = createSnapshot();
      const changed = snapshot !== lastSnapshot;
      if (navigator.onLine && session && changed) {
        try {
          await syncNow();
          lastSnapshot = createSnapshot();
        } catch (error) {
          emit("error", { message: error.message });
        }
      }
    }, 30000);

    emit("ready", { online: navigator.onLine, user: session?.user || null });
    return true;
  }

  async function signIn(email, password) {
    if (!client) await init();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    session = data.session || null;
    emit("auth", { event: "SIGNED_IN", user: data.user || null });
    return data;
  }

  async function signUp(email, password) {
    if (!client) await init();
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) throw error;
    session = data.session || null;
    return data;
  }

  async function signOut() {
    if (!client) await init();
    const { error } = await client.auth.signOut();
    if (error) throw error;
    session = null;
    emit("auth", { event: "SIGNED_OUT", user: null });
  }

  async function getUser() {
    if (!client) await init();
    const { data, error } = await client.auth.getUser();
    if (error) {
      if (/session missing/i.test(error.message || "")) return null;
      throw error;
    }
    return data.user || null;
  }

  async function pushLocal() {
    if (!session) throw new Error("Please sign in first.");
    if (!navigator.onLine) throw new Error("You are offline. Your data is still saved on this device.");

    const rows = [];
    const updatedAt = new Date().toISOString();

    Object.entries(COLLECTIONS).forEach(([localKey, collection]) => {
      readArray(localKey).forEach((record, index) => {
        const id = recordId(record, index);
        rows.push({
          user_id: session.user.id,
          collection,
          record_id: id,
          data: { ...record, id, _cloudUpdatedAt: updatedAt },
          updated_at: updatedAt,
          deleted_at: null
        });
      });
    });

    if (!rows.length) return { uploaded: 0 };

    const chunkSize = 250;
    let uploaded = 0;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await client
        .from(TABLE)
        .upsert(chunk, { onConflict: "user_id,collection,record_id" });
      if (error) throw error;
      uploaded += chunk.length;
    }

    return { uploaded };
  }

  async function pullCloud() {
    if (!session) throw new Error("Please sign in first.");
    if (!navigator.onLine) throw new Error("You are offline. Connect to the internet before restoring.");

    const { data, error } = await client
      .from(TABLE)
      .select("collection,record_id,data,updated_at")
      .eq("user_id", session.user.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: true });

    if (error) throw error;

    const localByCollection = Object.fromEntries(
      Object.entries(COLLECTIONS).map(([localKey, collection]) => [collection, localKey])
    );

    const grouped = {};
    (data || []).forEach(row => {
      if (!localByCollection[row.collection]) return;
      (grouped[row.collection] ||= []).push({
        ...(row.data || {}),
        id: row.record_id,
        _cloudUpdatedAt: row.updated_at
      });
    });

    Object.entries(grouped).forEach(([collection, cloudRecords]) => {
      const localKey = localByCollection[collection];
      const existing = readArray(localKey);
      const merged = new Map(existing.map((record, index) => [recordId(record, index), record]));

      cloudRecords.forEach(record => {
        const current = merged.get(record.id);
        const currentTime = Date.parse(
          current?._cloudUpdatedAt || current?.updatedAt || current?.createdAt || 0
        );
        const cloudTime = Date.parse(record._cloudUpdatedAt || 0);
        if (!current || cloudTime >= currentTime) merged.set(record.id, record);
      });

      localStorage.setItem(localKey, JSON.stringify([...merged.values()]));
    });

    lastSnapshot = createSnapshot();
    return { downloaded: (data || []).length };
  }

  async function syncNow() {
    if (syncing) return { busy: true };
    if (!session) throw new Error("Please sign in first.");
    if (!navigator.onLine) throw new Error("You are offline. Changes will remain saved on this device.");

    syncing = true;
    emit("sync-start");
    try {
      const pushed = await pushLocal();
      const pulled = await pullCloud();
      const at = new Date().toISOString();
      localStorage.setItem(LAST_SYNC_KEY, at);
      lastSnapshot = createSnapshot();
      const result = { ...pushed, ...pulled, at };
      emit("sync-success", result);
      return result;
    } finally {
      syncing = false;
    }
  }

  async function cloudCount() {
    if (!session) return 0;
    const { count, error } = await client
      .from(TABLE)
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.user.id)
      .is("deleted_at", null);
    if (error) throw error;
    return count || 0;
  }

  function localCounts() {
    return Object.fromEntries(
      Object.entries(COLLECTIONS).map(([localKey, collection]) => [
        collection,
        readArray(localKey).length
      ])
    );
  }

  window.JCCloud = {
    init,
    signIn,
    signUp,
    signOut,
    getUser,
    syncNow,
    pushLocal,
    pullCloud,
    migrateLocalData: syncNow,
    cloudCount,
    localCounts,
    queueCount: () => 0,
    lastSync: () => localStorage.getItem(LAST_SYNC_KEY),
    isOnline: () => navigator.onLine,
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };

  init().catch(error => {
    console.error("JC Cloud initialization failed:", error);
    emit("error", { message: error.message });
  });
})(window);
