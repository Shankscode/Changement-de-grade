export const MINUTES = (n: number) => n * 60 * 1000;

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + MINUTES(minutes));
}

export function isExpired(date: Date): boolean {
  return date < new Date();
}
