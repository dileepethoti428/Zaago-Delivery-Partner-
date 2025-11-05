import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const signupSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export const documentUploadSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid phone number'),
  dob: z.string().min(1, 'Date of birth is required'),
  emergencyContact: z.string().regex(/^[6-9]\d{9}$/, 'Invalid emergency contact'),
  aadharNumber: z.string().regex(/^\d{12}$/, 'Aadhar must be 12 digits'),
  licenseNumber: z.string().min(5, 'License number is required').max(50),
  licenseExpiry: z.string().min(1, 'License expiry date is required'),
  profilePhoto: z.instanceof(File).refine((file) => file.size <= 5 * 1024 * 1024, 'Max 5MB'),
  aadharFront: z.instanceof(File).refine((file) => file.size <= 5 * 1024 * 1024, 'Max 5MB'),
  aadharBack: z.instanceof(File).refine((file) => file.size <= 5 * 1024 * 1024, 'Max 5MB'),
  licenseFront: z.instanceof(File).refine((file) => file.size <= 5 * 1024 * 1024, 'Max 5MB'),
  licenseBack: z.instanceof(File).refine((file) => file.size <= 5 * 1024 * 1024, 'Max 5MB'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;
export type DocumentUploadFormData = z.infer<typeof documentUploadSchema>;
