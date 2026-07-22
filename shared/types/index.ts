// Shared event and DTO contracts, added as labs need them.

/**
 * Lab 02 — the in-process domain event emitted after a checkout charges the
 * card and persists the order. Independent handlers (orders, notifications,
 * audit) react to it instead of running inline in the request. Keeping the
 * contract here — not inside the lab — signals it is a boundary between the
 * emitter and its subscribers, even though today they share one process.
 */
export const PAYMENT_COMPLETED = 'payment.completed';

export interface PaymentCompletedEvent {
  orderId: number;
  reference: string;
  customerEmail: string;
  amount: number;
  /** Provider reference for the successful charge (fake gateway in this lab). */
  providerRef: string;
  /** ISO-8601 timestamp of when the payment completed. */
  occurredAt: string;
}
