export type NotificationEventType =
  | "new_listing_nearby"
  | "driver_interested"
  | "sender_approved"
  | "delivery_picked_up"
  | "delivery_delivered"
  | "payment_confirmed"
  | "delivery_cancelled"
  | "new_chat_message"
  | "driver_selected"
  | "driver_confirmed"
  | "driver_declined"
  | "selection_cancelled"
  | "selection_timeout";

export interface NotificationTemplate {
  event: NotificationEventType;
  titleHe: string;
  titleEn: string;
  bodyHe: string;
  bodyEn: string;
  /** Which role receives this notification */
  recipient: "sender" | "driver" | "both";
  /** Data payload keys to include */
  dataKeys: string[];
}

export const NOTIFICATION_TEMPLATES: Record<NotificationEventType, NotificationTemplate> = {
  new_listing_nearby: {
    event: "new_listing_nearby",
    titleHe: "\u05DE\u05E9\u05DC\u05D5\u05D7 \u05D7\u05D3\u05E9 \u05D1\u05D0\u05D6\u05D5\u05E8\u05DA",
    titleEn: "New Delivery Nearby",
    bodyHe: "\u05DE\u05E9\u05DC\u05D5\u05D7 \u05D7\u05D3\u05E9 \u05DE-{{pickupCity}} \u05DC-{{destinationCity}} \u05D6\u05DE\u05D9\u05DF \u05DC\u05DA",
    bodyEn: "New delivery from {{pickupCity}} to {{destinationCity}} is available",
    recipient: "driver",
    dataKeys: ["deliveryId", "pickupCity", "destinationCity", "price"],
  },
  driver_interested: {
    event: "driver_interested",
    titleHe: "\u05E0\u05D4\u05D2 \u05DE\u05E2\u05D5\u05E0\u05D9\u05D9\u05DF",
    titleEn: "Driver Interested",
    bodyHe: "{{driverName}} ⭐{{driverRating}} 📦{{driverDeliveries}} רוצה לאסוף את המשלוח שלך",
    bodyEn: "{{driverName}} ⭐{{driverRating}} 📦{{driverDeliveries}} wants to pick up your delivery",
    recipient: "sender",
    dataKeys: ["deliveryId", "driverName", "driverId", "driverRating", "driverDeliveries", "driverPhoto"],
  },
  sender_approved: {
    event: "sender_approved",
    titleHe: "\u05D0\u05D5\u05E9\u05E8\u05EA \u05DC\u05DE\u05E9\u05DC\u05D5\u05D7!",
    titleEn: "Delivery Approved!",
    bodyHe: "\u05D4\u05E9\u05D5\u05DC\u05D7 \u05D0\u05D9\u05E9\u05E8 \u05D0\u05D5\u05EA\u05DA \u05DC\u05DE\u05E9\u05DC\u05D5\u05D7 \u05DE-{{pickupCity}}",
    bodyEn: "You have been approved for the delivery from {{pickupCity}}",
    recipient: "driver",
    dataKeys: ["deliveryId", "pickupCity", "destinationCity"],
  },
  delivery_picked_up: {
    event: "delivery_picked_up",
    titleHe: "\u05D4\u05DE\u05E9\u05DC\u05D5\u05D7 \u05E0\u05D0\u05E1\u05E3",
    titleEn: "Delivery Picked Up",
    bodyHe: "\u05D4\u05E0\u05D4\u05D2 \u05D0\u05E1\u05E3 \u05D0\u05EA \u05D4\u05DE\u05E9\u05DC\u05D5\u05D7 \u05E9\u05DC\u05DA",
    bodyEn: "Your delivery has been picked up by the driver",
    recipient: "sender",
    dataKeys: ["deliveryId", "driverName"],
  },
  delivery_delivered: {
    event: "delivery_delivered",
    titleHe: "\u05D4\u05DE\u05E9\u05DC\u05D5\u05D7 \u05E0\u05DE\u05E1\u05E8!",
    titleEn: "Delivery Completed!",
    bodyHe: "\u05D4\u05DE\u05E9\u05DC\u05D5\u05D7 \u05E9\u05DC\u05DA \u05D4\u05D2\u05D9\u05E2 \u05DC\u05D9\u05E2\u05D3\u05D5",
    bodyEn: "Your delivery has arrived at its destination",
    recipient: "sender",
    dataKeys: ["deliveryId"],
  },
  payment_confirmed: {
    event: "payment_confirmed",
    titleHe: "\u05EA\u05E9\u05DC\u05D5\u05DD \u05D0\u05D5\u05E9\u05E8",
    titleEn: "Payment Confirmed",
    bodyHe: "\u05D4\u05EA\u05E9\u05DC\u05D5\u05DD \u05E2\u05D1\u05D5\u05E8 \u05D4\u05DE\u05E9\u05DC\u05D5\u05D7 \u05D0\u05D5\u05E9\u05E8",
    bodyEn: "Payment for the delivery has been confirmed",
    recipient: "both",
    dataKeys: ["deliveryId", "price"],
  },
  delivery_cancelled: {
    event: "delivery_cancelled",
    titleHe: "\u05DE\u05E9\u05DC\u05D5\u05D7 \u05D1\u05D5\u05D8\u05DC",
    titleEn: "Delivery Cancelled",
    bodyHe: "\u05D4\u05DE\u05E9\u05DC\u05D5\u05D7 \u05D1\u05D5\u05D8\u05DC \u05E2\u05DC \u05D9\u05D3\u05D9 {{cancelledBy}}",
    bodyEn: "The delivery has been cancelled by {{cancelledBy}}",
    recipient: "both",
    dataKeys: ["deliveryId", "cancelledBy"],
  },
  new_chat_message: {
    event: "new_chat_message",
    titleHe: "\u05D4\u05D5\u05D3\u05E2\u05D4 \u05D7\u05D3\u05E9\u05D4",
    titleEn: "New Message",
    bodyHe: "{{senderName}}: {{messagePreview}}",
    bodyEn: "{{senderName}}: {{messagePreview}}",
    recipient: "both",
    dataKeys: ["deliveryId", "chatRoomId", "senderName", "messagePreview"],
  },
  driver_selected: {
    event: "driver_selected",
    titleHe: "השולח בחר בך!",
    titleEn: "You Were Selected!",
    bodyHe: "אשר את המשלוח תוך 15 דקות",
    bodyEn: "Confirm the delivery within 15 minutes",
    recipient: "driver",
    dataKeys: ["deliveryId", "pickupCity", "destinationCity", "price"],
  },
  driver_confirmed: {
    event: "driver_confirmed",
    titleHe: "הנהג אישר!",
    titleEn: "Driver Confirmed!",
    bodyHe: "המשלוח שויך ל-{{driverName}}",
    bodyEn: "The delivery has been assigned to {{driverName}}",
    recipient: "sender",
    dataKeys: ["deliveryId", "driverName", "driverId"],
  },
  driver_declined: {
    event: "driver_declined",
    titleHe: "הנהג דחה",
    titleEn: "Driver Declined",
    bodyHe: "בחר נהג אחר מהרשימה",
    bodyEn: "Please select another driver from the list",
    recipient: "sender",
    dataKeys: ["deliveryId", "driverName"],
  },
  selection_cancelled: {
    event: "selection_cancelled",
    titleHe: "השולח ביטל את הבחירה",
    titleEn: "Selection Cancelled",
    bodyHe: "המשלוח הוחזר לרשימה",
    bodyEn: "The delivery has been returned to the listing",
    recipient: "driver",
    dataKeys: ["deliveryId"],
  },
  selection_timeout: {
    event: "selection_timeout",
    titleHe: "הנהג לא הגיב בזמן",
    titleEn: "Driver Did Not Respond",
    bodyHe: "בחר נהג אחר מהרשימה",
    bodyEn: "Please select another driver from the list",
    recipient: "sender",
    dataKeys: ["deliveryId", "driverName"],
  },
};

/**
 * Interpolate template placeholders with actual values.
 */
export function interpolateTemplate(
  template: string,
  values: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return values[key] ?? `{{${key}}}`;
  });
}
