# Flux Currency Converter

Flux is a modern browser extension that seamlessly converts and localizes prices on any webpage using real-time global exchange rates. With a clean, minimal interface, Flux provides instant feedback and automatic price conversions directly on the sites you browse.

<div align="center">
  <img src="assets/Screenshot%20Hero%20%26%20Dark.png" alt="Flux Hero Image" width="400"/>
</div>

## Install

| Browser | Link |
|---|---|
| **Chrome / Other Chromium-based Browsers** | [Chrome Web Store](https://chromewebstore.google.com/detail/lageadcjahlpmmbepfmehmcmbndpfkkk) |
| **Firefox** | [Manual Install](#for-firefox) *(AMO listing coming soon)* |
| **Microsoft Edge** | [Manual Install](#for-developers-manual-installation) *(Edge Add-ons listing coming soon)* |

## Features

- **Real-Time Auto-Conversion**: Automatically parses text and structured prices (e.g., on Amazon, Twitter) on the page, replacing them with your target currency.
- **Modern UI**: A fully responsive popup interface using the Space Grotesk font with a built-in Dark/Light mode toggle.
- **Smart Caching Engine**: API rates are cached locally in the browser to ensure instantaneous target currency swaps without redundant network calls.
- **Performance Optimized**: Uses debounced MutationObservers and pre-compiled regex logic to keep scrolling buttery smooth, even on infinite-scroll pages.
- **Site-Specific Controls**: You can disable Flux on a per-site basis directly from the popup using the power icon, or toggle it globally.
- **Customizable Badges**: Choose whether to display the subtle `≈` indicator next to converted prices.
- **Cross-Browser**: Works on Chrome, Firefox, Edge, and any Chromium-based browser.

## Screenshots

### Dark Mode
![Dark Mode](assets/Screenshot%20Hero%20%26%20Dark.png)

### Light Mode
![Light Mode](assets/Screenshot%20Light.png)

### In-Page Conversion Example
![In-Page Example](assets/Web%20Example.png)

## Installation

### For Users (Chrome Web Store)
👉 **[Install Flux from the Chrome Web Store](https://chromewebstore.google.com/detail/lageadcjahlpmmbepfmehmcmbndpfkkk)**

### For Firefox

1. Download or clone this repository.
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on**.
4. Select the `manifest.json` file from the `Flux-Extension` folder.
5. The Flux icon will appear in your toolbar. Pin it for quick access!

> **Note:** Firefox support requires Firefox 109 or newer (Manifest V3). A permanent listing on [Firefox Add-ons (AMO)](https://addons.mozilla.org/) is coming soon.

### For Microsoft Edge

Edge uses the same Chromium extension format — the same package works on both Chrome and Edge with zero changes.

1. Download or clone this repository.
2. Open Edge and navigate to `edge://extensions/`.
3. Toggle on **Developer mode** in the bottom-left.
4. Click **Load unpacked** and select the `Flux-Extension` folder.
5. Pin the Flux icon for easy access.

> **Note:** A listing on the [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/) store is planned.

### For Developers (Manual Installation)

1. Clone or download this repository to your local machine:
   ```bash
   git clone https://github.com/Satya-Siba-Nayak/Flux-Extension.git
   ```
2. Open Chrome (or your Chromium-based browser) and navigate to `chrome://extensions/`.
3. Toggle on **Developer mode** in the top right corner.
4. Click on **Load unpacked** and select the `Flux-Extension` folder you just downloaded.
5. The Flux icon will appear in your extension toolbar. Pin it for quick access!

## Usage

1. **Set your Currencies**: Click the Flux icon to open the popup. Select your base currency (the currency of the website you are viewing) and your target currency.
2. **Browse**: Go to any webpage, and the prices will automatically be converted! Converted prices are marked with a subtle `≈` badge.
3. **Toggle Badge**: You can turn off the `≈` badge indicator in the settings if you prefer a perfectly seamless look.
4. **Site Power**: If you don't want Flux running on a specific website, open the popup and click the power icon in the top right. 
5. **Theme**: Click the Sun/Moon icon in the header to switch between Dark and Light mode.

## Supported Currencies

Flux currently supports major currencies including USD, EUR, GBP, INR, JPY, CAD, AUD, CHF, CNY, and SGD.

## Tech Stack
- **JavaScript (Vanilla)**: Service workers, content scripts, and DOM manipulation.
- **CSS3**: Custom variables for light/dark theming and clean layout styling.
- **API**: Powered by [fawazahmed0/currency-api](https://github.com/fawazahmed0/currency-api).

## Support & Contact

Having issues, suggestions, or feature requests?

- 📧 **Email**: [support@satya-nayak.dev](mailto:support@satya-nayak.dev)
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/Satya-Siba-Nayak/Flux-Extension/issues)

## License 
[MIT License](LICENSE)
