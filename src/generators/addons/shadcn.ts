import type { ProjectConfig } from "../../types.js";
import { writeFile, writeJsonFile, projectPath } from "../../utils/fs.js";

// components.json — shadcn/ui reads this to know where to write components
const componentsJson = (projectName: string) => ({
  $schema: "https://ui.shadcn.com/schema.json",
  style: "default",
  rsc: false,
  tsx: true,
  tailwind: {
    config: "",
    css: "packages/shared/src/styles/global.css",
    baseColor: "neutral",
    cssVariables: true,
    prefix: "",
  },
  iconLibrary: "lucide",
  aliases: {
    // shadcn writes components to packages/ui/src/components/
    components: `@${projectName}/ui/components`,
    utils: `@${projectName}/shared/utils`,
    ui: `@${projectName}/ui/components`,
    lib: `@${projectName}/shared`,
    hooks: `@${projectName}/shared/hooks`,
  },
});

// Starter Button — demonstrates the shadcn pattern.
// Run `npx shadcn add <component>` to add more.
const buttonTsx = (projectName: string) =>
  `import { cn } from "@${projectName}/shared/utils";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
`;

export async function generateShadcn(
  root: string,
  config: ProjectConfig,
): Promise<void> {
  if (config.framework !== "react") return;

  const pp = (...s: string[]) => projectPath(root, ...s);

  await writeJsonFile(pp("components.json"), componentsJson(config.projectName));
  await writeFile(
    pp("packages", "ui", "src", "components", "button.tsx"),
    buttonTsx(config.projectName),
  );
}
