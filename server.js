import express from "express";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

/* =========================
   API SETTINGS
========================= */

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = "llama-3.1-8b-instant";

/* =========================
   PERSONALITY
========================= */

const SYSTEM_PROMPT = `
You are Bubble AI.

You are friendly, helpful, and slightly playful.

Answer clearly and helpfully.
`;

/* =========================
   WEBSITE KNOWLEDGE
========================= */

const KNOWLEDGE_URLS = [
  "https://sites.google.com/hpsbegumpet.org.in/our-class-8a/",
  "https://sites.google.com/hpsbegumpet.org.in/our-class-8a/pavan",
  "https://sites.google.com/hpsbegumpet.org.in/our-class-8a/pbrs",
  "https://sites.google.com/hpsbegumpet.org.in/our-class-8a/students",
  "https://sites.google.com/hpsbegumpet.org.in/our-class-8a/teachers",
  "https://sites.google.com/hpsbegumpet.org.in/our-class-8a/quotes",
  "https://sites.google.com/hpsbegumpet.org.in/our-class-8a/test"
];

/* =========================
   WEBSITE CACHE (FAST)
========================= */

let cachedWebsiteText = "";
let lastFetchTime = 0;

// refresh every 10 minutes
const CACHE_DURATION = 10 * 60 * 1000;

async function getWebsiteTextCached() {
  const now = Date.now();

  if (cachedWebsiteText && (now - lastFetchTime < CACHE_DURATION)) {
    console.log("Using cached website data");
    return cachedWebsiteText;
  }

  console.log("Refreshing website cache...");

  let allText = "";

  for (const url of KNOWLEDGE_URLS) {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: controller.signal
      });

      const html = await response.text();

      const $ = cheerio.load(html);
      const text = $("body").text();

      allText += text + "\n";

    } catch (err) {
      console.log("Failed:", url);
    }
  }

  cachedWebsiteText = allText;
  lastFetchTime = now;

  return allText;
}

/* =========================
   MEMORY
========================= */

let conversationHistory = [];
const MAX_MEMORY = 10;

/* =========================
   ROUTES
========================= */

// homepage
app.get("/", (req, res) => {
  res.send("Bubble AI server is running");
});

// test UI
app.get("/test", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Bubble AI</title>

  <style>
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: #0f172a;
      color: white;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    header {
      padding: 15px;
      background: #1e293b;
      font-size: 18px;
      font-weight: bold;
      text-align: center;
    }

    #chat {
      flex: 1;
      padding: 15px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .msg {
      max-width: 70%;
      padding: 10px 14px;
      border-radius: 12px;
      line-height: 1.4;
      white-space: pre-wrap;
    }

    .user {
      align-self: flex-end;
      background: #3b82f6;
    }

    .bot {
      align-self: flex-start;
      background: #1e293b;
    }

    #inputBox {
      display: flex;
      padding: 10px;
      background: #1e293b;
    }

    input {
      flex: 1;
      padding: 10px;
      border: none;
      outline: none;
      border-radius: 8px;
      font-size: 14px;
    }

    button {
      margin-left: 10px;
      padding: 10px 15px;
      border: none;
      background: #3b82f6;
      color: white;
      border-radius: 8px;
      cursor: pointer;
    }

    button:hover {
      background: #2563eb;
    }

    .typing {
      font-style: italic;
      opacity: 0.7;
    }
  </style>
</head>

<body>

<header>💬 Bubble AI</header>

<div id="chat"></div>

<div id="inputBox">
  <input id="msg" placeholder="Type a message..." />
  <button onclick="send()">Send</button>
</div>

<script>
  const chat = document.getElementById("chat");
  const input = document.getElementById("msg");

  function addMessage(text, type) {
    const div = document.createElement("div");
    div.className = "msg " + type;
    div.textContent = text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    return div;
  }

  async function send() {
    const message = input.value.trim();
    if (!message) return;

    addMessage(message, "user");
    input.value = "";

    const typing = addMessage("Bubble AI is typing...", "bot typing");

    try {
      const res = await fetch("/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message })
      });

      const data = await res.json();

      typing.remove();
      addMessage(data.reply || "No response", "bot");

    } catch (err) {
      typing.remove();
      addMessage("Error connecting to server.", "bot");
    }
  }

  // Enter key support
  input.addEventListener("keypress", function(e) {
    if (e.key === "Enter") {
      send();
    }
  });
</script>

</body>
</html>
  `);
});

/* =========================
   CHAT ROUTE
========================= */

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res.json({ reply: "No message provided." });
    }

    console.log("Incoming:", userMessage);

    // use cached website
    const websiteText = await getWebsiteTextCached();

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "system",
              content: "Website data:\n" + websiteText.slice(0, 5000)
            },
            { role: "user", content: userMessage }
          ]
        })
      }
    );

    const data = await response.json();

    console.log("FULL GROQ RESPONSE:", data);

    if (!data.choices) {
      return res.json({
        reply: "ERROR: " + JSON.stringify(data)
      });
    }

    const aiReply = data.choices[0].message.content;

    res.json({ reply: aiReply });

  } catch (err) {
    console.log("SERVER ERROR:", err);
    res.json({ reply: "Server crashed." });
  }
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Bubble AI server running on port ${PORT}`);
});
