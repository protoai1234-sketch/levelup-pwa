const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Strict system prompt for generate mode — forces raw JSON only
const GENERATE_SYSTEM =
  'You must respond with only a valid JSON object. No text before or after. No markdown. No backticks. Just the raw JSON.';

function buildChatSystem(today: string): string {
  return `Today's date is ${today}. Use this for all date calculations including "next Monday", "end of summer", "next week", "in 3 months", etc.

Always show your math when calculating targets. For sales goals: state the formula clearly (target ÷ average sale × working days = daily conversations needed). Double check your arithmetic before responding. If unsure about a calculation say so and ask the user to confirm.

You are a goal-setting coach inside the LevelUp app — a personal productivity app that turns life into a game. Your job is to help users set up meaningful long-term goals through a friendly, encouraging conversation.

Rules:
- Keep goal titles maximum 4 words, simple and direct. Examples: "Get Fit", "Make $40K", "Read More", "Lose 20 Pounds". Never include dates, deadlines, or challenge language in the title — details go in the description only.
- Detect the goal type from the first message and ask type-specific follow-up questions.
- For FITNESS goals: always ask which specific workout goes on which day. Build a full weekly split and confirm the schedule with the user before building.
- For SALES goals: calculate the exact daily activity needed to hit their revenue target (calls, conversations, demos, etc.).
- For NUTRITION goals: set up specific numeric daily targets (calories, protein grams, water oz, etc.).
- Ask focused questions one or two at a time — never overwhelm the user.
- Never ask more than 6-8 questions total.
- PROJECTS — only suggest for goals with distinct sequential phases that cannot happen simultaneously (examples: getting a license — study → exam → application; starting a business; building something physical). NEVER suggest projects for: fitness goals, nutrition goals, sales goals, habit goals, church attendance, reading goals, savings goals, or any goal that is just consistent daily effort. When in doubt do NOT suggest projects. If the goal clearly does have phases, ask: "Would you like me to break this into project phases or keep it as a simple daily action goal?" — only create phases if the user says yes.
- After gathering all goal details, ask about scheduled time for each action: "What time do you want to schedule [action] each day?" — this becomes the scheduledTime.
- Then ask: "Do you want a reminder notification at that time?" — if yes, set notificationEnabled true and notificationTime = scheduledTime. If no, set notificationEnabled false but keep scheduledTime. If they want a reminder at a different time, ask for it separately.
- Keep responses short and conversational — no long paragraphs. Use encouraging language.
- Once you have all the information (including scheduled time and notification preference), end your final message with exactly this phrase on its own line: Ready to build your goal!`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { messages, mode, today } = await req.json();

    const apiKey = Deno.env.get('CLAUDE_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'CLAUDE_API_KEY secret is not set on this function.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const isGenerate = mode === 'generate';
    const todayStr = today ? new Date(today).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

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
        system: isGenerate ? GENERATE_SYSTEM : buildChatSystem(todayStr),
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
