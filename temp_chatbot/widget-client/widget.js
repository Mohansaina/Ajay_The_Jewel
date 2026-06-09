/**
 * AI Chatbot Widget - Universal JavaScript Snippet
 * white-label, zero external dependencies, modern glassmorphic UI.
 */
(function () {
  // Prevent double loading
  if (window.AIChatbotWidgetInstance) return;
  window.AIChatbotWidgetInstance = true;

  // Simple Markdown Parser to keep bundle size small (<30KB)
  function parseMarkdown(text) {
    if (!text) return "";
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Bold text (**text**)
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Bulleted Lists
    // Match line-level markdown lists and wrap them
    const lines = html.split("\n");
    let inList = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("* ") || line.startsWith("- ")) {
        const itemContent = line.substring(2);
        if (!inList) {
          lines[i] = `<ul style="margin: 0.5rem 0; padding-left: 1.25rem;"><li>${itemContent}</li>`;
          inList = true;
        } else {
          lines[i] = `<li>${itemContent}</li>`;
        }
      } else {
        if (inList) {
          lines[i - 1] += "</ul>";
          inList = false;
        }
      }
    }
    if (inList) {
      lines[lines.length - 1] += "</ul>";
    }
    html = lines.join("\n");

    // Links ([text](url))
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline; font-weight: 500;">$1</a>');

    // Line breaks
    html = html.replace(/\n/g, "<br>");

    return html;
  }

  // Web Component for the Chatbot Widget
  class AIChatbotWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      
      // Default state
      this.isOpen = false;
      this.settings = {
        brandColor: "#2563EB",
        welcomeMessage: "Hi there! Ask me anything about our services.",
        position: "bottom-right",
        emailCaptureRequired: false,
        avatarUrl: null
      };
      this.conversationId = localStorage.getItem("ai_chatbot_conv_id") || null;
      this.visitorEmail = localStorage.getItem("ai_chatbot_visitor_email") || null;
      this.messages = JSON.parse(localStorage.getItem("ai_chatbot_messages")) || [];
      this.isTyping = false;

      // Extract attributes / configurations
      this.apiKey = this.getAttribute("api-key") || (window.ChatbotConfig && window.ChatbotConfig.apiKey);
      this.apiHost = this.getAttribute("api-host") || (window.ChatbotConfig && window.ChatbotConfig.apiHost) || "http://localhost:8000";
      
      if (!this.apiKey) {
        console.error("AI Chatbot Widget: Missing 'api-key' parameter.");
      }
    }

    async connectedCallback() {
      // Load initial settings
      await this.loadSettings();
      
      // Inject Styles & Markup
      this.render();
      this.initElements();
      this.applySettings();
      this.setupEventListeners();
      
      // Load existing conversation or display welcome message
      this.loadConversation();
    }

    async loadSettings() {
      if (!this.apiKey) return;
      
      // If we are in Customizer preview mode, override fetch
      if (window.ChatbotConfig && window.ChatbotConfig.overrideSettings) {
        this.settings = { ...this.settings, ...window.ChatbotConfig.overrideSettings };
        return;
      }

      try {
        const response = await fetch(`${this.apiHost}/api/settings`, {
          method: "GET",
          headers: {
            "X-API-Key": this.apiKey
          }
        });
        if (response.ok) {
          const data = await response.json();
          this.settings = {
            brandColor: data.brand_color || "#2563EB",
            welcomeMessage: data.welcome_message || "Hi there! Ask me anything about our services.",
            position: data.position || "bottom-right",
            emailCaptureRequired: !!data.email_capture_required,
            avatarUrl: data.avatar_url || null
          };
        }
      } catch (err) {
        console.warn("AI Chatbot: Could not retrieve settings from server. Using defaults.", err);
      }
    }

    applySettings() {
      const container = this.shadowRoot.querySelector(".widget-container");
      const button = this.shadowRoot.querySelector(".launcher-btn");
      const header = this.shadowRoot.querySelector(".chat-header");
      const emailSubmitBtn = this.shadowRoot.querySelector(".email-submit-btn");

      // Position
      container.className = `widget-container ${this.settings.position}`;

      // Brand Color
      button.style.backgroundColor = this.settings.brandColor;
      header.style.backgroundColor = this.settings.brandColor;
      if (emailSubmitBtn) {
        emailSubmitBtn.style.backgroundColor = this.settings.brandColor;
      }
      
      // Apply CSS variable for brand color styling in message bubbles
      container.style.setProperty("--brand-color", this.settings.brandColor);

      // Custom Avatar
      const avatarEl = this.shadowRoot.querySelector(".header-avatar");
      if (this.settings.avatarUrl) {
        avatarEl.src = this.settings.avatarUrl;
      } else {
        // Fallback default avatar SVG
        avatarEl.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.477 2 2 6.477 2 12c0 1.88.519 3.638 1.419 5.148L2.05 21.8a.5.5 0 0 0 .584.585l4.651-1.37A9.957 9.957 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18c-1.578 0-3.07-.44-4.354-1.205a.5.5 0 0 0-.4-.055l-3.328.98.98-3.328a.5.5 0 0 0-.056-.4A7.957 7.957 0 0 1 4 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8zm-2-9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/></svg>`;
      }
    }

    render() {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 14px;
            color: #1F2937;
            z-index: 999999;
            position: fixed;
          }

          .widget-container {
            position: fixed;
            bottom: 24px;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            font-family: inherit;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          }

          .widget-container.bottom-right {
            right: 24px;
            align-items: flex-end;
          }

          .widget-container.bottom-left {
            left: 24px;
            align-items: flex-start;
          }

          /* Floating Launcher Button */
          .launcher-btn {
            width: 60px;
            height: 60px;
            border-radius: 30px;
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.2s;
            position: relative;
          }

          .launcher-btn:hover {
            transform: scale(1.08);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
          }

          .launcher-btn:active {
            transform: scale(0.95);
          }

          .launcher-btn svg {
            width: 28px;
            height: 28px;
            fill: white;
            transition: transform 0.3s;
          }

          .launcher-btn.open svg.chat-icon {
            transform: scale(0) rotate(90deg);
            position: absolute;
          }

          .launcher-btn svg.close-icon {
            transform: scale(0) rotate(-90deg);
            position: absolute;
          }

          .launcher-btn.open svg.close-icon {
            transform: scale(1) rotate(0deg);
          }

          /* Chat Window Card */
          .chat-window {
            width: 380px;
            height: 600px;
            max-height: calc(100vh - 120px);
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(243, 244, 246, 0.7);
            border-radius: 20px;
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
            margin-bottom: 16px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            opacity: 0;
            transform: translateY(20px) scale(0.95);
            pointer-events: none;
            transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            transform-origin: bottom right;
          }

          .widget-container.bottom-left .chat-window {
            transform-origin: bottom left;
          }

          .chat-window.open {
            opacity: 1;
            transform: translateY(0) scale(1);
            pointer-events: auto;
          }

          /* Header */
          .chat-header {
            padding: 16px 20px;
            color: white;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          }

          .header-profile {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .header-avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            object-fit: cover;
            background: rgba(255, 255, 255, 0.2);
            border: 1.5px solid rgba(255, 255, 255, 0.4);
          }

          .header-info h3 {
            margin: 0;
            font-size: 15px;
            font-weight: 600;
            letter-spacing: 0.2px;
          }

          .header-info p {
            margin: 2px 0 0 0;
            font-size: 11px;
            opacity: 0.9;
            display: flex;
            align-items: center;
            gap: 4px;
          }

          .header-info p::before {
            content: "";
            display: inline-block;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #10B981;
          }

          .close-window-btn {
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            padding: 4px;
            opacity: 0.8;
            transition: opacity 0.2s, transform 0.2s;
            display: flex;
            align-items: center;
          }

          .close-window-btn:hover {
            opacity: 1;
            transform: scale(1.1);
          }

          /* Messages log */
          .messages-log {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 14px;
            scroll-behavior: smooth;
          }

          .messages-log::-webkit-scrollbar {
            width: 5px;
          }
          .messages-log::-webkit-scrollbar-track {
            background: transparent;
          }
          .messages-log::-webkit-scrollbar-thumb {
            background: #E5E7EB;
            border-radius: 3px;
          }

          /* Message Bubbles */
          .message-row {
            display: flex;
            flex-direction: column;
            max-width: 85%;
            animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }

          @keyframes slideIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .message-row.visitor {
            align-self: flex-end;
          }

          .message-row.assistant, .message-row.owner {
            align-self: flex-start;
          }

          .bubble {
            padding: 10px 14px;
            border-radius: 16px;
            line-height: 1.45;
            word-break: break-word;
            font-size: 13.5px;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          }

          .message-row.visitor .bubble {
            background-color: var(--brand-color, #2563EB);
            color: white;
            border-bottom-right-radius: 4px;
          }

          .message-row.assistant .bubble {
            background-color: #F3F4F6;
            color: #1F2937;
            border-bottom-left-radius: 4px;
          }

          .message-row.owner .bubble {
            background-color: #EEF2FF;
            color: #3730A3;
            border: 1px solid #C7D2FE;
            border-bottom-left-radius: 4px;
          }

          .message-meta {
            font-size: 10px;
            color: #9CA3AF;
            margin-top: 4px;
            margin-left: 4px;
          }

          .message-row.visitor .message-meta {
            align-self: flex-end;
            margin-right: 4px;
            margin-left: 0;
          }

          /* System/Escalation Alert bubble */
          .system-notice {
            align-self: center;
            background: #FEF3C7;
            color: #92400E;
            border: 1px solid #FDE68A;
            border-radius: 10px;
            padding: 8px 12px;
            font-size: 11.5px;
            text-align: center;
            line-height: 1.4;
            max-width: 90%;
            margin: 4px 0;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
            animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }

          /* Input Footer */
          .chat-footer {
            padding: 12px 16px;
            border-top: 1px solid #F3F4F6;
            background: white;
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .message-input {
            flex: 1;
            border: 1.5px solid #E5E7EB;
            border-radius: 20px;
            padding: 10px 14px;
            font-size: 13.5px;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
            resize: none;
            height: 20px;
            max-height: 80px;
            line-height: 20px;
          }

          .message-input:focus {
            border-color: var(--brand-color, #2563EB);
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
          }

          .send-btn {
            background: none;
            border: none;
            cursor: pointer;
            padding: 8px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.2s, transform 0.2s;
            color: var(--brand-color, #2563EB);
          }

          .send-btn:hover {
            background-color: #F3F4F6;
            transform: scale(1.05);
          }

          .send-btn:active {
            transform: scale(0.95);
          }

          .send-btn svg {
            width: 20px;
            height: 20px;
            fill: currentColor;
          }

          /* Email Capture Overlay */
          .email-capture-overlay {
            position: absolute;
            top: 68px; /* Below header */
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.98);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 30px;
            text-align: center;
            z-index: 10;
            animation: fadeIn 0.25s ease forwards;
          }

          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          .email-capture-overlay svg {
            width: 48px;
            height: 48px;
            fill: #9CA3AF;
            margin-bottom: 16px;
          }

          .email-capture-overlay h4 {
            margin: 0 0 8px 0;
            font-size: 16px;
            font-weight: 600;
            color: #111827;
          }

          .email-capture-overlay p {
            margin: 0 0 20px 0;
            font-size: 12.5px;
            color: #6B7280;
            line-height: 1.5;
          }

          .email-input-field {
            width: 100%;
            max-width: 280px;
            border: 1.5px solid #D1D5DB;
            border-radius: 10px;
            padding: 10px 14px;
            font-size: 13.5px;
            outline: none;
            margin-bottom: 12px;
            text-align: center;
            box-sizing: border-box;
            transition: border-color 0.2s;
          }

          .email-input-field:focus {
            border-color: var(--brand-color, #2563EB);
          }

          .email-submit-btn {
            width: 100%;
            max-width: 280px;
            color: white;
            border: none;
            border-radius: 10px;
            padding: 11px;
            font-size: 13.5px;
            font-weight: 600;
            cursor: pointer;
            transition: opacity 0.2s;
          }

          .email-submit-btn:hover {
            opacity: 0.9;
          }

          /* Typing Indicator */
          .typing-indicator {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 6px;
          }

          .typing-dot {
            width: 6px;
            height: 6px;
            background: #9CA3AF;
            border-radius: 50%;
            animation: bounce 1.3s infinite ease-in-out;
          }

          .typing-dot:nth-child(2) { animation-delay: 0.15s; }
          .typing-dot:nth-child(3) { animation-delay: 0.3s; }

          @keyframes bounce {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-4px); }
          }

          /* Powered By Label */
          .powered-by {
            font-size: 10px;
            color: #9CA3AF;
            text-align: center;
            padding: 4px 0 6px 0;
            background: white;
            border-top: 1.5px solid rgba(243, 244, 246, 0.4);
          }
          .powered-by a {
            color: inherit;
            text-decoration: none;
            font-weight: 600;
            transition: color 0.2s;
          }
          .powered-by a:hover {
            color: var(--brand-color, #2563EB);
          }

          /* Responsive Tweaks */
          @media (max-width: 480px) {
            .chat-window {
              width: calc(100vw - 32px);
              height: calc(100vh - 100px);
              bottom: 0;
            }
            .widget-container {
              bottom: 12px;
            }
            .widget-container.bottom-right { right: 16px; }
            .widget-container.bottom-left { left: 16px; }
          }
        </style>

        <div class="widget-container bottom-right">
          <!-- Chat Window -->
          <div class="chat-window">
            <!-- Header -->
            <div class="chat-header">
              <div class="header-profile">
                <img class="header-avatar" src="" alt="Chatbot Profile">
                <div class="header-info">
                  <h3>Support Assistant</h3>
                  <p>Online</p>
                </div>
              </div>
              <button class="close-window-btn" title="Close Chat">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <!-- Email Capture Overlay -->
            <div class="email-capture-overlay" id="emailCapture" style="display: none;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
              <h4>Welcome!</h4>
              <p>To start your conversation with our AI assistant, please enter your email address.</p>
              <input type="email" class="email-input-field" placeholder="your@email.com" required>
              <button class="email-submit-btn">Start Chat</button>
            </div>

            <!-- Messages Log -->
            <div class="messages-log" id="messagesLog">
              <!-- Dynamically populated -->
            </div>

            <!-- Input Bar -->
            <div class="chat-footer">
              <textarea class="message-input" placeholder="Type a message..." rows="1"></textarea>
              <button class="send-btn" title="Send message">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            </div>

            <!-- White-Label Branding footer -->
            <div class="powered-by">
              Powered by <a href="#" target="_blank" rel="noopener noreferrer">Verdia AI</a>
            </div>
          </div>

          <!-- Launcher Button -->
          <button class="launcher-btn" title="Chat with support">
            <!-- Chat icon (Default launcher state) -->
            <svg class="chat-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>
            <!-- Close icon (Open state launcher) -->
            <svg class="close-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
      `;
    }

    initElements() {
      this.container = this.shadowRoot.querySelector(".widget-container");
      this.launcherBtn = this.shadowRoot.querySelector(".launcher-btn");
      this.chatWindow = this.shadowRoot.querySelector(".chat-window");
      this.closeBtn = this.shadowRoot.querySelector(".close-window-btn");
      this.messagesLog = this.shadowRoot.querySelector("#messagesLog");
      this.inputField = this.shadowRoot.querySelector(".message-input");
      this.sendBtn = this.shadowRoot.querySelector(".send-btn");
      this.emailOverlay = this.shadowRoot.querySelector("#emailCapture");
      this.emailInputField = this.shadowRoot.querySelector(".email-input-field");
      this.emailSubmitBtn = this.shadowRoot.querySelector(".email-submit-btn");
    }

    setupEventListeners() {
      // Toggle chat window on launcher click
      this.launcherBtn.addEventListener("click", () => this.toggleWindow());
      
      // Close window
      this.closeBtn.addEventListener("click", () => this.toggleWindow(false));

      // Input dynamic grow
      this.inputField.addEventListener("input", () => {
        this.inputField.style.height = "auto";
        this.inputField.style.height = `${Math.min(this.inputField.scrollHeight, 80)}px`;
      });

      // Press Enter to send
      this.inputField.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

      // Click Send button
      this.sendBtn.addEventListener("click", () => this.sendMessage());

      // Submit email capture
      this.emailSubmitBtn.addEventListener("click", () => this.submitEmailCapture());
      this.emailInputField.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          this.submitEmailCapture();
        }
      });
    }

    toggleWindow(forceState) {
      this.isOpen = forceState !== undefined ? forceState : !this.isOpen;
      
      if (this.isOpen) {
        this.chatWindow.classList.add("open");
        this.launcherBtn.classList.add("open");
        this.scrollToBottom();
        this.inputField.focus();

        // Check if email capture is required and not present
        if (this.settings.emailCaptureRequired && !this.visitorEmail) {
          this.emailOverlay.style.display = "flex";
        } else {
          this.emailOverlay.style.display = "none";
        }
      } else {
        this.chatWindow.classList.remove("open");
        this.launcherBtn.classList.remove("open");
      }
    }

    submitEmailCapture() {
      const email = this.emailInputField.value.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!email || !emailRegex.test(email)) {
        this.emailInputField.style.borderColor = "red";
        return;
      }

      this.visitorEmail = email;
      localStorage.setItem("ai_chatbot_visitor_email", email);
      this.emailOverlay.style.display = "none";
      this.inputField.focus();
    }

    loadConversation() {
      this.messagesLog.innerHTML = "";
      
      // If we don't have stored messages, show default welcome message
      if (this.messages.length === 0) {
        const welcomeText = this.settings.welcomeMessage;
        this.messages.push({
          sender: "assistant",
          content: welcomeText,
          timestamp: new Date().toISOString()
        });
        this.saveMessages();
      }

      this.messages.forEach(msg => {
        this.appendMessageElement(msg.sender, msg.content, msg.timestamp);
      });
      
      this.scrollToBottom();
    }

    appendMessageElement(sender, content, timestamp) {
      // Remove typing bubble if present (to append new message)
      this.removeTypingIndicator();

      if (content.startsWith("[System Notice:")) {
        const noticeEl = document.createElement("div");
        noticeEl.className = "system-notice";
        noticeEl.innerHTML = parseMarkdown(content);
        this.messagesLog.appendChild(noticeEl);
        this.scrollToBottom();
        return;
      }

      const row = document.createElement("div");
      row.className = `message-row ${sender}`;

      const bubble = document.createElement("div");
      bubble.className = "bubble";
      bubble.innerHTML = parseMarkdown(content);

      const meta = document.createElement("div");
      meta.className = "message-meta";
      const date = timestamp ? new Date(timestamp) : new Date();
      meta.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      row.appendChild(bubble);
      row.appendChild(meta);
      this.messagesLog.appendChild(row);
      this.scrollToBottom();
    }

    showTypingIndicator() {
      if (this.isTyping) return;
      this.isTyping = true;

      const row = document.createElement("div");
      row.className = "message-row assistant typing-row";
      row.id = "typingIndicatorBubble";

      const bubble = document.createElement("div");
      bubble.className = "bubble typing-indicator";
      bubble.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      `;

      row.appendChild(bubble);
      this.messagesLog.appendChild(row);
      this.scrollToBottom();
    }

    removeTypingIndicator() {
      const el = this.shadowRoot.getElementById("typingIndicatorBubble");
      if (el) {
        el.remove();
      }
      this.isTyping = false;
    }

    async sendMessage() {
      const query = this.inputField.value.trim();
      if (!query || this.isTyping) return;

      // Clear input and reset height
      this.inputField.value = "";
      this.inputField.style.height = "auto";

      // Append visitor message to UI
      const timestamp = new Date().toISOString();
      this.appendMessageElement("visitor", query, timestamp);
      
      // Save visitor message to state
      this.messages.push({
        sender: "visitor",
        content: query,
        timestamp: timestamp
      });
      this.saveMessages();

      // Show typing indicator
      this.showTypingIndicator();

      // Generate or retrieve visitor session ID
      if (!this.conversationId) {
        this.conversationId = crypto.randomUUID();
        localStorage.setItem("ai_chatbot_conv_id", this.conversationId);
      }

      // Establish SSE fetch stream
      try {
        const payload = {
          query: query,
          conversation_id: this.conversationId,
          visitor_email: this.visitorEmail || undefined,
          page_url: window.location.href
        };

        const response = await fetch(`${this.apiHost}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": this.apiKey
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`Server returned HTTP ${response.status}`);
        }

        // Setup stream reading
        this.removeTypingIndicator();
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let botReply = "";

        // Create initial response row to stream tokens into
        const botRow = document.createElement("div");
        botRow.className = "message-row assistant";
        const botBubble = document.createElement("div");
        botBubble.className = "bubble";
        const botMeta = document.createElement("div");
        botMeta.className = "message-meta";
        botMeta.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        botRow.appendChild(botBubble);
        botRow.appendChild(botMeta);
        this.messagesLog.appendChild(botRow);
        
        let hasNotice = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          
          // Save the last line if it's incomplete
          buffer = lines.pop();

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            const dataStr = trimmed.substring(6);
            if (dataStr === "[DONE]") {
              break;
            }

            try {
              const dataObj = JSON.parse(dataStr);
              if (dataObj.text) {
                // If this is a System Notice escalation snippet, handle specially
                if (dataObj.text.startsWith("[System Notice:")) {
                  hasNotice = true;
                  const noticeEl = document.createElement("div");
                  noticeEl.className = "system-notice";
                  noticeEl.innerHTML = parseMarkdown(dataObj.text);
                  this.messagesLog.insertBefore(noticeEl, botRow);
                  
                  // Record notice in storage
                  this.messages.push({
                    sender: "assistant",
                    content: dataObj.text,
                    timestamp: new Date().toISOString()
                  });
                } else {
                  botReply += dataObj.text;
                  botBubble.innerHTML = parseMarkdown(botReply);
                }
                this.scrollToBottom();
              }
            } catch (err) {
              // Parse error, skip line
            }
          }
        }

        // Save AI reply to storage
        if (botReply) {
          this.messages.push({
            sender: "assistant",
            content: botReply,
            timestamp: new Date().toISOString()
          });
          this.saveMessages();
        }

      } catch (err) {
        console.error("AI Chatbot Stream Error:", err);
        this.removeTypingIndicator();
        const errMsg = "[System Notice: Connection lost. Failed to fetch response from AI Assistant.]";
        this.appendMessageElement("assistant", errMsg, new Date().toISOString());
        this.messages.push({
          sender: "assistant",
          content: errMsg,
          timestamp: new Date().toISOString()
        });
        this.saveMessages();
      }
    }

    scrollToBottom() {
      setTimeout(() => {
        this.messagesLog.scrollTop = this.messagesLog.scrollHeight;
      }, 50);
    }

    saveMessages() {
      // Keep only last 50 messages to protect localStorage space
      if (this.messages.length > 50) {
        this.messages = this.messages.slice(-50);
      }
      localStorage.setItem("ai_chatbot_messages", JSON.stringify(this.messages));
    }
  }

  // Register the custom element
  customElements.define("ai-chatbot-widget", AIChatbotWidget);

  // Auto-inject widget styles and element on page load
  function injectWidget() {
    // Only inject if not already in markup
    if (document.querySelector("ai-chatbot-widget")) return;

    const widget = document.createElement("ai-chatbot-widget");
    
    // Set standard apiHost parameter
    if (window.ChatbotConfig) {
      if (window.ChatbotConfig.apiKey) {
        widget.setAttribute("api-key", window.ChatbotConfig.apiKey);
      }
      if (window.ChatbotConfig.apiHost) {
        widget.setAttribute("api-host", window.ChatbotConfig.apiHost);
      }
    }
    
    document.body.appendChild(widget);
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    injectWidget();
  } else {
    document.addEventListener("DOMContentLoaded", injectWidget);
  }
})();
