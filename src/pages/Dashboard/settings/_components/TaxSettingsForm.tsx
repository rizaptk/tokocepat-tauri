
import { useStore } from '@/lib/store';
import { useForm, useFieldArray } from 'react-hook-form';
import { useEffect, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { updateStoreConfig } from '@/services/settingsService';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

import { Loader2, Save, PlusCircle, Trash2, Percent } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

type CategoryOverride = {
  category_id: string;
  tax_rate: number;
};

type TaxSettingsFormValues = {
  default_rate: number;
  product_type_overrides: {
    food_and_beverage?: number;
  };
  category_overrides: CategoryOverride[];
};

export function TaxSettingsForm() {
  const { storeConfig, categories } = useStore();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<TaxSettingsFormValues>({
    defaultValues: {
      default_rate: 0.11,
      product_type_overrides: {
        food_and_beverage: undefined
      },
      category_overrides: []
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'category_overrides'
  });

  useEffect(() => {
    if (storeConfig) {
      form.reset({
        default_rate:
          storeConfig.tax_settings?.default_rate ?? storeConfig.tax_rate,
        product_type_overrides: {
          food_and_beverage:
            storeConfig.tax_settings?.product_type_overrides?.food_and_beverage
        },
        category_overrides:
          storeConfig.tax_settings?.category_overrides || []
      });
    }
  }, [storeConfig, form]);

  const onSubmit = (data: TaxSettingsFormValues) => {
    startTransition(async () => {
      try {
        const updatePayload = {
          tax_settings: data,
          tax_rate: data.default_rate
        };

        await updateStoreConfig(updatePayload);

        toast({
          title: 'Success',
          description: 'Tax settings updated.'
        });
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description:
            error.message || 'Could not update tax settings.'
        });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tax Management</CardTitle>
        <CardDescription>
          Set default and override tax rates. Rates should be decimals
          (e.g., 0.11 for 11%).
        </CardDescription>
      </CardHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-8">

            <FormField
              control={form.control}
              name="default_rate"
              rules={{
                required: "Default tax rate is required",
                min: 0,
                max: 1
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Tax Rate</FormLabel>

                  <FormControl>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value))
                        }
                      />

                      <Percent className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    </div>
                  </FormControl>

                  <FormDescription>
                    Applied to all items unless overridden.
                  </FormDescription>

                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div>
              <h4 className="font-semibold mb-4">Overrides</h4>

              <FormField
                control={form.control}
                name="product_type_overrides.food_and_beverage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Food & Beverage Rate</FormLabel>

                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="e.g. 0.10"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? undefined
                                : parseFloat(e.target.value)
                            )
                          }
                        />

                        <Percent className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      </div>
                    </FormControl>

                    <FormDescription>
                      Overrides default rate for all F&B products.
                    </FormDescription>

                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div>
              <h4 className="font-semibold mb-4">Category Overrides</h4>

              <div className="space-y-4">
                {fields.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-end gap-2 p-3 border rounded-lg bg-muted/50"
                  >
                    <FormField
                      control={form.control}
                      name={`category_overrides.${index}.category_id`}
                      rules={{ required: "Category required" }}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Category</FormLabel>

                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a category" />
                              </SelectTrigger>
                            </FormControl>

                            <SelectContent>
                              {categories.map((cat) => (
                                <SelectItem
                                  key={cat.id}
                                  value={cat.id}
                                >
                                  {cat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`category_overrides.${index}.tax_rate`}
                      rules={{
                        required: "Rate required",
                        min: 0,
                        max: 1
                      }}
                      render={({ field }) => (
                        <FormItem className="w-32">
                          <FormLabel>Rate</FormLabel>

                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(
                                  parseFloat(e.target.value)
                                )
                              }
                            />
                          </FormControl>

                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({
                      category_id: "",
                      tax_rate: 0
                    })
                  }
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Category Override
                </Button>
              </div>
            </div>

            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Tax Settings
                </>
              )}
            </Button>

          </CardContent>
        </form>
      </Form>
    </Card>
  );
}