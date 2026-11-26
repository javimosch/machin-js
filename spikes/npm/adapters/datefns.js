import { addDays, format, differenceInCalendarDays, parseISO } from "npm:date-fns@4.1.0";
export const later = (iso, n) => format(addDays(parseISO(iso), n), "yyyy-MM-dd EEEE HH:mm");
export const between = (a, b) => differenceInCalendarDays(parseISO(b), parseISO(a));
