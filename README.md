# Spark

An AI learning companion for students aged 11–13, built for the ForgeX AI Hackathon at Mesa School of Business.

- **Study notebooks:** a chat that asks what you tried, gives hints, asks you to explain, then shows the full answer. Upload notes (PDF, photo or text) and Spark teaches them step by step. A Progress tab tracks concepts as solid, learning or shaky.
- **My Thoughts:** private pages. Spark only joins a page when you switch "Talk with Spark" on, and each page keeps its own conversation.
- **Voice buddy:** talk to Spark out loud and it answers in a friendly Gemini voice.
- Black or white theme, switched with the bulb.

## Run locally

```bash
python3 -m http.server 5173
```

Open http://localhost:5173 and paste a Gemini API key in Settings.

## Deploy on Vercel

1. Import this repository in Vercel. No build settings are needed.
2. In **Settings → Environment Variables**, add `GEMINI_API_KEY` with your key from Google AI Studio.
3. Redeploy. The site then uses the server key through `/api/gemini`, and visitors don't need their own key.

Notebooks, pages and memories are saved in each visitor's browser.
