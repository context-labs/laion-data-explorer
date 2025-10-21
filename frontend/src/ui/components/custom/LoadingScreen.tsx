import { Centered } from "~/ui/components/custom/Centered";
import { ScaleLoader } from "~/ui/components/ui/ScaleLoader";

export function LoadingScreen() {
  return (
    <Centered className="absolute left-0 top-0 h-full w-full bg-background">
      <ScaleLoader />
    </Centered>
  );
}
