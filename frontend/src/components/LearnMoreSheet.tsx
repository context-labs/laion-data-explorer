import {
  Col,
  Separator,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/ui";
import { LearnMoreContent } from "./LearnMoreContent";

interface LearnMoreSheetProps {
  open: boolean;
  onClose: () => void;
}

export function LearnMoreSheet({ open, onClose }: LearnMoreSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl" side="right">
        <SheetHeader>
          <SheetTitle>About This Dataset</SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          <LearnMoreContent />
        </div>
        <Separator className="my-4" />
        <Col className="gap-2">
          <h2>Model Info</h2>
          <p className="text-sm text-muted-foreground">
            Inference.net fine-tuned a 14B Qwen model to specialize in the task
            of extracting structured summaries from scientific papers. We
            carefully benchmarked this model across a variety of closed source
            models.
          </p>
          <h2 className="mt-4">Model Benchmarks</h2>
        </Col>
      </SheetContent>
    </Sheet>
  );
}
