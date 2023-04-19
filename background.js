function generateMarkdown(tabs) {
    const output = ['# Open Tabs\n'];
  
    for (const tab of tabs) {
      output.push(`\n## ${tab.title}\n`);
      output.push(`[${tab.url}](${tab.url})\n`);
    }
  
    return output.join('');
  }

  chrome.browserAction.onClicked.addListener(() => {
    chrome.windows.getAll({ populate: true, windowTypes: ['normal'] }, (windows) => {
      const currentWindow = windows.find((window) => window.focused);
      const tabs = currentWindow.tabs;
  
      const markdown = generateMarkdown(tabs);
  
      chrome.tabs.create({ url: 'data:text/html;charset=UTF-8,' + encodeURIComponent(markdown) });
    });
  });
  