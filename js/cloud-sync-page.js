// JC Handyman Build 12.2 — Cloud Sync page controller
(function () {
  "use strict";

  const $ = id => document.getElementById(id);
  const logLines = [];

  function setLog(text) {
    logLines.unshift(`[${new Date().toLocaleTimeString()}] ${text}`);
    $("activityLog").textContent = logLines.slice(0, 30).join("\n");
  }

  function setMessage(id, text, type = "") {
    const element = $(id);
    if (!element) return;
    element.textContent = text;
    element.className = `message ${type}`.trim();
  }

  function setConnection() {
    const online = navigator.onLine;
    $("internetStatus").textContent = online ? "Online" : "Offline";
    $("connectionBadge").textContent = online ? "Online" : "Offline";
    $("connectionBadge").className = `badge ${online ? "online" : "offline"}`;
  }

  function refreshLocalCounts() {
    const counts = JCCloud.localCounts();
    $("migrationSummary").innerHTML = Object.entries(counts)
      .map(([name, count]) => `
        <div class="collection">
          <span>${name.replaceAll("_", " ")}</span>
          <strong>${Number(count || 0)}</strong>
        </div>`)
      .join("");

    $("queueCount").textContent = "0";
    $("lastSync").textContent = JCCloud.lastSync()
      ? new Date(JCCloud.lastSync()).toLocaleString()
      : "Never";
  }

  async function refreshUser() {
    try {
      const user = await JCCloud.getUser();
      $("signedInAs").textContent = user?.email || "Not signed in";
      $("signOutBtn").classList.toggle("hidden", !user);
      $("cloudCount").textContent = user ? await JCCloud.cloudCount() : "—";
      return user;
    } catch (error) {
      $("signedInAs").textContent = "Not signed in";
      $("cloudCount").textContent = "—";
      setLog(`User check: ${error.message}`);
      return null;
    }
  }

  $("authForm").addEventListener("submit", async event => {
    event.preventDefault();
    const email = $("emailInput").value.trim();
    const password = $("passwordInput").value;

    try {
      setMessage("authMessage", "Signing in…");
      await JCCloud.signIn(email, password);
      setMessage("authMessage", "Signed in successfully.", "success");
      setLog("Signed in successfully.");
      await refreshUser();
      setConnection();
    } catch (error) {
      setMessage("authMessage", error.message, "error");
      setLog(`Sign-in failed: ${error.message}`);
    }
  });

  $("signUpBtn").addEventListener("click", async () => {
    const email = $("emailInput").value.trim();
    const password = $("passwordInput").value;

    if (!email || password.length < 6) {
      setMessage("authMessage", "Enter an email and a password with at least 6 characters.", "error");
      return;
    }

    try {
      setMessage("authMessage", "Creating account…");
      const data = await JCCloud.signUp(email, password);
      setMessage(
        "authMessage",
        data.session
          ? "Account created and signed in."
          : "Account created. Check your email for a confirmation link.",
        "success"
      );
      await refreshUser();
    } catch (error) {
      setMessage("authMessage", error.message, "error");
    }
  });

  $("signOutBtn").addEventListener("click", async () => {
    try {
      await JCCloud.signOut();
      setMessage("authMessage", "Signed out.", "success");
      await refreshUser();
    } catch (error) {
      setMessage("authMessage", error.message, "error");
    }
  });

  $("syncNowBtn").addEventListener("click", async () => {
    try {
      setLog("Sync started.");
      const result = await JCCloud.syncNow();
      setLog(`Sync complete: ${result.uploaded || 0} uploaded, ${result.downloaded || 0} downloaded.`);
      refreshLocalCounts();
      await refreshUser();
    } catch (error) {
      setLog(`Sync failed: ${error.message}`);
      alert(error.message);
    }
  });

  $("pullBtn").addEventListener("click", async () => {
    try {
      const result = await JCCloud.pullCloud();
      setLog(`Restored ${result.downloaded || 0} cloud records.`);
      refreshLocalCounts();
      alert("Cloud data restored. Refresh your CRM pages to see the records.");
    } catch (error) {
      setLog(`Restore failed: ${error.message}`);
      alert(error.message);
    }
  });

  $("migrateBtn").addEventListener("click", async () => {
    try {
      setMessage("migrationMessage", "Migration running…");
      const result = await JCCloud.migrateLocalData();
      setMessage(
        "migrationMessage",
        `Migration complete: ${result.uploaded || 0} uploaded and ${result.downloaded || 0} downloaded.`,
        "success"
      );
      setLog("Migration completed.");
      refreshLocalCounts();
      await refreshUser();
    } catch (error) {
      setMessage("migrationMessage", error.message, "error");
      setLog(`Migration failed: ${error.message}`);
    }
  });

  $("refreshSummaryBtn").addEventListener("click", refreshLocalCounts);

  JCCloud.on(event => {
    if (event.type === "ready") {
      setConnection();
      refreshUser();
    }
    if (event.type === "connection") setConnection();
    if (event.type === "auth") refreshUser();
    if (event.type === "sync-success") {
      refreshLocalCounts();
      refreshUser();
    }
    if (event.type === "error") setLog(`Cloud error: ${event.detail.message}`);
  });

  window.addEventListener("online", setConnection);
  window.addEventListener("offline", setConnection);

  setConnection();
  refreshLocalCounts();
  refreshUser();
})();
