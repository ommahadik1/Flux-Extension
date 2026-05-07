// Content script for Universal Currency Converter

let exchangeRate = 84.0;
let baseCurrency = "usd";
let targetCurrency = "inr";
let isEnabled = true;
let showBadge = true;
let disabledDomains = [];
let processedNodes = new WeakSet();

// ── Currency Data ────────────────────────────────────────────────

// Using strings for regex source to avoid escape issues in literals
const CURRENCIES = {
  usd: { symbol: "$", locale: "en-US", code: "USD", regexStr: "\\$([\\d,]+\\.?\\d*)" },
  eur: { symbol: "€", locale: "de-DE", code: "EUR", regexStr: "€\\s?([\\d.]+,?\\d*)" },
  gbp: { symbol: "£", locale: "en-GB", code: "GBP", regexStr: "£([\\d,]+\\.?\\d*)" },
  inr: { symbol: "₹", locale: "en-IN", code: "INR", regexStr: "₹\\s?([\\d,]+\\.?\\d*)" },
  jpy: { symbol: "¥", locale: "ja-JP", code: "JPY", regexStr: "¥([\\d,]+\\.?\\d*)" },
  cad: { symbol: "C$", locale: "en-CA", code: "CAD", regexStr: "(?:C\\$|CAD\\s)([\\d,]+\\.?\\d*)" },
  aud: { symbol: "A$", locale: "en-AU", code: "AUD", regexStr: "(?:A\\$|AUD\\s)([\\d,]+\\.?\\d*)" },
  chf: { symbol: "CHF", locale: "de-CH", code: "CHF", regexStr: "CHF\\s?([\\d']+\\.?\\d*)" },
  cny: { symbol: "CN¥", locale: "zh-CN", code: "CNY", regexStr: "(?:CN¥|RMB)\\s?([\\d,]+\\.?\\d*)" },
  sgd: { symbol: "S$", locale: "en-SG", code: "SGD", regexStr: "(?:S\\$|SGD\\s)([\\d,]+\\.?\\d*)" }
};

// ── Domain Utilities ──────────────────────────────────────────────

function getRootDomain(hostname) {
  const parts = hostname.split(".");
  if (parts.length <= 2) return hostname;
  const ccSLDs = ["co", "com", "org", "net", "gov", "edu", "ac"];
  if (ccSLDs.includes(parts[parts.length - 2])) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

function isDomainDisabled() {
  const root = getRootDomain(window.location.hostname);
  return disabledDomains.some(
    (d) => d === root || d === window.location.hostname,
  );
}

// ── Formatting ────────────────────────────────────────────────────

function formatCurrency(amount, currencyCode) {
  const cur = CURRENCIES[currencyCode];
  if (!cur) return `${amount.toFixed(2)}`;

  const formatter = new Intl.NumberFormat(cur.locale, {
    style: 'currency',
    currency: cur.code,
    minimumFractionDigits: (cur.code === 'JPY') ? 0 : 2,
    maximumFractionDigits: (cur.code === 'JPY') ? 0 : 2
  });

  return formatter.format(amount);
}

function parseCurrency(amountStr, currencyCode) {
  const cur = CURRENCIES[currencyCode];
  if (!cur) return parseFloat(amountStr);

  let cleanStr = amountStr;
  if (cur.locale === "de-DE") {
    // European format: 1.234,56
    cleanStr = cleanStr.replace(/\./g, "").replace(/,/g, ".");
  } else if (cur.locale === "de-CH") {
    // Swiss format: 1'234.56
    cleanStr = cleanStr.replace(/'/g, "");
  } else {
    // US/UK format: 1,234.56
    cleanStr = cleanStr.replace(/,/g, "");
  }
  
  return parseFloat(cleanStr);
}

// ── Badge Helper ──────────────────────────────────────────────────

function createBadge(originalText) {
  const badge = document.createElement("sup");
  badge.className = "usd-inr-badge";
  badge.textContent = "≈";
  badge.title = `Converted from ${originalText.trim()}`;
  return badge;
}

function removeBadges() {
  document.querySelectorAll(".usd-inr-badge").forEach((b) => b.remove());
}

function addBadges() {
  document.querySelectorAll(".usd-inr-converted, [data-usd-converted]").forEach((el) => {
    if (!el.querySelector(".usd-inr-badge") && el.dataset.originalPrice) {
      el.appendChild(createBadge(el.dataset.originalPrice));
    }
  });
}

// ── Text Node Conversion ─────────────────────────────────────────

function convertTextNode(node) {
  if (processedNodes.has(node)) return;

  const parent = node.parentElement;
  if (
    !parent ||
    parent.isContentEditable ||
    parent.tagName === "SCRIPT" ||
    parent.tagName === "STYLE" ||
    parent.tagName === "TEXTAREA" ||
    parent.tagName === "INPUT" ||
    parent.closest("[data-usd-converted]")
  ) {
    return;
  }

  const cur = CURRENCIES[baseCurrency];
  if (!cur) return; 

  const text = node.textContent;
  
  const regexMatch = new RegExp(cur.regexStr, 'g');
  
  if (!regexMatch.test(text)) return;
  regexMatch.lastIndex = 0; 

  const newText = text.replace(regexMatch, (match, amountStr) => {
    const amount = parseCurrency(amountStr, baseCurrency);
    if (!isNaN(amount) && amount > 0) {
      return formatCurrency(amount * exchangeRate, targetCurrency);
    }
    return match;
  });

  if (text !== newText) {
    const span = document.createElement("span");
    span.className = "usd-inr-converted";
    span.dataset.originalPrice = text;
    span.textContent = newText;
    span.style.cssText = "background:transparent;padding:0;margin:0;display:inline;";

    if (showBadge) span.appendChild(createBadge(text));

    parent.replaceChild(span, node);
    processedNodes.add(span);
  }
}

// ── Structured Price Conversion (Amazon .a-price etc.) ───────────

function convertStructuredPrices(root) {
  if (!root || !root.querySelectorAll) return;

  const priceEls = root.querySelectorAll(".a-price:not([data-usd-converted]), .a-color-price:not([data-usd-converted]), .a-text-price:not([data-usd-converted])");

  const cur = CURRENCIES[baseCurrency];
  if (!cur) return;

  for (const priceEl of priceEls) {
    if (priceEl.closest("[data-usd-converted]") && priceEl.closest("[data-usd-converted]") !== priceEl) continue;

    const offscreen = priceEl.querySelector(".a-offscreen");
    const rawText = offscreen ? offscreen.textContent.trim() : priceEl.textContent.trim();

    const match = rawText.match(new RegExp(cur.regexStr));
    if (!match) continue;

    const amount = parseCurrency(match[1], baseCurrency);
    if (isNaN(amount) || amount <= 0) continue;

    const convertedValue = amount * exchangeRate;
    const formatted = formatCurrency(convertedValue, targetCurrency);
    
    priceEl.dataset.usdConverted = "true";
    priceEl.dataset.originalPrice = rawText;

    const symbolEl = priceEl.querySelector(".a-price-symbol");
    const wholeEl = priceEl.querySelector(".a-price-whole");
    const fractionEl = priceEl.querySelector(".a-price-fraction");

    if (symbolEl && wholeEl) {
      symbolEl.dataset.origText = symbolEl.textContent;
      symbolEl.textContent = CURRENCIES[targetCurrency].symbol;

      const numOnly = formatted.replace(CURRENCIES[targetCurrency].symbol, "").trim();
      let wholeStr = numOnly;
      let fractionStr = "";
      
      const sep = CURRENCIES[targetCurrency].locale.startsWith('de') ? ',' : '.';
      if (numOnly.includes(sep)) {
        const parts = numOnly.split(sep);
        fractionStr = parts.pop();
        wholeStr = parts.join(sep);
      }

      const decimalEl = wholeEl.querySelector(".a-price-decimal");
      wholeEl.dataset.origText = wholeEl.textContent;
      wholeEl.textContent = wholeStr;
      if (decimalEl) wholeEl.appendChild(decimalEl);

      if (fractionEl) {
        fractionEl.dataset.origText = fractionEl.textContent;
        fractionEl.textContent = fractionStr;
      }
    } else if (!offscreen && !priceEl.querySelector('*')) {
      priceEl.dataset.origText = priceEl.textContent;
      priceEl.textContent = formatted;
    }

    if (offscreen) {
      offscreen.dataset.origText = offscreen.textContent;
      offscreen.textContent = formatted;
    }
    const ariaHidden = priceEl.querySelector('[aria-hidden="true"]');
    if (ariaHidden && !ariaHidden.querySelector(".a-price-symbol")) {
      ariaHidden.dataset.origText = ariaHidden.textContent;
      ariaHidden.textContent = formatted;
    }

    if (showBadge) priceEl.appendChild(createBadge(rawText));

    processedNodes.add(priceEl);
  }
}

// ── Main Conversion Entry Point ──────────────────────────────────

function convertPrices(node) {
  if (!isEnabled || isDomainDisabled()) return;
  if (!node || processedNodes.has(node)) return;

  if (node.nodeType === Node.TEXT_NODE) {
    convertTextNode(node);
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    if (node.dataset && (node.dataset.originalPrice || node.dataset.usdConverted)) return;

    convertStructuredPrices(node);

    const children = Array.from(node.childNodes);
    for (const child of children) {
      convertPrices(child);
    }
  }
  processedNodes.add(node);
}

// ── Revert ───────────────────────────────────────────────────────

function revertPrices() {
  document.querySelectorAll(".usd-inr-converted").forEach((el) => {
    const textNode = document.createTextNode(el.dataset.originalPrice || "");
    if (el.parentElement) el.parentElement.replaceChild(textNode, el);
  });

  document.querySelectorAll("[data-usd-converted]").forEach((priceEl) => {
    if (priceEl.dataset.origText !== undefined) {
       priceEl.textContent = priceEl.dataset.origText;
       delete priceEl.dataset.origText;
    } else {
      priceEl.querySelectorAll("[data-orig-text]").forEach((sub) => {
        if (sub.classList.contains("a-price-whole")) {
          const decimal = sub.querySelector(".a-price-decimal");
          sub.textContent = sub.dataset.origText;
          if (decimal) sub.appendChild(decimal);
        } else {
          sub.textContent = sub.dataset.origText;
        }
        delete sub.dataset.origText;
      });
    }

    priceEl.querySelectorAll(".usd-inr-badge").forEach((b) => b.remove());
    delete priceEl.dataset.usdConverted;
    delete priceEl.dataset.originalPrice;
  });

  processedNodes = new WeakSet();
}

// ── MutationObserver ─────────────────────────────────────────────

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === "childList") {
      for (const node of mutation.addedNodes) {
        convertPrices(node);
      }
    }
  }
});

// ── Initialization ───────────────────────────────────────────────

function initialize() {
  chrome.storage.local.get(
    ["exchangeRate", "baseCurrency", "targetCurrency", "enabled", "showBadge", "disabledDomains"],
    (data) => {
      if (data.exchangeRate) exchangeRate = data.exchangeRate;
      if (data.baseCurrency) baseCurrency = data.baseCurrency;
      if (data.targetCurrency) targetCurrency = data.targetCurrency;
      if (data.hasOwnProperty("enabled")) isEnabled = data.enabled;
      if (data.hasOwnProperty("showBadge")) showBadge = data.showBadge;
      if (Array.isArray(data.disabledDomains)) disabledDomains = data.disabledDomains;

      if (isEnabled && !isDomainDisabled()) {
        convertPrices(document.body);
        observer.observe(document.body, { childList: true, subtree: true });
      }
    },
  );
}

// ── Message Listener ─────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "updateExchangeRate":
      exchangeRate = request.exchangeRate;
      baseCurrency = request.baseCurrency || baseCurrency;
      targetCurrency = request.targetCurrency || targetCurrency;
      if (isEnabled && !isDomainDisabled()) {
        revertPrices();
        convertPrices(document.body);
      }
      sendResponse({ status: "ok" });
      break;

    case "toggleEnabled":
      isEnabled = request.enabled;
      if (isEnabled && !isDomainDisabled()) {
        convertPrices(document.body);
        observer.observe(document.body, { childList: true, subtree: true });
      } else {
        observer.disconnect();
        revertPrices();
      }
      sendResponse({ status: "ok" });
      break;

    case "toggleDomain":
      disabledDomains = request.disabledDomains || [];
      if (isDomainDisabled()) {
        observer.disconnect();
        revertPrices();
      } else if (isEnabled) {
        processedNodes = new WeakSet();
        convertPrices(document.body);
        observer.observe(document.body, { childList: true, subtree: true });
      }
      sendResponse({ status: "ok" });
      break;

    case "toggleBadge":
      showBadge = request.showBadge;
      if (showBadge) {
        addBadges();
      } else {
        removeBadges();
      }
      sendResponse({ status: "ok" });
      break;
  }
});

initialize();
