import { ThemeToggle } from "@/components/theme-toggle";

export function TopBar() {
  return (
    <header className="flex h-14 sm:h-16 items-center justify-end border-b border-[#e2e8f0] bg-white px-4 sm:px-6 dark:border-[#252a35] dark:bg-[#141720]">
      <ThemeToggle />
    </header>
  );
}
