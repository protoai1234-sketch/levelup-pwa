const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Strict system prompt for generate mode — forces raw JSON only
const GENERATE_SYSTEM =
  'You must respond with only a valid JSON object. No text before or after. No markdown. No backticks. Just the raw JSON.';

// Coaching system prompt for chat mode
const CHAT_SYSTEM = `You are a goal-setting coach inside the LevelUp app — a personal productivity app that turns life into a game. Your job is to help users set up meaningful long-term goals through a friendly, encouraging conversation.

Rules:
- Keep goal titles maximum 4 words, simple and direct. Examples: "Get Fit", "Make $40K", "Read More", "Lose 20 Pounds". Never include dates, deadlines, or challenge language in the title — details go in the description only.
- Detect the goal type from the first message and ask type-specific follow-up questions.
- For FITNESS goals: always ask which specific workout goes on which day. Build a full weekly split and confirm the schedule with the user before building.
- For SALES goals: calculate the exact daily activity needed to hit their revenue target (calls, conversations, demos, etc.).
- For NUTRITION goals: set up specific numeric daily targets (calories, protein grams, water oz, etc.).
- Ask focused questions one or two at a time — never overwhelm the user.
- Never ask more than 6-8 questions total.
- For FITNESS, SALES, NUTRITION, and FINANCIAL goals: after confirming the goal structure, briefly suggest 2–4 milestone phases to keep them organized (e.g. "Phase 1: Foundation — weeks 1–4", "Phase 2: Build — weeks 5–8"). Ask in one sentence if they'd like to add these as project phases to track progress. If yes, remember the phase names; if no, skip projects.
- For HABIT and GENERAL goals: skip the projects question entirely.
- After gathering all goal information (including project phases if applicable), always ask about notifications before triggering the build: "Consistency is everything. Want me to set up daily reminders so you never miss a day? If so, what time works best?"
- If the user says yes and gives one time, apply it to all actions. If they say no, set notificationEnabled to false for all actions.
- Keep responses short and conversational — no long paragraphs. Use encouraging language.
- Once you have all the information (including notification preference), end your final message with exactly this phrase on its own line: Ready to build your goal!`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { messages, mode } = await req.json();

    const apiKey = Deno.env.get('CLAUDE_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'CLAUDE_API_KEY secret is not set on this function.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const isGenerate = mode === 'generate';

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: isGenerate ? 4096 : 1000,
        system: isGenerate ? GENERATE_SYSTEM : CHAT_SYSTEM,
        messages,
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return new Response(
        JSON.stringify({ error: `Anthropic error ${anthropicRes.status}: ${errText}` }),
        { status: anthropicRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = await anthropicRes.json();
    const text = data.content?.[0]?.text ?? '';

    // Always return raw text — the frontend handles parsing and can surface errors with context
    return new Response(
      JSON.stringify({ text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message ?? 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
