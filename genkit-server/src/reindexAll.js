import "dotenv/config";
import { supabaseAdmin } from "./supabaseAdmin.js";
import { embedPaperFlow } from "./flows/embedPaper.js";

/** Run with: npm run reindex
 *  Embeds every paper that doesn't have an embedding yet (e.g. papers
 *  submitted before semantic search was added, or after a bulk import). */
async function main() {
  const { data: papers, error } = await supabaseAdmin
    .from("research_papers")
    .select("id, title")
    .is("embedding", null);

  if (error) {
    console.error("Failed to load papers:", error.message);
    process.exit(1);
  }

  if (!papers.length) {
    console.log("Nothing to reindex — every paper already has an embedding.");
    return;
  }

  console.log(`Reindexing ${papers.length} paper(s)...`);

  let done = 0;
  for (const paper of papers) {
    try {
      await embedPaperFlow({ paperId: paper.id });
      done += 1;
      console.log(`  [${done}/${papers.length}] embedded: ${paper.title}`);
    } catch (err) {
      console.error(`  failed to embed "${paper.title}" (${paper.id}):`, err.message);
    }
  }

  console.log(`Done. Embedded ${done}/${papers.length} paper(s).`);
}

main();
