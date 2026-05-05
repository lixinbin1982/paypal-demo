import Link from "next/link";

const Nav = () => {
  return (
    <nav className="w-full px-6 py-4 flex items-center justify-between border-b border-[var(--border)] bg-white">
      <Link
        href="/"
        className="text-sm font-semibold tracking-tight text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
      >
        <span className="text-[var(--accent)]">✦</span> Luxe
      </Link>
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="text-xs text-[var(--foreground-secondary)] hover:text-[var(--accent)] transition-colors"
        >
          Shop
        </Link>
        <span className="text-[10px] text-[var(--accent)] font-medium tracking-wide">
          Free shipping over $50
        </span>
      </div>
    </nav>
  );
};

export default Nav;
