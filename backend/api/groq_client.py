import json
import urllib.request
import asyncio
import os

# Load .env manually if it exists
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
if os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            if "=" in line and not line.startswith("#"):
                k, v = line.strip().split("=", 1)
                os.environ[k] = v

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


def generate_commander_assessment_sync(prompt: str) -> dict:
    """Generate a structured JSON response using the Groq API synchronously."""
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    system_prompt = (
        "You are AEGIS, a Strategic Swarm Commander. "
        "You must respond ONLY with a valid JSON object matching this schema:\n"
        "{\n"
        '  "priority": "string (SEARCH | INVESTIGATE | TRACK_SURVIVOR | RELAY | RETURN)",\n'
        '  "recommended_action": "string (e.g. REALLOCATE, MAINTAIN)",\n'
        '  "recommended_drone_id": int or null,\n'
        '  "reason": "string (Why this drone/action was chosen)",\n'
        '  "trade_offs": { "why_not_others": "string (Why other candidates were rejected)" },\n'
        '  "confidence": float (0.0 to 1.0)\n'
        "}\n"
        "Do not include any other text or markdown formatting."
    )

    payload = {
        "model": "llama3-8b-8192",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
        "max_tokens": 300,
        "response_format": {"type": "json_object"},
    }

    try:
        req = urllib.request.Request(
            GROQ_API_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10.0) as response:
            result = json.loads(response.read().decode("utf-8"))
            content = result["choices"][0]["message"]["content"].strip()
            return json.loads(content)
    except Exception as e:
        print(f"[GROQ ERROR] {e}")
        return None


async def generate_commander_assessment(prompt: str) -> dict:
    """Run the synchronous urllib call in a thread pool to avoid blocking the asyncio loop."""
    return await asyncio.to_thread(generate_commander_assessment_sync, prompt)
