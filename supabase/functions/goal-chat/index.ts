const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Strict system prompt used only for the generate call — overrides whatever the frontend sends
const GENERATE_SYSTEM =
  'You must respond with only a valid JSON object. No text before or after. No markdown. No backticks. Just the raw JSON.';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { messages, systemPrompt, mode } = await req.json();

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
        // Generate mode forces JSON-only; chat mode uses the coaching system prompt
        system: isGenerate ? GENERATE_SYSTEM : systemPrompt,
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
