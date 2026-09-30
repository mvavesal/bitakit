import { cn } from "cn"

import ChevronLeft from "reicon-react/icons/ChevronLeft"
import ChevronRight from "reicon-react/icons/ChevronRight"
import ChevronDown from "reicon-react/icons/ChevronDown"
import Loader from "reicon-react/icons/Loader"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
