function generateMarkdown(tabs) {
    const output = ['# Open Tabs\n'];
  
    for (const tab of tabs) {
      output.push(`\n## ${tab.title}\n`);
      output.push(`[${tab.url}](${tab.url})`);
    }
  
    return output.join('');
  }
  
  chrome.browserAction.onClicked.addListener(async () => {
    const [currentWindow] = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
    const tabs = currentWindow.tabs;
  
    const markdown = generateMarkdown(tabs);
  
    await chrome.tabs.create({ url: 'data:text/html;charset=UTF-8,' + encodeURIComponent(markdown) });
  });