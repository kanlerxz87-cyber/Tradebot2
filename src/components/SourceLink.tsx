import { ExternalLink } from 'lucide-react';

interface SourceLinkProps {
  href: string;
  label?: string;
  className?: string;
}

export function SourceLink({ href, label = 'Official source', className = '' }: SourceLinkProps) {
  return (
    <a
      className={`source-link ${className}`.trim()}
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => event.stopPropagation()}
    >
      {label}
      <ExternalLink aria-hidden="true" size={12} strokeWidth={2} />
    </a>
  );
}
