import dayjs from 'dayjs';

export interface CalendarEntry {
  title: string;
  start: string;
  end: string;
  description?: string;
}

export function buildLoanCalendar(schedule: Array<{ dueDate: string; payment: number; installmentNumber: number }>) {
  const entries: CalendarEntry[] = schedule.map((item) => ({
    title: `Prestação #${item.installmentNumber}`,
    start: item.dueDate,
    end: dayjs(item.dueDate).add(30, 'minute').format('YYYY-MM-DDTHH:mm:ss'),
    description: `Valor previsto: ${item.payment}`
  }));

  return { count: entries.length, entries };
}
