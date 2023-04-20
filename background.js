function generateMarkdown(tabs) {
    const timestamp = new Date();
    const formattedTimestamp = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}-${String(timestamp.getDate()).padStart(2, '0')}_${String(timestamp.getHours()).padStart(2, '0')}:${String(timestamp.getMinutes()).padStart(2, '0')}`;
  
    let markdown = `# ${formattedTimestamp} Open Tabs\n\n`;
  
    for (const tab of tabs) {
      markdown += `## ${tab.title}\n[${tab.url}](${tab.url})\n\n`;
    }
  
    return markdown;
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
  
  