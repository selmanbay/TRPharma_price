export function buildSettingsTabsHtml(tabs, activeSettingsTab) {
  return `
    <div class="settings-tabs" role="tablist" aria-label="Ayarlar sekmeleri">
      ${tabs.map((tab) => `
        <button
          class="settings-tab ${activeSettingsTab === tab.id ? 'active' : ''}"
          data-settings-tab="${tab.id}"
          type="button"
          role="tab"
          aria-selected="${activeSettingsTab === tab.id ? 'true' : 'false'}">${tab.label}</button>
      `).join('')}
    </div>
  `;
}
