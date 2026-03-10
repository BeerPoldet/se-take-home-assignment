export class Logger {
  private logs: string[] = [];

  log(message: string): void {
    const timestamp = this.formatTime(new Date());
    const logEntry = `[${timestamp}] ${message}`;
    this.logs.push(logEntry);
    console.log(logEntry);
  }

  private formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  getLogsAsString(): string {
    return this.logs.join('\n');
  }
}
