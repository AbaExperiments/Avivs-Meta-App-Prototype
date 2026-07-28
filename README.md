# Avivs-Meta-App-Prototype — Muse Spark 1.1 Lab Harness

A clean, generic lab harness for building with **Muse Spark 1.1** in **OpenCode**.

## Prerequisites

- Node.js 20+
- [OpenCode Desktop](https://opencode.ai) (or `opencode` CLI)
- A Meta API key with access to `meta/muse-spark-1.1`

## Setup

1. Clone this repo:

   ```bash
   git clone git@github.com-abaexperiments:AbaExperiments/Avivs-Meta-App-Prototype.git
   cd Avivs-Meta-App-Prototype
   ```

2. Set your API key (required):

   ```bash
   export META_API_KEY="your-meta-api-key"
   # or add to .env (ignored by git)
   echo "META_API_KEY=your-key" > .env
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

## Running with OpenCode Desktop + Muse Spark

This repo includes `opencode.json` pre-configured with the Meta provider:

```json
{
  "provider": {
    "meta": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Meta Model API",
      "options": {
        "baseURL": "https://api.meta.ai/v1",
        "headers": { "Authorization": "Bearer ${env:META_API_KEY}" }
      },
      "models": {
        "meta/muse-spark-1.1": {
          "name": "Muse Spark 1.1",
          "limit": { "context": 1048576, "output": 131072 }
        }
      }
    }
  }
}
```

**To run:**

1. Open this folder in **OpenCode Desktop**
2. Ensure `META_API_KEY` is set in your environment (OpenCode will read `${env:META_API_KEY}`)
3. Select model `meta/muse-spark-1.1` — OpenCode will auto-install `@ai-sdk/openai-compatible` via the `npm` field
4. Start prompting — you're in a Spark lab with full file/edit/build/test/git access

> Required env: `META_API_KEY` — get it from https://developers.meta.ai

## Scripts

| Command            | Description                    |
| ------------------ | ------------------------------ |
| `npm run dev`      | Run `src/index.ts` with tsx    |
| `npm run build`    | Type-check and emit to `dist/` |
| `npm run test`     | Run vitest                     |
| `npm run lint`     | eslint + prettier check        |
| `npm run lint:fix` | Auto-fix lint + format         |

## Structure

```
.
├── opencode.json       # Meta provider + Spark 1.1 model (1M context)
├── src/
│   ├── index.ts        # Entry: console.log("Muse Spark 1.1 lab ready")
│   ├── index.test.ts   # Basic vitest harness check
│   └── examples/
│       ├── hello.ts    # Placeholder
│       └── game.ts     # Placeholder
├── AGENTS.md           # Instructions for Spark agent
└── README.md
```

## Lab Rules (see AGENTS.md)

- Create/edit files in `src/` and `src/examples/`
- `npm run build` to type-check, `npm run test` to verify
- `npm run dev` for quick iteration
- Git is available — commit as you experiment

## Notes

- Remote: `git@github.com-abaexperiments:AbaExperiments/Avivs-Meta-App-Prototype.git` (origin main)
- `.opencode/`, `.env`, `node_modules/`, `dist/` are gitignored
- TypeScript strict mode enabled
