import { useRef, useState } from "react";

const INVITE = [
  ["ta-IN", "உங்கள் மொழியில் பேசுங்கள்"],
  ["hi-IN", "अपनी भाषा में बोलिए"],
  ["te-IN", "మీ భాషలో మాట్లాడండి"],
  ["ml-IN", "നിങ്ങളുടെ ഭാഷയിൽ സംസാരിക്കൂ"],
];
const ERR = "🙏 மீண்டும் தட்டுங்கள் / फिर से दबाइए / మళ్ళీ నొక్కండి / വീണ്ടും തൊടൂ";

const speak = (text, lang) =>
  new Promise((done) => {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang; u.rate = 0.9; u.onend = u.onerror = done;
      speechSynthesis.speak(u);
    } catch { done(); }
  });

const b64 = (blob) =>
  new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result.split(",")[1]); r.readAsDataURL(blob); });

export default function App() {
  const [card, setCard] = useState(null);
  const [state, setState] = useState("idle"); // idle | recording | thinking
  const [typing, setTyping] = useState(false);
  const [txt, setTxt] = useState("");
  const history = useRef([]);
  const rec = useRef(null);

  async function send(payload) {
    setState("thinking");
    try {
      const r = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: history.current, ...payload }),
      });
      if (!r.ok) throw new Error("api");
      const d = await r.json();
      history.current.push({ role: "user", text: d.heard || payload.text || "(opened app)" });
      history.current.push({ role: "model", text: d.answer });
      setCard(d); setState("idle");
      speak([d.answer, ...(d.checklist || []), d.where].filter(Boolean).join(". "), d.lang);
    } catch {
      setState("idle"); setTyping(true);
      setCard({ answer: ERR, lang: "ta-IN", checklist: [], where: "" });
    }
  }

  async function tapMic() {
    if (state === "recording") { rec.current.stop(); return; }
    if (state !== "idle") return;
    speechSynthesis.cancel();
    if (!card) { for (const [l, t] of INVITE) await speak(t, l); }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream), chunks = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mr.mimeType });
        send({ audio: { mimeType: mr.mimeType.split(";")[0], data: await b64(blob) } });
      };
      rec.current = mr; mr.start(); setState("recording");
      setTimeout(() => mr.state === "recording" && mr.stop(), 8000);
    } catch { setTyping(true); }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-pink-50 p-5 text-gray-900">
      <h1 className="text-center text-3xl font-bold text-pink-700">தோழி 🌸 Thozhi</h1>
      <p className="text-center text-sm text-gray-600">PM Matru Vandana Yojana</p>

      {card && (
        <section className="space-y-3 rounded-3xl border-2 border-pink-200 bg-white p-5 text-2xl leading-relaxed">
          <p>{card.answer}</p>
          {card.checklist?.length > 0 && (
            <ul className="space-y-1 text-xl">{card.checklist.map((c) => <li key={c}>📄 {c}</li>)}</ul>
          )}
          {card.where && <p className="text-xl">📍 {card.where}</p>}
          <button className="text-lg text-pink-700" onClick={() => speak(card.answer, card.lang)}>🔊</button>
        </section>
      )}

      <button
        onClick={tapMic}
        aria-label="speak"
        className={`mx-auto my-4 h-44 w-44 rounded-full text-6xl text-white shadow-xl ${state === "recording" ? "animate-pulse bg-red-600" : "bg-pink-600"}`}
      >
        {state === "thinking" ? "⏳" : state === "recording" ? "⏹" : "🎤"}
      </button>
      <p className="text-center text-lg">
        {state === "recording" ? "கேட்கிறேன்… / सुन रही हूँ…" : !card ? "தொடங்க தட்டுங்கள் · शुरू करें · ప్రారంభించండి · തുടങ്ങൂ" : ""}
      </p>

      <button className="text-center text-sm text-gray-500 underline" onClick={() => setTyping(!typing)}>⌨️</button>
      {typing && (
        <div className="flex gap-2">
          <input className="flex-1 rounded-xl border p-3 text-lg" value={txt} onChange={(e) => setTxt(e.target.value)} />
          <button className="rounded-xl bg-pink-600 px-4 text-white" onClick={() => { send({ text: txt }); setTxt(""); }}>➤</button>
        </div>
      )}
      <p className="mt-auto text-center text-xs text-gray-500">Confirm final details with your Anganwadi worker.</p>
    </main>
  );
}
