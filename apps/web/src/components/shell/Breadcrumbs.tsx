import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

/** Accessible breadcrumb trail — <nav aria-label> + ordered list, current page marked aria-current. */
export function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Navigasi remah roti" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1 font-sans text-sm text-on-surface-variant">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {index > 0 ? (
                <span aria-hidden="true" className="text-on-surface-variant">
                  /
                </span>
              ) : null}
              {item.href && !isLast ? (
                <Link href={item.href} className="hover:text-on-surface hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined} className={isLast ? "font-medium text-on-surface" : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
