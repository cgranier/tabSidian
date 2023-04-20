document.getElementById('save').addEventListener('click', () => {
    const restrictedUrls = document.getElementById('restrictedUrls').value.split('\n');
    chrome.storage.sync.set({ restrictedUrls });
  });
  
  function setDefaultRestrictedUrls() {
    const defaultRestrictedUrls = [
      'gmail.com',
      'google.com',
      'bing.com'
    ];
    document.getElementById('restrictedUrls').value = defaultRestrictedUrls.join('\n');
    chrome.storage.sync.set({ restrictedUrls: defaultRestrictedUrls });
  }
  
  chrome.storage.sync.get('restrictedUrls', ({ restrictedUrls }) => {
    if (restrictedUrls) {
      document.getElementById('restrictedUrls').value = restrictedUrls.join('\n');
    } else {
      setDefaultRestrictedUrls();
    }
  });
  