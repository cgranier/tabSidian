document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("save").addEventListener("click", () => {
    const restrictedUrls = document
      .getElementById("restrictedUrls")
      .value.split("\n");
    chrome.storage.sync.set({ restrictedUrls });
    const markdownFormat = document.getElementById("markdownFormat").value;
    chrome.storage.sync.set({ restrictedUrls, markdownFormat });
  });

  document.getElementById("presetFormats").addEventListener("change", (event) => {
    document.getElementById("markdownFormat").value = event.target.value;
  });

  chrome.storage.sync.get(
    ["restrictedUrls", "markdownFormat"],
    ({ restrictedUrls, markdownFormat }) => {
      if (restrictedUrls) {
        document.getElementById("restrictedUrls").value =
          restrictedUrls.join("\n");
      } else {
        setDefaultRestrictedUrls();
      }
      if (markdownFormat) {
        document.getElementById("markdownFormat").value = markdownFormat;
      } else {
        setDefaultMarkdownFormat();
      }
    }
  );
});

function setDefaultRestrictedUrls() {
  const defaultRestrictedUrls = ["chrome-extension://", "extension://", "mail.google.com", "outlook.live.com"];
  document.getElementById("restrictedUrls").value =
    defaultRestrictedUrls.join("\n");
  chrome.storage.sync.set({ restrictedUrls: defaultRestrictedUrls });
}

function setDefaultMarkdownFormat() {
  const defaultMarkdownFormat = "## {title}\n[{url}]({url})\n\n";
  document.getElementById("markdownFormat").value = defaultMarkdownFormat;
  chrome.storage.sync.set({
    markdownFormat: defaultMarkdownFormat,
  });
}
