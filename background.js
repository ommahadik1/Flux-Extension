// Background script for Flux Currency Converter

const UPDATE_INTERVAL_MINUTES = 60;

// Track the latest forceUpdate request to discard stale responses
// NOTE: latestRequestId resets on every service worker restart (MV3 limitation).
// A response in-flight across a SW restart will be discarded as stale (ID mismatch).
// This is an acceptable edge case — the user can manually refresh.
let latestRequestId = 0;

function getApiUrls(baseCurrency) {
  return [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${baseCurrency}.json`,
    `https://latest.currency-api.pages.dev/v1/currencies/${baseCurrency}.json`
  ];
}

/**
 * Fetches the exchange rate for a given currency pair.
 * Accepts base and target directly to avoid reading stale storage state.
 * Returns a Promise that resolves with { rate, allRates, base, target }.
 */
async function fetchExchangeRate(base, target) {
  const urls = getApiUrls(base);
  let data = null;

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
      break;
    } catch (error) {
      console.warn(`Failed to fetch from ${url}:`, error.message);
    }
  }

  if (!data) {
    throw new Error("All API endpoints failed.");
  }

  const rate = data?.[base]?.[target];
  if (typeof rate !== "number" || !isFinite(rate) || rate <= 0) {
    throw new Error(`Unexpected API response format for ${base}->${target}`);
  }

  return { rate, allRates: data[base], base, target };
}

/**
 * Updates exchange rate and persists to storage.
 * Can be called from alarms/startup (reads storage for currencies)
 * or with explicit base/target params (from forceUpdate).
 */
async function updateExchangeRate(baseOverride, targetOverride) {
  let base = baseOverride;
  let target = targetOverride;

  // If not provided, read from storage
  if (!base || !target) {
    const settings = await chrome.storage.local.get(["baseCurrency", "targetCurrency"]);
    base = settings.baseCurrency || "usd";
    target = settings.targetCurrency || "inr";
  }

  const result = await fetchExchangeRate(base, target);

  const now = Date.now();
  await chrome.storage.local.set({
    exchangeRate: result.rate,
    ratesCache: result.allRates,
    cachedBase: result.base,
    baseCurrency: result.base,
    targetCurrency: result.target,
    lastUpdate: now,
  });

  await notifyTabs(result.rate, result.base, result.target);

  return { rate: result.rate, lastUpdate: now, base: result.base, target: result.target };
}

async function notifyTabs(newRate, base, target) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: "updateExchangeRate",
        exchangeRate: newRate,
        baseCurrency: base,
        targetCurrency: target
      });
    } catch (_) {
      // Content script not loaded on this tab
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    baseCurrency: "usd",
    targetCurrency: "inr",
    exchangeRate: 84.0, // Initial fallback
    enabled: true,
    showBadge: true,
    disabledDomains: [],
    lastUpdate: null,
  });
  updateExchangeRate("usd", "inr").catch(console.error);
  chrome.alarms.create("updateExchangeRateAlarm", {
    periodInMinutes: UPDATE_INTERVAL_MINUTES,
  });
});

chrome.runtime.onStartup.addListener(() => {
  updateExchangeRate().catch(console.error);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "updateExchangeRateAlarm") {
    updateExchangeRate().catch(console.error);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getExchangeRate") {
    chrome.storage.local.get(["exchangeRate", "lastUpdate", "baseCurrency", "targetCurrency"], (data) => {
      sendResponse({
        exchangeRate: data.exchangeRate,
        lastUpdate: data.lastUpdate,
        baseCurrency: data.baseCurrency,
        targetCurrency: data.targetCurrency
      });
    });
    return true;

  } else if (request.action === "forceUpdate") {
    const base = request.baseCurrency;
    const target = request.targetCurrency;
    const requestId = ++latestRequestId;

    if (!base || !target) {
      updateExchangeRate()
        .then((result) => {
          if (requestId === latestRequestId) {
            sendResponse({ status: "updated", exchangeRate: result.rate, lastUpdate: result.lastUpdate });
          } else {
            sendResponse({ status: "stale" });
          }
        })
        .catch((err) => {
          console.error("forceUpdate failed:", err);
          sendResponse({ status: "error", message: err.message });
        });
      return true;
    }

    // Save the new currency selection immediately
    chrome.storage.local.set({ baseCurrency: base, targetCurrency: target });

    // Try cache first — if we have fresh rates for this base currency, use them
    chrome.storage.local.get(["ratesCache", "cachedBase", "lastUpdate"], (cache) => {
      const isFresh = cache.lastUpdate && (Date.now() - cache.lastUpdate < UPDATE_INTERVAL_MINUTES * 60 * 1000);

      if (cache.cachedBase === base && cache.ratesCache && isFresh) {
        const cachedRate = cache.ratesCache[target];
        if (cachedRate && typeof cachedRate === "number") {
          // Discard if a newer request has superseded this one
          if (requestId !== latestRequestId) {
            sendResponse({ status: "stale" });
            return;
          }

          const now = Date.now();
          chrome.storage.local.set({ exchangeRate: cachedRate, lastUpdate: now }, () => {
            notifyTabs(cachedRate, base, target);
            sendResponse({ status: "updated", exchangeRate: cachedRate, lastUpdate: now });
          });
          return;
        }
      }

      // Cache miss — fetch fresh rates
      updateExchangeRate(base, target)
        .then((result) => {
          if (requestId === latestRequestId) {
            sendResponse({ status: "updated", exchangeRate: result.rate, lastUpdate: result.lastUpdate });
          } else {
            sendResponse({ status: "stale" });
          }
        })
        .catch((err) => {
          console.error("forceUpdate fetch failed:", err);
          sendResponse({ status: "error", message: err.message });
        });
    });

    return true;
  }

  // Safety net  keep the message channel open for any unhandled async paths.
  return true;
});
