document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("save").addEventListener("click", () => {
    const restrictedUrls = document
      .getElementById("restrictedUrls")
      .value.split("\n");
    chrome.storage.sync.set({ restrictedUrls });
    const titleFormat = document.getElementById("titleFormat").value;
    const urlFormat = document.getElementById("urlFormat").value;
    chrome.storage.sync.set({ restrictedUrls, titleFormat, urlFormat });
  });

  chrome.storage.sync.get(
    ["restrictedUrls", "titleFormat", "urlFormat"],
    ({ restrictedUrls, titleFormat, urlFormat }) => {
      if (restrictedUrls) {
        document.getElementById("restrictedUrls").value =
          restrictedUrls.join("\n");
      } else {
        setDefaultRestrictedUrls();
      }
      if (titleFormat && urlFormat) {
        document.getElementById("titleFormat").value = titleFormat;
        document.getElementById("urlFormat").value = urlFormat;
      } else {
        setDefaultMarkdownFormats();
      }
    }
  );
});

function setDefaultRestrictedUrls() {
  const defaultRestrictedUrls = ["gmail.com", "google.com", "bing.com"];
  document.getElementById("restrictedUrls").value =
    defaultRestrictedUrls.join("\n");
  chrome.storage.sync.set({ restrictedUrls: defaultRestrictedUrls });
}

function setDefaultMarkdownFormats() {
  const defaultTitleFormat = "## {title}";
  const defaultUrlFormat = "[{url}]({url})";

  document.getElementById("titleFormat").value = defaultTitleFormat;
  document.getElementById("urlFormat").value = defaultUrlFormat;
  chrome.storage.sync.set({
    titleFormat: defaultTitleFormat,
    urlFormat: defaultUrlFormat,
  });
}
