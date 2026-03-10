export enum OrderType {
  NORMAL = 'NORMAL',
  VIP = 'VIP'
}

export enum OrderState {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETE = 'COMPLETE'
}

export class Order {
  id: number;
  type: OrderType;
  state: OrderState;
  createdAt: Date;
  processingStartedAt?: Date;
  completedAt?: Date;
  assignedBotId?: number;

  constructor(id: number, type: OrderType) {
    this.id = id;
    this.type = type;
    this.state = OrderState.PENDING;
    this.createdAt = new Date();
  }

  startProcessing(botId: number): void {
    this.state = OrderState.PROCESSING;
    this.assignedBotId = botId;
    this.processingStartedAt = new Date();
  }

  complete(): void {
    this.state = OrderState.COMPLETE;
    this.completedAt = new Date();
  }

  resetToPending(): void {
    this.state = OrderState.PENDING;
    this.assignedBotId = undefined;
    this.processingStartedAt = undefined;
  }
}
