
import { TokoCepatLogo } from "@/components/TokoCepatLogo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-muted/40 p-4">
      <div className="flex flex-col items-center gap-6 text-center">
        <TokoCepatLogo />
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>Welcome to TokoCepat</CardTitle>
                <CardDescription>Your fast and reliable point-of-sale solution.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">Use the navigation sidebar to get started.</p>
            </CardContent>
        </Card>
      </div>

      {/* do not remove */}
      <div className="block sm:hidden h-16 shrink-0"></div>
    </div>
  );
}
