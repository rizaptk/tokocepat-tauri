'use client';

import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { logoutAction } from '../_actions/auth';
import { LogOut } from 'lucide-react';

export function LogoutButton() {
    return (
        <form action={logoutAction} className="w-full">
            <button type="submit" className="w-full text-left">
                 <DropdownMenuItem className="w-full cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                </DropdownMenuItem>
            </button>
        </form>
    );
}
