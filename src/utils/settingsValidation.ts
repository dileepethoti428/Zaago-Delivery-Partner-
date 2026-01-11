import { z } from 'zod';

export const profileSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid phone number').optional(),
  vehicle_type: z.enum(['Bike', 'Scooter', 'Cycle', 'Other']).optional(),
  vehicle_number: z.string().max(50).optional(),
  profile_image_url: z.string().url().optional().or(z.literal('')),
});

export const payoutSchema = z.object({
  bank_account_name: z.string().min(2, 'Account holder name is required'),
  bank_account_number: z.string().min(8, 'Account number must be at least 8 digits'),
  ifsc_code: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format'),
  bank_name: z.string().optional(),
  upi_id: z.string().regex(/^[\w.-]+@[\w.-]+$/, 'Invalid UPI ID format').optional().or(z.literal('')),
});

export const kycSchema = z.object({
  aadhar_number_masked: z.string().optional(),
  driving_license_number_masked: z.string().optional(),
});

export const notificationsSchema = z.object({
  notify_new_orders: z.boolean(),
  notify_earnings_updates: z.boolean(),
  notify_promotions: z.boolean(),
});

export const preferencesSchema = z.object({
  is_available: z.boolean(),
  auto_accept_orders: z.boolean(),
  preferred_language: z.string(),
  theme_preference: z.enum(['system', 'light', 'dark']),
});

export type ProfileFormData = z.infer<typeof profileSchema>;
export type PayoutFormData = z.infer<typeof payoutSchema>;
export type KYCFormData = z.infer<typeof kycSchema>;
export type NotificationsFormData = z.infer<typeof notificationsSchema>;
export type PreferencesFormData = z.infer<typeof preferencesSchema>;
