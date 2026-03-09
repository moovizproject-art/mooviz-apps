/**
 * Dev-only: Trigger a mock "driver interested" push notification
 * for screenshot purposes.
 */
import notifee, {
  AndroidImportance,
  AndroidStyle,
  AndroidCategory,
} from '@notifee/react-native';

export async function triggerDriverInterestedNotification(): Promise<void> {
  const channelId = await notifee.createChannel({
    id: 'mooviz-delivery',
    name: 'משלוחים',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });

  await notifee.displayNotification({
    title: '🚛 נהג חדש מעוניין במשלוח שלך!',
    body: 'חמודי רוצה לאסוף את המשלוח מרחוב בן יהודה 45, תל אביב',
    subtitle: 'MOOVIZ',
    android: {
      channelId,
      smallIcon: 'ic_launcher',
      category: AndroidCategory.SOCIAL,
      importance: AndroidImportance.HIGH,
      style: {
        type: AndroidStyle.BIGTEXT,
        text: 'חמודי רוצה לאסוף את המשלוח מרחוב בן יהודה 45, תל אביב\n\n⭐ 4.8  •  📦 127 משלוחים  •  🚗 רכב\n💰 ₪45',
      },
      actions: [
        {
          title: '✓ אשר',
          pressAction: { id: 'approve' },
        },
        {
          title: '✗ דחה',
          pressAction: { id: 'reject' },
        },
      ],
      pressAction: { id: 'default' },
    },
  });
}
