document.addEventListener('DOMContentLoaded', () => {
    const settingsForm = document.getElementById('settingsForm');
    const apiKeyInput = document.getElementById('apiKey');
  
    // Load the stored API key and display it in the input field
    chrome.storage.sync.get('apiKey', (data) => {
      apiKeyInput.value = data.apiKey || '';
    });
  
    // Save the API key when the form is submitted
    settingsForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const apiKey = apiKeyInput.value.trim();
      chrome.storage.sync.set({ apiKey }, () => {
        alert('API key saved.');
      });
    });
  });
  