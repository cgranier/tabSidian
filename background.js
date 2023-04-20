function generateMarkdownAndTimestamp(tabs) {
    const timestamp = new Date();
    const formattedTimestamp = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}-${String(timestamp.getDate()).padStart(2, '0')}_${String(timestamp.getHours()).padStart(2, '0')}-${String(timestamp.getMinutes()).padStart(2, '0')}-${String(timestamp.getSeconds()).padStart(2, '0')}`;
  
    let markdown = '';
  
    for (const tab of tabs) {
      markdown += `## ${tab.title}\n[${tab.url}](${tab.url})\n\n`;
    }
  
    return { markdown, formattedTimestamp };
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
  
        const { markdown, formattedTimestamp } = generateMarkdownAndTimestamp(tabs);
  
        chrome.downloads.download({
          url: 'data:text/markdown;charset=UTF-8,' + encodeURIComponent(markdown),
          filename: `${formattedTimestamp}_OpenTabs.md`,
          saveAs: true,
        });
      });
    });
  });
  
  