export default function SQLToTextPrep(req,res,next){
    if(!req.body.prompt || !req.body.sqlquery || !req.body.queryoutput){
        return res.status(404).json({message:"The required data is missing!"});
    }
    const {prompt,sqlquery,queryoutput}=req.body;
    req.promptMiddleware={
        enhancedPrompt:`
            You are a database results assistant.

            Original user question:
            ${prompt}

            Executed SQL:
            ${sqlquery}

            Database results:
            ${queryoutput}

            Instructions:
            1. Answer the user's original question directly.
            2. Use ONLY the supplied database results.
            3. Never invent records, duplicates, trends, or statistics.
            4. Do not provide recommendations unless explicitly requested.
            5. Keep the answer concise.
            6. If the results are empty, clearly state that no matching records were found.
            7. Do not include the SQL query or raw JSON unless requested.
            `
    };
    next();
}