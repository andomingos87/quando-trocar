import { siteConfig } from "@/lib/config";

// Endereço de feedback — ajuste aqui se o canal mudar.
const FEEDBACK_EMAIL =
  process.env.NEXT_PUBLIC_ADMIN_FEEDBACK_EMAIL ?? "anderson.domingos@aureatech.io";

function mailto(subject: string) {
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(
    `[${siteConfig.name}] ${subject}`,
  )}`;
}

export function SidebarFooter({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="border-t border-paper/10 px-2 py-3">
      <ul className="space-y-0.5">
        <li>
          <FooterLink href={mailto("Reportar bug no painel admin")} onClick={onNavigate}>
            <FooterIcon>
              <circle cx="12" cy="12" r="9" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </FooterIcon>
            Reportar bug
          </FooterLink>
        </li>
        <li>
          <FooterLink
            href={mailto("Sugerir melhoria no painel admin")}
            onClick={onNavigate}
          >
            <FooterIcon>
              <path d="M9 18h6" />
              <path d="M10 22h4" />
              <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2v.3h6v-.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z" />
            </FooterIcon>
            Sugerir melhoria
          </FooterLink>
        </li>
      </ul>
    </div>
  );
}

function FooterLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-paper/70 transition hover:bg-ink/40 hover:text-paper"
    >
      {children}
    </a>
  );
}

function FooterIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}
