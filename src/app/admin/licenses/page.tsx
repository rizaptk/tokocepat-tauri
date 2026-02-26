'use client';

import { useState } from 'react';
import {
  MoreHorizontal,
  PlusCircle,
  KeyRound,
  Trash2,
  View,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Mock data for demonstration purposes
const mockLicenses = [
  {
    id: 'lic_1',
    customer: 'user1@example.com',
    key: 'PRO-USER1-XXXX-YYYY',
    plan: 'PRO_YEARLY',
    status: 'active',
    expires: '2025-05-20',
    seats: '1/1',
  },
  {
    id: 'lic_2',
    customer: 'user2@example.com',
    key: 'LTD-USER2-AAAA-BBBB',
    plan: 'LIFETIME',
    status: 'active',
    expires: 'Never',
    seats: '1/1',
  },
  {
    id: 'lic_3',
    customer: 'user3@example.com',
    key: 'PRO-USER3-CCCC-DDDD',
    plan: 'PRO_YEARLY',
    status: 'expired',
    expires: '2024-04-15',
    seats: '0/1',
  },
  {
    id: 'lic_4',
    customer: 'user4@example.com',
    key: 'PRO-USER4-EEEE-FFFF',
    plan: 'PRO_MONTHLY',
    status: 'deactivated',
    expires: '2024-06-10',
    seats: '0/1',
  },
];

const planTypes = [
  { value: 'PRO_MONTHLY', label: 'Pro Monthly' },
  { value: 'PRO_YEARLY', label: 'Pro Yearly' },
  { value: 'LIFETIME', label: 'Lifetime' },
];

export default function AdminLicensesPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  return (
    <>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Licenses</h1>
      </div>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>License Management</CardTitle>
              <CardDescription>
                Manually create, view, and manage customer licenses.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create License
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>License Key</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires On</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockLicenses.map((license) => (
                <TableRow key={license.id}>
                  <TableCell className="font-medium">{license.customer}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {license.key}
                    </Badge>
                  </TableCell>
                  <TableCell>{license.plan}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        license.status === 'active'
                          ? 'default'
                          : license.status === 'expired'
                          ? 'destructive'
                          : 'secondary'
                      }
                      className={license.status === 'active' ? 'bg-green-600' : ''}
                    >
                      {license.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{license.expires}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          aria-haspopup="true"
                          size="icon"
                          variant="ghost"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem>
                          <View className="mr-2 h-4 w-4" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Deactivate
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create License Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New License</DialogTitle>
            <DialogDescription>
              Generate a new license for a customer. The license key will be
              auto-generated.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="customer-email" className="text-right">
                Customer Email
              </Label>
              <Input
                id="customer-email"
                placeholder="customer@example.com"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="plan-type" className="text-right">
                Plan
              </Label>
              <Select>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {planTypes.map((plan) => (
                    <SelectItem key={plan.value} value={plan.value}>
                      {plan.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Generate License</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
