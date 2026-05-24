// All Claude API calls go through the Supabase Edge Function.
// The CLAUDE_API_KEY secret never leaves the server.

import { todayString } from './dateHelpers';

const EDGE_FN_URL = 'https://bnfhcwzyaxtitgoydrmz.functions.supabase.co/goal-chat';
const TIMEOUT_MS = 30000;

// When the AI ends a message with this phrase, the frontend auto-triggers goal generation.
export const READY_TRIGGER = 'Ready to build your goal!';

// Keep this in sync with buildChatSystem() in the edge function (edge function is authoritative).
export const SYSTEM_PROMPT = `[Date injected server-side] You are a goal-setting coach inside the LevelUp app — a personal productivity app that turns life into a game. Your job is to help users set up meaningful long-term goals through a friendly, encouraging conversation.

Rules:
- Keep goal titles maximum 4 words, simple and direct. Examples: "Get Fit", "Make $40K", "Read More", "Lose 20 Pounds". Never include dates, deadlines, or challenge language in the title — details go in the description only.
- Detect the goal type from the first message and ask type-specific follow-up questions.
- For FITNESS goals: always ask which specific workout goes on which day. Build a full weekly split and confirm the schedule with the user before building.
- For SALES goals: calculate the exact daily activity needed to hit their revenue target. Always show your math (target ÷ average sale × working days = daily conversations needed). Double-check arithmetic before responding.
- For NUTRITION goals: set up specific numeric daily targets (calories, protein grams, water oz, etc.).
- Ask focused questions one or two at a time — never overwhelm the user.
- Never ask more than 6-8 questions total.
- PROJECTS — only suggest for goals with distinct sequential phases that cannot happen simultaneously (getting a license, starting a business, building something). NEVER suggest for: fitness, nutrition, sales, habit, reading, savings, or any consistent-daily-effort goal. When in doubt, skip projects. If the goal clearly has phases, ask: "Would you like me to break this into project phases or keep it as a simple daily action goal?" — only create phases if the user says yes.
- After gathering all goal details, ask about scheduled time for each action: "What time do you want to schedule [action] each day?" (this sets scheduledTime). Then ask: "Do you want a reminder notification at that time?" — yes sets notificationEnabled true and notificationTime = scheduledTime; no sets notificationEnabled false but keeps scheduledTime.
- Keep responses short and conversational — no long paragraphs. Use encouraging language.
- Once you have all the information, end your final message with exactly this phrase on its own line: Ready to build your goal!`;

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''}`,
  };
}

async function callEdgeFn(body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('Request timed out after 30 seconds. Please try again.');
    throw e;
  }
  clearTimeout(timer);

  console.log('[EdgeFn] Response status:', res.status);

  if (!res.ok) {
    const errText = await res.text().catch(() => `HTTP ${res.status}`);
    console.error('[EdgeFn] Error body:', errText);
    let msg;
    try { msg = JSON.parse(errText).error; } catch { msg = errText; }
    throw new Error(msg || `Edge function returned ${res.status}`);
  }

  const data = await res.json();
  console.log('[EdgeFn] Response data:', data);
  return data;
}

// Returns the assistant's reply text.
export async function sendGoalChat(messages) {
  const data = await callEdgeFn({ messages, mode: 'chat', today: new Date().toISOString() });
  if (data.error) throw new Error(data.error);
  const text = data.text ?? '';
  if (!text) throw new Error('Got an empty response from the AI. Please try again.');
  return text;
}

// Returns parsed goal JSON object.
export async function buildGoalFromConversation(messages) {
  const today = todayString();
  const d90 = new Date();
  d90.setDate(d90.getDate() + 90);
  const ninetyDays = `${d90.getFullYear()}-${String(d90.getMonth()+1).padStart(2,'0')}-${String(d90.getDate()).padStart(2,'0')}`;

  const buildPrompt = `Based on our entire conversation, generate the complete goal configuration as a JSON object. You must respond with ONLY a valid JSON object and absolutely nothing else — no preamble, no explanation, no markdown code blocks, no backticks. Just the raw JSON.

Use this exact schema:

{
  "title": "string (max 4 words, no dates)",
  "description": "string",
  "goalType": "fitness|sales|nutrition|financial|habit|general",
  "traits": ["from: Discipline, Health, Knowledge, Finance, Social, Creativity"],
  "startDate": "${today}",
  "endDate": "YYYY-MM-DD",
  "activeDays": [1,2,3,4,5],
  "dailyActions": [
    {
      "name": "string",
      "pointValue": 30,
      "scheduledTime": "08:00",
      "notificationEnabled": false,
      "notificationTime": "07:00",
      "metricType": "checkbox",
      "metricTarget": null,
      "metricUnit": null,
      "dayOfWeek": null
    }
  ],
  "weeklyPlan": {
    "monday": null, "tuesday": null, "wednesday": null, "thursday": null,
    "friday": null, "saturday": null, "sunday": null
  },
  "projects": [
    {
      "name": "string",
      "description": "string",
      "tasks": [
        { "name": "string", "due_date": "YYYY-MM-DD or null" }
      ]
    }
  ]
}

Rules:
- title must be 4 words or fewer — no dates, no deadlines, no challenge language
- activeDays: JS day numbers — 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
- startDate must be ${today}
- endDate should reflect the user's timeline; default to ${ninetyDays} if not specified
- For fitness goals with a weekly split: fill weeklyPlan strings describing each day's workout; set dayOfWeek (0-6) on each action to assign it to a specific day; metricType stays "checkbox"
- For sales/nutrition/financial goals: set metricType "number", metricTarget to the numeric target, metricUnit to the unit (e.g. "conversations", "grams", "dollars", "calories")
- For rest days in fitness, set weeklyPlan value to null — do not create actions for rest days
- Point values: 10-20 easy, 30-50 moderate, 60-100 hard effort per action
- Generate specific, actionable action names — not generic ones
- SCHEDULED TIME: Read back through the conversation. If the user provided a scheduled time for an action, set scheduledTime to that time in HH:MM 24-hour format. Default to "08:00" if no time was given.
- NOTIFICATIONS (critical): If the user confirmed they want reminders, set notificationEnabled to true and notificationTime to the reminder time in HH:MM 24-hour format. If the reminder time is the same as the scheduled time, set notificationTime = scheduledTime. If the user said no to reminders, set notificationEnabled to false but still set scheduledTime.
- PROJECTS: Only include projects if the goal has distinct sequential phases (getting a license, starting a business, building something) AND the user explicitly agreed to phases during the conversation. For all other goals (fitness, sales, nutrition, habits, savings, reading) set projects to []`;

  const data = await callEdgeFn({
    messages: [...messages, { role: 'user', content: buildPrompt }],
    mode: 'generate',
  });

  if (data.error) throw new Error(data.error);

  const rawText = (data.text ?? '').trim();
  console.log('[GoalGen] Raw Claude response:', rawText);

  // Aggressively strip all code fence variants before parsing
  const clean = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .replace(/^`+/, '')
    .replace(/`+$/, '')
    .trim();

  try {
    return JSON.parse(clean);
  } catch (e) {
    console.error('[GoalGen] JSON parse failed. Raw response was:', rawText);
    throw new Error(`Goal JSON parse failed — raw response: "${rawText.slice(0, 300)}"`);
  }
}
