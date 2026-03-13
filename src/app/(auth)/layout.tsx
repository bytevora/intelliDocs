export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-primary via-primary/90 to-primary/70 p-12 text-primary-foreground">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">IntelliDocs</h1>
        </div>
        <div className="space-y-4">
          <blockquote className="text-xl font-medium leading-relaxed opacity-90">
            &ldquo;Turn your words into visuals. Collaborate in real time.
            Share ideas that stick.&rdquo;
          </blockquote>
          <p className="text-sm opacity-70">
            AI-powered document platform for teams
          </p>
        </div>
        <div className="flex gap-6 text-sm opacity-60">
          <span>Text-to-Visuals</span>
          <span>Real-time Collaboration</span>
          <span>Smart Sharing</span>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[400px]">{children}</div>
      </div>
    </div>
  );
}
