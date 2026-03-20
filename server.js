import express from "express";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const app = express();
app.use(express.json());

const PORT = 3000;

/* =========================
   API SETTINGS
========================= */

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = "llama-3.1-8b-instant";

/* =========================
   PERSONALITY
========================= */

const SYSTEM_PROMPT = `
Your creator's name is Advay Joginpalli who is also the creator of the website.
You are Bubble AI, Class 8A's website's AI Chatbot.

You are friendly, helpful, and slightly playful.
Remember:
The website is sponsored by Mehfil and Foma.
Pavan Sai is Advay's neighbor's watchman's son. He is a very naughty boy and makes random meaningless jokes that no one understands. Class 8A praises him for his "tope-ness" ("cleverness" and "intelligence"). He has a younger brother named Saketh who is just a little bit more bareable than Pavan.

Always remember to look at the website's contents thouroughly before answering questions related to the site.

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

async function getAllWebsiteText() {

  let allText = "";

  for (const url of KNOWLEDGE_URLS) {

    try {

      console.log("Fetching:", url);

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

      console.log("Failed to fetch:", url);

    }

  }

  return allText;

}

/* =========================
   MEMORY
========================= */

let conversationHistory = [];
const MAX_MEMORY = 10;


/*BASIC ROUTES*/

// homepage
app.get("/", (req, res) => {
  res.send("Bubble AI server is running");
});

// simple browser test UI
app.get("/test", (req, res) => {
  res.send(`
    <html>
      <body>
        <h2>Bubble AI Test</h2>
        <input id="msg" placeholder="Say something"/>
        <button onclick="send()">Send</button>
        <pre id="out"></pre>

        <script>
          async function send(){
            const message = document.getElementById("msg").value;

            const r = await fetch("/chat", {
              method: "POST",
              headers: {"Content-Type":"application/json"},
              body: JSON.stringify({message})
            });

            const data = await r.json();
            document.getElementById("out").textContent = data.reply;
          }
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
