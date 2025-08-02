"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/ui/shadcn-io/dropzone';
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Root as Slider, Track as SliderTrack, Range as SliderRange, Thumb as SliderThumb } from "@radix-ui/react-slider";

const formSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().min(1, "Project description is required"),
  numNfts: z
    .number()
    .min(1, "At least one NFT is required")
    .max(1000, "Maximum 1000 NFTs"),
});

type FormValues = z.infer<typeof formSchema>;

const TRAITS = [
  { category: "hat", options: "Beanie,Fedora,Cap,Viking Helmet,Halo,...,none" },
  { category: "accessories", options: "Sunglasses,Piercing,Chain,...,none" },
  { category: "skin", options: "Human,Alien,Robot,Zombie,...,none" },
  { category: "outfit", options: "Suit,Hoodie,Armor,Astronaut,...,none" },
  { category: "eyes", options: "Normal,Big Eyes,Laser Eyes,...,none" },
  { category: "hair", options: "Short,Buzz Cut,Mohawk,...,none" },
  { category: "expression", options: "Smiling,Winking,Angry,...,none" },
  { category: "prop", options: "Sword,Staff,Wand,...,none" },
  { category: "shoes", options: "Sneakers,Boots,Flip Flops,...,none" },
];

export default function ProjectForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<File[] | undefined>();

  const handleDrop = (droppedFiles: File[]) => {
    setFiles(droppedFiles);
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "Chillhouse Collection",
      description: "A vibrant and absurd collection of 1000 cartoon-style NFT characters...",
      numNfts: 5,
    },
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
        traits: TRAITS.map(trait => ({
          category: trait.category,
          options: trait.options.split(',').map(opt => opt.trim()).filter(Boolean),
        })),
      };
      formData.append('data', JSON.stringify(json));

      if (files && files.length > 0) {
        const file = files[0];
        const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
        const maxSize = 5 * 1024 * 1024;
        if (!allowedTypes.includes(file.type)) {
          throw new Error('Invalid file type. Only PNG, JPEG, or WEBP allowed.');
        }
        if (file.size > maxSize) {
          throw new Error('File size exceeds 5MB limit.');
        }
        formData.append('referenceImage', file);
      }

      const response = await fetch('/api/generate', { method: 'POST', body: formData });
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

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6 text-center">Create New NFT Project</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel>Project Name</FormLabel>
              <FormControl><Input placeholder="My NFT Project" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem>
              <FormLabel>Project Description</FormLabel>
              <FormControl><Textarea placeholder="Describe your NFT collection" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="numNfts" render={({ field }) => (
            <FormItem>
              <FormLabel>Number of NFTs: {field.value}</FormLabel>
              <FormControl>
                <Slider
                  value={[field.value]}
                  max={50}
                  step={5}
                  onValueChange={(value) => field.onChange(value[0])}
                  className="relative flex h-5 w-full touch-none select-none items-center"
                >
                  <SliderTrack className="relative h-[3px] grow rounded-full bg-gray-200">
                    <SliderRange className="absolute h-full rounded-full bg-black" />
                  </SliderTrack>
                  <SliderThumb className="block h-5 w-5 rounded-[10px] bg-gray-600 shadow" aria-label="Number of NFTs" />
                </Slider>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <div>
            <FormLabel className="mb-2">Reference Image (optional)</FormLabel>
            <Dropzone
              accept={{ 'image/*': [] }}
              maxFiles={1}
              maxSize={5 * 1024 * 1024}
              minSize={1}
              onDrop={handleDrop}
              onError={console.error}
              src={files}
            >
              <DropzoneEmptyState />
              <DropzoneContent />
            </Dropzone>
            <p className="text-sm text-gray-500 mt-1">Upload a reference image to guide the style of your NFTs.</p>
          </div>

          {error && <p className="text-red-500 text-center">{error}</p>}
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Creating..." : "Create Project"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
