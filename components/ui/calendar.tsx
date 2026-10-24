"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { cn } from "cn"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-2xl select-none", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "space-y-3",
        month_caption: "flex justify-between pt-1 relative items-center px-1 font-semibold text-sm",
        caption_label: "text-sm font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight",
        nav: "flex items-center gap-1",
        button_previous: "h-7 w-7 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 p-0 rounded-full flex items-center justify-center transition-all active:scale-95",
        button_next: "h-7 w-7 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 p-0 rounded-full flex items-center justify-center transition-all active:scale-95",
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex justify-between",
        weekday: "text-neutral-400 dark:text-neutral-500 rounded-md w-8 font-medium text-[0.75rem] text-center uppercase tracking-wider",
        week: "flex w-full mt-1.5 justify-between",
        day: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day_button: "h-8 w-8 p-0 font-medium rounded-full flex items-center justify-center text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer transition-colors active:scale-90",
        selected: "!bg-blue-600 !text-white font-semibold shadow-sm hover:!bg-blue-500",
        today: "border border-blue-600/40 font-bold text-blue-600 dark:text-blue-400",
        outside: "text-neutral-300 dark:text-neutral-600 opacity-40",
        disabled: "text-neutral-300 dark:text-neutral-700 opacity-30 cursor-not-allowed",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => orientation === "left" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
      }}
      {...props}
    />
  )
}

export { Calendar }
