// TODO: ჩანაცვლდება Firestore-ის notifications collection-ითა და push
// listener-ით. მონაცემები ზუსტად აღებულია დიზაინის რეფერენსის (ზიპის
// App.tsx) CUSTOMER_NOTIFS/PROVIDER_NOTIFS მასივებიდან.
import type { Role } from '../navigation/types';

export type NotificationTarget =
  | { screen: 'CustomerJobDetail'; jobId: string }
  | { screen: 'ProviderJobDetail'; id: string; mode?: 'browse' | 'selected' | 'completed' }
  | { screen: 'ChatConversation'; chatId: string; name: string; initials: string; color: string }
  | { screen: 'ProviderReviews' };

export type NotificationEntry = {
  id: string;
  role: Role;
  iconType: 'avatar' | 'icon';
  iconEmoji?: string;
  iconInitials?: string;
  iconColor: string;
  iconBg: string;
  title: string;
  text: string;
  time: string;
  read: boolean;
  target?: NotificationTarget;
};

export const NOTIFICATIONS: NotificationEntry[] = [
  // Customer
  {
    id: 'cn1',
    role: 'customer',
    iconType: 'avatar',
    iconInitials: 'გბ',
    iconColor: '#fff',
    iconBg: '#2563EB',
    title: 'ახალი ოსტატი დაინტერესდა',
    text: 'გიორგი ბერიძე დაინტერესდა შენს მოთხოვნით — ონკანის შეკეთება',
    time: '5 წ. წინ',
    read: false,
    target: { screen: 'CustomerJobDetail', jobId: 'j2' },
  },
  {
    id: 'cn2',
    role: 'customer',
    iconType: 'icon',
    iconEmoji: '💬',
    iconColor: '#fff',
    iconBg: '#2563EB',
    title: 'ახალი შეტყობინება',
    text: 'გიორგი ბერიძე: კი, დღეს 16:00-ზე შემიძლია მოსვლა.',
    time: '10 წ. წინ',
    read: false,
    target: { screen: 'ChatConversation', chatId: 'p1', name: 'გიორგი ბერიძე', initials: 'გბ', color: '#2563EB' },
  },
  {
    id: 'cn3',
    role: 'customer',
    iconType: 'icon',
    iconEmoji: '✅',
    iconColor: '#fff',
    iconBg: '#059669',
    title: 'მოთხოვნა დადასტურებულია',
    text: 'გიორგი ბერიძე არჩეულია სამუშაოსთვის — ონკანის შეკეთება',
    time: '1 სთ. წინ',
    read: true,
    target: { screen: 'CustomerJobDetail', jobId: 'j1' },
  },
  {
    id: 'cn4',
    role: 'customer',
    iconType: 'icon',
    iconEmoji: '⏰',
    iconColor: '#fff',
    iconBg: '#D97706',
    title: 'სამუშაო დასრულდა?',
    text: 'დაადასტურე შესრულდა თუ არა სამუშაო — ონკანის შეკეთება',
    time: '3 სთ. წინ',
    read: true,
    target: { screen: 'CustomerJobDetail', jobId: 'j1' },
  },
  {
    id: 'cn5',
    role: 'customer',
    iconType: 'icon',
    iconEmoji: '⭐',
    iconColor: '#fff',
    iconBg: '#7C3AED',
    title: 'მოთხოვნა დასრულებულია',
    text: 'ახლა შეგიძლია შეაფასო ოსტატი — დავით ჩიქოვანი',
    time: 'გუშინ',
    read: true,
    target: { screen: 'CustomerJobDetail', jobId: 'j3' },
  },

  // Provider
  {
    id: 'pn1',
    role: 'provider',
    iconType: 'icon',
    iconEmoji: '🔧',
    iconColor: '#fff',
    iconBg: '#7C3AED',
    title: 'ახალი მოთხოვნა შენს რაიონში',
    text: 'სანტექნიკოსი • ვაკე • დღეს',
    time: '3 წ. წინ',
    read: false,
    target: { screen: 'ProviderJobDetail', id: 'f1' },
  },
  {
    id: 'pn2',
    role: 'provider',
    iconType: 'icon',
    iconEmoji: '💬',
    iconColor: '#fff',
    iconBg: '#2563EB',
    title: 'ახალი შეტყობინება',
    text: 'ნინო: შეგიძლიათ დღეს მოსვლა?',
    time: '15 წ. წინ',
    read: false,
    target: { screen: 'ChatConversation', chatId: 'p2', name: 'ნინო კვარაცხელია', initials: 'ნკ', color: '#A855F7' },
  },
  {
    id: 'pn3',
    role: 'provider',
    iconType: 'icon',
    iconEmoji: '🏆',
    iconColor: '#fff',
    iconBg: '#059669',
    title: 'შენ აგირჩიეს სამუშაოსთვის',
    text: 'ონკანიდან წყალი ჟონავს • ვაკე',
    time: '2 სთ. წინ',
    read: false,
    target: { screen: 'ProviderJobDetail', id: 'f1', mode: 'selected' },
  },
  {
    id: 'pn4',
    role: 'provider',
    iconType: 'icon',
    iconEmoji: '🚫',
    iconColor: '#94A3B8',
    iconBg: '#F1F5F9',
    title: 'მოთხოვნა დაიხურა',
    text: 'მომხმარებელმა სხვა ოსტატი აირჩია — ელ. გაყვანილობა',
    time: '4 სთ. წინ',
    read: true,
  },
  {
    id: 'pn5',
    role: 'provider',
    iconType: 'icon',
    iconEmoji: '✅',
    iconColor: '#fff',
    iconBg: '#059669',
    title: 'სამუშაო დასრულებულად დადასტურდა',
    text: 'მომხმარებელმა დაადასტურა სამუშაოს დასრულება',
    time: 'გუშინ',
    read: true,
    target: { screen: 'ProviderJobDetail', id: 'f1', mode: 'completed' },
  },
  {
    id: 'pn6',
    role: 'provider',
    iconType: 'icon',
    iconEmoji: '⭐',
    iconColor: '#fff',
    iconBg: '#D97706',
    title: 'ახალი შეფასება მიიღე',
    text: '★★★★★  5.0 — შესანიშნავი სამუშაო!',
    time: '2 დ. წინ',
    read: true,
    target: { screen: 'ProviderReviews' },
  },
];

export function getUnreadCount(role: Role): number {
  return NOTIFICATIONS.filter((n) => n.role === role && !n.read).length;
}
