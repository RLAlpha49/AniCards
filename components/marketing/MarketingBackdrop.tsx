interface MarketingBackdropProps {
  lightOpacity?: number;
  darkOpacity?: number;
}

export function MarketingBackdrop({
  lightOpacity = 0.5,
  darkOpacity = 0.3,
}: Readonly<MarketingBackdropProps>) {
  return (
    <>
      <div
        className="
          pointer-events-none absolute inset-0 opacity-30
          motion-safe:animate-in motion-safe:duration-1000 motion-safe:fade-in-0
          dark:hidden
        "
        style={{
          opacity: lightOpacity,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30Z' fill='none' stroke='%23a67c1a2e' stroke-width='1'/%3E%3C/svg%3E")`,
        }}
      />
      <div
        className="
          pointer-events-none absolute inset-0 hidden opacity-20
          motion-safe:animate-in motion-safe:duration-1000 motion-safe:fade-in-0
          dark:block
        "
        style={{
          opacity: darkOpacity,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30Z' fill='none' stroke='%23c9a84c15' stroke-width='1'/%3E%3C/svg%3E")`,
        }}
      />
    </>
  );
}
