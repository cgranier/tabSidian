function generateMarkdownAndTimestamp(tabs, titleFormat, urlFormat) {
  const timestamp = new Date();
  const formattedTimestamp = `${timestamp.getFullYear()}-${String(
    timestamp.getMonth() + 1
  ).padStart(2, "0")}-${String(timestamp.getDate()).padStart(2, "0")}T${String(
    timestamp.getHours()
  ).padStart(2, "0")}-${String(timestamp.getMinutes()).padStart(
    2,
    "0"
  )}-${String(timestamp.getSeconds()).padStart(2, "0")}`;

  const localDate = timestamp
    .toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$1-$2");

  const localTime = timestamp.toLocaleString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  let markdown = `---\ndate_created: ${localDate}\ntime_created: ${localTime}\n---\n\n`;

  //console.log('tabs: ' + tabs.length);

  for (const tab of tabs) {
    let formattedTitle = titleFormat
      .replace(/\{title\}/g, tab.title)
      .replace(/\{url\}/g, tab.url)
      .replace(/\\n/g, "\n");
    let formattedUrl = urlFormat
      .replace(/\{title\}/g, tab.title)
      .replace(/\{url\}/g, tab.url)
      .replace(/\\n/g, "\n");

    markdown += formattedTitle;
    markdown += formattedUrl;
  }

  return { markdown, formattedTimestamp };
}

function shouldProcessTab(tab, restrictedUrls, processOnlySelectedTabs) {
  const isPinned = tab.pinned;
  const isSettingsTab =
    tab.url.startsWith("edge://") || tab.url.startsWith("chrome://");
  const isRestrictedUrl = restrictedUrls.some((url) => tab.url.includes(url));
  const isSelected = tab.highlighted;

  // const process = true;
  if (processOnlySelectedTabs) {
    process = isSelected && !isPinned && !isSettingsTab && !isRestrictedUrl;
  } else {
    process = !isPinned && !isSettingsTab && !isRestrictedUrl;
  }

  //console.log('process: ' + process + ' isPinned: '+isPinned+' isSettings: '+isSettingsTab+' isRestricted: '+isRestrictedUrl+' URL: ' + tab.url)
  return process;
}

chrome.action.onClicked.addListener(() => {
  chrome.storage.sync.get(
    ["restrictedUrls", "titleFormat", "urlFormat"],
    (result) => {
      //important to remove empty lines
      const restrictedUrls = result.restrictedUrls.filter((str) => str !== "");
      const titleFormat = result.titleFormat || "## {title}\n";
      const urlFormat = result.urlFormat || "[{url}]({url})\n\n";

      chrome.windows.getAll(
        { populate: true, windowTypes: ["normal"] },
        (windows) => {
          const currentWindow = windows.find((window) => window.focused);
          const selectedTabs = currentWindow.tabs.filter(
            (tab) => tab.highlighted
          );
          const processOnlySelectedTabs = selectedTabs.length > 1;
          const tabs = currentWindow.tabs.filter((tab) =>
            shouldProcessTab(tab, restrictedUrls || [], processOnlySelectedTabs)
          );

          console.log(
            "processing only selected tabs: " + processOnlySelectedTabs
          );
          console.log("tabs: " + currentWindow.tabs.length);
          console.log("tabs after filter: " + tabs.length);

          const { markdown, formattedTimestamp } = generateMarkdownAndTimestamp(
            tabs,
            titleFormat,
            urlFormat
          );

          const base64Markdown = btoa(unescape(encodeURIComponent(markdown)));

          chrome.downloads.download({
            url: "data:text/markdown;charset=UTF-8;base64," + base64Markdown,
            filename: `${formattedTimestamp}_OpenTabs.md`,
            saveAs: true,
          });
        }
      );
    }
  );
});
