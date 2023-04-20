function generateMarkdown(tabs) {
    const output = ['# Open Tabs\n'];
  
    for (const tab of tabs) {
      output.push(`\n## ${tab.title}\n`);
      output.push(`[${tab.url}](${tab.url})\n`);
    }
  
    return output.join('');
  }

function shouldProcessTab(tab, restrictedUrls) {
    const isPinned = tab.pinned;
    const isSettingsTab = tab.url.startsWith('edge://');
    const isRestrictedUrl = restrictedUrls.some((url) => tab.url.includes(url));
  
    return !isPinned && !isSettingsTab && !isRestrictedUrl;
  }
  
chrome.browserAction.onClicked.addListener(() => {
    chrome.storage.sync.get('restrictedUrls', ({ restrictedUrls }) => {
      chrome.windows.getAll({ populate: true, windowTypes: ['normal'] }, (windows) => {
        const currentWindow = windows.find((window) => window.focused);
        const tabs = currentWindow.tabs.filter((tab) => shouldProcessTab(tab, restrictedUrls || []));
  
        const markdown = generateMarkdown(tabs);
  
        chrome.tabs.create({ url: 'data:text/plain;charset=UTF-8,' + encodeURIComponent(markdown) });
      });
    });
  });
  
  