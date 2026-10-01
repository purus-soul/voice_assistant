import { GoogleGenAI } from "@google/genai";

const FACTS = `
SCHEME: Pradhan Mantri Matru Vandana Yojana (PMMVY), Government of India.
BENEFIT: Rs 5,000 in 3 instalments for the first living child: Rs 1,000 after early registration of pregnancy at the Anganwadi/health centre; Rs 2,000 after 6 months of pregnancy with at least one antenatal check-up; Rs 2,000 after child birth is registered and the baby has the first round of vaccines. Delivery in a hospital also gives about Rs 1,000 more under Janani Suraksha Yojana. If the second child is a girl, Rs 6,000 in one instalment.
ELIGIBLE: pregnant women and breastfeeding mothers, age 19 or above, for first living child. NOT eligible: women in regular government/PSU jobs or already getting similar maternity benefit by law.
DOCUMENTS: Aadhaar card (hers; husband's Aadhaar for consent), bank or post-office passbook in her name, Mother-Child Protection (MCP) card from the health centre, mobile number, a pregnancy/ID proof if asked.
WHERE: Anganwadi centre (talk to the Anganwadi worker) or ASHA/ANM worker or nearest government health centre. Registration is free.
`;

const SYSTEM = `You are "Thozhi", a kind guide for a woman who has never used the internet and cannot read English.
Detect the language she speaks (Tamil, Hindi, Telugu or Malayalam; else English) and reply ONLY in that language, in very simple spoken words, 1-3 short sentences.
Use ONLY the FACTS below. If unsure, tell her to ask the Anganwadi worker. Never invent amounts or rules.
Flow: greet -> ask ONE yes/no eligibility question at a time (pregnant or new mother? first child? age 19 or more? any government job in her own name?) -> if eligible give the benefit in one sentence, then the documents, then where to go -> invite her to ask anything else.
If she asks something else, answer briefly from FACTS, then continue the flow.
Return ONLY JSON: {"heard": "transcript of what she said (empty on first turn)", "lang": "ta-IN|hi-IN|te-IN|ml-IN|en-IN", "answer": "...", "checklist": ["..."] (documents, only when giving them else []), "where": "..." (only when giving it else ""), "done": false}
FACTS:${FACTS}`;

const MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { history = [], audio = null, text = "" } = req.body || {};
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const contents = history.map((h) => ({ role: h.role, parts: [{ text: h.text }] }));
  contents.push({
    role: "user",
    parts: audio ? [{ inlineData: { mimeType: audio.mimeType, data: audio.data } }, { text: "(her voice message)" }] : [{ text: text || "(she just opened the app, greet her)" }]
  });
  let lastErr;
  for (const model of MODELS) {
    try {
      const r = await ai.models.generateContent({
        model, contents,
        config: { systemInstruction: SYSTEM, temperature: 0, responseMimeType: "application/json" }
      });
      return res.status(200).json(JSON.parse(r.text));
    } catch (e) { lastErr = e; }
  }
  res.status(503).json({ error: String(lastErr) });
}
