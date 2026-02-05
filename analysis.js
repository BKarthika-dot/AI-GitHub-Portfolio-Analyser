/*Deterministic Analysis Layer

Before any AI model is used, repository data is:
- Parsed and normalized in JavaScript
- README files are detected case-insensitively
- Key project ideas are extracted deterministically
- Structured summaries are generated

This reduces AI hallucinations and ensures feedback is grounded in real repository data.*/


const repoDetails = [];
const languages = {};
let recentRepos = 0;
const cutoffDate = new Date("2025-10-01");
const githubUsername = items[0]?.json?.owner?.login || "Unknown";

// Helper: detect README file (case-insensitive) and extract first few lines as main idea
function extractReadmeMainIdea(repo) {
    if (!repo.files) return { readme: "No README content", mainIdea: "No main idea available" };
    const readmeFile = Object.keys(repo.files).find(f => f.toLowerCase() === "readme.md");
    if (!readmeFile) return { readme: "No README content", mainIdea: "No main idea available" };
    const content = repo.files[readmeFile].content || "";
    const lines = content.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    const mainIdea = lines.slice(0, 3).join(" ");
    return { readme: content, mainIdea: mainIdea || "README exists but no main idea detected" };
}

// ================================
// Process each repo
// ================================
const deterministicReview = [];

for (const item of items) {
    const repo = item.json;

    // Track languages
    if (repo.language) {
        languages[repo.language] = (languages[repo.language] || 0) + 1;
    }

    // Track recent activity
    const updatedAt = new Date(repo.updated_at);
    if (updatedAt > cutoffDate) recentRepos++;

    // Extract README content and main idea
    const { readme, mainIdea } = extractReadmeMainIdea(repo);

    // Determine strengths and weaknesses for this repo
    const strengths = [];
    const weaknesses = [];

    if (repo.language && repo.language !== "Unknown") strengths.push(`Uses ${repo.language}`);
    if (repo.description && repo.description !== "No description provided") strengths.push(`Has description: "${repo.description}"`);
    if (readme && readme !== "No README content") strengths.push(`Has README`);
    if (mainIdea && mainIdea !== "No main idea available") strengths.push(`Main idea: ${mainIdea}`);

    if (!repo.description || repo.description === "No description provided") weaknesses.push("Missing description");
    if (!readme || readme === "No README content") weaknesses.push("Missing README");

    // Add repo-level review
    deterministicReview.push({
        name: repo.name,
        description: repo.description || "No description provided",
        language: repo.language || "Unknown",
        mainIdea,
        strengths,
        weaknesses,
        html_url: repo.html_url || "No URL",
        updated_at: repo.updated_at || "Unknown",
        topics: repo.topics || []
    });

    // Also store for RAG
    repoDetails.push({
        name: repo.name,
        description: repo.description || "No description provided",
        language: repo.language || "Unknown",
        html_url: repo.html_url || "No URL",
        updated_at: repo.updated_at || "Unknown",
        topics: repo.topics || [],
        readme,
        mainIdea
    });
}

// ================================
// Evaluate profile strength
// ================================
let profileStrength = "Weak";
if (items.length >= 10 && recentRepos >= 3) profileStrength = "Good";
if (items.length >= 20 && Object.keys(languages).length >= 3) profileStrength = "Strong";

// ================================
// RAG-style stringified repo details
// ================================
const repoDetailsText = repoDetails
    .map(repo => `
Repo Name: ${repo.name}
Description: ${repo.description}
Language: ${repo.language}
URL: ${repo.html_url}
Updated At: ${repo.updated_at}
Topics: ${(repo.topics && repo.topics.length > 0) ? repo.topics.join(", ") : "None"}
README Main Idea: ${repo.mainIdea}
`)
    .join("\n\n");

// ================================
// Final output for n8n
// ================================
return {
    github_username: githubUsername,
    totalRepos: items.length,
    recentRepos,
    languages,
    profileStrength,
    deterministicReview,  // repo-level objects including mainIdea
    repoDetailsText       // flattened string for AI
};
