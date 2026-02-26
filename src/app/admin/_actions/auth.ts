'use server';

import 'server-only';
import { z } from 'zod';
import { createSession, deleteSession } from '@/lib/session';
import { redirect } from 'next/navigation';

const LoginSchema = z.object({
  username: z.string().min(1, "Username is required."),
  password: z.string().min(1, "Password is required."),
});

export type LoginFormState = {
  error?: string;
  success?: boolean;
};

export async function loginAction(prevState: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const validatedFields = LoginSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    return { error: "Both username and password are required." };
  }
  
  const { username, password } = validatedFields.data;

  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    await createSession(username);
  } else {
    return { error: "Invalid username or password." };
  }

  // Redirect to the admin dashboard on successful login
  redirect('/admin');
}

export async function logoutAction() {
    await deleteSession();
    redirect('/admin/login');
}
