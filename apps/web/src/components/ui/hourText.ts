/** «07» — подпись часа под ячейкой `HourGrid` и в подписях графиков по часам. */
export const hourText = (hour: number): string => String(hour).padStart(2, '0')
