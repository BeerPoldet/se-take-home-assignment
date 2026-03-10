import { Order } from './Order';

export enum BotState {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING'
}

export class Bot {
  id: number;
  state: BotState;
  currentOrder?: Order;
  processingTimeout?: NodeJS.Timeout;

  constructor(id: number) {
    this.id = id;
    this.state = BotState.IDLE;
  }

  assignOrder(order: Order): void {
    this.currentOrder = order;
    this.state = BotState.PROCESSING;
  }

  completeOrder(): void {
    this.currentOrder = undefined;
    this.state = BotState.IDLE;
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
      this.processingTimeout = undefined;
    }
  }

  cancelProcessing(): Order | undefined {
    const order = this.currentOrder;
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
      this.processingTimeout = undefined;
    }
    this.currentOrder = undefined;
    this.state = BotState.IDLE;
    return order;
  }
}
