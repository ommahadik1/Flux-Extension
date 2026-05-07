// Background script for Universal Currency Converter

const UPDATE_INTERVAL_MINUTES = 60;

function getApiUrls(baseCurrency) {
  return [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${baseCurrency}.json`,
    `https://latest.currency-api.pages.dev/v1/currencies/${baseCurrency}.json`
  ];
}

async function updateExchangeRate() {
  chrome.storage.local.get(["baseCurrency", "targetCurrency"], async (settings) => {
    const base = settings.baseCurrency || "usd";
    const target = settings.targetCurrency || "inr";
    let data = null;

    const urls = getApiUrls(base);

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
      console.error("All API endpoints failed.");
      return;
    }

    const newRate = data?.[base]?.[target];
    if (!newRate || typeof newRate !== "number") {
      console.error("Unexpected API response format:", data);
      return;
    }

    await chrome.storage.local.set({
      exchangeRate: newRate,
      ratesCache: data[base],
      cachedBase: base,
      lastUpdate: Date.now(),
    });

    await notifyTabs(newRate, base, target);
  });
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
  updateExchangeRate();
  chrome.alarms.create("updateExchangeRateAlarm", {
    periodInMinutes: UPDATE_INTERVAL_MINUTES,
  });
});

chrome.runtime.onStartup.addListener(() => {
  updateExchangeRate();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "updateExchangeRateAlarm") {
    updateExchangeRate();
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
    // If settings changed, we need to update them before fetching
    if (request.baseCurrency && request.targetCurrency) {
       chrome.storage.local.set({
         baseCurrency: request.baseCurrency,
         targetCurrency: request.targetCurrency
       }, () => {
         chrome.storage.local.get(["ratesCache", "cachedBase", "lastUpdate"], (cache) => {
           const isFresh = cache.lastUpdate && (Date.now() - cache.lastUpdate < UPDATE_INTERVAL_MINUTES * 60 * 1000);
           if (cache.cachedBase === request.baseCurrency && cache.ratesCache && isFresh) {
             const newRate = cache.ratesCache[request.targetCurrency];
             if (newRate) {
               chrome.storage.local.set({ exchangeRate: newRate }, () => {
                 notifyTabs(newRate, request.baseCurrency, request.targetCurrency);
                 sendResponse({ status: "updated" });
               });
               return;
             }
           }
           updateExchangeRate().then(() => sendResponse({ status: "updated" }));
         });
       });
    } else {
       updateExchangeRate().then(() => sendResponse({ status: "updated" }));
    }
    return true;
  }
});
