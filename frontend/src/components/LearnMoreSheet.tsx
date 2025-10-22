import {
  CodeBlock,
  Col,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/ui";
import BenchmarksImage from "../assets/benchmarks.png";
import { LearnMoreLinks } from "./LearnMoreContent";

const SCHEMA_CODE = `interface ScientificSummary {
  title: string;
  authors: string;
  publication_year: number | null;
  field_subfield: string;
  type_of_paper: string;
  executive_summary: string;
  research_context: string;
  key_results: string;
  three_takeaways: string;
  claims?: {
    details: string;
    supporting_evidence: string;
    contradicting_evidence: string;
    implications: string;
  }[];
}

interface SummarizationData {
  article_classification:
    | "SCIENTIFIC_TEXT"
    | "PARTIAL_SCIENTIFIC_TEXT"
    | "NON_SCIENTIFIC_TEXT";
  summary: ScientificSummary | null;
}`;

interface LearnMoreSheetProps {
  open: boolean;
  onClose: () => void;
}

export function LearnMoreSheet({ open, onClose }: LearnMoreSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-3xl h-full flex flex-col"
        side="right"
      >
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>About This Project</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto pb-6">
          <Col className="gap-2 mt-6">
            <LearnMoreLinks />
            <p className="text-sm text-muted-foreground">
              We fine-tuned a 14B Qwen model to specialize in the task of
              extracting structured summaries from scientific papers. We
              carefully benchmarked this model across a variety of closed source
              models.
            </p>
            <p className="text-sm text-muted-foreground">
              We evaluated the model's performance on 1,000 samples withheld
              from the training set using an LLM-as-a-Judge methodology, on a
              qualitative 5-point rubric.
            </p>
            <h2 className="mt-6">Model Benchmarks</h2>
            <img
              src={BenchmarksImage}
              alt="Model Benchmarks"
              className="w-full my-4 rounded-lg border"
            />
            <h2 className="mt-6">Structured Extraction Schema</h2>
            <p className="text-sm text-muted-foreground">
              The fine-tuned model extracts structured summaries from papers
              following this TypeScript schema:
            </p>
            <CodeBlock
              language="typescript"
              code={SCHEMA_CODE}
              obfuscatedCode={SCHEMA_CODE}
              copyButton={<></>}
              className="mt-2"
              customStyle={{ fontSize: "0.7rem" }}
            />
          </Col>
          <Col className="gap-2 mt-12">
            <h2>Dataset Exploration</h2>
            <b>Embeddings</b>
            <p className="text-sm text-muted-foreground">
              Paper embeddings were generated using{" "}
              <a
                href="https://huggingface.co/allenai/specter2_base"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                SPECTER2
              </a>
              , a transformer model from AllenAI specifically designed for
              scientific documents. The model processes each paper's title,
              executive summary, and research context to generate
              768-dimensional embeddings optimized for semantic search over
              scientific literature.
            </p>
            <b>Cluster Algorithm</b>
            <p className="text-sm text-muted-foreground">
              The visualization uses UMAP (Uniform Manifold Approximation and
              Projection) to reduce the 768D embeddings to 3D coordinates,
              preserving local and global structure. K-Means clustering groups
              papers into ~100 clusters based on semantic similarity in the
              embedding space. Cluster labels are automatically generated using
              TF-IDF analysis of paper fields and key takeaways, identifying the
              most distinctive terms for each cluster.
            </p>
          </Col>
        </div>
      </SheetContent>
    </Sheet>
  );
}
