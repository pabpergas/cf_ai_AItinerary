import { cn } from "@/lib/utils";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  as?: React.ElementType;
  children?: React.ReactNode;
  className?: string;
  href?: string;
  loading?: boolean;
  shape?: "base" | "square" | "circular";
  size?: "sm" | "md" | "lg" | "base";
  variant?: "primary" | "secondary" | "ghost" | "destructive" | "outline";
};

export const Button = ({
  as: Component = "button",
  children,
  className,
  disabled,
  href,
  loading,
  shape = "base",
  size = "base",
  variant = "secondary",
  ...props
}: ButtonProps) => {
  const baseClasses = "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  
  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-500 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700",
    ghost: "text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-500 dark:text-gray-300 dark:hover:bg-gray-800",
    destructive: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500",
    outline: "border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50 focus-visible:ring-gray-500 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
  };

  const sizeClasses = {
    sm: "h-8 px-3 text-sm rounded-md",
    md: "h-9 px-4 text-sm rounded-md",
    base: "h-10 px-4 text-base rounded-md",
    lg: "h-11 px-8 text-base rounded-md"
  };

  const shapeClasses = {
    base: "",
    square: "aspect-square p-0",
    circular: "rounded-full aspect-square p-0"
  };

  if (href) {
    return (
      <a
        href={href}
        className={cn(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          shapeClasses[shape],
          className
        )}
        {...(props as any)}
      >
        {loading ? (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
        ) : (
          children
        )}
      </a>
    );
  }

  return (
    <Component
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        shapeClasses[shape],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
      ) : (
        children
      )}
    </Component>
  );
};