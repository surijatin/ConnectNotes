// LinkedIn Connection Notes - Popup Script

// Load and display LinkedIn notes
const loadLinkedInNotes = () => {
  chrome.storage.local
    .get(["linkedinNotes"])
    .then((result) => {
      const notes = result.linkedinNotes || [];
      const peopleList = document.getElementById("people");
      const countElement = document.getElementById("count");

      // Update count
      countElement.textContent = notes.length;

      if (notes.length === 0) {
        peopleList.innerHTML =
          '<li class="no-data">No connection notes yet. Visit LinkedIn profiles to start taking notes!</li>';
        return;
      }

      // Sort notes by most recently updated
      notes.sort((a, b) => new Date(b.dateUpdated) - new Date(a.dateUpdated));

      // Generate HTML for each note
      const notesHTML = notes
        .map((note) => {
          const updatedDate = new Date(note.dateUpdated);
          const timeAgo = getTimeAgo(updatedDate);
          const notePreview =
            note.note.length > 100
              ? note.note.substring(0, 100) + "..."
              : note.note;

          return `
        <li class="connection-item" data-username="${note.username}">
          <div class="connection-header">
            <div class="connection-info">
              <strong class="connection-name">${
                note.fullName || note.username
              }</strong>
              <span class="connection-username">@${note.username}</span>
            </div>
            <div class="connection-actions">
              <button class="edit-btn" data-username="${
                note.username
              }" title="Edit note">✏️</button>
              <button class="delete-btn" data-username="${
                note.username
              }" title="Delete note">🗑️</button>
            </div>
          </div>
          <div class="connection-note">
            <p class="note-content">${notePreview}</p>
            <span class="note-timestamp">${timeAgo}</span>
          </div>
        </li>
      `;
        })
        .join("");

      peopleList.innerHTML = notesHTML;

      // Add event listeners for edit and delete buttons
      addEventListeners();
    })
    .catch((error) => {
      console.error("Error loading LinkedIn notes:", error);
      document.getElementById("people").innerHTML =
        '<li class="error">Error loading notes. Please try again.</li>';
      document.getElementById("count").textContent = "0";
    });
};

// Add event listeners for interactive elements
const addEventListeners = () => {
  // Edit button listeners
  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const username = e.target.getAttribute("data-username");
      editNote(username);
    });
  });

  // Delete button listeners
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const username = e.target.getAttribute("data-username");
      deleteNote(username);
    });
  });

  // Connection item click listeners (for expanding/viewing full note)
  document.querySelectorAll(".connection-item").forEach((item) => {
    item.addEventListener("click", () => {
      const username = item.getAttribute("data-username");
      viewFullNote(username);
    });
  });
};

// Search functionality
const setupSearch = () => {
  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", (e) => {
    const searchTerm = e.target.value.toLowerCase();
    filterNotes(searchTerm);
  });
};

// Filter notes based on search term
const filterNotes = (searchTerm) => {
  const connectionItems = document.querySelectorAll(".connection-item");

  connectionItems.forEach((item) => {
    const name = item
      .querySelector(".connection-name")
      .textContent.toLowerCase();
    const username = item
      .querySelector(".connection-username")
      .textContent.toLowerCase();
    const note = item.querySelector(".note-content").textContent.toLowerCase();

    const isMatch =
      name.includes(searchTerm) ||
      username.includes(searchTerm) ||
      note.includes(searchTerm);

    item.style.display = isMatch ? "block" : "none";
  });
};

// Edit note functionality
const editNote = (username) => {
  chrome.storage.local.get(["linkedinNotes"]).then((result) => {
    const notes = result.linkedinNotes || [];
    const note = notes.find((n) => n.username === username);

    if (note) {
      const newNoteContent = prompt(
        `Edit note for ${note.fullName || username}:`,
        note.note
      );

      if (newNoteContent !== null && newNoteContent !== note.note) {
        // Update the note
        note.note = newNoteContent;
        note.dateUpdated = new Date().toISOString();

        chrome.storage.local.set({ linkedinNotes: notes }).then(() => {
          loadLinkedInNotes(); // Refresh the display
        });
      }
    }
  });
};

// Delete note functionality
const deleteNote = (username) => {
  chrome.storage.local.get(["linkedinNotes"]).then((result) => {
    const notes = result.linkedinNotes || [];
    const note = notes.find((n) => n.username === username);

    if (note && confirm(`Delete note for ${note.fullName || username}?`)) {
      const updatedNotes = notes.filter((n) => n.username !== username);

      chrome.storage.local.set({ linkedinNotes: updatedNotes }).then(() => {
        loadLinkedInNotes(); // Refresh the display
      });
    }
  });
};

// View full note functionality
const viewFullNote = (username) => {
  chrome.storage.local.get(["linkedinNotes"]).then((result) => {
    const notes = result.linkedinNotes || [];
    const note = notes.find((n) => n.username === username);

    if (note) {
      alert(
        `Note for ${note.fullName || username}:\n\n${
          note.note
        }\n\nCreated: ${new Date(
          note.dateCreated
        ).toLocaleDateString()}\nUpdated: ${new Date(
          note.dateUpdated
        ).toLocaleDateString()}`
      );
    }
  });
};

// Export notes functionality
const exportNotes = () => {
  chrome.storage.local.get(["linkedinNotes"]).then((result) => {
    const notes = result.linkedinNotes || [];

    if (notes.length === 0) {
      alert("No notes to export!");
      return;
    }

    // Create CSV content
    const csvHeaders = "Full Name,Username,Note,Date Created,Date Updated\n";
    const csvContent = notes
      .map((note) => {
        const safeName = `"${(note.fullName || note.username).replace(
          /"/g,
          '""'
        )}"`;
        const safeNote = `"${note.note.replace(/"/g, '""')}"`;
        return `${safeName},${note.username},${safeNote},${note.dateCreated},${note.dateUpdated}`;
      })
      .join("\n");

    const fullCSV = csvHeaders + csvContent;

    // Download the file
    const blob = new Blob([fullCSV], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `linkedin-notes-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  });
};

// Delete all notes functionality
const deleteAllNotes = () => {
  if (
    confirm(
      "Are you sure you want to delete ALL connection notes? This cannot be undone."
    )
  ) {
    chrome.storage.local.set({ linkedinNotes: [] }).then(() => {
      loadLinkedInNotes(); // Refresh the display
    });
  }
};

// Utility function to get human-readable time ago
const getTimeAgo = (date) => {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800)
    return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return date.toLocaleDateString();
};

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Load and display notes
  loadLinkedInNotes();

  // Setup search functionality
  setupSearch();

  // Add event listeners for action buttons
  document.getElementById("exportBtn").addEventListener("click", exportNotes);
  document
    .getElementById("deleteBtn")
    .addEventListener("click", deleteAllNotes);

  // Refresh notes every 3 seconds to stay updated (faster for better UX)
  setInterval(loadLinkedInNotes, 3000);
});
