import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type ExplorerBreadcrumbProps = {
  parts: string[];
  rootLabel: string;
  ariaLabel: string;
  onNavigate: (path: string) => void;
};

export default function ExplorerBreadcrumb({
  parts,
  rootLabel,
  ariaLabel,
  onNavigate,
}: ExplorerBreadcrumbProps) {
  return (
    <Breadcrumb aria-label={ariaLabel}>
      <BreadcrumbList>
        {parts.map((part, index) => {
          const path = parts.slice(1, index + 1).join("/");
          const label = index === 0 ? rootLabel : part;
          const isLast = index === parts.length - 1;
          return (
            <span key={`${part}-${index}`} className="contents">
              {index > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <button
                      type="button"
                      className="cursor-pointer bg-transparent p-0"
                      onClick={() => onNavigate(path)}
                    >
                      {label}
                    </button>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
