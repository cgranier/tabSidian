function generateMarkdownAndTimestamp(tabs) {
    const timestamp = new Date();
    const formattedTimestamp = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}-${String(timestamp.getDate()).padStart(2, '0')}T${String(timestamp.getHours()).padStart(2, '0')}-${String(timestamp.getMinutes()).padStart(2, '0')}-${String(timestamp.getSeconds()).padStart(2, '0')}`;
  
    const localDate = timestamp.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$1-$2');
  
    const localTime = timestamp.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  
    let markdown = `---\ndate_created: ${localDate}\ntime_created: ${localTime}\n---\n\n`;
  
    for (const tab of tabs) {
      markdown += `## ${tab.title}\n[${tab.url}](${tab.url})\n\n`;
    }
  
    return { markdown, formattedTimestamp };
  }

  function shouldProcessTab(tab, restrictedUrls, processOnlySelectedTabs) {
    const isPinned = tab.pinned;
    const isSettingsTab = tab.url.startsWith('edge://') || tab.url.startsWith('chrome://');
    const isRestrictedUrl = restrictedUrls.some((url) => tab.url.includes(url));
    const isSelected = tab.highlighted;
  
    if (processOnlySelectedTabs) {
      return isSelected && !isPinned && !isSettingsTab && !isRestrictedUrl;
    }
  
    return !isPinned && !isSettingsTab && !isRestrictedUrl;
  }
  
  chrome.browserAction.onClicked.addListener(() => {
    chrome.storage.sync.get('restrictedUrls', ({ restrictedUrls }) => {
      chrome.windows.getAll({ populate: true, windowTypes: ['normal'] }, (windows) => {
        const currentWindow = windows.find((window) => window.focused);
        const selectedTabs = currentWindow.tabs.filter((tab) => tab.highlighted);
        const processOnlySelectedTabs = selectedTabs.length > 1;
        const tabs = currentWindow.tabs.filter((tab) => shouldProcessTab(tab, restrictedUrls || [], processOnlySelectedTabs));
  
        const { markdown, formattedTimestamp } = generateMarkdownAndTimestamp(tabs);
  
        chrome.downloads.download({
          url: 'data:text/markdown;charset=UTF-8,' + encodeURIComponent(markdown),
          filename: `${formattedTimestamp}_OpenTabs.md`,
          saveAs: true,
        });
      });
    });
  });
  