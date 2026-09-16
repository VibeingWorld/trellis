import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionUser, hasAdmin, SESSION_COOKIE } from '@/lib/auth';
import LoginForm from './LoginForm';

export default async function LoginPage(){const store=await cookies();if(getSessionUser(store.get(SESSION_COOKIE)?.value))redirect('/');return <LoginForm setupRequired={!hasAdmin()}/>;}
