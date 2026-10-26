'use client';

// P6-b: the coach chat, extracted verbatim from the old /coach page so it can
// live as one pane of the unified /insights tab. Behavior is unchanged: a
// client chat over POST /api/coach (rule-based engine, no LLM), suggestions
// chips, citations rendered under each answer. CoachThread/CoachMessage
// persistence stays exactly as the API implements it.
import { useState, useRef, useEffect } from 'react';

interface Msg { role: 'user' | 'coach'; content: string; citations?: string[]; grounded?: boolean }

const SUGGESTIONS = [
  'Can I eat biryani today?',
  'Why did my glucose rise?',
  'What should I eat for dinner?',
  'Is idli ok for breakfast?',
];

export default function CoachChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function ask(q: string) {
    if (!q.trim() || loading) return;
    const next = [...messages, { role: 'user' as const, content: q }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const j = await res.json();
      setMessages([...next, {
        role: 'coach', content: j.text, citations: j.citations, grounded: j.grounded,
      }]);
    } catch {
      setMessages([...next, { role: 'coach', content: 'Sorry, I had trouble answering that.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-16rem)] min-h-[24rem] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-neutral-500">Ask me anything about your metabolism.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)}
                  className="min-h-[44px] rounded-full border border-neutral-300 px-3 py-1.5 text-xs hover:border-brand-400 dark:border-neutral-700">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
              m.role === 'user'
                ? 'bg-brand-600 text-white'
                : 'bg-neutral-100 dark:bg-neutral-900'
            }`}>
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.citations && m.citations.length > 0 && (
                <div className="mt-2 border-t border-neutral-200 pt-2 dark:border-neutral-700">
                  <p className="text-[10px] uppercase text-neutral-400">Based on</p>
                  <ul className="mt-1 space-y-0.5">
                    {m.citations.map((c, j) => (
                      <li key={j} className="text-[11px] text-neutral-500">• {c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-neutral-100 px-4 py-2.5 text-sm dark:bg-neutral-900">
              <span className="animate-pulse">Thinking…</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(input); }}
        className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a food, your glucose, or what to eat…"
          className="flex-1 rounded-lg border border-neutral-300 bg-transparent px-4 py-2.5 outline-none focus:border-brand-500 dark:border-neutral-700"
        />
        <button type="submit" disabled={loading || !input.trim()}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          Send
        </button>
      </form>
    </div>
  );
}
