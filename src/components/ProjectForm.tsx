'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useRouter } from 'next/navigation';
import { useState, useRef } from 'react';

const formSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().min(1, 'Project description is required'),
  numNfts: z.number().min(1, 'At least one NFT is required').max(1000, 'Maximum 1000 NFTs'),
  traits: z.array(
    z.object({
      category: z.string().min(1, 'Category is required'),
      options: z.string().min(1, 'Options are required'),
    })
  ).min(1, 'At least one trait is required'),
});

type FormValues = z.infer<typeof formSchema>;

export default function ProjectForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [traitKeys, setTraitKeys] = useState<string[]>([Date.now().toString()]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: 'Chillhouse Collection',
      description: 'A vibrant and absurd collection of 1000 cartoon-style NFT characters with dynamic hats, wild accessories, bizarre skins, and eccentric outfits. Perfect for meme lovers and collectors who don’t take life too seriously.',
      numNfts: 5,
      traits: [
        {
          category: 'hat',
          options: 'Beanie,Fedora,Cap,Viking Helmet,Halo,Cowboy Hat,Top Hat,Crown,Bucket Hat,Bere,none'
        },
        {
          category: 'accessories',
          options: 'Sunglasses,Piercing,Chain,Watch,AirPods,Monocle,Backpack,Headphones,Scarf,Cigar,none'
        },
        {
          category: 'skin',
          options: 'Human,Alien,Robot,Zombie,Skeleton,Lava,Ice,Golden,Wood,Stone,none'
        },
        {
          category: 'outfit',
          options: 'Suit,Hoodie,Armor,Astronaut,Samurai,Tracksuit,Pajamas,Chef Coat,Wizard Robe,Biker Jacket,none'
        },
        {
          category: 'background',
          options: 'Bubblegum Swamp,Burning Parliament,Neon Dojo,Cheese Moon,Haunted IKEA,Desert TV Graveyard,Quantum Library,Forbidden Sandbox,God’s Waiting Room,Vaporwave Grid,Glitched Suburb,Nuclear Playground,Froggy Kingdom,Interdimensional Bathroom,Tax Haven Island,Vinyl Jungle,Ramen Volcano,no_background'
        }
      ],
    }
    
  });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      const json = {
        name: values.name,
        description: values.description,
        numNfts: values.numNfts,
        traits: values.traits.map((trait) => ({
          category: trait.category,
          options: trait.options.split(',').map(opt => opt.trim()).filter(opt => opt),
        })),
      };

      formData.append('data', JSON.stringify(json));

      if (fileInputRef.current?.files?.[0]) {
        formData.append('referenceImage', fileInputRef.current.files[0]);
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.statusText}`);
      }

      const { projectId } = await response.json();
      router.push(`/projects/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTrait = () => {
    form.setValue('traits', [...form.getValues('traits'), { category: '', options: '' }]);
    setTraitKeys([...traitKeys, Date.now().toString()]);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Name</FormLabel>
              <FormControl>
                <Input placeholder="My NFT Project" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Describe your NFT collection" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="numNfts"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Number of NFTs</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="Enter number of NFTs (1-1000)"
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {form.getValues('traits').map((_, index) => (
          <div key={traitKeys[index]} className="space-y-4 border p-4 rounded">
            <FormField
              control={form.control}
              name={`traits.${index}.category`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trait Category</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Accessoire" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`traits.${index}.options`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Options (comma-separated)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Lunettes, Chapeau, Écharpe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ))}
        <Button type="button" variant="outline" onClick={addTrait}>
          Add Trait
        </Button>

        <div>
          <FormLabel>Reference Image (optional)</FormLabel>
          <Input type="file" ref={fileInputRef} />
        </div>

        {error && <p className="text-red-500">{error}</p>}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Project'}
        </Button>
      </form>
    </Form>
  );
}
