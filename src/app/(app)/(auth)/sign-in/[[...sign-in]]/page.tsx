import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import SignInForm from '../../_components/SignInForm';

export default async function SignInPage() {
  const { userId } = await auth();
  if (userId) redirect('/dashboard');
  return <SignInForm />;
}
