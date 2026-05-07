// Popup script for Universal Currency Converter

document.addEventListener("DOMContentLoaded", () => {
  const baseCurrencySelect = document.getElementById("baseCurrency");
  const targetCurrencySelect = document.getElementById("targetCurrency");
  const swapBtn = document.getElementById("swapCurrencies");
  const currentRateEl = document.getElementById("currentRate");
  const lastUpdatedEl = document.getElementById("lastUpdated");
  const refreshBtn = document.getElementById("refreshRate");
  const showBadgeToggle = document.getElementById("showBadge");
  const enabledToggle = document.getElementById("enabled");
  
  const sitePowerBtn = document.getElementById("sitePower");
  const disabledSection = document.getElementById("disabledSection");
  const disabledList = document.getElementById("disabledList");

  let currentRootDomain = null;
  let disabledDomains = [];

  // ── Currency Symbols Map ──────────────────────────────────────
  const SYMBOLS = {
    usd: "$", eur: "€", gbp: "£", inr: "₹", jpy: "¥", 
    cad: "C$", aud: "A$", chf: "CHF", cny: "CN¥", sgd: "S$"
  };

  // ── Domain Utilities ──────────────────────────────────────────
  function getRootDomain(hostname) {
    const parts = hostname.split(".");
    if (parts.length <= 2) return hostname;
    const ccSLDs = ["co", "com", "org", "net", "gov", "edu", "ac"];
    if (ccSLDs.includes(parts[parts.length - 2])) {
      return parts.slice(-3).join(".");
    }
    return parts.slice(-2).join(".");
  }

  // ── Initialize ────────────────────────────────────────────────
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab && tab.url) {
      try {
        const url = new URL(tab.url);
        currentRootDomain = getRootDomain(url.hostname);
      } catch {
        sitePowerBtn.disabled = true;
      }
    } else {
      sitePowerBtn.disabled = true;
    }
    loadSettings();
  });

  function loadSettings() {
    chrome.storage.local.get(
      ["baseCurrency", "targetCurrency", "exchangeRate", "lastUpdate", "enabled", "showBadge", "disabledDomains"],
      (data) => {
        if (data.baseCurrency) baseCurrencySelect.value = data.baseCurrency;
        if (data.targetCurrency) targetCurrencySelect.value = data.targetCurrency;
        
        enabledToggle.checked = data.hasOwnProperty("enabled") ? data.enabled : true;
        showBadgeToggle.checked = data.hasOwnProperty("showBadge") ? data.showBadge : true;
        disabledDomains = Array.isArray(data.disabledDomains) ? data.disabledDomains : [];

        updateRateDisplay(data.exchangeRate, data.lastUpdate);
        updateSiteUI();
        renderDisabledList();
      }
    );
  }

  // ── Exchange Rate Logic ───────────────────────────────────────
  
  function updateRateDisplay(rate, lastUpdate) {
    if (!rate) {
      currentRateEl.textContent = "Unavailable";
      lastUpdatedEl.textContent = "Check connection";
      return;
    }
    
    const base = baseCurrencySelect.value;
    const target = targetCurrencySelect.value;
    
    // Format nicely based on value (e.g., JPY needs no decimals, small values need more)
    let formattedRate;
    if (rate < 0.01) formattedRate = rate.toFixed(4);
    else if (target === 'jpy') formattedRate = rate.toFixed(0);
    else formattedRate = rate.toFixed(2);

    currentRateEl.textContent = `1 ${SYMBOLS[base]} = ${formattedRate} ${SYMBOLS[target]}`;
    
    if (lastUpdate) {
      lastUpdatedEl.textContent = `Updated ${timeAgo(lastUpdate)}`;
    }
  }

  function handleCurrencyChange() {
    if (baseCurrencySelect.value === targetCurrencySelect.value) {
      // Prevent same currency by swapping
      swapCurrencies();
      return;
    }

    currentRateEl.textContent = "Loading...";
    
    const base = baseCurrencySelect.value;
    const target = targetCurrencySelect.value;

    chrome.runtime.sendMessage({ 
      action: "forceUpdate", 
      baseCurrency: base, 
      targetCurrency: target 
    }, () => {
      chrome.storage.local.get(["exchangeRate", "lastUpdate"], (data) => {
        updateRateDisplay(data.exchangeRate, data.lastUpdate);
      });
    });
  }

  baseCurrencySelect.addEventListener("change", handleCurrencyChange);
  targetCurrencySelect.addEventListener("change", handleCurrencyChange);

  function swapCurrencies() {
    const temp = baseCurrencySelect.value;
    baseCurrencySelect.value = targetCurrencySelect.value;
    targetCurrencySelect.value = temp;
    handleCurrencyChange();
  }
  
  swapBtn.addEventListener("click", swapCurrencies);

  refreshBtn.addEventListener("click", () => {
    refreshBtn.classList.add("spinning");
    currentRateEl.textContent = "Loading...";
    chrome.runtime.sendMessage({ action: "forceUpdate", baseCurrency: baseCurrencySelect.value, targetCurrency: targetCurrencySelect.value }, () => {
      refreshBtn.classList.remove("spinning");
      chrome.storage.local.get(["exchangeRate", "lastUpdate"], (data) => {
        updateRateDisplay(data.exchangeRate, data.lastUpdate);
      });
    });
  });

  // ── Global Toggles ────────────────────────────────────────────

  showBadgeToggle.addEventListener("change", () => {
    const val = showBadgeToggle.checked;
    chrome.storage.local.set({ showBadge: val });
    notifyTabs({ action: "toggleBadge", showBadge: val });
  });

  enabledToggle.addEventListener("change", () => {
    const val = enabledToggle.checked;
    chrome.storage.local.set({ enabled: val });
    notifyTabs({ action: "toggleEnabled", enabled: val });
  });

  // ── Site Power ────────────────────────────────────────────────

  function updateSiteUI() {
    if (!currentRootDomain) return;
    const isDisabled = disabledDomains.includes(currentRootDomain);
    sitePowerBtn.classList.toggle("active", !isDisabled);
    sitePowerBtn.classList.toggle("inactive", isDisabled);
  }

  sitePowerBtn.addEventListener("click", () => {
    if (!currentRootDomain) return;
    
    const idx = disabledDomains.indexOf(currentRootDomain);
    if (idx >= 0) disabledDomains.splice(idx, 1);
    else disabledDomains.push(currentRootDomain);

    chrome.storage.local.set({ disabledDomains }, () => {
      updateSiteUI();
      renderDisabledList();
      notifyTabs({ action: "toggleDomain", disabledDomains });
    });
  });

  // ── Disabled Sites ────────────────────────────────────────────

  function renderDisabledList() {
    disabledList.innerHTML = "";
    if (disabledDomains.length === 0) {
      disabledSection.style.display = "none";
      return;
    }
    
    disabledSection.style.display = "block";
    for (const domain of disabledDomains) {
      const item = document.createElement("div");
      item.className = "disabled-item";
      item.textContent = domain;

      const btn = document.createElement("button");
      btn.className = "remove-btn";
      btn.innerHTML = "&times;";
      btn.title = "Re-enable";
      btn.onclick = () => {
        disabledDomains = disabledDomains.filter((d) => d !== domain);
        chrome.storage.local.set({ disabledDomains }, () => {
          updateSiteUI();
          renderDisabledList();
          notifyTabs({ action: "toggleDomain", disabledDomains });
        });
      };
      
      item.appendChild(btn);
      disabledList.appendChild(item);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────

  function notifyTabs(msg) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, msg).catch(() => {});
      }
    });
  }

  function timeAgo(ts) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(ts).toLocaleDateString();
  }
});
