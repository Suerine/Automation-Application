const body = document.querySelector("body");
const sidebar = document.querySelector(".sidebar");
const toggle = document.querySelector(".toggle");
const modeSwitch = document.querySelector(".toggle-switch");
const modeText = document.querySelector(".mode-text");
const dropdownBtn = document.getElementById("dropdownBtn");
const dropdown = document.getElementById("myDropdown");
const style = document.createElement("style");
document.head.appendChild(style);

toggle.addEventListener("click", () => {
  sidebar.classList.toggle("close");
});

modeSwitch.addEventListener("click", () => {
  body.classList.toggle("dark");

  if (body.classList.contains("dark")) {
    modeText.innerText = "Light Mode";
  } else {
    modeText.innerText = "Dark Mode";
  }
});

document.addEventListener("DOMContentLoaded", function () {
  dropdownBtn.addEventListener("click", function (event) {
    dropdown.classList.toggle("show");
    event.stopPropagation(); // Prevent it from triggering the window click
  });
  // Close the dropdown if the user clicks outside
  window.addEventListener("click", function () {
    if (dropdown.classList.contains("show")) {
      dropdown.classList.remove("show");
    }
  });
});

document
  .getElementById("fetchEmailsBtn")
  .addEventListener("click", async () => {
    const fetchBtn = document.getElementById("fetchEmailsBtn");
    const originalText = fetchBtn.innerHTML;

    try {
      // Show loading state
      fetchBtn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Loading...';
      fetchBtn.disabled = true;

      const data = await window.electronAPI.gmail.fetchEmails();
      console.log("Fetched data:", data);

      const emailHeader = document.getElementById("emailHeader");
      const emailList = document.getElementById("emailList");

      emailHeader.innerHTML = `<h3>${data.header || "Inbox"}</h3>`;
      emailList.innerHTML = "";

      if (data.emails && data.emails.length > 0) {
        data.emails.forEach((email) => {
          const emailCard = document.createElement("div");
          emailCard.classList.add("email-notification");
          emailCard.dataset.emailId = email.id;

          const senderInfo = processSenderInfo(email.from);
          const emailDate = new Date().toLocaleString();

          const rawBody = email.body || "";
          const { fullText } = processEmailContent(rawBody);
          const previewText =
            fullText.length > 200 ? fullText.slice(0, 200) + "..." : fullText;

          emailCard.innerHTML = `
             <div class="email-subject">${email.subject || "No subject"}</div>
              <div class="email-header">
                <div class="sender-info">
                  <div class="sender-avatar">${senderInfo.initials}</div>
                  <div class="sender-name">${senderInfo.name}</div>
                  <div class="sender-email">${senderInfo.email}</div>
                </div>
                <div class="email-date">${emailDate}</div>
              </div>
             <div class="email-content">
                <div class="email-body" 
                     data-full="${fullText.replace(/"/g, "&quot;")}"
                     data-preview="${previewText.replace(/"/g, "&quot;")}">
                  ${previewText}
                </div>
                
                <!-- Only show expand button if content is longer than preview -->
                ${
                  fullText.length > previewText.length
                    ? `<button class="expand-btn">▼ Show more</button>`
                    : ""
                }
                <div class="email-actions">
                  <button class="email-action generate-reply-btn">Generate Reply</button>
                  <button class="email-action forward-btn">Forward</button>
                  <!-- Suggestions Container -->
                    <div class="suggestions-container">
                      <!-- Suggestions buttons will be inserted here -->
                    </div>
                </div>
                <!-- Reply Form (initially hidden) -->
                <div class="reply-form">
                  <textarea class="reply-textarea" placeholder="Type your reply..."></textarea>
                  <div class="reply-buttons">
                    <button class="send-reply-btn"><i class="bi bi-send icon"></i>Send</button>
                    <button class="cancel-reply-btn"><i class="bi bi-x-circle icon"></i>Cancel</button>
                  </div>
                </div>
              </div>
             </div>
           `;

          emailList.appendChild(emailCard);
        });

        // Expand/collapse functionality
        document.querySelectorAll(".expand-btn").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            const card = e.target.closest(".email-notification");
            const body = card.querySelector(".email-body");
            const actions = card.querySelector(".email-actions");
            const isExpanded = body.classList.contains("expanded");

            if (isExpanded) {
              // Collapsing
              body.classList.remove("expanded");
              actions.classList.remove("visible");
              e.target.textContent = "▼ Show more";
              e.target.classList.remove("expanded");
            } else {
              // Expanding
              body.innerHTML = body.dataset.full; // Swap to full content
              body.classList.add("expanded");
              actions.classList.add("visible");
              e.target.textContent = "▲ Show less";
              e.target.classList.add("expanded");
            }
          });
        });
        document.querySelectorAll(".generate-reply-btn").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            const card = e.target.closest(".email-notification");
            const replyForm = card.querySelector(".reply-form");
            const replyTextarea = card.querySelector(".reply-textarea");
            const emailBody = card.querySelector(".email-body").dataset.full;
            const emailSubject = card.querySelector(".email-subject").innerText;
            const senderEmail = card.querySelector(".sender-email").innerText;
            const emailId = card.dataset.emailId;

            // Create suggestions container if it doesn't exist
            let suggestionsContainer = card.querySelector(
              ".suggestions-container"
            );
            if (!suggestionsContainer) {
              suggestionsContainer = document.createElement("div");
              suggestionsContainer.className = "suggestions-container";
              replyForm.insertBefore(suggestionsContainer, replyTextarea);
            }

            // Create loading animation style if it doesn't exist
            let style = document.getElementById("spin-style");
            if (!style) {
              style = document.createElement("style");
              style.id = "spin-style";
              document.head.appendChild(style);
            }

            try {
              // Show loading state
              e.target.innerHTML =
                '<i class="bi bi-arrow-repeat spin"></i> Generating...';
              e.target.disabled = true;
              style.textContent = `
               @keyframes spin {
                 0% { transform: rotate(0deg); }
                 100% { transform: rotate(360deg); }
               }
               .spin {
                 animation: spin 1s linear infinite;
                 display: inline-block;
               }
             `;

              // Clear previous suggestions
              suggestionsContainer.innerHTML = "";

              const generatedReplies =
                await window.electronAPI.replyGenerator.generateReply({
                  emailId: emailId,
                  body: emailBody,
                  subject: emailSubject,
                  sender: senderEmail,
                });

              // Create buttons for each reply suggestion
              generatedReplies.forEach((replyText, index) => {
                const btn = document.createElement("button");
                btn.className = "suggestion-btn";
                btn.textContent = `Suggestion ${index + 1}`;
                btn.addEventListener("click", () => {
                  replyTextarea.value = replyText;
                });
                suggestionsContainer.appendChild(btn);

                // Add space between buttons
                if (index < generatedReplies.length - 1) {
                  suggestionsContainer.appendChild(
                    document.createTextNode(" ")
                  );
                }
              });

              // Auto-fill with first suggestion
              if (generatedReplies.length > 0) {
                replyTextarea.value = generatedReplies[0];
              }

              replyForm.style.display = "flex";
            } catch (error) {
              console.error("Failed to generate reply:", error);
              suggestionsContainer.innerHTML = `
              <div class="error-message">
                ❌ Could not generate replies. Please try again.
              </div>
      `;
            } finally {
              // Reset button state
              e.target.innerHTML = "Generate Reply";
              e.target.disabled = false;
            }
          });
        });
        document.querySelectorAll(".cancel-reply-btn").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            const card = e.target.closest(".email-notification");
            const replyForm = card.querySelector(".reply-form");
            replyForm.style.display = "none";
          });
        });

        document.querySelectorAll(".send-reply-btn").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            const card = e.target.closest(".email-notification");
            const replyTextarea = card.querySelector(".reply-textarea");
            const senderEmail = card.querySelector(".sender-email").innerText;
            const subject = card.querySelector(".email-subject").innerText;

            try {
              const result = await window.electronAPI.gmail.sendEmail(
                senderEmail,
                `Re: ${subject}`,
                replyTextarea.value
              );
              alert("✅ Reply sent!");
            } catch (err) {
              console.error("❌ Failed to send reply:", err);
              alert("❌ Could not send reply.");
            }
          });
        });
      } else {
        emailList.innerHTML = '<div class="empty-inbox">No emails found</div>';
      }
    } catch (err) {
      console.error("Failed to fetch emails:", err);
      emailList.innerHTML =
        '<div class="error-message">Error loading emails</div>';
    } finally {
      // Restore button state
      fetchBtn.innerHTML = originalText;
      fetchBtn.disabled = false;
    }
  });

// Helper functions
function processSenderInfo(from) {
  // Extract name and email from "Name <email@domain.com>" format
  const match = from.match(/(.*)<(.*)>/) || [null, from, from];
  const name = match[1]?.trim() || match[2].split("@")[0];
  const email = match[2].trim();

  // Get initials for avatar
  const initials = name
    .split(" ")
    .map((part) => part[0]?.toUpperCase() || "")
    .join("")
    .substring(0, 2);

  return { name, email, initials };
}

function processEmailContent(body) {
  // Create a temporary DOM element to work with HTML safely
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = body;

  // Remove unwanted tags (style, script, meta, etc.)
  tempDiv
    .querySelectorAll("style, script, meta, link, iframe, object")
    .forEach((el) => el.remove());

  // Optionally allow only some tags (e.g. <b>, <i>, <a>, <br>, <p>)
  const allowedTags = ["BR", "B", "I", "U", "A", "P", "DIV", "SPAN"];

  tempDiv.querySelectorAll("*").forEach((el) => {
    if (!allowedTags.includes(el.tagName)) {
      // Replace block elements with newlines
      if (["DIV", "P"].includes(el.tagName)) {
        el.outerHTML = "\n" + el.textContent + "\n";
      } else {
        el.outerHTML = el.textContent;
      }
    }
  });

  // Replace multiple line breaks with max 2
  let cleaned = tempDiv.innerHTML
    .replace(/\r\n|\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/\n/g, "<br>")
    .replace(/(<br>\s*){3,}/g, "<br><br>")
    .trim();

  // Make URLs clickable
  cleaned = cleaned.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank">$1</a>'
  );

  return {
    fullText: cleaned,
  };
}

document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("sendEmailBtn")
    .addEventListener("click", async () => {
      try {
        const to = document.getElementById("to").value;
        const subject = document.getElementById("subject").value;
        const body = document.getElementById("body").value;

        console.log("Sending email:", { to, subject, body }); // Debug log
        const result = await window.electronAPI.gmail.sendEmail(
          to,
          subject,
          body
        );
        console.log("Email sent:", result); // Debug log
        alert("✅ Email sent!");
      } catch (err) {
        console.error("❌ Failed to send email:", err);
        alert("❌ Error sending email");
      }
    });
});
