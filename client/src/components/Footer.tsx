export default function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="border-t bg-background">
      <div className="container py-6">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <img src="/rpm-logo.jpg" alt="RPM Technologies" className="h-8 w-auto" />
            <span className="text-sm text-muted-foreground">
              © {currentYear} RPM Technologies. All rights reserved.
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold">DRIVE IT FASTER</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
