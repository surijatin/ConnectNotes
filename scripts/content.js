// LinkedIn Profile Detection and Note Injection

// Check if we're on a LinkedIn profile page
const isLinkedInProfile = () => {
  return (
    window.location.hostname.includes("linkedin.com") &&
    window.location.pathname.includes("/in/")
  );
};

// Extract profile information from the page
const getProfileInfo = () => {
  try {
    // Extract username from URL - pattern: /in/username/
    const urlMatch = window.location.pathname.match(/\/in\/([^\/]+)/);
    const username = urlMatch ? urlMatch[1] : null;

    // Extract full name from aria-label or h1
    const nameLink = document.querySelector("a[aria-label]");
    const nameElement = document.querySelector('h1[class*="t-24"]');
    const fullName =
      nameLink?.getAttribute("aria-label") || nameElement?.textContent?.trim();

    // Extract professional description if available
    const descElement =
      document.querySelector(
        '[data-generated-suggestion-target*="profileActionDelegate"]'
      ) || document.querySelector(".text-body-medium.break-words");
    const description = descElement?.textContent?.trim();

    return { username, fullName, description };
  } catch (error) {
    return { username: null, fullName: null, description: null };
  }
};

// Find the optimal injection point for our note interface
const findInjectionPoint = () => {
  try {
    // Primary: Look for professional description with data attribute
    let target = document.querySelector(
      '[data-generated-suggestion-target*="profileActionDelegate"]'
    );

    // Fallback 1: Find by class pattern
    if (!target) {
      target = document.querySelector(".text-body-medium.break-words");
    }

    // Fallback 2: Use structural approach - find h1 with name, then navigate to container
    if (!target) {
      const nameElement = document.querySelector('h1[class*="t-24"]');
      if (nameElement) {
        // Navigate up to find a suitable parent container
        target = nameElement.closest(
          'div[class*="break-words"]'
        )?.parentElement;
      }
    }

    return target;
  } catch (error) {
    return null;
  }
};

// Inject the note interface into the LinkedIn profile page
const injectNoteInterface = (profileData) => {
  if (!profileData.username) {
    return;
  }

  const injectionPoint = findInjectionPoint();
  if (!injectionPoint) {
    return;
  }

  // Remove existing interface if any
  const existingInterface = document.getElementById("linkedinNoteAction");
  if (existingInterface) {
    existingInterface.remove();
  }

  // Create our note interface container
  const noteContainer = document.createElement("div");
  noteContainer.id = "linkedinNoteAction";
  noteContainer.style.cssText = `
    margin-top: 16px;
    padding: 16px;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    background-color: #f8f9fa;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  noteContainer.innerHTML = `
    <div style="margin-bottom: 8px;">
      <strong>LinkedIn Connection Note</strong>
      <span id="saveStatus" style="font-size: 12px; color: #666; margin-left: 8px;">(Auto-save enabled)</span>
    </div>
    <textarea 
      id="linkedinNote" 
      placeholder="Add a note about this connection... Why did you connect? Where did you meet?"
      style="width: 100%; min-height: 80px; padding: 8px; border: 1px solid #ccc; border-radius: 4px; resize: vertical; font-size: 14px;"
      spellcheck="false" 
      autocomplete="off"
    ></textarea>
    <div style="font-size: 11px; color: #999; margin-top: 4px;">
      💡 Tip: Clear the note completely to remove it from your saved connections
    </div>
  `;

  // Insert after the injection point
  injectionPoint.insertAdjacentElement("afterend", noteContainer);

  const noteTextarea = document.getElementById("linkedinNote");

  // Load existing note for this profile
  loadExistingNote(profileData.username, noteTextarea);

  // Add auto-save functionality
  noteTextarea.addEventListener("input", () => {
    const saveStatus = document.getElementById("saveStatus");
    if (saveStatus) {
      saveStatus.textContent = "Saving...";
      saveStatus.style.color = "#0073b1";
    }

    saveNote(
      profileData.username,
      noteTextarea.value,
      profileData.fullName,
      () => {
        // Callback when save is complete
        if (saveStatus) {
          const trimmedValue = noteTextarea.value.trim();
          if (trimmedValue === "") {
            saveStatus.textContent = "Note removed";
            saveStatus.style.color = "#666";
          } else {
            saveStatus.textContent = "Saved";
            saveStatus.style.color = "#057642";
          }

          // Reset status after 2 seconds
          setTimeout(() => {
            if (saveStatus) {
              saveStatus.textContent = "(Auto-save enabled)";
              saveStatus.style.color = "#666";
            }
          }, 2000);
        }
      }
    );
  });
};

// Load existing note from storage
const loadExistingNote = (username, textarea) => {
  chrome.storage.local
    .get(["linkedinNotes"])
    .then((result) => {
      const notes = result.linkedinNotes || [];
      const existingNote = notes.find((note) => note.username === username);

      if (existingNote) {
        textarea.value = existingNote.note;
      }
    })
    .catch((error) => {
      // Error loading note - silently fail
    });
};

// Save note to storage
const saveNote = (username, noteContent, fullName, callback) => {
  chrome.storage.local
    .get(["linkedinNotes"])
    .then((result) => {
      const notes = result.linkedinNotes || [];
      const existingIndex = notes.findIndex(
        (note) => note.username === username
      );

      // Check if note content is empty or only whitespace
      const trimmedContent = noteContent.trim();

      if (trimmedContent === "" || trimmedContent.length === 0) {
        // If note is empty, remove the entry from storage
        if (existingIndex !== -1) {
          notes.splice(existingIndex, 1);
          chrome.storage.local.set({ linkedinNotes: notes }).then(() => {
            if (callback) callback();
          });
        } else {
          // If no existing note and content is empty, still call callback
          if (callback) callback();
        }
        return;
      }

      // If note has content, save it
      const noteObject = {
        username: username,
        fullName: fullName || username,
        note: trimmedContent,
        dateCreated:
          existingIndex === -1
            ? new Date().toISOString()
            : notes[existingIndex].dateCreated,
        dateUpdated: new Date().toISOString(),
      };

      if (existingIndex !== -1) {
        notes[existingIndex] = noteObject;
      } else {
        notes.push(noteObject);
      }

      chrome.storage.local.set({ linkedinNotes: notes }).then(() => {
        if (callback) callback();
      });
    })
    .catch((error) => {
      if (callback) callback(); // Still call callback on error
    });
};

// Main function to handle profile detection and injection
const handleProfileDetection = () => {
  if (!isLinkedInProfile()) {
    return;
  }

  // Wait a bit for the page to load
  setTimeout(() => {
    const profileData = getProfileInfo();
    if (profileData.username) {
      injectNoteInterface(profileData);
    }
  }, 1000);
};

// MutationObserver to detect page changes (LinkedIn SPA navigation)
const observer = new MutationObserver((mutationsList) => {
  // Check if we're on a profile page and if significant DOM changes occurred
  if (isLinkedInProfile()) {
    // Look for changes that might indicate a new profile loaded
    for (let mutation of mutationsList) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        // Check if profile content elements are being added
        const hasProfileContent = Array.from(mutation.addedNodes).some(
          (node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              return (
                node.querySelector('h1[class*="t-24"]') ||
                node.querySelector("[data-generated-suggestion-target]") ||
                node.classList?.toString().includes("t-24")
              );
            }
            return false;
          }
        );

        if (hasProfileContent) {
          setTimeout(() => {
            const profileData = getProfileInfo();
            if (profileData.username) {
              injectNoteInterface(profileData);
            }
          }, 500);
          break;
        }
      }
    }
  }
});

// Start observing
observer.observe(document, {
  childList: true,
  subtree: true,
});

// Handle initial page load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", handleProfileDetection);
} else {
  handleProfileDetection();
}

// Also handle page navigation in SPA
let currentUrl = window.location.href;
const checkUrlChange = () => {
  if (currentUrl !== window.location.href) {
    currentUrl = window.location.href;
    handleProfileDetection();
  }
};

// Check for URL changes periodically (fallback for SPA navigation)
setInterval(checkUrlChange, 1000);
