import {
  Button,
  CodeBlock,
  Col,
  Separator,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/ui";
import { useTheme } from "~/ui/providers/ThemeProvider";
import { GithubIcon } from "lucide-react";
import BenchmarksDarkImage from "../assets/benchmark-dark-theme.webp";
import BenchmarksLightImage from "../assets/benchmark-light-theme.webp";
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
  onEmailCTAClick: () => void;
}

export function LearnMoreSheet({
  open,
  onClose,
  onEmailCTAClick,
}: LearnMoreSheetProps) {
  const { isDarkTheme } = useTheme();

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-5xl h-full flex flex-col"
        side="right"
      >
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>About This Project</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto pb-6">
          <Col className="gap-2 mt-6">
            <LearnMoreLinks />
            <p className="text-base text-muted-foreground">
              We fine-tuned a 14B Qwen model to specialize in the task of
              extracting structured summaries from scientific papers. We
              carefully benchmarked this model across a variety of closed source
              models.
            </p>
            <p className="text-base text-muted-foreground">
              We evaluated the model's performance on 1,000 samples withheld
              from the training set using an LLM-as-a-Judge methodology, on a
              qualitative 5-point rubric.
            </p>
            <h2 className="mt-6">Model Benchmarks</h2>
            <img
              src={isDarkTheme ? BenchmarksDarkImage : BenchmarksLightImage}
              alt="Model Benchmarks"
              className="w-full my-4 rounded-lg border"
            />
            <h2 className="mt-6">Structured Extraction Schema</h2>
            <p className="text-base text-muted-foreground">
              The fine-tuned model extracts structured summaries from papers
              following this TypeScript schema:
            </p>
            <CodeBlock
              language="typescript"
              code={SCHEMA_CODE}
              obfuscatedCode={SCHEMA_CODE}
              copyButton={<></>}
              className="mt-2"
              customStyle={{ fontSize: "1rem" }}
            />
          </Col>
          <Col className="gap-2 mt-12">
            <h2>Dataset Exploration</h2>
            <b>Embeddings</b>
            <p className="text-base text-muted-foreground">
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
            <p className="text-base text-muted-foreground">
              The visualization uses UMAP (Uniform Manifold Approximation and
              Projection) to reduce the 768D embeddings to 3D coordinates,
              preserving local and global structure. K-Means clustering groups
              papers into ~100 clusters based on semantic similarity in the
              embedding space. Cluster labels are automatically generated using
              TF-IDF analysis of paper fields and key takeaways, identifying the
              most distinctive terms for each cluster.
            </p>
          </Col>
          <Separator className="my-8" />
          <div className="mt-8 flex justify-start gap-3">
            <Button
              variant="default"
              onClick={() => {
                onEmailCTAClick();
                onClose();
              }}
              className="w-full sm:w-auto"
            >
              Interested in the full dataset?
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                window.open(
                  "https://github.com/context-labs/laion-data-explorer",
                  "_blank",
                  "noopener,noreferrer",
                )
              }
              className="w-full sm:w-auto"
            >
              <GithubIcon className="mr-2 h-4 w-4" />
              GitHub
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
