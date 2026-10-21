
import db from "../config/readOnlyDB.js";

const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = "qwen2.5-coder:7b";

// Generate response using local Ollama model
async function generateAIResponse(prompt) {
    const response = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: MODEL,
            prompt,
            stream: false,
            options: {
                temperature: 0
            }
        }),
        signal: AbortSignal.timeout(120000)
    });

    if (!response.ok) {
        throw new Error(`Ollama failed: ${response.status}`);
    }

    const data = await response.json();
    return data.response;
}

// Used by both PromptToSQL and SQLToText
export async function SendPromptController(req, res) {
    try {
        const enhancedPrompt = req.promptMiddleware?.enhancedPrompt;

        if (!enhancedPrompt) {
            return res.status(400).json({
                message: "Enhanced prompt missing!"
            });
        }

        let responseText = await generateAIResponse(enhancedPrompt);

        // Remove Markdown code fences for SQL generation
        if (req.path === "/PromptToSQL") {
            responseText = responseText.trim()
                .replace(/^```(?:sql)?\s*/i, "")
                .replace(/\s*```$/, "")
                .trim();
        }

        return res.status(200).json({
            success: true,
            response: responseText
        });

    } catch (error) {
        console.error("Ollama Error:", error);

        return res.status(503).json({
            message: "Local AI generation failed!"
        });
    }
}

// Execute generated SQL using read-only database
export function RunQueryController(req, res) {
    const { query } = req.body;

    if (typeof query !== "string" || !query.trim()) {
        return res.status(400).json({
            message: "Invalid SQL query!"
        });
    }

    // Basic read-only check, NOT a complete SQL validator.
    // Also use a SELECT-only MySQL user, allowlisted views,
    // single-statement mode and database query timeouts.
    if (!/^\s*SELECT\b/i.test(query)) {
        return res.status(403).json({
            message: "Only SELECT queries are allowed!"
        });
    }

    db.query(query, (err, rows) => {
        if (err) {
            console.error("SQL Error:", err.message);

            return res.status(500).json({
                message: "Could not execute SQL query!"
            });
        }

        return res.status(200).json(rows);
    });
}

