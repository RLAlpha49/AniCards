import HeaderClient from "@/components/HeaderClient";

export default function Header() {
  return (
    <header className="
      sticky top-0 z-50 border-b border-gold/30 bg-white/90 backdrop-blur-xl
      dark:bg-[#0C0A10]
    ">
      <div className="
        absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-transparent via-gold to-transparent
      " />
      <HeaderClient />
    </header>
  );
}
